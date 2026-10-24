import { Bot, FlaskConical, Languages, Loader2, Mic, MicOff, RotateCcw, Send, Sparkles, Square, User, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../hooks/AppContext";
import { api, type AssistantEngine, type AssistantStatus, type AssistantTurn, type WhatIfChart } from "../services/api";
import { LANGUAGE_OPTIONS, UI, scenarioLabel, zoneLabel } from "../lib/assistantI18n";
import { LOCALES, Speaker, micSupported, startListening, type VoiceLang } from "../lib/voice";

/** Facility-operator "What-If" assistant: ask by text or voice (English, Hindi, Marathi), get a digital-twin projection back, read aloud. */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  charts?: WhatIfChart[];
  mode?: AssistantEngine;
  model?: string | null;
  notice?: string | null;
  error?: boolean;
  lang?: VoiceLang;
}

const STORAGE_KEY = "coldguard.whatif.chat.v3";

function engineLabel(mode: AssistantEngine | undefined, model: string | null | undefined, builtIn: string) {
  if (mode === "ollama") return `Ollama${model ? ` · ${model}` : ""}`;
  if (mode === "gemini") return `Gemini${model ? ` · ${model}` : ""}`;
  return builtIn;
}
const ZONE_OPTIONS = [
  { id: "zone-a", name: "Vaccine Store A" },
  { id: "zone-b", name: "Dairy Chiller B" },
  { id: "zone-c", name: "Frozen Store C" },
];

function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
  } catch {
    /* storage unavailable: chat simply isn't remembered */
  }
}

