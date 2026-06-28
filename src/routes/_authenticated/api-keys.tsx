import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createApiKey, revokeApiKey } from "@/lib/api-keys.functions";
import { Copy, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/api-keys")({
  component: ApiKeysPage,
});

type Row = { id: string; label: string; created_at: string; last_used_at: string | null; total_documents_sent: number; revoked_at: string | null };

function ApiKeysPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<{ label: string; raw: string } | null>(null);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);

  async function load() {
    const { data } = await supabase.from("api_keys")
      .select("id,label,created_at,last_used_at,total_documents_sent,revoked_at")
      .order("created_at", { ascending: false });
    if (data) setRows(data as Row[]);
  }
  useEffect(() => { load(); }, []);

  async function onCreate() {
    if (!label.trim()) return;
    try {
      const r = await create({ data: { label: label.trim() } });
      setRevealed({ label: r.label, raw: r.raw });
      setLabel("");
      load();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function onRevoke(id: string) {
    if (!confirm("Revoke this key? Apps using it will start getting 401.")) return;
    try { await revoke({ data: { id } }); load(); toast.success("Revoked."); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-display text-2xl font-semibold">API Keys</h1>
        <p className="text-sm text-ink-soft">Issue one key per consumer app (SmartCare, hosting CRM, SmartSchool…). The label becomes the <code className="data-mono">source</code> on every outbox row sent with that key.</p>
      </div>

      <div className="surface-card p-5">
        <div className="flex gap-2">
          <Input placeholder="Label, e.g. smartcare" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button onClick={onCreate} className="lift-hover">Create key</Button>
        </div>
      </div>

      {revealed && (
        <div className="surface-card border-brand/40 bg-brand/5 p-5">
          <div className="text-sm font-medium text-ink">Copy this key now — it will not be shown again.</div>
          <div className="text-xs text-ink-soft">Label: {revealed.label}</div>
          <div className="mt-3 flex items-center gap-2">
            <code className="data-mono flex-1 break-all rounded-md border border-hairline bg-surface px-3 py-2">{revealed.raw}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(revealed.raw); toast.success("Copied"); }}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setRevealed(null)}>Dismiss</Button>
        </div>
      )}

      <div className="surface-card">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-soft">
            <tr><th className="px-5 py-3 text-left">Label</th><th className="text-left">Created</th><th className="text-left">Last used</th><th className="text-left">Docs sent</th><th className="text-left">Status</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-ink-soft"><KeyRound className="mx-auto mb-2 h-5 w-5 opacity-50"/>No keys yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-hairline">
                <td className="px-5 py-3">{r.label}</td>
                <td className="data-mono">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="data-mono">{r.last_used_at ? new Date(r.last_used_at).toLocaleString() : "—"}</td>
                <td className="data-mono">{r.total_documents_sent}</td>
                <td>{r.revoked_at
                  ? <span className="status-badge border-status-failed/30 bg-status-failed/10 text-status-failed">Revoked</span>
                  : <span className="status-badge border-brand/30 bg-brand/10 text-brand-deep">Active</span>}</td>
                <td className="pr-5 text-right">
                  {!r.revoked_at && <Button size="sm" variant="ghost" onClick={() => onRevoke(r.id)}>Revoke</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="surface-card bg-surface-2 p-5 text-sm">
        <div className="font-medium">How to use</div>
        <pre className="data-mono mt-3 overflow-x-auto rounded-md border border-hairline bg-surface p-3 text-xs leading-relaxed">{`POST /api/public/v1/send
x-api-key: <your key>
content-type: application/json

{
  "customer_name": "Acme Co",
  "customer_phone": "+9198XXXXXXXX",
  "template_id": "uuid (optional)",
  "merge_data": { "amount": "12000", "due_date": "2026-07-15" },
  "raw_pdf_url": "https://… (optional, if no template)",
  "password_protected": true,
  "idempotency_key": "your-unique-id-per-document"
}`}</pre>
      </div>
    </div>
  );
}
