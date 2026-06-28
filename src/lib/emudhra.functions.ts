import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function mask(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}

export const getEmudhraCredsPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("emudhra_credentials")
      .select("api_key, api_secret, last_rotated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      apiKeyMasked: mask(data?.api_key ?? null),
      apiSecretMasked: mask(data?.api_secret ?? null),
      lastRotatedAt: data?.last_rotated_at ?? null,
    };
  });

export const saveEmudhraCreds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { apiKey: string; apiSecret: string }) => {
    if (!d?.apiKey || !d?.apiSecret) throw new Error("apiKey and apiSecret are required");
    return d;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("emudhra_credentials")
      .upsert({ id: 1, api_key: data.apiKey, api_secret: data.apiSecret, last_rotated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
