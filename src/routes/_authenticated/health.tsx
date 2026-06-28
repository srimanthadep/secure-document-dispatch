import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/health")({
  component: HealthPage,
});

function HealthPage() {
  const [conn, setConn] = useState<{ sidecar_last_heartbeat_at: string | null } | null>(null);
  const [health, setHealth] = useState<{ emudhra_circuit_state: string; emudhra_consecutive_failures: number; emudhra_last_failure_at: string | null; queue_depth: number; updated_at: string } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [{ data: c }, { data: h }] = await Promise.all([
        supabase.from("connection_status").select("sidecar_last_heartbeat_at").eq("id", 1).maybeSingle(),
        supabase.from("system_health").select("emudhra_circuit_state,emudhra_consecutive_failures,emudhra_last_failure_at,queue_depth,updated_at").eq("id", 1).maybeSingle(),
      ]);
      if (c) setConn(c); if (h) setHealth(h);
    };
    load();
    const ch = supabase.channel("health")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_health" }, (p) => setHealth(p.new as typeof health))
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_status" }, (p) => setConn(p.new as typeof conn))
      .subscribe();
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => { supabase.removeChannel(ch); clearInterval(id); };
  }, []);

  const heartbeatAge = conn?.sidecar_last_heartbeat_at
    ? Math.round((Date.now() - new Date(conn.sidecar_last_heartbeat_at).getTime()) / 1000)
    : null;
  const sidecarStale = !heartbeatAge || heartbeatAge > 120;

  // touch tick so eslint is happy
  void tick;

  const circuitColor = health?.emudhra_circuit_state === "open" ? "text-status-failed"
    : health?.emudhra_circuit_state === "half_open" ? "text-status-pending" : "text-status-success";

  return (
    <div className="mx-auto max-w-3xl space-y-6 rise-in">
      <div>
        <h1 className="text-display text-2xl font-semibold">System health</h1>
        <p className="text-sm text-ink-soft">Live infrastructure state — refreshes via Realtime.</p>
      </div>

      {sidecarStale && (
        <div className="rounded-md border border-status-failed/40 bg-status-failed/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-status-failed">
            <AlertTriangle className="h-4 w-4"/> Sidecar heartbeat stale
          </div>
          <p className="mt-1 text-ink">
            The sidecar has not reported in over 2 minutes. The outbox is not being processed.
            Check the sidecar process and that it has access to the database service role.
          </p>
        </div>
      )}

      <section className="surface-card p-6">
        <h2 className="text-display flex items-center gap-2 font-semibold"><Activity className="h-4 w-4"/>Sidecar</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Last heartbeat</dt><dd className="data-mono mt-0.5">{conn?.sidecar_last_heartbeat_at ? new Date(conn.sidecar_last_heartbeat_at).toLocaleString() : "never"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Age</dt><dd className={`data-mono mt-0.5 ${sidecarStale ? "text-status-failed" : "text-status-success"}`}>{heartbeatAge != null ? `${heartbeatAge}s` : "—"}</dd></div>
        </dl>
      </section>

      <section className="surface-card p-6">
        <h2 className="text-display font-semibold">eMudhra circuit breaker</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">State</dt><dd className={`text-display mt-0.5 font-semibold capitalize ${circuitColor}`}>{health?.emudhra_circuit_state ?? "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Consecutive failures</dt><dd className="data-mono mt-0.5">{health?.emudhra_consecutive_failures ?? 0}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Last failure</dt><dd className="data-mono mt-0.5">{health?.emudhra_last_failure_at ? new Date(health.emudhra_last_failure_at).toLocaleString() : "—"}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-ink-soft">Queue depth</dt><dd className="data-mono mt-0.5">{health?.queue_depth ?? 0}</dd></div>
        </dl>
      </section>
    </div>
  );
}
