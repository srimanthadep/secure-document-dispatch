type Props = { status: string };

const MAP: Record<string, { label: string; cls: string }> = {
  queued:     { label: "Queued",     cls: "border-hairline text-ink-soft bg-surface-2" },
  signing:    { label: "Signing",    cls: "border-status-pending/30 text-status-pending bg-status-pending/10" },
  encrypting: { label: "Encrypting", cls: "border-status-pending/30 text-status-pending bg-status-pending/10" },
  sending:    { label: "Sending",    cls: "border-status-pending/30 text-status-pending bg-status-pending/10" },
  sent:       { label: "Sent",       cls: "border-brand/30 text-brand-deep bg-brand/10" },
  delivered:  { label: "Delivered",  cls: "border-status-delivered/30 text-status-delivered bg-status-delivered/10" },
  read:       { label: "Read",       cls: "border-status-delivered/40 text-status-delivered bg-status-delivered/15" },
  failed:     { label: "Failed",     cls: "border-status-failed/30 text-status-failed bg-status-failed/10" },
};

export function StatusBadge({ status }: Props) {
  const m = MAP[status] ?? { label: status, cls: "border-hairline text-ink-soft bg-surface-2" };
  return (
    <span className={`status-badge ${m.cls}`}>
      <span className="status-dot" />
      {m.label}
    </span>
  );
}
