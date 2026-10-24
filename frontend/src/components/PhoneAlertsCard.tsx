import { BellRing, CheckCircle2, Copy, Send, Smartphone, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type PhoneAlertStatus } from "../services/api";

/** Shows which manager phones receive instant alerts and lets the manager send a test push. */
export default function PhoneAlertsCard() {
  const [status, setStatus] = useState<PhoneAlertStatus | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.phoneAlertStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const sendTest = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await api.phoneAlertTest();
      const delivered = res.recipients.filter((r) => r.delivered).length;
      setResult(
        res.recipients.length === 0
          ? { ok: false, text: "No storage manager has a phone number on file." }
          : delivered === res.recipients.length
            ? { ok: true, text: `Test alert sent to ${delivered} phone${delivered > 1 ? "s" : ""}.` }
            : { ok: false, text: res.error || "Some phones could not be reached." },
      );
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "Could not send test alert." });
    } finally {
      setSending(false);
    }
  };

  const copy = (topic: string) => {
    navigator.clipboard?.writeText(topic).catch(() => {});
    setCopied(topic);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!status) return null;

  return (
    <div className="rounded-2xl border border-[#BAE6FD] bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
            <BellRing size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#0F172A]">
              Instant Phone Alerts{" "}
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {status.enabled ? "ON" : "OFF"}
              </span>
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              New {status.severities.join(" & ")} alerts, including digital-twin scenarios, pop up on the manager's phone within seconds.
            </p>
          </div>
        </div>
        <button
          onClick={sendTest}
          disabled={sending || !status.enabled}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          <Send size={14} /> {sending ? "Sending…" : "Send test alert"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {status.recipients.map((r) => (
          <div key={r.topic} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Smartphone size={15} className="text-[#2563EB] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#0F172A] truncate">{r.name} · {r.phone}</div>
                <div className="text-[11px] text-[#475569] font-mono truncate">ntfy topic: {r.topic}</div>
              </div>
            </div>
            <button onClick={() => copy(r.topic)} className="text-[#475569] hover:text-[#2563EB]" title="Copy topic">
              {copied === r.topic ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={15} />}
            </button>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-[#64748B]">
        One-time phone setup: install the free <b>ntfy</b> app (Play Store / App Store) → tap <b>+</b> → subscribe to the topic above.
      </p>

      {result && (
        <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${result.ok ? "text-emerald-700" : "text-red-600"}`}>
          {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {result.text}
        </div>
      )}
    </div>
  );
}
