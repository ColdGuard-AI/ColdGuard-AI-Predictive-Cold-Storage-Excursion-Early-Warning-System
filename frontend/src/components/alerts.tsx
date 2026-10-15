import { BellRing, Check, CheckCircle2, CircleDot, Lightbulb, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../hooks/AppContext";
import { fmtDateTime, fmtTime, toneForSeverity, TONE_TEXT } from "../lib/format";
import { api } from "../services/api";
import type { Alert } from "../types/api";
import { Badge, Button } from "./ui";

export function SeverityBadge({ severity }: { severity: Alert["severity"] }) {
  return (
    <Badge tone={toneForSeverity(severity)} dot>
      {severity[0].toUpperCase() + severity.slice(1)}
    </Badge>
  );
}

export function useAcknowledge(onDone?: (a: Alert) => void) {
  const { notify, refreshZones } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  const acknowledge = async (alert: Alert) => {
    setPending(alert.id);
    try {
      const updated = await api.acknowledge(alert.id);
      notify("success", `Alert ${alert.id} acknowledged.`);
      onDone?.(updated);
      void refreshZones();
    } catch (err) {
      notify("error", `Could not acknowledge alert: ${err instanceof Error ? err.message : err}`);
    } finally {
      setPending(null);
    }
  };
  return { acknowledge, pending };
}

export function AlertRow({ alert, zoneName, onOpen, onAck, ackPending }: {
  alert: Alert;
  zoneName?: string;
  onOpen: (a: Alert) => void;
  onAck: (a: Alert) => void;
  ackPending: boolean;
}) {
  const tone = toneForSeverity(alert.severity);
  return (
    <li className={`group rounded-lg border bg-ink-900/60 transition-colors hover:border-neon/25 ${alert.active && alert.severity === "critical" ? "border-crit/30" : "border-white/[0.06]"}`}>
      <div className="flex items-start gap-3 p-3">
        <span className={`mt-0.5 ${TONE_TEXT[tone]}`} aria-hidden>
          {alert.active ? <BellRing size={16} /> : <CircleDot size={16} />}
        </span>
        <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(alert)} aria-label={`Open alert ${alert.title}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-fg">{alert.category_label}</span>
            <SeverityBadge severity={alert.severity} />
            {!alert.active && <Badge>Resolved</Badge>}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{alert.explanation}</p>
          <p className="mt-1 font-mono text-[11px] text-fg-faint">
            {fmtDateTime(alert.created_at)}
            {zoneName ? ` · ${zoneName}` : ""} · {alert.id}
          </p>
        </button>
        <div className="shrink-0">
          {alert.acknowledged ? (
            <span className="flex items-center gap-1 text-[11px] text-fg-faint" title={`Acknowledged by ${alert.acknowledged_by ?? "operator"}`}>
              <CheckCircle2 size={13} className="text-neon/70" /> Ack'd
            </span>
          ) : (
            <Button size="sm" onClick={() => onAck(alert)} loading={ackPending} aria-label={`Acknowledge alert ${alert.id}`}>
              <Check size={13} /> Ack
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function AlertDetail({ alert, zoneName, onClose, onAck, ackPending }: {
  alert: Alert;
  zoneName?: string;
  onClose: () => void;
  onAck: (a: Alert) => void;
  ackPending: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ctxEntries = Object.entries(alert.context ?? {}).filter(([, v]) => v !== null && typeof v !== "object");
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="alert-detail-title">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-neon/15 bg-ink-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-fg-faint">{alert.id}</p>
            <h2 id="alert-detail-title" className="mt-1 text-lg font-semibold text-fg">{alert.category_label}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <SeverityBadge severity={alert.severity} />
              <Badge tone={alert.active ? "crit" : "neutral"}>{alert.active ? "Condition active" : "Resolved"}</Badge>
              <Badge tone={alert.acknowledged ? "ok" : "warn"}>{alert.acknowledged ? "Acknowledged" : "Unacknowledged"}</Badge>
            </div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close alert details" className="rounded p-1 text-fg-muted hover:text-fg">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-[11px] uppercase tracking-wider text-fg-faint">Zone</dt><dd className="text-fg">{zoneName ?? alert.zone_id}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wider text-fg-faint">Raised</dt><dd className="font-mono text-fg">{fmtDateTime(alert.created_at)}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wider text-fg-faint">Last seen</dt><dd className="font-mono text-fg">{fmtTime(alert.last_seen_at)}</dd></div>
          <div><dt className="text-[11px] uppercase tracking-wider text-fg-faint">Occurrences</dt><dd className="font-mono text-fg">{alert.occurrences}</dd></div>
        </dl>

        <section className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Explanation</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-fg">{alert.explanation}</p>
        </section>

        <section className="mt-4 rounded-lg border border-neon/20 bg-neon/[0.05] p-3">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neon">
            <Lightbulb size={13} /> Recommended action
          </h3>
          <p className="mt-1.5 text-sm text-fg">{alert.recommended_action}</p>
        </section>

        {ctxEntries.length > 0 && (
          <section className="mt-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Data behind this alert</h3>
            <dl className="mt-1.5 space-y-1 text-xs">
              {ctxEntries.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-fg-muted">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-mono text-fg">{typeof v === "number" ? Number(v.toFixed(2)) : String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <p className="mt-4 text-[11px] text-fg-faint">Generated from simulated sensor data. Verify on site before acting.</p>

        <div className="mt-auto pt-6">
          {alert.acknowledged ? (
            <p className="text-xs text-fg-muted">
              Acknowledged by {alert.acknowledged_by ?? "operator"} at {fmtTime(alert.acknowledged_at)} (sim clock).
            </p>
          ) : (
            <Button variant="primary" className="w-full" onClick={() => onAck(alert)} loading={ackPending}>
              <Check size={15} /> Acknowledge alert
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
