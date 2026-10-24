import {
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  DollarSign,
  FileText,
  Flame,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  Mic,
  MicOff,
  Play,
  PlugZap,
  Radio,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Thermometer,
  Trash2,
  TriangleAlert,
  User,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AudioControlModal } from "../components/AudioControlModal";
import { Button, Card, SimulatedBadge } from "../components/ui";
import { useApp } from "../hooks/AppContext";
import {
  getSpeechEngineMode,
  getWhisperProvider,
  isAutoVoiceResultEnabled,
  setAutoVoiceResultEnabled,
  setSpeechEngineMode,
  SoundEffects,
  SPEECH_LANGUAGES,
  VoiceInputSession,
  VoiceSynthesizer,
  WhisperAudioRecorder,
} from "../lib/audio";
import { CHART, fmtMinutes, fmtTemp } from "../lib/format";
import { api } from "../services/api";
import type { WhatIfResponse } from "../types/api";

// Multilingual scenario suggestion prompts mapped to selected language
const MULTILINGUAL_SUGGESTIONS: Record<string, (prod: string, room: string) => string[]> = {
  en: (p, z) => [
    `Will ${p} spoil if cooling cuts for 45 minutes in ${z}?`,
    `What happens if chamber door is jammed open for 30 minutes in a heatwave?`,
    `Can ${z} survive a 2-hour power outage without temperature excursion?`,
    `What if an unnoticed suction freon leak drops chiller efficiency by 50% for 2 hours?`,
    `What is our critical response deadline if compressor trips right now?`,
    `What if the RTD sensor develops a +3.5°C calibration drift?`,
  ],
  mr: (p, z) => [
    `${z} मध्ये ४५ मिनिटे वीज पुरवठा खंडित झाल्यास ${p} खराब होईल का?`,
    `उष्णतेच्या लाटेत चेंबरचा दरवाजा ३० मिनिटे उघडा राहिल्यास काय होईल?`,
    `कंप्रेसर बंद पडल्यास आमच्याकडे कारवाईसाठी किती वेळ शिल्लक आहे?`,
    `${z} मध्ये २ तास वीज बंद राहिल्यास तापमान सुरक्षित राहील का?`,
    `रेफ्रिजरंट गळतीमुळे कूलिंग ५०% कमी झाल्यास काय धोका निर्माण होईल?`,
  ],
  hi: (p, z) => [
    `क्या ${z} में 45 मिनट बिजली कट होने पर ${p} खराब हो जाएगी?`,
    `यदि भीषण गर्मी में 30 मिनट तक दरवाजा खुला रहे तो क्या होगा?`,
    `कंप्रेसर खराब होने पर हमारे पास कार्रवाई के लिए कितना समय है?`,
    `क्या 2 घंटे के पावर कट में ${z} का तापमान सुरक्षित सीमा में रहेगा?`,
    `यदि रेफ्रिजरेंट लीक से कूलिंग 50% घट जाए तो क्या प्रभाव पड़ेगा?`,
  ],
  es: (p, z) => [
    `¿Se dañará ${p} si se corta la refrigeración por 45 minutos en ${z}?`,
    `¿Qué pasa si la puerta queda abierta 30 minutos durante una ola de calor?`,
    `¿Puede ${z} resistir un corte eléctrico de 2 horas sin exceder la temperatura?`,
    `¿Cuánto tiempo tenemos antes del límite crítico si falla el compresor?`,
  ],
  fr: (p, z) => [
    `Les stocks de ${p} vont-ils se dégrader si le refroidissement s'arrête 45 min dans ${z} ?`,
    `Que se passe-t-il si la porte reste ouverte 30 min en pleine canicule ?`,
    `La zone ${z} peut-elle supporter une coupure électrique de 2 heures ?`,
    `Combien de temps avons-nous pour intervenir en cas d'arrêt du compresseur ?`,
  ],
  de: (p, z) => [
    `Werden ${p} verderben, wenn die Kühlung für 45 Minuten in ${z} ausfällt?`,
    `Was passiert, wenn die Tür bei einer Hitzewelle 30 Minuten offen bleibt?`,
    `Kann ${z} einen 2-stündigen Stromausfall unbeschadet überstehen?`,
    `Wie viel Reaktionszeit bleibt vor Grenzwertüberschreitung bei Kompressorausfall?`,
  ],
  ja: (p, z) => [
    `${z} で冷却が45分間停止した場合、${p} は品質劣化しますか？`,
    `猛暑の中でドアが30分間開いたままになったらどうなりますか？`,
    `${z} は2時間の停電に耐えられますか？`,
    `コンプレッサー故障時、限界突破までの対応猶予時間は何分ですか？`,
  ],
};

