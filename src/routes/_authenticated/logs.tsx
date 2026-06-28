import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/logs")({
  component: LogsPage,
});

type Out = { id: string; source: string; customer_name: string | null; customer_phone: string; status: string; signed_pdf_hash: string | null; created_at: string; sent_at: string | null };

function LogsPage() {
  const [rows, setRows] = useState<Out[]>([]);
  const [source, setSource] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [selected, setSelected] = useState<Out | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [source, status, from, to]);

  async function load() {
    let q = supabase.from("outbox")
      .select("id,source,customer_name,customer_phone,status,signed_pdf_hash,created_at,sent_at")
      .order("created_at", { ascending: false }).limit(200);
    if (source !== "all") q = q.eq("source", source);
    if (status !== "all") q = q.eq("status", status);
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) q = q.lte("created_at", new Date(to + "T23:59:59").toISOString());
    const { data } = await q;
    if (data) setRows(data as Out[]);
  }

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-display text-2xl font-semibold">Logs</h1>
        <p className="text-sm text-ink-soft">All outbox activity. Click any row for the audit trail.</p>
      </div>

      <div className="surface-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
        <div>
          <Label>Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="manual">manual</SelectItem>
              <SelectItem value="smartcare">smartcare</SelectItem>
              <SelectItem value="hosting_crm">hosting_crm</SelectItem>
              <SelectItem value="smartschool">smartschool</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
            <SelectContent>
              {["all","queued","signing","encrypting","sending","sent","delivered","read","failed"].map((s) =>
                <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>From</Label><Input type="date" className="mt-1" value={from} onChange={(e) => setFrom(e.target.value)}/></div>
        <div><Label>To</Label><Input type="date" className="mt-1" value={to} onChange={(e) => setTo(e.target.value)}/></div>
      </div>

      <div className="surface-card">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th className="px-5 py-3 text-left">ID</th>
              <th className="text-left">Source</th>
              <th className="text-left">Customer</th>
              <th className="text-left">Phone</th>
              <th className="text-left">Status</th>
              <th className="text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-10 text-center text-ink-soft">No matching rows.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} onClick={() => setSelected(r)} className="cursor-pointer border-t border-hairline transition-colors hover:bg-brand/5">
                <td className="data-mono px-5 py-2.5">{r.id.slice(0, 8)}…</td>
                <td className="data-mono">{r.source}</td>
                <td>{r.customer_name ?? "—"}</td>
                <td className="data-mono">{r.customer_phone}</td>
                <td><StatusBadge status={r.status}/></td>
                <td className="data-mono">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <AuditModal row={selected} onClose={() => setSelected(null)}/>}
    </div>
  );
}

function AuditModal({ row, onClose }: { row: Out; onClose: () => void }) {
  const [events, setEvents] = useState<{ id: string; event: string; detail: unknown; created_at: string }[]>([]);
  useEffect(() => {
    supabase.from("audit_log").select("id,event,detail,created_at").eq("outbox_id", row.id)
      .order("created_at", { ascending: true }).then(({ data }) => data && setEvents(data));
  }, [row.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="surface-card max-h-[80vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-display text-lg font-semibold">Audit trail</h2>
        <div className="data-mono mt-1">{row.id}</div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Source</dt><dd className="data-mono">{row.source}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Status</dt><dd><StatusBadge status={row.status}/></dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Phone</dt><dd className="data-mono">{row.customer_phone}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Signed hash</dt><dd className="data-mono break-all text-xs">{row.signed_pdf_hash ?? "—"}</dd></div>
        </dl>

        <h3 className="text-display mt-6 text-sm font-semibold">Events</h3>
        {events.length === 0 ? (
          <div className="mt-2 text-sm text-ink-soft">No audit events yet.</div>
        ) : (
          <ol className="mt-3 space-y-2">
            {events.map((e) => (
              <li key={e.id} className="rounded-md border border-hairline bg-surface-2 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{e.event}</span>
                  <span className="data-mono">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {e.detail !== null && (
                  <pre className="data-mono mt-1 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify(e.detail, null, 2)}</pre>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
