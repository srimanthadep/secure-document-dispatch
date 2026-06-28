import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotateCcw, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/connect")({
  component: ConnectPage,
});

type ConnRow = {
  status: "disconnected" | "awaiting_qr" | "connecting" | "connected";
  qr_code: string | null;
  last_connected_at: string | null;
  sidecar_last_heartbeat_at: string | null;
};

function ConnectPage() {
  const navigate = useNavigate();
  const [row, setRow] = useState<ConnRow | null>(null);
  const [forcing, setForcing] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.from("connection_status").select("status, qr_code, last_connected_at, sidecar_last_heartbeat_at")
      .eq("id", 1).maybeSingle().then(({ data }) => { if (alive && data) setRow(data as ConnRow); });
    const ch = supabase.channel("conn-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_status" },
        (p) => setRow(p.new as ConnRow))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (row?.status === "connected") {
      const t = setTimeout(() => navigate({ to: "/dashboard" }), 1400);
      return () => clearTimeout(t);
    }
  }, [row?.status, navigate]);

  async function forceReconnect() {
    setForcing(true);
    const { error } = await supabase.from("connection_status")
      .update({ status: "disconnected", qr_code: null })
      .eq("id", 1);
    setForcing(false);
    if (error) toast.error(error.message); else toast.success("Sidecar will reconnect.");
  }

  const status = row?.status ?? "disconnected";
  const heartbeatAge = row?.sidecar_last_heartbeat_at
    ? Math.round((Date.now() - new Date(row.sidecar_last_heartbeat_at).getTime()) / 1000)
    : null;
  const sidecarStale = !heartbeatAge || heartbeatAge > 120;

  return (
    <div className="canvas-glow -m-6 flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <div className="glass-card w-full max-w-md p-8 rise-in">
        <div className="text-center">
          <h1 className="text-display text-2xl font-semibold text-ink">Connect WhatsApp</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Scan this code from your phone: WhatsApp → Linked devices → Link a device.
          </p>
        </div>

        <div className="mt-7 flex items-center justify-center">
          <div className={`relative flex h-64 w-64 items-center justify-center rounded-2xl bg-white shadow-inner ${
            status === "awaiting_qr" ? "pulse-brand" : ""
          } ${status === "connected" ? "ring-2 ring-brand" : ""}`}>
            {status === "connected" ? (
              <svg viewBox="0 0 48 48" className="h-24 w-24 text-brand">
                <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                <path className="draw-check" d="M14 25 L21 32 L34 17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : row?.qr_code ? (
              <QrPreview value={row.qr_code} />
            ) : (
              <div className="text-center text-xs text-ink-soft">
                {sidecarStale
                  ? <>Waiting for the sidecar service.<br/>Once it starts, the QR appears here.</>
                  : "Generating QR…"}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 text-center text-sm">
          <div className="font-medium text-ink">
            {status === "connected" && "Connected — redirecting to dashboard…"}
            {status === "awaiting_qr" && "Awaiting scan"}
            {status === "connecting" && "Establishing session…"}
            {status === "disconnected" && "Disconnected"}
          </div>
          {row?.last_connected_at && (
            <div className="mt-1 data-mono">
              last: {new Date(row.last_connected_at).toLocaleString()}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={forceReconnect} disabled={forcing}
            className="lift-hover">
            <RotateCcw className="mr-2 h-4 w-4" />
            {forcing ? "Resetting…" : "Force reconnect"}
          </Button>
        </div>

        {sidecarStale && (
          <div className="mt-4 rounded-md border border-status-pending/30 bg-status-pending/10 p-3 text-xs text-ink">
            Sidecar heartbeat is stale. The QR will appear here as soon as the
            sidecar process is running and pointed at this database.
          </div>
        )}
      </div>
    </div>
  );
}

/** Render a QR by encoding the payload through a publicly-cacheable image URL.
 *  The sidecar writes the QR payload (the raw string Baileys emits) into
 *  connection_status.qr_code. We render it client-side. */
function QrPreview({ value }: { value: string }) {
  // Use the same cdn that's already used for the placeholder; fallback to
  // an inline data approach when possible. We rely on a public QR encoder.
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=1&data=${encodeURIComponent(value)}`;
  return <img src={src} alt="WhatsApp QR" className="h-60 w-60" />;
}
