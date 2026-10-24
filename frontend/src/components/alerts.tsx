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
    <li className={`group rounded-2xl border bg-white transition-all shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] ${
      alert.active && alert.severity === "critical" ? "border-red-300 ring-1 ring-red-200" : "border-[#DCE8F6]"
    }`}>
      <div className="flex items-start gap-3.5 p-4">
        <span className={`mt-0.5 ${TONE_TEXT[tone]}`} aria-hidden>
          {alert.active ? <BellRing size={18} /> : <CircleDot size={18} />}
        </span>
        <button className="min-w-0 flex-1 text-left cursor-pointer" onClick={() => onOpen(alert)} aria-label={`Open alert ${alert.title}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-base font-bold text-[#0F172A]">{alert.category_label}</span>
            <SeverityBadge severity={alert.severity} />
            {!alert.active && <Badge>Resolved</Badge>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-[#475569]">{alert.explanation}</p>
          <p className="mt-1.5 font-mono text-xs text-slate-400">
            {fmtDateTime(alert.created_at)}
            {zoneName ? ` · ${zoneName}` : ""} · {alert.id}
          </p>
        </button>
        <div className="shrink-0">
          {alert.acknowledged ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full" title={`Acknowledged by ${alert.acknowledged_by ?? "operator"}`}>
              <CheckCircle2 size={14} className="text-emerald-600" /> Ack'd
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => onAck(alert)} loading={ackPending} aria-label={`Acknowledge alert ${alert.id}`}>
              <Check size={14} /> Ack
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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-[#DCE8F6] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#DCE8F6]">
          <div>
            <p className="font-mono text-xs font-bold text-slate-400">{alert.id}</p>
            <h2 id="alert-detail-title" className="mt-1 text-xl font-extrabold text-[#0F172A]">{alert.category_label}</h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <SeverityBadge severity={alert.severity} />
              <Badge tone={alert.active ? "crit" : "neutral"}>{alert.active ? "Active Excursion" : "Resolved"}</Badge>
              <Badge tone={alert.acknowledged ? "ok" : "warn"}>{alert.acknowledged ? "Acknowledged" : "Action Required"}</Badge>
            </div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close alert details" className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-[#0F172A] hover:bg-slate-50 transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-[#DCE8F6]">
          <div><dt className="text-xs font-bold uppercase tracking-wider text-[#475569]">Cold Room</dt><dd className="font-bold text-[#0F172A] mt-0.5">{zoneName ?? alert.zone_id}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-[#475569]">Raised At</dt><dd className="font-mono font-bold text-[#0F172A] mt-0.5">{fmtDateTime(alert.created_at)}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-[#475569]">Last Telemetry</dt><dd className="font-mono font-bold text-[#0F172A] mt-0.5">{fmtTime(alert.last_seen_at)}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-wider text-[#475569]">Occurrences</dt><dd className="font-mono font-bold text-[#0F172A] mt-0.5">{alert.occurrences}</dd></div>
        </dl>

        <section className="mt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">Diagnostic Explanation</h3>
          <p className="mt-2 text-base leading-relaxed text-[#0F172A]">{alert.explanation}</p>
        </section>

        <section className="mt-5 rounded-2xl border-2 border-sky-200 bg-[#EFF6FF] p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2563EB]">
            <Lightbulb size={16} /> Standard Operating Procedure (SOP) Action
          </h3>
          <p className="mt-2 text-sm sm:text-base font-semibold text-[#0F172A] leading-relaxed">{alert.recommended_action}</p>
        </section>

        {ctxEntries.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">Telemetry Attributes</h3>
            <dl className="mt-2 space-y-1.5 text-sm bg-slate-50 p-4 rounded-xl border border-[#DCE8F6]">
              {ctxEntries.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-[#475569] font-medium">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-mono font-bold text-[#0F172A]">{typeof v === "number" ? Number(v.toFixed(2)) : String(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <div className="mt-auto pt-6 border-t border-[#DCE8F6]">
          {alert.acknowledged ? (
            <p className="text-sm font-medium text-[#475569]">
              Acknowledged by <strong className="text-[#0F172A]">{alert.acknowledged_by ?? "operator"}</strong> at {fmtTime(alert.acknowledged_at)}.
            </p>
          ) : (
            <Button variant="primary" className="w-full py-3" onClick={() => onAck(alert)} loading={ackPending}>
              <Check size={18} /> Acknowledge Alert & Log SOP Action
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
