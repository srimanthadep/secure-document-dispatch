import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [conn, setConn] = useState<{ status: string; last_connected_at: string | null; sidecar_last_heartbeat_at: string | null } | null>(null);
  const [health, setHealth] = useState<{ emudhra_circuit_state: string; emudhra_consecutive_failures: number; queue_depth: number } | null>(null);
  const [counts, setCounts] = useState({ sent: 0, delivered: 0, read: 0, failed: 0 });
  const [recent, setRecent] = useState<RecentRow[]>([]);

  useEffect(() => {
    let alive = true;

    const loadAll = async () => {
      const [{ data: c }, { data: h }] = await Promise.all([
        supabase.from("connection_status").select("status,last_connected_at,sidecar_last_heartbeat_at").eq("id", 1).maybeSingle(),
        supabase.from("system_health").select("emudhra_circuit_state,emudhra_consecutive_failures,queue_depth").eq("id", 1).maybeSingle(),
      ]);
      if (!alive) return;
      if (c) setConn(c);
      if (h) setHealth(h);

      const since = new Date(); since.setHours(0, 0, 0, 0);
      const { data: today } = await supabase.from("outbox")
        .select("status").gte("created_at", since.toISOString());
      if (today && alive) {
        const c = { sent: 0, delivered: 0, read: 0, failed: 0 };
        for (const r of today) {
          if (r.status === "sent") c.sent++;
          else if (r.status === "delivered") c.delivered++;
          else if (r.status === "read") c.read++;
          else if (r.status === "failed") c.failed++;
        }
        setCounts(c);
      }

      const { data: r } = await supabase.from("outbox")
        .select("id,customer_name,customer_phone,status,source,created_at")
        .order("created_at", { ascending: false }).limit(10);
      if (r && alive) setRecent(r as RecentRow[]);
    };

    loadAll();

    const ch = supabase.channel("dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_status" },
        (p) => setConn(p.new as typeof conn))
      .on("postgres_changes", { event: "*", schema: "public", table: "system_health" },
        (p) => setHealth(p.new as typeof health))
      .on("postgres_changes", { event: "*", schema: "public", table: "outbox" },
        () => loadAll())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  const heartbeatAge = conn?.sidecar_last_heartbeat_at
    ? Math.round((Date.now() - new Date(conn.sidecar_last_heartbeat_at).getTime()) / 1000)
    : null;
  const sidecarStale = !heartbeatAge || heartbeatAge > 120;

  return (
    <div className="space-y-6 rise-in">
      <div>
        <h1 className="text-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-ink-soft">Live state of the signing pipeline.</p>
      </div>

      {sidecarStale && (
        <div className="rounded-md border border-status-failed/40 bg-status-failed/10 p-3 text-sm text-ink">
          <span className="font-medium text-status-failed">Sidecar heartbeat stale</span>
          {" — "}the always-on service is not reporting. Outbox processing is paused.
        </div>
      )}

      <div className="canvas-glow rounded-2xl p-1">
        <div className="glass-strip grid grid-cols-1 gap-4 p-5 sm:grid-cols-4">
          <SummaryCell label="Connection" value={conn?.status ?? "—"} sub={conn?.last_connected_at ? new Date(conn.last_connected_at).toLocaleString() : "never"} />
          <SummaryCell label="eMudhra" value={health?.emudhra_circuit_state ?? "—"} sub={`${health?.emudhra_consecutive_failures ?? 0} consecutive failures`} />
          <SummaryCell label="Sidecar" value={sidecarStale ? "stale" : "fresh"} sub={heartbeatAge != null ? `${heartbeatAge}s ago` : "never"} />
          <SummaryCell label="Queue depth" value={String(health?.queue_depth ?? 0)} sub="pending in outbox" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Counter label="Sent today" n={counts.sent} />
        <Counter label="Delivered" n={counts.delivered} tone="delivered" />
        <Counter label="Read" n={counts.read} tone="success" />
        <Counter label="Failed" n={counts.failed} tone="failed" />
      </div>

      <div className="surface-card">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <h2 className="text-display text-sm font-semibold">Recent activity</h2>
          <Link to="/logs" className="text-xs text-brand-deep hover:underline">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-soft">
            No documents sent yet. Use <Link to="/send" className="underline">Send</Link> or wire your other apps to the public API.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-soft">
              <tr><th className="px-5 py-2 text-left">Customer</th><th className="text-left">Phone</th><th className="text-left">Source</th><th className="text-left">Status</th><th className="text-left">When</th></tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-hairline transition-colors hover:bg-brand/5">
                  <td className="px-5 py-2.5">{r.customer_name ?? "—"}</td>
                  <td><span className="data-mono">{r.customer_phone}</span></td>
                  <td className="data-mono">{r.source}</td>
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

type RecentRow = { id: string; customer_name: string | null; customer_phone: string; status: string; source: string; created_at: string };

function SummaryCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="cursor-spot rounded-lg p-3"
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        (e.currentTarget as HTMLDivElement).style.setProperty("--mx", `${e.clientX - r.left}px`);
        (e.currentTarget as HTMLDivElement).style.setProperty("--my", `${e.clientY - r.top}px`);
      }}>
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-1 text-display text-lg font-semibold capitalize text-ink">{value}</div>
      <div className="data-mono mt-0.5">{sub}</div>
    </div>
  );
}

function Counter({ label, n, tone }: { label: string; n: number; tone?: "delivered" | "success" | "failed" }) {
  const color = tone === "delivered" ? "text-status-delivered"
    : tone === "success" ? "text-status-success"
    : tone === "failed" ? "text-status-failed" : "text-ink";
  return (
    <div className="surface-card lift-hover p-5">
      <div className="text-xs uppercase tracking-wide text-ink-soft">{label}</div>
      <div className={`text-display mt-1 text-3xl font-semibold ${color}`}>{n}</div>
    </div>
  );
}
