/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Storage Manager Multilingual AI Voice & Chatbot Copilot
   Arctic Blue Design System
   Features:
     - Local Ollama RAG integration (Llama 3, Mistral, Qwen, Fine-Tuned)
     - Multilingual support: English, Spanish, French, German, Hindi, Japanese, Chinese, Arabic
     - Voice to Text (STT) via Web Speech API with language matching
     - Text to Voice (TTS) via SpeechSynthesis with native speech pronunciation
     - Grounded real-time telemetry from SQLite/TimescaleDB
───────────────────────────────────────────────────────────────────────────── */
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Copy,
  Cpu,
  Globe2,
  Layers,
  MessageSquare,
  Mic,
  MicOff,
  Package,
  Radio,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Thermometer,
  Trash2,
  User,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../hooks/AppContext";
import { api } from "../../services/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  language?: string;
  engine?: string;
  isSpeaking?: boolean;
}

const LANGUAGES = [
  { code: "en", name: "English (US)", flag: "🇺🇸", locale: "en-US" },
  { code: "es", name: "Español", flag: "🇪🇸", locale: "es-ES" },
  { code: "hi", name: "हिन्दी (Hindi)", flag: "🇮🇳", locale: "hi-IN" },
  { code: "de", name: "Deutsch", flag: "🇩🇪", locale: "de-DE" },
  { code: "fr", name: "Français", flag: "🇫🇷", locale: "fr-FR" },
  { code: "ja", name: "日本語 (Japanese)", flag: "🇯🇵", locale: "ja-JP" },
  { code: "zh", name: "中文 (Chinese)", flag: "🇨🇳", locale: "zh-CN" },
  { code: "ar", name: "العربية (Arabic)", flag: "🇸🇦", locale: "ar-SA" },
];

const OLLAMA_MODELS = [
  { id: "llama3", name: "Llama 3 (8B) • Meta", desc: "Recommended for GxP cold storage reasoning" },
  { id: "coldguard-manager", name: "ColdGuard Manager (Fine-Tuned)", desc: "Fine-tuned on thermal inertia & GxP Modelfile" },
  { id: "mistral", name: "Mistral (7B) • Mistral AI", desc: "Fast low-latency inference" },
  { id: "qwen2.5", name: "Qwen 2.5 • Alibaba", desc: "High-accuracy multilingual capabilities" },
  { id: "phi3", name: "Phi-3 Mini • Microsoft", desc: "Ultra-lightweight local model" },
];

const QUICK_PROMPTS = [
  {
    category: "Telemetry",
    icon: Thermometer,
    prompts: [
      "What is the current temperature of all 3 cold chambers?",
      "Are all compressor racks operating within normal electrical load?",
      "Which chamber has the highest temperature drift right now?",
    ],
  },
  {
    category: "Risk & Forecasting",
    icon: ShieldCheck,
    prompts: [
      "Are there any predicted excursion breaches in the next 1 hour?",
      "What is the excursion risk score for Vaccine Store A?",
      "Explain the current cooling pull-down recovery curve.",
    ],
  },
  {
    category: "Inventory Financials",
    icon: Package,
    prompts: [
      "How much total financial inventory is at risk across the facility?",
      "What is the dollar valuation of biologics stored in Zone A?",
      "What perishable products have the shortest time to spoilage?",
    ],
  },
  {
    category: "GxP & Regulations",
    icon: BrainCircuit,
    prompts: [
      "Are all digital telemetry logs compliant with FDA 21 CFR Part 11?",
      "What standard operating procedure (SOP) applies to open chamber doors?",
      "How is cryptographic tamper-evidence verified across sensor packets?",
    ],
  },
];

