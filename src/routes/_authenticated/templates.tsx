import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

type Tpl = {
  id: string; name: string; version: number;
  template_type: "static_pdf" | "merge_fields";
  file_url: string; fields_schema: { fields?: string[] } | null; active: boolean; created_at: string;
};

function TemplatesPage() {
  const [rows, setRows] = useState<Tpl[]>([]);
  const [editing, setEditing] = useState<Tpl | "new" | null>(null);

  async function load() {
    const { data } = await supabase.from("templates")
      .select("*").order("name").order("version", { ascending: false });
    if (data) setRows(data as Tpl[]);
  }
  useEffect(() => { load(); }, []);

  // Group by name to show only the latest active version primarily
  const grouped = rows.reduce<Record<string, Tpl[]>>((acc, r) => {
    (acc[r.name] ??= []).push(r); return acc;
  }, {});

  return (
    <div className="space-y-6 rise-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-semibold">Templates</h1>
          <p className="text-sm text-ink-soft">Editing creates a new version. Old versions stay queryable in /logs.</p>
        </div>
        <Button className="lift-hover" onClick={() => setEditing("new")}><Plus className="mr-1 h-4 w-4"/>New template</Button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-ink-soft">
          <FileText className="mx-auto mb-2 h-5 w-5 opacity-50"/>No templates yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(grouped).map(([name, versions]) => {
            const latest = versions[0];
            return (
              <div key={name} className="surface-card lift-hover p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-display font-semibold">{name}</div>
                    <div className="data-mono mt-0.5">v{latest.version} · {latest.template_type}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(latest)}>Edit</Button>
                </div>
                {latest.fields_schema?.fields && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {latest.fields_schema.fields.map((f) => (
                      <span key={f} className="data-mono rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-xs">{f}</span>
                    ))}
                  </div>
                )}
                <div className="data-mono mt-3 text-xs">{versions.length} version{versions.length === 1 ? "" : "s"}</div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TemplateEditor template={editing === "new" ? null : editing} onClose={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function TemplateEditor({ template, onClose }: { template: Tpl | null; onClose: () => void }) {
  const [name, setName] = useState(template?.name ?? "");
  const [type, setType] = useState<"static_pdf" | "merge_fields">(template?.template_type ?? "static_pdf");
  const [fieldsText, setFieldsText] = useState((template?.fields_schema?.fields ?? []).join(", "));
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState(template?.file_url ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      let url = fileUrl;
      if (file) {
        const path = `${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
        const { error: upErr } = await supabase.storage.from("templates").upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        url = path;
      }
      if (!url) { toast.error("Upload a PDF or keep the existing one"); setBusy(false); return; }

      const fields = type === "merge_fields"
        ? fieldsText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const fields_schema = type === "merge_fields" ? { fields } : null;

      // Always create a new version row. Mark prior versions of the same name inactive.
      const nextVersion = template ? template.version + 1 : 1;
      if (template) {
        await supabase.from("templates").update({ active: false }).eq("name", name).eq("active", true);
      }
      const { error } = await supabase.from("templates").insert({
        name: name.trim(), version: nextVersion, template_type: type,
        file_url: url, fields_schema, active: true,
      });
      if (error) throw new Error(error.message);
      toast.success(`Saved as v${nextVersion}`);
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="surface-card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-display text-lg font-semibold">{template ? `Edit ${template.name}` : "New template"}</h2>
        <p className="text-xs text-ink-soft">{template ? `Saving creates v${template.version + 1}.` : "Will be saved as v1."}</p>
        <div className="mt-4 space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" disabled={!!template}/>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="static_pdf">Static PDF</SelectItem>
                <SelectItem value="merge_fields">Merge-field template</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type === "merge_fields" && (
            <div>
              <Label>Field names (comma-separated)</Label>
              <Textarea value={fieldsText} onChange={(e) => setFieldsText(e.target.value)} rows={3} className="mt-1 font-mono text-xs"
                placeholder="customer_name, amount, due_date"/>
            </div>
          )}
          <div>
            <Label>PDF file{template ? " (re-upload to replace)" : ""}</Label>
            <input type="file" accept="application/pdf" className="mt-1 block text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)}/>
            {fileUrl && !file && <div className="data-mono mt-1 text-xs">Existing: {fileUrl}</div>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="lift-hover">{busy ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}
