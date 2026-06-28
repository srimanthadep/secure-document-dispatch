import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";
import { ShieldCheck, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/verify")({
  component: VerifyPage,
});

type Row = {
  id: string; customer_name: string | null; customer_phone: string;
  status: string; sent_at: string | null; delivered_at: string | null; read_at: string | null;
  signed_pdf_hash: string | null; timestamp_token: string | null; created_at: string;
};

function VerifyPage() {
  const [q, setQ] = useState("");
  const [row, setRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setBusy(true); setNotFound(false); setRow(null);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
    const query = supabase.from("outbox")
      .select("id,customer_name,customer_phone,status,sent_at,delivered_at,read_at,signed_pdf_hash,timestamp_token,created_at");
    const { data } = isUuid
      ? await query.eq("id", term).maybeSingle()
      : await query.eq("signed_pdf_hash", term).maybeSingle();
    setBusy(false);
    if (data) setRow(data as Row); else setNotFound(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 rise-in">
      <div>
        <h1 className="text-display text-2xl font-semibold">Verify</h1>
        <p className="text-sm text-ink-soft">Paste an outbox ID or a signed-PDF SHA-256 hash.</p>
      </div>

      <div className="surface-card p-5">
        <Label>Lookup</Label>
        <div className="mt-1 flex gap-2">
          <Input placeholder="UUID or hash" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()} className="font-mono text-sm"/>
          <Button onClick={search} disabled={busy}><Search className="mr-1 h-4 w-4"/>Search</Button>
        </div>
      </div>

      {notFound && (
        <div className="surface-card border-status-failed/30 p-5 text-sm text-status-failed">
          No matching document found.
        </div>
      )}

      {row && (
        <div className="surface-card p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className={`h-6 w-6 ${row.signed_pdf_hash ? "text-brand" : "text-ink-soft"}`}/>
            <div className="flex-1">
              <div className="text-display font-semibold">{row.customer_name ?? "—"}</div>
              <div className="data-mono">{row.customer_phone}</div>
            </div>
            <StatusBadge status={row.status} />
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Detail label="Document ID" value={row.id} mono />
            <Detail label="Created" value={new Date(row.created_at).toLocaleString()} mono />
            <Detail label="Sent at" value={row.sent_at ? new Date(row.sent_at).toLocaleString() : "—"} mono />
            <Detail label="Delivered at" value={row.delivered_at ? new Date(row.delivered_at).toLocaleString() : "—"} mono />
            <Detail label="Read at" value={row.read_at ? new Date(row.read_at).toLocaleString() : "—"} mono />
            <Detail label="Signed PDF SHA-256" value={row.signed_pdf_hash ?? "— (not signed yet)"} mono break />
            <Detail label="Timestamp token" value={row.timestamp_token ? "Present (RFC 3161)" : "—"} />
            <Detail label="Signature status" value={row.signed_pdf_hash ? "Signed" : "Unsigned"} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, mono, break: br }: { label: string; value: string; mono?: boolean; break?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "data-mono" : "text-sm"} ${br ? "break-all" : ""}`}>{value}</dd>
    </div>
  );
}