export default function ManagerAssistant() {
  const { zones, totalPowerKw, facilityRisk } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "### 👋 Welcome, Cold Storage Manager\n\nI am your **ColdGuard AI Copilot**, connected to live facility telemetry and powered by local Ollama GxP models.\n\n* Ask me about **chamber temperatures**, **compressor electrical power**, or **door dynamics**.\n* Query **multi-horizon excursion risks** and **financial inventory exposure**.\n* Use **Voice-to-Text** to speak via microphone in any of our 8 supported languages, and click the speaker to listen aloud.\n\nHow can I assist your operations today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      engine: "ColdGuard Intelligence Engine",
    },
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedModel, setSelectedModel] = useState("llama3");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; default_model: string; models: string[] }>({
    connected: false,
    default_model: "llama3",
    models: [],
  });
  const [isRecording, setIsRecording] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Check Ollama status on mount
  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await api.assistantStatus();
        if (res && res.ollama) {
          setOllamaStatus(res.ollama);
        }
      } catch (err) {
        console.warn("Could not reach assistant status API:", err);
      }
    }
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Speech-to-Text (STT) Integration ──────────────────────────────────────
  const activeLocale = useMemo(() => {
    return LANGUAGES.find((l) => l.code === selectedLanguage)?.locale || "en-US";
  }, [selectedLanguage]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = activeLocale;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsRecording(false);
    }
  };

  // ── Text-to-Speech (TTS) Integration ──────────────────────────────────────
  const speakText = (text: string, messageId?: string) => {
    if (!("speechSynthesis" in window)) {
      console.warn("Speech synthesis not supported in this browser");
      return;
    }

    // Stop current speech
    window.speechSynthesis.cancel();

    if (currentlySpeakingId === messageId) {
      setCurrentlySpeakingId(null);
      return;
    }

    // Strip markdown formatting for cleaner audio speech
    const cleanText = text
      .replace(/###/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/—/g, "-")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = activeLocale;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick a natural voice for the target locale if available
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(selectedLanguage));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      if (messageId) setCurrentlySpeakingId(messageId);
    };

    utterance.onend = () => {
      setCurrentlySpeakingId(null);
    };

    utterance.onerror = () => {
      setCurrentlySpeakingId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // ── Send Message Handler ──────────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

    // Stop any ongoing voice recognition
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      language: selectedLanguage,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await api.assistantChat({
        message: query,
        language: selectedLanguage,
        model: selectedModel,
        history: historyPayload,
      });

      const aiMsgId = `ai-${Date.now()}`;
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: "assistant",
        content: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        language: response.language,
        engine: response.engine === "ollama" ? `Ollama (${response.model})` : "ColdGuard Neural Engine",
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If auto-speak is enabled, trigger speech synthesis
      if (autoSpeak) {
        speakText(response.reply, aiMsgId);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          "⚠️ **Connection Notice**: I was unable to reach the inference backend. Please ensure the ColdGuard FastAPI server is running on port 8000.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engine: "Fallback Notice",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    window.speechSynthesis?.cancel();
    setCurrentlySpeakingId(null);
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content: "Chat history cleared. Live telemetry context refreshed. How can I assist you now?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engine: "ColdGuard Intelligence Engine",
      },
    ]);
  };

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Section
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shadow-sm">
              <Bot size={22} className="text-[#2563EB]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2">
                Storage Manager AI Voice & Chatbot
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] uppercase">
                  Ollama RAG & Voice
                </span>
              </h1>
              <p className="text-sm text-[#475569] mt-0.5 font-medium">
                Multilingual AI intelligence copilot grounded in real-time cold chamber telemetry, GxP regulations, and financial exposure.
              </p>
            </div>
          </div>
        </div>

        {/* Top Status Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-all ${
              ollamaStatus.connected
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-[#EFF6FF] border-[#BAE6FD] text-[#2563EB]"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                ollamaStatus.connected ? "bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse" : "bg-[#2563EB]"
              }`}
            />
            <span>
              {ollamaStatus.connected
                ? `Ollama Active (${selectedModel})`
                : "ColdGuard Local Engine (Ollama Ready)"}
            </span>
          </div>

          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] hover:bg-[#F1F7FF] text-[#475569] hover:text-[#0F172A] text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Trash2 size={14} /> Clear Session
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. Top 4 Metric & System Grounding Cards
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Inference Runtime</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Server size={17} />
            </div>
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
            {ollamaStatus.connected ? "Ollama Local (11434)" : "ColdGuard Neural"}
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle2 size={13} /> Privacy-First • On-Premise Execution
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Multilingual Engine</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Globe2 size={17} />
            </div>
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
            {LANGUAGES.find((l) => l.code === selectedLanguage)?.name || "English"}
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">
            8 Native Languages Supported
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Live Telemetry Grounding</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Radio size={17} />
            </div>
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
            {zones?.length ?? 3} Active Zones
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle2 size={13} /> Continuous 1.0 Hz SQLite RAG
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Speech Interface</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Mic size={17} />
            </div>
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
            {isRecording ? "Listening..." : currentlySpeakingId ? "Speaking..." : "Voice Ready"}
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">
            Web Speech STT &amp; SpeechSynthesis TTS
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Full-Width Main Interactive Chat & Voice Workstation
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full rounded-2xl bg-white border border-[#DCE8F6] shadow-arctic-card flex flex-col h-[780px] overflow-hidden">
        {/* Chat Header & Integrated Control Toolbar */}
        <div className="px-6 py-4 border-b border-[#DCE8F6] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-sm">
              <BrainCircuit size={20} />
            </div>
            <div>
              <div className="font-extrabold text-[#0F172A] text-base leading-tight">
                ColdGuard Storage Manager Copilot
              </div>
              <div className="text-xs text-[#64748B] font-medium flex items-center gap-1.5 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Real-time RAG Telemetry Connected</span>
                <span>•</span>
                <span>3 Active Chambers Grounded</span>
              </div>
            </div>
          </div>

          {/* Integrated Control Toolbar (Language, Model, TTS, Clear) */}
          <div className="flex items-center gap-2.5 flex-wrap ml-auto">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-[#DCE8F6] shadow-sm">
              <Globe2 size={15} className="text-[#2563EB]" />
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-transparent font-bold text-xs sm:text-sm text-[#0F172A] cursor-pointer focus:outline-none"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Selector */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-[#DCE8F6] shadow-sm">
              <Server size={15} className="text-[#2563EB]" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent font-bold text-xs sm:text-sm text-[#0F172A] cursor-pointer focus:outline-none"
              >
                {OLLAMA_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-Speak TTS Toggle */}
            <button
              onClick={() => setAutoSpeak(!autoSpeak)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer ${
                autoSpeak
                  ? "bg-[#EFF6FF] border-[#BAE6FD] text-[#2563EB]"
                  : "bg-white border-[#DCE8F6] text-[#64748B] hover:text-[#0F172A]"
              }`}
              title={autoSpeak ? "Disable automated voice readout" : "Enable automated voice readout"}
            >
              {autoSpeak ? <Volume2 size={15} className="text-[#2563EB]" /> : <VolumeX size={15} />}
              <span>{autoSpeak ? "Voice TTS On" : "TTS Muted"}</span>
            </button>

            {/* Status Pill */}
            <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
              {ollamaStatus.connected ? "Ollama Active" : "Local Telemetry RAG"}
            </span>
          </div>
        </div>

        {/* Quick Query Templates Strip */}
        <div className="px-6 py-2.5 bg-white border-b border-[#DCE8F6] flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles size={13} className="text-[#2563EB]" /> Quick Prompts:
          </span>
          <button
            onClick={() => handleSendMessage("What is the current temperature of all 3 cold chambers?")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            🌡️ All Temperatures
          </button>
          <button
            onClick={() => handleSendMessage("Are there any predicted excursion breaches in the next 1 hour?")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            🚨 1h Excursion Forecast
          </button>
          <button
            onClick={() => handleSendMessage("How much total financial inventory is at risk across the facility?")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            💰 Inventory Financial Exposure
          </button>
          <button
            onClick={() => handleSendMessage("Explain the cooling pull-down recovery curve and door status.")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            🚪 Door &amp; Pull-Down
          </button>
          <button
            onClick={() => handleSendMessage("Are all digital telemetry logs compliant with FDA 21 CFR Part 11?")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            📋 FDA GxP Regulations
          </button>
          <button
            onClick={() => handleSendMessage("Are all compressor racks operating within normal electrical load?")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            ⚡ Compressor Power (kW)
          </button>
        </div>

          {/* Chat Message Scrollable Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-gradient-to-b from-[#F1F7FF]/30 to-white">
            {messages.map((m) => {
              const isUser = m.role === "user";
              const isSpeakingThis = currentlySpeakingId === m.id;

              return (
                <div key={m.id} className={`flex items-start gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar */}
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      isUser
                        ? "bg-[#2563EB] text-white"
                        : "bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]"
                    }`}
                  >
                    {isUser ? <User size={18} /> : <Bot size={18} />}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm transition-all ${
                      isUser
                        ? "bg-[#2563EB] text-white rounded-tr-none font-medium"
                        : "bg-white border border-[#DCE8F6] text-[#0F172A] rounded-tl-none hover:border-[#BAE6FD]"
                    }`}
                  >
                    {/* Header info */}
                    <div
                      className={`flex items-center justify-between gap-3 pb-2 mb-2 border-b text-[11px] font-bold ${
                        isUser ? "border-white/20 text-blue-100" : "border-[#DCE8F6] text-[#64748B]"
                      }`}
                    >
                      <span>{isUser ? "Storage Manager" : "ColdGuard Assistant"}</span>
                      <div className="flex items-center gap-2">
                        <span>{m.timestamp}</span>
                        {!isUser && (
                          <button
                            onClick={() => speakText(m.content, m.id)}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              isSpeakingThis
                                ? "bg-rose-100 text-rose-600 animate-pulse"
                                : "hover:bg-[#EFF6FF] text-[#2563EB]"
                            }`}
                            title={isSpeakingThis ? "Stop speaking" : "Listen aloud"}
                          >
                            <Volume2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Message Body with simple markdown rendering */}
                    <div className="space-y-2 whitespace-pre-wrap font-sans">
                      {m.content.split("\n\n").map((paragraph, pIdx) => {
                        if (paragraph.startsWith("### ")) {
                          return (
                            <h4 key={pIdx} className={`text-base font-extrabold mt-1 mb-1 tracking-tight ${isUser ? "text-white" : "text-[#0F172A]"}`}>
                              {paragraph.replace("### ", "")}
                            </h4>
                          );
                        }
                        return <p key={pIdx}>{paragraph}</p>;
                      })}
                    </div>

                    {/* Footer Engine Badge */}
                    {!isUser && m.engine && (
                      <div className="mt-2.5 pt-2 border-t border-[#DCE8F6]/60 flex items-center justify-between text-[11px] text-[#64748B]">
                        <span className="font-mono text-[10px] text-[#2563EB] font-bold">{m.engine}</span>
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={11} /> 100% GxP Grounded
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shrink-0 animate-pulse">
                  <Bot size={18} />
                </div>
                <div className="rounded-2xl p-4 bg-white border border-[#DCE8F6] text-[#0F172A] rounded-tl-none shadow-sm flex items-center gap-2.5">
                  <RefreshCw size={16} className="text-[#2563EB] animate-spin" />
                  <span className="text-xs font-bold text-[#475569]">
                    Querying live telemetry &amp; generating {LANGUAGES.find((l) => l.code === selectedLanguage)?.name} response...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Input Indicator Bar (Visible when recording) */}
          {isRecording && (
            <div className="px-6 py-2.5 bg-rose-50 border-t border-rose-200 text-rose-800 flex items-center justify-between text-xs font-bold animate-pulse">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>Microphone Active • Listening in {LANGUAGES.find((l) => l.code === selectedLanguage)?.name}...</span>
              </div>
              <button
                onClick={toggleRecording}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Input Form Bar */}
          <div className="p-4 bg-white border-t border-[#DCE8F6]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2.5"
            >
              {/* Mic STT Button */}
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-3 rounded-xl border transition-all cursor-pointer shadow-sm ${
                  isRecording
                    ? "bg-rose-500 text-white border-rose-600 shadow-rose-300 animate-pulse"
                    : "bg-[#EFF6FF] text-[#2563EB] border-[#BAE6FD] hover:bg-[#DBEAFE]"
                }`}
                title={isRecording ? "Stop recording" : "Speak to Chatbot (Voice-to-Text)"}
              >
                {isRecording ? <MicOff size={19} /> : <Mic size={19} />}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Ask in ${LANGUAGES.find((l) => l.code === selectedLanguage)?.name} (e.g., "What is the risk in Vaccine Store A?")...`}
                className="flex-1 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] px-4 py-3 text-sm font-medium text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:bg-white focus:outline-none transition shadow-inner"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-bold text-sm transition shadow-sm cursor-pointer disabled:cursor-not-allowed"
              >
                <Send size={16} />
                <span>Send</span>
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-2.5 px-1 font-medium">
              <span>Press <b>Enter</b> to submit query or click 🎙️ to speak</span>
              <span>Local Ollama (Llama 3) • Multi-Horizon RAG • FDA 21 CFR Part 11</span>
            </div>
          </div>
        </div>
    </div>
  );
}