// ---------------------------------------------------------------- tiny, safe Markdown renderer
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={k++} className="font-semibold text-[#0F172A]">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={k++} className="rounded bg-slate-100 px-1 text-[12px]">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={`${list.ordered ? "list-decimal" : "list-disc"} ml-5 space-y-1`}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = !!numbered;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) blocks.push(<h3 key={blocks.length} className="text-[13px] font-bold text-[#0F172A] pt-1">{inline(heading[1])}</h3>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 text-[13px] leading-relaxed text-[#334155]">{blocks}</div>;
}

// ---------------------------------------------------------------- projection chart
function fmtMin(m: number | null, t: typeof UI.en) {
  if (m === null || m === undefined) return t.notReached;
  return m < 90 ? `${Math.round(m)} ${t.min}` : `${Math.round((m / 60) * 10) / 10} ${t.hours}`;
}

function ScenarioChart({ chart, lang }: { chart: WhatIfChart; lang: VoiceLang }) {
  const t = UI[lang];
  const { limits, metrics } = chart;
  const breached = metrics.time_to_limit_minutes !== null;
  const color = metrics.inventory_at_risk_usd > 0 ? "#DC2626" : breached ? "#EA580C" : "#2563EB";
  const temps = chart.points.flatMap((p) => [p.scenario, p.baseline]);
  const lo = Math.floor(Math.min(...temps, limits.lower) - 1);
  const hi = Math.ceil(Math.max(...temps, limits.upper, chart.spoilage_threshold) + 1);
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="text-xs font-bold text-[#0F172A]">
          {zoneLabel(chart.zone_id, chart.zone_name, lang)} · {scenarioLabel(chart.scenario, chart.scenario_label, lang)}
          {chart.duration_minutes ? ` (${fmtMin(chart.duration_minutes, t)} ${t.forDur})` : ""}
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{t.projection}</div>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart.points} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
            <XAxis dataKey="minute" tick={{ fontSize: 10, fill: "#64748B" }} tickFormatter={(m) => `${m}m`} minTickGap={24} />
            <YAxis domain={[lo, hi]} tick={{ fontSize: 10, fill: "#64748B" }} tickFormatter={(v) => `${v}°`} />
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toFixed(1)}°C`, name]}
              labelFormatter={(m) => `${t.minute} ${m}`}
              contentStyle={{ fontSize: 12, borderRadius: 10 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={limits.upper} stroke="#F97316" strokeDasharray="4 4" label={{ value: `${t.limit} ${limits.upper}°C`, fontSize: 10, fill: "#C2410C", position: "insideTopLeft" }} />
            <ReferenceLine y={limits.lower} stroke="#38BDF8" strokeDasharray="4 4" />
            {chart.spoilage_threshold > limits.upper && (
              <ReferenceLine y={chart.spoilage_threshold} stroke="#DC2626" strokeDasharray="2 3" />
            )}
            <Line type="monotone" dataKey="baseline" name={t.ifNothing} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            <Line type="monotone" dataKey="scenario" name={t.scenario} stroke={color} strokeWidth={2.2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          [t.peakTemp, `${metrics.peak_temperature.toFixed(1)}°C`],
          [t.breachIn, fmtMin(metrics.time_to_limit_minutes, t)],
          [t.aiLead, metrics.ai_lead_time_minutes !== null ? `${Math.round(metrics.ai_lead_time_minutes)} ${t.min}` : t.none],
          [t.stockRisk, metrics.inventory_at_risk_usd > 0 ? `$${metrics.inventory_at_risk_usd.toLocaleString()}` : t.none],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
            <div className="text-[10px] font-medium text-[#64748B]">{label}</div>
            <div className="text-xs font-bold text-[#0F172A]">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- page
function loadPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function savePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export default function Chatbot() {
  const { zones } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>(loadChat);
  const [input, setInput] = useState("");
  const [zoneId, setZoneId] = useState("zone-a");
  const [busy, setBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<AssistantStatus | null>(null);
  const [lang, setLang] = useState<VoiceLang>(() => loadPref("coldguard.whatif.lang", ["en", "hi", "mr"] as const, "en"));
  const [voiceReplies, setVoiceReplies] = useState(() => loadPref("coldguard.whatif.voice", ["on", "off"] as const, "on") === "on");
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  const speakerRef = useRef(new Speaker());
  const t = UI[lang];

  useEffect(() => { api.assistantStatus().then(setAiStatus).catch(() => setAiStatus(null)); }, []);
  useEffect(() => { saveChat(messages); endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => () => { speakerRef.current.stop(); stopListeningRef.current?.(); }, []);

  const zoneOptions = zones?.length ? zones.map((z) => ({ id: z.zone_id, name: z.name })) : ZONE_OPTIONS;

  const speak = (index: number, text: string, language: VoiceLang) => {
    setSpeakingIdx(index);
    speakerRef.current.speak(text, language, () => setSpeakingIdx((cur) => (cur === index ? null : cur)));
  };
  const stopSpeaking = () => { speakerRef.current.stop(); setSpeakingIdx(null); };

  const send = async (text: string, viaVoice = false) => {
    const question = text.trim();
    if (!question || busy) return;
    stopSpeaking();
    const history: AssistantTurn[] = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    const index = messages.length + 1; // position of the reply
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api.askWhatIf(question, history, zoneId, lang);
      setMessages((prev) => [...prev, {
        role: "assistant", content: res.reply, charts: res.charts, mode: res.mode, model: res.model, notice: res.notice, lang,
      }]);
      if (voiceReplies || viaVoice) speak(index, res.reply, lang);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", error: true, content: e instanceof Error ? e.message : t.errorFallback }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = async () => {
    setMicError(null);
    if (listening) { stopListeningRef.current?.(); return; }
    if (!micSupported()) { setMicError(t.noMic); return; }
    stopSpeaking();
    setListening(true);
    setInput("");
    stopListeningRef.current = await startListening(lang, {
      onInterim: (text) => setInput(text),
      onFinal: (text) => { setInput(text); send(text, true); },
      onError: (code) => setMicError(code === "mic-denied" ? t.micDenied : code === "network" ? t.micNetwork : `${t.micFailed}: ${code}`),
      onEnd: () => { setListening(false); stopListeningRef.current = null; },
    });
  };

  const changeLang = (next: VoiceLang) => {
    stopListeningRef.current?.();
    stopSpeaking();
    setLang(next);
    savePref("coldguard.whatif.lang", next);
  };

  const toggleVoiceReplies = () => {
    const next = !voiceReplies;
    if (!next) stopSpeaking();
    setVoiceReplies(next);
    savePref("coldguard.whatif.voice", next ? "on" : "off");
  };

  return (
    <div className="flex flex-col gap-4 pb-6 font-sans h-[calc(100vh-7rem)] min-h-[560px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <FlaskConical size={20} />
            </div>
            {t.title}
          </h1>
          <p className="text-xs text-[#475569] mt-1 font-medium">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            title={aiStatus ? Object.entries(aiStatus.providers).map(([n, p]) => `${n}: ${p.available ? p.model : "not available"}`).join(" · ") : ""}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${aiStatus?.ai_enabled ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
          >
            <Sparkles size={12} /> {aiStatus ? engineLabel(aiStatus.active, aiStatus.providers[aiStatus.active]?.model, t.builtIn) : t.builtIn}
          </span>
          <div role="group" aria-label={t.language} className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
            <Languages size={13} className="mx-1 text-[#64748B]" />
            {LANGUAGE_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => changeLang(o.id)}
                aria-pressed={lang === o.id}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${lang === o.id ? "bg-[#2563EB] text-white" : "text-[#475569] hover:text-[#2563EB]"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggleVoiceReplies}
            title={voiceReplies ? t.voiceOn : t.voiceOff}
            aria-pressed={voiceReplies}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${voiceReplies ? "border-[#BAE6FD] bg-[#EFF6FF] text-[#2563EB]" : "border-slate-200 bg-white text-[#64748B]"}`}
          >
            {voiceReplies ? <Volume2 size={13} /> : <VolumeX size={13} />} {voiceReplies ? t.voiceOn : t.voiceOff}
          </button>
          <label className="text-[11px] font-semibold text-[#475569]">
            {t.defaultRoom}{" "}
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-[#0F172A]">
              {zoneOptions.map((z) => <option key={z.id} value={z.id}>{zoneLabel(z.id, z.name, lang)}</option>)}
            </select>
          </label>
          <button
            onClick={() => { stopSpeaking(); setMessages([]); }}
            disabled={busy || messages.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#475569] hover:text-[#2563EB] disabled:opacity-40"
          >
            <RotateCcw size={12} /> {t.newChat}
          </button>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-[#BAE6FD] bg-white p-4 sm:p-5 shadow-sm">
        {messages.length === 0 && !busy ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-6">
            <div className="h-12 w-12 rounded-2xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <Bot size={24} />
            </div>
            <div>
              <div className="text-sm font-bold text-[#0F172A]">{t.emptyTitle}</div>
              <div className="text-xs text-[#64748B] mt-1 max-w-xl">{t.emptyHint}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 max-w-2xl w-full">
              {t.suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-left rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-xs text-[#334155] hover:border-[#93C5FD] hover:bg-[#EFF6FF]">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center"><Bot size={15} /></div>
                )}
                <div className={m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-[#2563EB] px-3.5 py-2 text-[13px] text-white"
                  : `max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-tl-sm border px-3.5 py-3 ${m.error ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                  {m.role === "user" ? m.content : (
                    <>
                      {m.notice && <div className="mb-2 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[11px] text-amber-800">{m.notice}</div>}
                      {m.error ? <div className="text-[13px] text-red-700">{m.content}</div> : <Markdown text={m.content} />}
                      {m.charts?.map((c, j) => <ScenarioChart key={j} chart={c} lang={m.lang ?? lang} />)}
                      {m.mode && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-[10px] text-[#94A3B8]">{engineLabel(m.mode, m.model, UI[m.lang ?? lang].builtIn)} · {UI[m.lang ?? lang].simulatedBy}</div>
                          <button
                            onClick={() => (speakingIdx === i ? stopSpeaking() : speak(i, m.content, m.lang ?? lang))}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-[#475569] hover:text-[#2563EB]"
                          >
                            {speakingIdx === i ? <><Square size={11} /> {t.stop}</> : <><Volume2 size={12} /> {t.play}</>}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {m.role === "user" && (
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-[#0F172A] text-white flex items-center justify-center"><User size={14} /></div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-[#475569]">
                <Loader2 size={14} className="animate-spin text-[#2563EB]" /> {t.thinking}
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {micError && <div className="-mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{micError}</div>}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className={`flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm ${listening ? "border-red-300 ring-2 ring-red-100" : "border-[#BAE6FD]"}`}
      >
        <button
          type="button"
          onClick={toggleMic}
          disabled={busy}
          title={listening ? t.stopMic : t.mic}
          aria-label={listening ? t.stopMic : t.mic}
          className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl disabled:opacity-50 ${listening ? "bg-red-500 text-white" : "bg-[#EFF6FF] text-[#2563EB] hover:bg-[#DBEAFE]"}`}
        >
          {listening && <span className="absolute inset-0 rounded-xl bg-red-400 opacity-60 animate-ping" />}
          {listening ? <MicOff size={16} className="relative" /> : <Mic size={16} />}
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          maxLength={2000}
          lang={LOCALES[lang]}
          placeholder={listening ? t.listening : t.placeholder}
          className="flex-1 resize-none bg-transparent px-2 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none max-h-32"
        />
        <button
          type="submit"
          disabled={busy || !input.trim() || listening}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          <Send size={14} /> {t.ask}
        </button>
      </form>
    </div>
  );
}
