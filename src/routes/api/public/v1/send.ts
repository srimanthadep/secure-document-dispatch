import { createFileRoute } from "@tanstack/react-router";

/* /api/public/v1/send
 * External callers (your other internal apps) POST signed-document requests here.
 * Auth: `x-api-key` header, hashed with sha256 and compared against api_keys.key_hash.
 * Idempotency: `idempotency_key` is UNIQUE in the DB — retries collapse to the same row.
 */
export const Route = createFileRoute("/api/public/v1/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        return handleSend(request);
      },
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: corsHeaders(),
      }),
    },
  },
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-api-key",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Body = {
  customer_name?: string;
  customer_phone?: string;
  template_id?: string;
  merge_data?: Record<string, unknown>;
  raw_pdf_url?: string;
  password_protected?: boolean;
  idempotency_key?: string;
};

function validate(body: unknown): Body | string {
  if (!body || typeof body !== "object") return "body must be a JSON object";
  const b = body as Body;
  if (!b.customer_phone || typeof b.customer_phone !== "string") return "customer_phone is required";
  if (!b.idempotency_key || typeof b.idempotency_key !== "string") return "idempotency_key is required";
  if (!b.template_id && !b.raw_pdf_url) return "either template_id or raw_pdf_url is required";
  if (b.customer_phone.length > 24) return "customer_phone too long";
  if (b.idempotency_key.length > 120) return "idempotency_key too long";
  return b;
}

async function handleSend(request: Request): Promise<Response> {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) return json({ error: "missing x-api-key header" }, 401);

  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "invalid JSON body" }, 400); }

  const parsed = validate(body);
  if (typeof parsed === "string") return json({ error: parsed }, 400);

  const keyHash = await sha256Hex(apiKey);

  // Service-role module is loaded inside the handler (never at module scope of a route file).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: key, error: keyErr } = await supabaseAdmin
    .from("api_keys")
    .select("id, label, revoked_at, total_documents_sent")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (keyErr) return json({ error: "internal error" }, 500);
  if (!key) return json({ error: "invalid api key" }, 401);
  if (key.revoked_at) return json({ error: "api key has been revoked" }, 401);

  // Idempotency: if a row already exists for this key, return it.
  const { data: existing } = await supabaseAdmin
    .from("outbox").select("id, status")
    .eq("idempotency_key", parsed.idempotency_key!)
    .maybeSingle();
  if (existing) {
    return json({ id: existing.id, status: existing.status, idempotent: true });
  }

  // Look up template version if a template_id was given.
  let templateVersion: number | null = null;
  if (parsed.template_id) {
    const { data: tpl } = await supabaseAdmin.from("templates").select("version").eq("id", parsed.template_id).maybeSingle();
    templateVersion = tpl?.version ?? null;
  }

  const { data: row, error: insErr } = await supabaseAdmin.from("outbox").insert({
    source: key.label,
    api_key_id: key.id,
    idempotency_key: parsed.idempotency_key!,
    customer_name: parsed.customer_name ?? null,
    customer_phone: parsed.customer_phone!,
    template_id: parsed.template_id ?? null,
    template_version: templateVersion,
    merge_data: (parsed.merge_data ?? null) as never,
    raw_pdf_url: parsed.raw_pdf_url ?? null,
    password_protected: !!parsed.password_protected,
    status: "queued",
  }).select("id, status").single();

  if (insErr) {
    // Likely duplicate idempotency_key (race) — re-read.
    if (insErr.code === "23505") {
      const { data: dup } = await supabaseAdmin.from("outbox").select("id, status").eq("idempotency_key", parsed.idempotency_key!).maybeSingle();
      if (dup) return json({ id: dup.id, status: dup.status, idempotent: true });
    }
    return json({ error: "failed to enqueue", detail: insErr.message }, 500);
  }

  // Bump usage counters (fire-and-forget; we don't fail the request on this).
  await supabaseAdmin.from("api_keys").update({
    last_used_at: new Date().toISOString(),
    total_documents_sent: (key.total_documents_sent ?? 0) + 1,
  }).eq("id", key.id);

  await supabaseAdmin.from("audit_log").insert({
    outbox_id: row.id, event: "enqueued_via_api", detail: { source: key.label },
  });

  return json({ id: row.id, status: row.status }, 202);
}
