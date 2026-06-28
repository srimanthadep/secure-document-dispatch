import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  QrCode, LayoutDashboard, Send, FileText, ShieldCheck,
  ScrollText, KeyRound, Activity, Settings, LogOut,
} from "lucide-react";

const NAV = [
  { to: "/connect", label: "Connect", icon: QrCode },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/send", label: "Send", icon: Send },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/verify", label: "Verify", icon: ShieldCheck },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/api-keys", label: "API Keys", icon: KeyRound },
  { to: "/health", label: "Health", icon: Activity },
  { to: "/settings/security", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [status, setStatus] = useState<string>("…");

  useEffect(() => {
    let alive = true;
    supabase.from("connection_status").select("status").eq("id", 1).maybeSingle()
      .then(({ data }) => { if (alive && data) setStatus(data.status); });
    const ch = supabase.channel("conn-pill")
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_status" },
        (p) => { const r = p.new as { status?: string } | null; if (r?.status) setStatus(r.status); })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-surface md:flex">
          <div className="flex h-16 items-center gap-2 px-5 border-b border-hairline">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-deep text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="text-display text-sm font-semibold">Signing Hub</div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {NAV.map((item) => {
              const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    active ? "bg-surface-2 text-ink font-medium" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                  }`}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button onClick={signOut}
            className="m-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-surface-2 hover:text-ink">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-hairline bg-canvas/80 px-6 backdrop-blur">
            <div className="text-sm text-ink-soft">
              {NAV.find((n) => pathname.startsWith(n.to))?.label ?? "Dashboard"}
            </div>
            <ConnectionPill status={status} />
          </header>
          <div className="flex-1 p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ConnectionPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    connected:    { label: "Connected",    color: "text-status-success" },
    awaiting_qr:  { label: "Awaiting QR",  color: "text-status-pending" },
    connecting:   { label: "Connecting",   color: "text-status-pending" },
    disconnected: { label: "Disconnected", color: "text-status-failed" },
  };
  const s = map[status] ?? { label: status, color: "text-ink-soft" };
  return (
    <Link to="/connect" className="status-badge border-hairline bg-surface">
      <span className={`status-dot ${s.color}`} />
      <span className={s.color}>{s.label}</span>
    </Link>
  );
}
