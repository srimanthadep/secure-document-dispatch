import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { saveEmudhraCreds, getEmudhraCredsPreview } from "@/lib/emudhra.functions";

export const Route = createFileRoute("/_authenticated/settings/security")({
  component: SecurityPage,
});

type Settings = {
  password_rule: "last4_phone" | "fixed" | "custom_per_document";
  password_fixed_value: string | null;
  lock_pdfs_enabled: boolean;
  emudhra_enabled: boolean;
};

function SecurityPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [preview, setPreview] = useState<{ apiKeyMasked: string | null; apiSecretMasked: string | null; lastRotatedAt: string | null }>({ apiKeyMasked: null, apiSecretMasked: null, lastRotatedAt: null });
  const [keyInput, setKeyInput] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [busy, setBusy] = useState(false);
  const saveCreds = useServerFn(saveEmudhraCreds);
  const fetchPreview = useServerFn(getEmudhraCredsPreview);

  useEffect(() => {
    supabase.from("settings").select("password_rule,password_fixed_value,lock_pdfs_enabled,emudhra_enabled")
      .eq("id", 1).maybeSingle().then(({ data }) => data && setS(data as Settings));
    fetchPreview().then(setPreview).catch(() => {});
  }, [fetchPreview]);

  async function updateSetting(patch: Partial<Settings>) {
    setS((cur) => cur ? { ...cur, ...patch } : cur);
    const { error } = await supabase.from("settings").update(patch).eq("id", 1);
    if (error) toast.error(error.message);
  }

  async function onSaveCreds() {
    if (!keyInput || !secretInput) { toast.error("Both fields are required."); return; }
    setBusy(true);
    try {
      await saveCreds({ data: { apiKey: keyInput, apiSecret: secretInput } });
      setKeyInput(""); setSecretInput("");
      const p = await fetchPreview();
      setPreview(p);
      toast.success("eMudhra credentials saved.");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  const rotationDays = preview.lastRotatedAt
    ? Math.floor((Date.now() - new Date(preview.lastRotatedAt).getTime()) / 86400000)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 rise-in">
      <div>
        <h1 className="text-display text-2xl font-semibold">Security</h1>
        <p className="text-sm text-ink-soft">PDF locking, eMudhra credentials, and account hardening.</p>
      </div>

      <section className="surface-card p-6">
        <h2 className="text-display font-semibold">PDF password protection</h2>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Lock PDFs before sending</div>
            <div className="text-xs text-ink-soft">When enabled, recipients must enter a password to open the document.</div>
          </div>
          <Switch checked={s?.lock_pdfs_enabled ?? false} onCheckedChange={(v) => updateSetting({ lock_pdfs_enabled: v })} />
        </div>

        {s?.lock_pdfs_enabled && (
          <div className="mt-4 space-y-3 border-t border-hairline pt-4">
            <div>
              <Label>Password rule</Label>
              <Select value={s.password_rule} onValueChange={(v) => updateSetting({ password_rule: v as Settings["password_rule"] })}>
                <SelectTrigger className="mt-1"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="last4_phone">Last 4 digits of customer's phone</SelectItem>
                  <SelectItem value="fixed">Fixed password</SelectItem>
                  <SelectItem value="custom_per_document">Custom per document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {s.password_rule === "fixed" && (
              <div>
                <Label htmlFor="fixed">Fixed password</Label>
                <Input id="fixed" value={s.password_fixed_value ?? ""} onChange={(e) => updateSetting({ password_fixed_value: e.target.value })} className="mt-1" />
              </div>
            )}
          </div>
        )}
      </section>

      <section className="surface-card p-6">
        <h2 className="text-display flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4"/>eMudhra DSC connection</h2>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">eMudhra enabled</div>
            <div className="text-xs text-ink-soft">When off, the sidecar skips DSC signing entirely.</div>
          </div>
          <Switch checked={s?.emudhra_enabled ?? false} onCheckedChange={(v) => updateSetting({ emudhra_enabled: v })} />
        </div>

        {s?.emudhra_enabled && (
          <div className="mt-4 space-y-4 border-t border-hairline pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Current API Key</Label>
                <div className="data-mono mt-1 rounded-md border border-hairline bg-surface-2 px-3 py-2">
                  {preview.apiKeyMasked ?? "(not set)"}
                </div>
              </div>
              <div>
                <Label>Current API Secret</Label>
                <div className="data-mono mt-1 rounded-md border border-hairline bg-surface-2 px-3 py-2">
                  {preview.apiSecretMasked ?? "(not set)"}
                </div>
              </div>
            </div>
            {preview.lastRotatedAt && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-soft">Key last rotated:</span>
                <span className="data-mono">{new Date(preview.lastRotatedAt).toLocaleDateString()}</span>
                {rotationDays !== null && rotationDays > 180 && (
                  <span className="status-badge border-status-pending/30 bg-status-pending/10 text-status-pending">
                    <AlertCircle className="h-3 w-3"/> {rotationDays}d — rotate soon
                  </span>
                )}
              </div>
            )}
            <div className="border-t border-hairline pt-4">
              <div className="text-sm font-medium">Rotate / set credentials</div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input placeholder="New API key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
                <Input placeholder="New API secret" type="password" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} />
              </div>
              <Button className="mt-3 lift-hover" onClick={onSaveCreds} disabled={busy}>
                {busy ? "Saving…" : "Save credentials"}
              </Button>
              <p className="mt-2 text-xs text-ink-soft">Secrets are written through a server function. They are never readable from the browser.</p>
            </div>
          </div>
        )}
      </section>

      <section className="surface-card p-6">
        <h2 className="text-display flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4"/>Multi-factor authentication</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Enable TOTP MFA on your login from the Cloud dashboard → Authentication → Sign-in methods. This protects the only account that has access to this workspace.
        </p>
      </section>
    </div>
  );
}
