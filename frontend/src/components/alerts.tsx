import { AlertTriangle, BellRing, Check, CheckCircle2, CircleDot, Clock, Database, Lightbulb, MapPin, RotateCcw, ShieldAlert, X } from "lucide-react";
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
  const isTamper = alert.category === "data_tampering";
  const ctx = alert.context || {};

  return (
    <li className={`group rounded-2xl border bg-white transition-all shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] ${
      isTamper
        ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-300"
        : alert.active && alert.severity === "critical"
        ? "border-red-300 ring-1 ring-red-200"
        : "border-[#DCE8F6]"
    }`}>
      <div className="flex items-start gap-3.5 p-4">
        <span className={`mt-0.5 ${isTamper ? "text-rose-600 animate-pulse" : TONE_TEXT[tone]}`} aria-hidden>
          {isTamper ? <ShieldAlert size={20} /> : alert.active ? <BellRing size={18} /> : <CircleDot size={18} />}
        </span>
        <button className="min-w-0 flex-1 text-left cursor-pointer" onClick={() => onOpen(alert)} aria-label={`Open alert ${alert.title}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-base font-bold text-[#0F172A]">{alert.category_label}</span>
            <SeverityBadge severity={alert.severity} />
            {isTamper && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                <AlertTriangle size={11} /> Cryptographic Tamper
              </span>
            )}
            {!alert.active && <Badge tone="ok">Resolved</Badge>}
          </div>

          <p className="mt-1 line-clamp-2 text-sm text-[#475569]">{alert.explanation}</p>

          {/* Tamper Highlights: Which data tampered, from where, timestamp */}
          {isTamper && (
            <div className="mt-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-mono grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-1.5 text-rose-900 truncate">
                <Database size={13} className="text-rose-600 shrink-0" />
                <span>
                  <strong className="text-rose-950">Data:</strong> {String(ctx.tampered_data || `${ctx.tampered_field || "value"}: ${ctx.original_value} → ${ctx.tampered_value}`)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-900 truncate">
                <MapPin size={13} className="text-rose-600 shrink-0" />
                <span>
                  <strong className="text-rose-950">From:</strong> {String(ctx.tampered_from || zoneName || alert.zone_id)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-rose-900 truncate">
                <Clock size={13} className="text-rose-600 shrink-0" />
                <span>
                  <strong className="text-rose-950">Timestamp:</strong> {String(ctx.telemetry_timestamp || alert.created_at)}
                </span>
              </div>
            </div>
          )}

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
            <Button size="sm" variant={isTamper ? "primary" : "secondary"} onClick={() => onAck(alert)} loading={ackPending} aria-label={`Acknowledge alert ${alert.id}`}>
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
  const { notify } = useApp();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isTamper = alert.category === "data_tampering";
  const ctx = alert.context || {};
  const ctxEntries = Object.entries(ctx).filter(([, v]) => v !== null && typeof v !== "object");

  const handleRestoreTamper = async () => {
    setIsRestoring(true);
    try {
      const readingId = typeof ctx.reading_id === "number" ? ctx.reading_id : undefined;
      const res = await api.restoreTamper(readingId);
      notify("success", res.message || "Tampered reading successfully restored to verified baseline.");
      onClose();
    } catch (err: any) {
      notify("error", "Failed to restore tampered reading: " + (err.message || String(err)));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="alert-detail-title">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-[#DCE8F6] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#DCE8F6]">
          <div>
            <p className="font-mono text-xs font-bold text-slate-400">{alert.id}</p>
            <h2 id="alert-detail-title" className="mt-1 text-xl font-extrabold text-[#0F172A] flex items-center gap-2">
              {isTamper && <ShieldAlert size={22} className="text-rose-600 animate-pulse" />}
              <span>{alert.category_label}</span>
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <SeverityBadge severity={alert.severity} />
              <Badge tone={alert.active ? "crit" : "neutral"}>{alert.active ? (isTamper ? "Active Tamper Alert" : "Active Excursion") : "Resolved"}</Badge>
              <Badge tone={alert.acknowledged ? "ok" : "warn"}>{alert.acknowledged ? "Acknowledged" : "Action Required"}</Badge>
            </div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close alert details" className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-[#0F172A] hover:bg-slate-50 transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Dedicated Cryptographic Tamper Alert Inspection Box */}
        {isTamper && (
          <section className="mt-5 rounded-2xl border-2 border-rose-300 bg-rose-50/50 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-rose-200">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-rose-600" /> Tamper Forensic Analysis
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-200 text-rose-900">
                SHA-256 Hash Mismatch
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              {/* 1. Which Data Was Tampered */}
              <div className="p-2.5 rounded-xl bg-white border border-rose-200">
                <div className="text-[10px] font-bold uppercase text-[#475569] flex items-center gap-1">
                  <Database size={11} className="text-rose-600" /> Which Data Was Tampered:
                </div>
                <div className="mt-1 text-sm font-bold text-rose-950 flex flex-wrap items-center gap-2">
                  <span>{String(ctx.tampered_data || `${ctx.tampered_field || "value"}: ${ctx.original_value} → ${ctx.tampered_value}`)}</span>
                  {ctx.delta && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800">
                      {String(ctx.delta)}
                    </span>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-slate-100 text-[#475569]">
                  <div>Original: <strong className="text-emerald-700">{String(ctx.original_value ?? "Authentic Seal")}</strong></div>
                  <div>Altered: <strong className="text-rose-700">{String(ctx.tampered_value ?? "Manipulated")}</strong></div>
                </div>
              </div>

              {/* 2. From Where (Location / Origin) */}
              <div className="p-2.5 rounded-xl bg-white border border-rose-200">
                <div className="text-[10px] font-bold uppercase text-[#475569] flex items-center gap-1">
                  <MapPin size={11} className="text-rose-600" /> Tampered From (Source / Location):
                </div>
                <div className="mt-1 text-xs font-bold text-[#0F172A]">
                  {String(ctx.tampered_from || `${zoneName || alert.zone_id} · Sensor ${ctx.device_id || "TS-01"}`)}
                </div>
                <div className="mt-0.5 text-[11px] text-[#475569]">
                  Source Record: <span className="font-semibold text-slate-700">{String(ctx.source_location || `Storage (Zone ${alert.zone_id})`)}</span>
                </div>
              </div>

              {/* 3. Timestamps */}
              <div className="p-2.5 rounded-xl bg-white border border-rose-200">
                <div className="text-[10px] font-bold uppercase text-[#475569] flex items-center gap-1">
                  <Clock size={11} className="text-rose-600" /> Timestamps:
                </div>
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#475569]">Telemetry Data Time:</span>
                    <div className="font-bold text-[#0F172A] mt-0.5">{String(ctx.telemetry_timestamp || alert.created_at)}</div>
                  </div>
                  <div>
                    <span className="text-[#475569]">Tamper Detected At:</span>
                    <div className="font-bold text-rose-700 mt-0.5">{String(ctx.detected_at || alert.last_seen_at)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Restore Baseline Action */}
            {alert.active && (
              <div className="pt-2">
                <button
                  onClick={handleRestoreTamper}
                  disabled={isRestoring}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                  title="Revert this database reading to its original cryptographically signed value"
                >
                  <RotateCcw size={14} className={isRestoring ? "animate-spin" : ""} />
                  <span>{isRestoring ? "Restoring Baseline..." : "Restore Tampered Record to Verified Baseline"}</span>
                </button>
              </div>
            )}
          </section>
        )}

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

        {ctxEntries.length > 0 && !isTamper && (
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