const PLACEHOLDERS: Record<string, string> = {
  en: "Ask any what-if scenario (e.g. What if cooling cuts for 45 mins in Vaccine Store A?)...",
  mr: "कोणतीही परिस्थिती विचारा (उदा. ४५ मिनिटे वीज बंद राहिल्यास लस खराब होईल का?)...",
  hi: "कोई भी 'क्या होगा अगर' स्थिति पूछें (उदा. 45 मिनट बिजली कट होने पर क्या होगा?)...",
  es: "Pregunte cualquier situación hipotética (ej. ¿Qué pasa si se corta la luz 45 min?)...",
  fr: "Posez votre question de simulation (ex. Que se passe-t-il si le froid coupe 45 min ?)...",
  de: "Frage zu beliebigem Szenario eingeben (z. B. Was passiert bei 45 Min. Kühlausfall?)...",
  ja: "シミュレーションの質問を入力または音声で発話（例：45分停電したらどうなる？）...",
};

export interface WhatIfChatTurn {
  id: string;
  timestamp: string;
  query: string;
  zoneId: string;
  zoneName: string;
  product: string;
  limits: { lower: number; upper: number; setpoint: number };
  result: WhatIfResponse;
}

export default function WhatIf() {
  const { zones, selectedZone, selectedZoneId, setSelectedZoneId, notify } = useApp();

  // Chat conversation stream state
  const [turns, setTurns] = useState<WhatIfChatTurn[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio / Speech state
  const [engineMode, setEngineMode] = useState<"whisper" | "browser">(() => getSpeechEngineMode());
  const [whisperRecorder] = useState(() => new WhisperAudioRecorder());
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);

  // Browser speech fallback & synthesizer
  const [voiceSession] = useState(() => new VoiceInputSession());
  const [speechLang, setSpeechLang] = useState(() => voiceSession.getLang());
  const [autoVoiceResult, setAutoVoiceResult] = useState(() => isAutoVoiceResultEnabled());
  const [activeAudioTurnId, setActiveAudioTurnId] = useState<string | null>(null);
  const [copiedSopTurnId, setCopiedSopTurnId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      voiceSession.stop();
      if (whisperRecorder.active()) {
        whisperRecorder.stop(() => {}, () => {});
      }
      VoiceSynthesizer.stop();
    };
  }, [voiceSession, whisperRecorder]);

  // Auto-scroll chat stream to bottom when a new response arrives
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns, loading]);

  const handleLangChange = (code: string) => {
    setSpeechLang(code);
    voiceSession.setLang(code);
    const langObj = SPEECH_LANGUAGES.find((l) => l.code === code);
    notify("info", `Language set to ${langObj?.flag || ""} ${langObj?.label || code}`);
  };

  const handleToggleAutoVoice = (checked: boolean) => {
    setAutoVoiceResult(checked);
    setAutoVoiceResultEnabled(checked);
    notify("info", checked ? "Voice Result Auto-Play enabled" : "Voice Result Auto-Play muted");
  };

  const product = selectedZone?.product ?? "stored biological inventory";
  const zoneName = selectedZone?.name ?? "Cold Storage Zone";
  const langKey = speechLang.slice(0, 2).toLowerCase();
  const getSuggestions = MULTILINGUAL_SUGGESTIONS[langKey] || MULTILINGUAL_SUGGESTIONS["en"];
  const SUGGESTED_PROMPTS = getSuggestions(product, zoneName);
  const inputPlaceholder = PLACEHOLDERS[langKey] || PLACEHOLDERS["en"];

  // Execute conversational simulation for any what-if scenario question
  const handleSendQuery = async (queryText?: string) => {
    const textToSend = (queryText !== undefined ? queryText : userQuery).trim();
    if (!textToSend || loading) return;

    setUserQuery("");
    setLoading(true);
    setError(null);

    const turnId = `turn-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const currentZoneName = selectedZone?.name ?? "Selected Cold Room";
    const currentProduct = selectedZone?.product ?? "Stored Items";
    const currentLimits = {
      lower: selectedZone?.lower_limit ?? 2,
      upper: selectedZone?.upper_limit ?? 8,
      setpoint: selectedZone?.setpoint ?? 4,
    };

    try {
      const res = await api.whatIf({
        zone_id: selectedZoneId,
        scenario: "compressor_failure",
        duration_minutes: 60,
        ambient_delta: 10,
        projection_minutes: 180,
        user_query: textToSend,
        language: langKey,
        dataset_source: "live",
      });

      const newTurn: WhatIfChatTurn = {
        id: turnId,
        timestamp,
        query: textToSend,
        zoneId: selectedZoneId,
        zoneName: currentZoneName,
        product: currentProduct,
        limits: currentLimits,
        result: res,
      };

      setTurns((prev) => [...prev, newTurn]);
      if (res.scenario_result.time_to_limit_minutes) {
        SoundEffects.playExcursionAlarm(1.2);
      } else {
        SoundEffects.playChime();
      }

      // Auto-voice announcement if enabled
      if (autoVoiceResult) {
        const speechToPlay =
          res.ai_answer?.speech_text ||
          `${res.ai_answer?.headline || ""}. Direct answer: ${res.ai_answer?.direct_answer || ""}`;
        if (speechToPlay) {
          setActiveAudioTurnId(turnId);
          VoiceSynthesizer.speak(speechToPlay, speechLang);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      notify("error", `Simulation calculation failed: ${msg}`);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Toggle voice input with Whisper API or Browser STT
  const toggleVoiceInput = async () => {
    if (engineMode === "whisper") {
      if (whisperRecorder.active()) {
        await whisperRecorder.stop(
          (transcribedText) => {
            setUserQuery(transcribedText);
            setIsListening(false);
            SoundEffects.playChime();
            handleSendQuery(transcribedText);
          },
          (err) => {
            setIsListening(false);
            notify("error", err);
          },
          (processing) => {
            setIsTranscribing(processing);
          }
        );
      } else {
        if (!whisperRecorder.isSupported()) {
          notify("error", "Microphone recording is not supported in this browser.");
          return;
        }
        await whisperRecorder.start((err) => {
          setIsListening(false);
          notify("error", err);
        });
        setIsListening(true);
      }
      return;
    }

    // WebSpeech fallback
    if (isListening) {
      voiceSession.stop();
      setIsListening(false);
      return;
    }

    if (!voiceSession.isSupported()) {
      notify("info", "Browser speech not supported. Please switch to Whisper API in Audio Settings.");
      return;
    }

    setIsListening(true);
    voiceSession.start(
      (interim) => {
        setUserQuery(interim);
      },
      (finalText) => {
        setUserQuery(finalText);
        setIsListening(false);
        SoundEffects.playChime();
        handleSendQuery(finalText);
      },
      (err) => {
        setIsListening(false);
        notify("error", err);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  const handlePlayVoice = (turn: WhatIfChatTurn) => {
    if (activeAudioTurnId === turn.id) {
      VoiceSynthesizer.stop();
      setActiveAudioTurnId(null);
      return;
    }

    VoiceSynthesizer.stop();
    const speechToPlay =
      turn.result.ai_answer?.speech_text ||
      `${turn.result.ai_answer?.headline || ""}. Direct answer: ${turn.result.ai_answer?.direct_answer || ""}`;

    if (speechToPlay) {
      setActiveAudioTurnId(turn.id);
      VoiceSynthesizer.speak(speechToPlay, speechLang);
    }
  };

  const handleCopySop = (turn: WhatIfChatTurn) => {
    const sit = turn.result.ai_answer?.real_world_situation;
    if (!sit) return;

    const textToCopy = `[ColdGuard AI Emergency SOP Incident Brief]
Scenario: ${turn.query}
Zone: ${turn.zoneName} (${turn.product})
Incident Classification: ${sit.title} (${sit.protocol_code})
Regulatory Compliance: ${sit.regulatory_standard}
Financial Inventory Risk: $${sit.inventory_risk_usd.toLocaleString()} / ₹${(sit.inventory_risk_inr / 100000).toFixed(2)} Lakh
Critical Limit Breach Time: ${turn.result.scenario_result.time_to_limit_minutes ? `~${turn.result.scenario_result.time_to_limit_minutes} min` : "No Breach"}

Mandatory SOP Actions:
${sit.immediate_sop_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Engineering Directives:
${turn.result.recommendations.map((r, i) => `* ${r}`).join("\n")}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedSopTurnId(turn.id);
    notify("success", "Emergency SOP protocol copied to clipboard!");
    setTimeout(() => setCopiedSopTurnId(null), 3000);
  };

  const handleClearChat = () => {
    VoiceSynthesizer.stop();
    setActiveAudioTurnId(null);
    setTurns([]);
    notify("info", "Chat history cleared. Ready for new what-if simulations.");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] max-w-7xl mx-auto space-y-3">
      {/* Top Header / Assistant Context Bar */}
      <div className="shrink-0 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-slate-950/95 p-3.5 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Identity & Status */}
          <div className="flex items-center gap-3">
            <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              <Bot size={22} className="text-slate-950" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                  ColdGuard What-If AI Simulation Chatbot
                </h1>
                <SimulatedBadge />
              </div>
              <p className="text-xs text-slate-400">
                Ask any hypothetical cold storage situation. Real-time thermodynamic simulation, excursion prediction, financial risk, and SOP actions.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Zone Selector */}
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1 text-slate-300">
              <span className="text-[11px] font-medium text-slate-400">Room:</span>
              <select
                value={selectedZoneId}
                onChange={(e) => setSelectedZoneId(e.target.value)}
                className="bg-transparent font-semibold text-cyan-300 focus:outline-none cursor-pointer"
                title="Select cold storage zone to simulate"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id} className="bg-slate-900 text-slate-100">
                    {z.name} ({z.product} · {z.lower_limit}°C to {z.upper_limit}°C)
                  </option>
                ))}
              </select>
            </div>

            {/* Speech Engine Mode Switcher */}
            <div className="flex items-center rounded-lg border border-cyan-500/30 bg-slate-950 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setEngineMode("whisper");
                  setSpeechEngineMode("whisper");
                  notify("info", `Switched to Whisper API (${getWhisperProvider().toUpperCase()})`);
                }}
                className={`px-2 py-0.5 text-xs font-semibold rounded-md transition flex items-center gap-1 cursor-pointer ${
                  engineMode === "whisper"
                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Use Whisper Deep Learning API for high-precision technical speech recognition"
              >
                <Sparkles size={11} className="text-cyan-400" />
                <span>Whisper API</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEngineMode("browser");
                  setSpeechEngineMode("browser");
                  notify("info", "Switched to Browser Speech Recognition");
                }}
                className={`px-2 py-0.5 text-xs font-semibold rounded-md transition flex items-center gap-1 cursor-pointer ${
                  engineMode === "browser"
                    ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Use browser built-in WebSpeech"
              >
                <Mic size={11} />
                <span>Browser STT</span>
              </button>
            </div>

            {/* Multilingual Selector */}
            <div className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-slate-950 px-2 py-1 text-slate-300">
              <Globe size={13} className="text-cyan-400" />
              <select
                value={speechLang}
                onChange={(e) => handleLangChange(e.target.value)}
                className="bg-transparent font-semibold text-cyan-300 focus:outline-none cursor-pointer"
                title="Select natural language for simulation voice & text"
              >
                {SPEECH_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-slate-900 text-slate-100">
                    {l.flag} {l.nativeName} ({l.label})
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Result Auto-Announce Toggle */}
            <label
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1 text-slate-300 cursor-pointer hover:border-cyan-500/40 transition"
              title="Automatically read aloud simulation results in chosen language"
            >
              <input
                type="checkbox"
                checked={autoVoiceResult}
                onChange={(e) => handleToggleAutoVoice(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <span className="flex items-center gap-1 text-cyan-300 font-medium">
                <Volume2 size={12} />
                <span>Auto-Voice</span>
              </span>
            </label>

            {/* Audio Settings Modal */}
            <button
              type="button"
              onClick={() => setAudioSettingsOpen(true)}
              className="rounded-lg border border-white/10 bg-slate-950 p-1.5 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition cursor-pointer"
              title="Audio & Whisper API Settings"
            >
              <Settings size={14} />
            </button>

            {/* Clear Chat */}
            {turns.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="rounded-lg border border-rose-500/20 bg-rose-950/20 px-2.5 py-1 text-rose-300 hover:bg-rose-900/30 hover:border-rose-500/40 transition flex items-center gap-1 cursor-pointer"
                title="Clear conversation history"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Conversational Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {/* Empty State Welcome Card */}
        {turns.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[460px] text-center p-6 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur">
            <div className="relative mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)]">
              <Bot size={32} />
              <Sparkles size={16} className="absolute -top-1 -right-1 text-cyan-300 animate-pulse" />
            </div>

            <h2 className="text-xl font-bold text-slate-100 max-w-lg mb-2">
              What hypothetical situation would you like to simulate?
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl leading-relaxed mb-6">
              Ask any situation question in plain language or use hands-free voice. ColdGuard AI will run the thermodynamic physics model for <span className="text-cyan-300 font-semibold">{zoneName}</span> (storing {product}), predicting thermal excursion time, regulatory impact, financial risk, and emergency SOP mitigations.
            </p>

            <div className="w-full max-w-3xl">
              <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3 flex items-center justify-center gap-1.5">
                <HelpCircle size={13} /> Try asking any of these what-if scenarios:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-left">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSendQuery(prompt)}
                    className="p-3 rounded-xl border border-white/10 bg-slate-950/60 hover:border-cyan-400/50 hover:bg-cyan-950/20 text-slate-300 hover:text-cyan-200 transition-all text-xs flex items-center justify-between group cursor-pointer shadow-sm"
                  >
                    <span className="line-clamp-2 pr-2">"{prompt}"</span>
                    <ArrowRight size={14} className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chronological Chat Messages */}
        {turns.map((turn) => {
          const res = turn.result;
          const ai = res.ai_answer;
          const sit = ai?.real_world_situation;
          const isBreach = !!res.scenario_result.time_to_limit_minutes;
          const isWarning = !isBreach && (res.scenario_result.peak_risk ?? 0) >= 40;
          const isAudioPlaying = activeAudioTurnId === turn.id;

          // Merge chart points
          const chartData = res.scenario_result.points.map((p, i) => {
            const basePoint = res.baseline.points[i];
            return {
              minute: p.minute,
              hypothetical: p.temperature,
              baseline: basePoint ? basePoint.temperature : null,
            };
          });

          return (
            <div key={turn.id} className="space-y-4">
              {/* User Question Message Bubble */}
              <div className="flex justify-end gap-2.5">
                <div className="max-w-2xl rounded-2xl rounded-tr-sm border border-cyan-500/40 bg-gradient-to-br from-cyan-950/60 via-slate-900/80 to-slate-900/90 p-4 text-slate-100 shadow-md">
                  <div className="flex items-center justify-between gap-3 mb-1.5 text-[11px] text-cyan-300 font-mono">
                    <span className="flex items-center gap-1 font-semibold">
                      <span>📍</span> {turn.zoneName} ({turn.product})
                    </span>
                    <span className="text-slate-400">{turn.timestamp}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-100 leading-relaxed">{turn.query}</p>
                </div>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 shrink-0">
                  <User size={16} />
                </div>
              </div>

              {/* ColdGuard AI Simulator Response Card */}
              <div className="flex justify-start gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shrink-0">
                  <Bot size={18} />
                </div>

                <div className="flex-1 max-w-4xl space-y-3 rounded-2xl rounded-tl-sm border border-white/10 bg-slate-900/80 p-4 sm:p-5 shadow-xl backdrop-blur">
                  {/* Status Verdict Header Banner */}
                  <div
                    className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-3 ${
                      isBreach
                        ? "border-rose-500/50 bg-gradient-to-r from-rose-950/70 via-rose-900/50 to-slate-900/80 text-rose-200"
                        : isWarning
                        ? "border-amber-500/50 bg-gradient-to-r from-amber-950/70 via-amber-900/50 to-slate-900/80 text-amber-200"
                        : "border-emerald-500/50 bg-gradient-to-r from-emerald-950/70 via-emerald-900/50 to-slate-900/80 text-emerald-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isBreach ? (
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/30 text-rose-400 animate-pulse">
                          <TriangleAlert size={18} />
                        </div>
                      ) : isWarning ? (
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/30 text-amber-400">
                          <AlertCircle size={18} />
                        </div>
                      ) : (
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/30 text-emerald-400">
                          <ShieldCheck size={18} />
                        </div>
                      )}
                      <div>
                        <div className="text-xs uppercase tracking-wider font-bold">
                          {isBreach
                            ? "CRITICAL EXCURSION PROJECTED"
                            : isWarning
                            ? "ELEVATED THERMAL STRAIN"
                            : "STABLE & SAFE OPERATION"}
                        </div>
                        <div className="text-sm font-semibold text-slate-100">
                          {ai?.headline || "Thermodynamic physics projection calculated"}
                        </div>
                      </div>
                    </div>

                    {/* Audio Broadcast Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePlayVoice(turn)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                          isAudioPlaying
                            ? "bg-rose-500/20 border-rose-400 text-rose-300 animate-pulse"
                            : "bg-cyan-500/20 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/30"
                        }`}
                        title="Listen to full AI simulation voice report"
                      >
                        {isAudioPlaying ? (
                          <>
                            <Square size={12} className="fill-current" />
                            <span>Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={13} />
                            <span>Listen Aloud</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Direct Conversational Answer */}
                  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4 text-sm text-slate-200 leading-relaxed">
                    <p className="font-medium text-slate-100">
                      {ai?.direct_answer || "Simulation resolution calculated across projected operational horizons."}
                    </p>

                    {/* Spoken Audio Transcript Snippet if available */}
                    {ai?.speech_text && ai.speech_text !== ai.direct_answer && (
                      <div className="mt-2.5 pt-2 border-t border-white/5 text-xs text-slate-400 italic flex items-start gap-1.5">
                        <Volume2 size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                        <span>Voice Brief: "{ai.speech_text}"</span>
                      </div>
                    )}
                  </div>

                  {/* Embedded Physics Trajectory Projection Chart */}
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <Thermometer size={15} className="text-cyan-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Physical Temperature Trajectory & Safety Boundaries
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono">
                        <span className="flex items-center gap-1 text-cyan-400">
                          <span className="h-2 w-2 rounded-full bg-cyan-400" /> Baseline Trajectory
                        </span>
                        <span className="flex items-center gap-1 text-rose-400">
                          <span className="h-2 w-2 rounded-full bg-rose-400" /> What-If Scenario
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="h-2 w-2 rounded-full bg-emerald-500/30 border border-emerald-400" /> Safe Band ({turn.limits.lower}°C - {turn.limits.upper}°C)
                        </span>
                      </div>
                    </div>

                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                          <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.3} />
                          <XAxis
                            dataKey="minute"
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(m) => `+${m}m`}
                          />
                          <YAxis
                            stroke="#64748b"
                            tick={{ fontSize: 10 }}
                            domain={[
                              (dataMin: number) => Math.min(turn.limits.lower - 2, Math.floor(dataMin - 1)),
                              (dataMax: number) => Math.max(turn.limits.upper + 3, Math.ceil(dataMax + 1)),
                            ]}
                            tickFormatter={(t) => `${t.toFixed(0)}°C`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#020617",
                              borderColor: "#334155",
                              borderRadius: "0.5rem",
                              fontSize: "12px",
                            }}
                            formatter={(val: number) => [`${val.toFixed(2)}°C`]}
                            labelFormatter={(m) => `+${m} minutes from incident start`}
                          />

                          {/* Safe Operating Band */}
                          <ReferenceArea
                            y1={turn.limits.lower}
                            y2={turn.limits.upper}
                            fill="#10b981"
                            fillOpacity={0.08}
                            stroke="#10b981"
                            strokeOpacity={0.2}
                          />

                          {/* Upper Limit Warning Line */}
                          <ReferenceLine
                            y={turn.limits.upper}
                            stroke="#f43f5e"
                            strokeDasharray="4 4"
                            label={{
                              value: `Upper Max ${turn.limits.upper}°C`,
                              position: "insideTopRight",
                              fill: "#f43f5e",
                              fontSize: 10,
                            }}
                          />

                          {/* AI Warning Marker if breached */}
                          {res.scenario_result.ai_first_warning_minute && (
                            <ReferenceLine
                              x={res.scenario_result.ai_first_warning_minute}
                              stroke="#eab308"
                              strokeDasharray="3 3"
                              label={{
                                value: `AI Early Alert +${res.scenario_result.ai_first_warning_minute}m`,
                                position: "insideTopLeft",
                                fill: "#eab308",
                                fontSize: 10,
                              }}
                            />
                          )}

                          {/* Baseline Line */}
                          <Line
                            type="monotone"
                            dataKey="baseline"
                            stroke="#06b6d4"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            dot={false}
                          />

                          {/* What-If Scenario Projection Line */}
                          <Line
                            type="monotone"
                            dataKey="hypothetical"
                            stroke={isBreach ? "#f43f5e" : isWarning ? "#f59e0b" : "#10b981"}
                            strokeWidth={2.5}
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 4-Card Quantitative Facts Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock size={12} className="text-cyan-400" /> Limit Breach
                      </div>
                      <div className="text-base font-bold font-mono text-slate-100 mt-1">
                        {res.scenario_result.time_to_limit_minutes
                          ? `~${res.scenario_result.time_to_limit_minutes} min`
                          : "No Breach"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {res.scenario_result.time_to_limit_minutes
                          ? `Crosses ${res.scenario_result.limit_side} limit`
                          : "Within safe ceiling"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-400" /> AI Warning Time
                      </div>
                      <div className="text-base font-bold font-mono text-amber-300 mt-1">
                        {res.scenario_result.ai_first_warning_minute
                          ? `+${res.scenario_result.ai_first_warning_minute} min`
                          : "Nominal"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {res.scenario_result.ai_lead_time_minutes
                          ? `${res.scenario_result.ai_lead_time_minutes} min early warning`
                          : "No early risk alarm"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <ShieldAlert size={12} className="text-rose-400" /> Peak Risk Score
                      </div>
                      <div className="text-base font-bold font-mono text-slate-100 mt-1">
                        {res.scenario_result.peak_risk ?? 0}
                        <span className="text-xs text-slate-400 font-normal"> / 100</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Max temp: {fmtTemp(res.scenario_result.max_temperature)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Wallet size={12} className="text-emerald-400" /> Financial Value
                      </div>
                      <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                        {sit ? `₹${(sit.inventory_risk_inr / 100000).toFixed(1)}L` : "$185k"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {sit ? `$${sit.inventory_risk_usd.toLocaleString()} at risk` : "Estimated stock value"}
                      </div>
                    </div>
                  </div>

                  {/* Real-World Operational Context & Emergency SOP Checklist */}
                  {sit && (
                    <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Building2 size={15} className="text-cyan-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            {sit.title} ({sit.protocol_code})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
                            {sit.regulatory_standard}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopySop(turn)}
                            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition cursor-pointer"
                            title="Copy emergency SOP checklist to clipboard"
                          >
                            {copiedSopTurnId === turn.id ? (
                              <>
                                <Check size={12} className="text-emerald-400" />
                                <span className="text-emerald-400 font-semibold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                <span>Copy SOP</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                          <FileText size={13} className="text-cyan-400" /> Mandatory Emergency SOP Action Checklist:
                        </div>
                        <div className="space-y-1">
                          {sit.immediate_sop_steps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-mono font-bold text-cyan-300 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Engineering Recommendations */}
                  {res.recommendations.length > 0 && (
                    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 text-xs text-slate-400">
                      <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1">
                        <Lightbulb size={13} className="text-amber-400" /> Prescribed Engineering Mitigations:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {res.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator Bubble */}
        {loading && (
          <div className="flex justify-start gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-slate-950 font-bold shadow-md shrink-0">
              <Bot size={18} />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-cyan-500/40 bg-slate-900/90 p-4 shadow-xl text-xs text-cyan-300 flex items-center gap-3 animate-pulse">
              <div className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <span>
                Calculating thermodynamic physics model, trajectory projections, and regulatory risk for {zoneName}...
              </span>
            </div>
          </div>
        )}

        {/* Error notification if failed */}
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300 flex items-center gap-2">
            <TriangleAlert size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Sticky Bottom Input & Voice Prompt Bar */}
      <div className="shrink-0 rounded-2xl border border-cyan-500/40 bg-slate-900/95 p-3 shadow-2xl backdrop-blur space-y-2">
        {/* Quick Suggestion Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap flex items-center gap-1">
            <HelpCircle size={12} /> Prompts:
          </span>
          {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => handleSendQuery(prompt)}
              className="text-[11px] whitespace-nowrap rounded-full border border-cyan-500/25 bg-cyan-950/40 px-2.5 py-0.5 text-cyan-300 hover:border-cyan-400 hover:bg-cyan-900/50 transition cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Listening / Transcribing Live Banner */}
        {isListening && (
          <div
            className={`flex items-center justify-between rounded-lg border px-3 py-1.5 text-xs animate-pulse ${
              engineMode === "whisper"
                ? "border-cyan-500/50 bg-cyan-950/50 text-cyan-200"
                : "border-rose-500/40 bg-rose-950/30 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio
                size={14}
                className={engineMode === "whisper" ? "text-cyan-400 animate-pulse" : "text-rose-400 animate-spin"}
              />
              <span>
                {engineMode === "whisper"
                  ? "Recording audio for Whisper API. Speak your question and click Stop to simulate."
                  : "Listening hands-free. Speak clearly into your microphone..."}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleVoiceInput}
              className={`underline font-semibold cursor-pointer ${
                engineMode === "whisper" ? "text-cyan-300 hover:text-white" : "text-rose-300 hover:text-rose-200"
              }`}
            >
              {engineMode === "whisper" ? "Stop & Transcribe" : "Done speaking"}
            </button>
          </div>
        )}

        {isTranscribing && (
          <div className="flex items-center justify-between rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-300 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <span className="font-semibold">Whisper Deep Learning model transcribing cold-chain speech...</span>
            </div>
          </div>
        )}

        {/* Input Field Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder={
                isTranscribing
                  ? "Transcribing with Whisper API..."
                  : isListening
                  ? "Listening hands-free... speak your what-if question..."
                  : inputPlaceholder
              }
              className="w-full rounded-xl border border-cyan-500/30 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 pr-24 transition shadow-inner"
            />

            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {userQuery && (
                <button
                  type="button"
                  onClick={() => setUserQuery("")}
                  className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title="Clear text"
                >
                  <X size={15} />
                </button>
              )}

              {/* Microphone Speech Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isTranscribing}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isTranscribing
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 opacity-70"
                    : isListening
                    ? engineMode === "whisper"
                      ? "bg-cyan-500/25 border-cyan-400 text-cyan-300 animate-pulse shadow-[0_0_12px_#06b6d4]"
                      : "bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse shadow-[0_0_12px_#f43f5e]"
                    : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400"
                }`}
                title={
                  isTranscribing
                    ? "Transcribing with Whisper API..."
                    : isListening
                    ? "Stop recording"
                    : `Speak your what-if question via ${engineMode === "whisper" ? "Whisper API" : "Browser STT"}`
                }
              >
                {isTranscribing ? (
                  <div className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                ) : isListening ? (
                  <MicOff size={16} />
                ) : (
                  <Mic size={16} />
                )}
              </button>
            </div>
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!userQuery.trim() || loading}
            className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-slate-950 font-bold transition shadow-md cursor-pointer disabled:cursor-not-allowed shrink-0"
            title="Simulate this scenario"
          >
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Audio & Whisper Configuration Modal */}
      <AudioControlModal isOpen={audioSettingsOpen} onClose={() => setAudioSettingsOpen(false)} />
    </div>
  );
}
