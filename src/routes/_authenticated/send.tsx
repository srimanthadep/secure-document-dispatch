import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/send")({
  component: SendPage,
});

type Tpl = { id: string; name: string; version: number; template_type: string; fields_schema: { fields?: string[] } | null };
type OutRow = { id: string; customer_phone: string; customer_name: string | null; status: string; created_at: string };

function SendPage() {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [recent, setRecent] = useState<OutRow[]>([]);

  useEffect(() => {
    supabase.from("templates").select("id,name,version,template_type,fields_schema").eq("active", true)
      .order("name").then(({ data }) => data && setTemplates(data as Tpl[]));
    loadRecent();
    const ch = supabase.channel("send-recent")
      .on("postgres_changes", { event: "*", schema: "public", table: "outbox" }, () => loadRecent())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function loadRecent() {
    const { data } = await supabase.from("outbox")
      .select("id,customer_phone,customer_name,status,created_at")
      .order("created_at", { ascending: false }).limit(20);
    if (data) setRecent(data as OutRow[]);
  }

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-display text-2xl font-semibold">Send</h1>
        <p className="text-sm text-ink-soft">Queue a document. The sidecar picks it up, signs, encrypts (if enabled), and delivers.</p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single send</TabsTrigger>
          <TabsTrigger value="bulk">Bulk send (CSV)</TabsTrigger>
        </TabsList>
        <TabsContent value="single" className="mt-4">
          <SingleSend templates={templates} onQueued={loadRecent} />
        </TabsContent>
        <TabsContent value="bulk" className="mt-4">
          <BulkSend templates={templates} onQueued={loadRecent} />
        </TabsContent>
      </Tabs>

      <div className="surface-card">
        <div className="border-b border-hairline px-5 py-3 text-display text-sm font-semibold">Recent queue</div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-soft">Nothing queued yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-soft">
              <tr><th className="px-5 py-2 text-left">Customer</th><th className="text-left">Phone</th><th className="text-left">Status</th><th className="text-left">Created</th></tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-hairline transition-colors hover:bg-brand/5">
                  <td className="px-5 py-2">{r.customer_name ?? "—"}</td>
                  <td><span className="data-mono">{r.customer_phone}</span></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="data-mono">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SingleSend({ templates, onQueued }: { templates: Tpl[]; onQueued: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tplId, setTplId] = useState<string>("");
  const [mergeText, setMergeText] = useState("{}");
  const [rawUrl, setRawUrl] = useState("");
  const [passwordOverride, setPasswordOverride] = useState("");
  const [busy, setBusy] = useState(false);

  const tpl = templates.find((t) => t.id === tplId);

  async function submit() {
    if (!phone.trim()) { toast.error("Phone required"); return; }
    let merge: unknown = null;
    if (tpl?.template_type === "merge_fields") {
      try { merge = JSON.parse(mergeText); } catch { toast.error("merge_data is not valid JSON"); return; }
    }
    setBusy(true);
    const { error } = await supabase.from("outbox").insert({
      source: "manual",
      idempotency_key: `manual-${crypto.randomUUID()}`,
      customer_name: name || null,
      customer_phone: phone.trim(),
      template_id: tplId || null,
      template_version: tpl?.version ?? null,
      merge_data: merge as never,
      raw_pdf_url: rawUrl || null,
      password_protected: !!passwordOverride || undefined,
      password_override: passwordOverride || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Queued");
    setName(""); setPhone(""); setTplId(""); setMergeText("{}"); setRawUrl(""); setPasswordOverride("");
    onQueued();
  }

  return (
    <div className="surface-card p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Customer name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Optional" />
        </div>
        <div>
          <Label>Phone (E.164)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+9198XXXXXXXX" />
        </div>
        <div className="sm:col-span-2">
          <Label>Template</Label>
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a template or use raw PDF below"/></SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name} v{t.version} · {t.template_type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tpl?.template_type === "merge_fields" && (
          <div className="sm:col-span-2">
            <Label>Merge data (JSON)</Label>
            <Textarea value={mergeText} onChange={(e) => setMergeText(e.target.value)} className="mt-1 font-mono text-xs" rows={5}
              placeholder='{"customer_name":"Acme","amount":"12000"}'/>
            {tpl.fields_schema?.fields && (
              <div className="data-mono mt-1 text-xs">Fields: {tpl.fields_schema.fields.join(", ")}</div>
            )}
          </div>
        )}
        {!tplId && (
          <div className="sm:col-span-2">
            <Label>Raw PDF URL</Label>
            <Input value={rawUrl} onChange={(e) => setRawUrl(e.target.value)} className="mt-1" placeholder="https://…" />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Password override (optional)</Label>
          <Input value={passwordOverride} onChange={(e) => setPasswordOverride(e.target.value)} className="mt-1" placeholder="Leave blank to use global rule" />
        </div>
      </div>
      <Button onClick={submit} disabled={busy} className="mt-5 lift-hover">{busy ? "Queueing…" : "Queue document"}</Button>
    </div>
  );
}

function BulkSend({ templates, onQueued }: { templates: Tpl[]; onQueued: () => void }) {
  const [tplId, setTplId] = useState<string>("");
  const [csv, setCsv] = useState<string>("");
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [busy, setBusy] = useState(false);
  const tpl = templates.find((t) => t.id === tplId);

  function parseCsv(text: string): Record<string, string>[] {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((s) => s.trim());
    return lines.slice(1).map((line) => {
      const cols = line.split(",");
      const r: Record<string, string> = {};
      headers.forEach((h, i) => { r[h] = (cols[i] ?? "").trim(); });
      return r;
    });
  }

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => { const text = String(reader.result); setCsv(text); setPreview(parseCsv(text)); };
    reader.readAsText(file);
  }

  async function submit() {
    if (!tplId) { toast.error("Pick a template"); return; }
    if (preview.length === 0) { toast.error("CSV is empty"); return; }
    setBusy(true);
    const rows = preview.map((p) => {
      const { customer_phone, customer_name, password_override, ...merge } = p;
      return {
        source: "manual",
        idempotency_key: `bulk-${crypto.randomUUID()}`,
        customer_phone,
        customer_name: customer_name || null,
        template_id: tplId,
        template_version: tpl?.version ?? null,
        merge_data: merge,
        password_override: password_override || null,
        password_protected: !!password_override || undefined,
      };
    }).filter((r) => r.customer_phone);
    const { error } = await supabase.from("outbox").insert(rows);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Queued ${rows.length} rows`);
    setCsv(""); setPreview([]);
    onQueued();
  }

  return (
    <div className="surface-card p-6">
      <div className="space-y-4">
        <div>
          <Label>Template</Label>
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a merge-field template"/></SelectTrigger>
            <SelectContent>
              {templates.filter((t) => t.template_type === "merge_fields").map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name} v{t.version}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tpl?.fields_schema?.fields && (
            <div className="data-mono mt-1 text-xs">
              CSV must include columns: customer_phone, customer_name, {tpl.fields_schema.fields.join(", ")}
            </div>
          )}
        </div>
        <div>
          <Label>CSV file</Label>
          <input type="file" accept=".csv,text/csv" className="mt-1 block text-sm" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
        {preview.length > 0 && (
          <div>
            <div className="text-xs text-ink-soft">{preview.length} rows parsed. First 5:</div>
            <div className="mt-2 overflow-x-auto rounded-md border border-hairline">
              <table className="w-full text-xs">
                <thead className="bg-surface-2">
                  <tr>{Object.keys(preview[0]).map((h) => <th key={h} className="px-3 py-1.5 text-left font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-hairline">
                      {Object.keys(preview[0]).map((h) => <td key={h} className="data-mono px-3 py-1.5">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <Button onClick={submit} disabled={busy || preview.length === 0} className="lift-hover">
          {busy ? "Queueing…" : `Queue ${preview.length || ""} rows`}
        </Button>
      </div>
    </div>
  );
}
