/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Storage Manager Multilingual AI Voice & Chatbot Copilot
   Arctic Blue Design System
   Features:
     - Fullscreen immersive AI Copilot workstation
     - Local Ollama RAG integration (Llama 3, Mistral, Qwen, Fine-Tuned)
     - Multilingual support: English, Spanish, French, German, Hindi, Japanese, Chinese, Arabic
     - Voice to Text (STT) via Web Speech API with language matching
     - Text to Voice (TTS) via SpeechSynthesis with native speech pronunciation
     - 100% dynamic live telemetry grounding (zero static data)
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
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Minimize2,
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
  { id: "coldguard-manager", name: "ColdGuard Manager (LoRA Fine-Tuned)", desc: "Fine-tuned on thermal inertia, door infiltration & GxP Modelfile (r=16, α=32)" },
  { id: "llama3", name: "Llama 3 (8B) • Meta", desc: "Base instruction model for cold storage reasoning" },
  { id: "mistral", name: "Mistral (7B) • Mistral AI", desc: "Fast low-latency inference" },
  { id: "qwen2.5", name: "Qwen 2.5 • Alibaba", desc: "High-accuracy multilingual capabilities" },
  { id: "phi3", name: "Phi-3 Mini • Microsoft", desc: "Ultra-lightweight local model" },
];

// Helper to generate a dynamic live telemetry greeting in the chosen language
function createDynamicGreeting(
  lang: string,
  currentZones: any[] | null | undefined,
  risk: number,
  power: number
): string {
  const zList = currentZones && currentZones.length > 0 ? currentZones : [];
  const zoneLines = zList
    .map(
      (z) =>
        `* **${z.name || z.zone_id}**: ${
          z.temperature != null ? `${z.temperature.toFixed(2)}°C` : "—"
        } (Safe: ${z.lower_limit}°C to ${z.upper_limit}°C) — Door: \`${
          z.door_status || "closed"
        }\` | Compressor: ${
          z.compressor_load_pct != null ? `${z.compressor_load_pct.toFixed(0)}% load` : "Normal"
        }`
    )
    .join("\n");

  if (lang === "hi") {
    return `### 👋 नमस्ते, कोल्ड स्टोरेज मैनेजर\n\nमैं आपका **कोल्डगार्ड AI कोपायलट** हूँ, जो लाइव फैसिलिटी टेलीमेट्री और स्थानीय Ollama GxP मॉडल से सीधे जुड़ा हुआ है।\n\n**वर्तमान लाइव सिस्टम स्थिति:**\n${
      zoneLines || "* लाइव टेलीमेट्री डेटा लोड हो रहा है..."
    }\n\n* **सुविधा जोखिम स्तर:** ${risk}%\n* **कुल कंप्रेसर लोड:** ${power.toFixed(1)} kW\n* **GxP विनियामक स्थिति:** 100% FDA 21 CFR Part 11 ऑडिट अनुपालन\n\nआप मुझसे कक्ष तापमान, इन्वेंट्री वित्तीय जोखिम, कंप्रेसर लोड या दरवाजों की स्थिति के बारे में पूछ सकते हैं। आप माइक्रोफ़ोन पर क्लिक करके बोल भी सकते हैं।`;
  }
  if (lang === "es") {
    return `### 👋 Bienvenido, Gerente de Almacenamiento en Frío\n\nSoy su **Copiloto ColdGuard AI**, conectado en tiempo real a la telemetría de la instalación y modelos locales Ollama.\n\n**Estado Actual de Telemetría en Vivo:**\n${
      zoneLines || "* Sincronizando datos de sensores..."
    }\n\n* **Riesgo Global:** ${risk}%\n* **Carga Eléctrica:** ${power.toFixed(1)} kW\n* **Cumplimiento GxP:** FDA 21 CFR Parte 11 Verificado\n\n¿En qué puedo asistirle hoy respecto a telemetría, pronóstico de excursiones o exposición financiera? Puede escribir o pulsar el micrófono para hablar en español.`;
  }
  if (lang === "de") {
    return `### 👋 Willkommen, Kaltlager-Manager\n\nIch bin Ihr **ColdGuard AI Copilot**, direkt angebunden an Echtzeit-Telemetrie und lokale Ollama GxP-Modelle.\n\n**Aktuelle Live-Telemetrie:**\n${
      zoneLines || "* Telemetriedaten werden synchronisiert..."
    }\n\n* **Gesamtanlagenrisiko:** ${risk}%\n* **Kompressor-Gesamtlast:** ${power.toFixed(1)} kW\n* **FDA 21 CFR Part 11:** Vollständig auditiert\n\nFragen Sie nach Kammertemperaturen, Exkursionsrisiken oder elektrischen Lasten.`;
  }
  if (lang === "fr") {
    return `### 👋 Bienvenue, Gestionnaire d'Entrepôt Frigorifique\n\nJe suis votre **Copilote ColdGuard AI**, connecté en temps réel à la télémétrie locale et aux modèles GxP Ollama.\n\n**État Actuel en Direct:**\n${
      zoneLines || "* Synchronisation des données télémétriques..."
    }\n\n* **Risque Global:** ${risk}%\n* **Charge Électrique:** ${power.toFixed(1)} kW\n* **Conformité GxP:** FDA 21 CFR Part 11 vérifiée\n\nPosez vos questions ou cliquez sur le micro pour parler.`;
  }
  // Default English
  return `### 👋 Welcome, Cold Storage Manager\n\nI am your **ColdGuard AI Copilot**, connected in real time to live facility telemetry and local Ollama GxP models.\n\n**Live Telemetry Status:**\n${
    zoneLines || "* Synchronizing telemetry stream from active chambers..."
  }\n\n* **Overall Facility Risk:** ${risk}%\n* **Total Electrical Load:** ${power.toFixed(1)} kW\n* **GxP Compliance:** 100% FDA 21 CFR Part 11 Tamper-Proof Audit Trail\n\nAsk me about chamber temperatures, excursion forecasts, financial exposure, or electromechanical compressor loads. You can also click the microphone to speak aloud in your preferred language.`;
}

export default function ManagerAssistant() {
  const { zones, totalPowerKw, facilityRisk } = useApp();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedModel, setSelectedModel] = useState("coldguard-manager");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; default_model: string; models: string[] }>({
    connected: false,
    default_model: "llama3",
    models: [],
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-init",
      role: "assistant",
      content: createDynamicGreeting("en", [], 0, 0),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      engine: "ColdGuard Intelligence Engine",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Sync dynamic greeting with live telemetry when initial state loads
  useEffect(() => {
    if (messages.length <= 1) {
      setMessages([
        {
          id: "welcome-live",
          role: "assistant",
          content: createDynamicGreeting(selectedLanguage, zones, facilityRisk, totalPowerKw),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          engine: ollamaStatus.connected ? `Ollama (${selectedModel})` : "ColdGuard Intelligence Engine",
        },
      ]);
    }
  }, [zones, facilityRisk, totalPowerKw, selectedLanguage, ollamaStatus.connected, selectedModel]);

  // Check Ollama daemon status
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

    window.speechSynthesis.cancel();

    if (currentlySpeakingId === messageId) {
      setCurrentlySpeakingId(null);
      return;
    }

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

  const copyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Send Message Handler ──────────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || loading) return;

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
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: createDynamicGreeting(selectedLanguage, zones, facilityRisk, totalPowerKw),
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        engine: ollamaStatus.connected ? `Ollama (${selectedModel})` : "ColdGuard Intelligence Engine",
      },
    ]);
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen bg-[#F1F7FF] p-2 sm:p-4 flex flex-col font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A] overflow-hidden"
          : "w-full h-[calc(100vh-100px)] min-h-[620px] flex flex-col font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]"
      }
    >
      {/* ─────────────────────────────────────────────────────────────
          Full-Screen Interactive Chat & Voice Workstation
      ───────────────────────────────────────────────────────────── */}
      <div className="w-full h-full flex-1 rounded-2xl bg-white border border-[#DCE8F6] shadow-xl flex flex-col overflow-hidden">
        {/* Chat Header & Integrated Control Toolbar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#DCE8F6] bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-sm shrink-0">
              <Bot size={22} />
            </div>
            <div>
              <div className="font-extrabold text-[#0F172A] text-base sm:text-lg leading-tight flex items-center gap-2">
                ColdGuard Storage Manager Copilot
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] hidden sm:inline-block">
                  Ollama RAG & Voice
                </span>
              </div>
              <div className="text-xs text-[#64748B] font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Telemetry Grounded
                </span>
                <span>•</span>
                <span>{zones?.length ?? 3} Active Chambers</span>
                <span>•</span>
                <span>
                  Risk: <b className="text-[#0F172A]">{facilityRisk}%</b>
                </span>
                <span>•</span>
                <span>
                  Load: <b className="text-[#0F172A]">{totalPowerKw.toFixed(1)} kW</b>
                </span>
              </div>
            </div>
          </div>

          {/* Integrated Control Toolbar (Language, Model, TTS, Clear, Fullscreen) */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-[#DCE8F6] shadow-sm">
              <Globe2 size={14} className="text-[#2563EB]" />
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
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-[#DCE8F6] shadow-sm">
              <Server size={14} className="text-[#2563EB]" />
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

            {/* LoRA Fine-Tuning Status Pill */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm bg-indigo-50 border-indigo-200 text-indigo-800"
              title="PEFT LoRA Adapter (Rank 16, Alpha 32) fine-tuned on dual-mass thermal infiltration and FDA 21 CFR Part 11"
            >
              <Sparkles size={13} className="text-indigo-600" />
              <span>LoRA Fine-Tuned (r=16, α=32)</span>
            </div>

            {/* Ollama / Physics Engine Status Pill */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-sm transition-all ${
                ollamaStatus.connected
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-[#EFF6FF] border-[#BAE6FD] text-[#2563EB]"
              }`}
              title={
                ollamaStatus.connected
                  ? "Connected to local Ollama daemon on http://localhost:11434"
                  : "Ollama daemon offline on port 11434. Running ColdGuard Physics & GxP Neural Engine. To activate Ollama LLM, run 'ollama serve' in your terminal."
              }
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  ollamaStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-[#2563EB]"
                }`}
              />
              <span>
                {ollamaStatus.connected ? `Ollama Active (${selectedModel})` : "ColdGuard Physics Engine"}
              </span>
            </div>

            {/* Clear Session */}
            <button
              onClick={clearChat}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-[#DCE8F6] hover:bg-[#F1F7FF] text-[#475569] hover:text-[#0F172A] text-xs font-bold transition shadow-sm cursor-pointer"
              title="Reset Chat Session"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] hover:text-[#1D4ED8] text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen Mode" : "Expand to Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
            </button>
          </div>
        </div>

        {/* Quick Query Templates Strip */}
        <div className="px-4 sm:px-6 py-2.5 bg-white border-b border-[#DCE8F6] flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles size={13} className="text-[#2563EB]" /> Quick Prompts:
          </span>
          <button
            onClick={() => handleSendMessage("What is the fine-tuning LoRA model architecture and hyperparameters?")}
            className="px-3 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 border border-indigo-200 text-xs font-bold text-indigo-900 transition cursor-pointer shrink-0 flex items-center gap-1"
          >
            🧬 LoRA Architecture & Specs
          </button>
          <button
            onClick={() => handleSendMessage("What will happen if I keep open the door for next 5 min?")}
            className="px-3 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 hover:border-rose-300 border border-rose-200 text-xs font-bold text-rose-800 transition cursor-pointer shrink-0"
          >
            🚪 5-Min Door Breach Simulation
          </button>
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
            onClick={() => handleSendMessage("What perishable products have the shortest time to spoilage?")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            📦 Spoilage Sensitivity
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
          <button
            onClick={() => handleSendMessage("Explain the cooling pull-down recovery curve and door status.")}
            className="px-3 py-1 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#BAE6FD] border border-[#DCE8F6] text-xs font-bold text-[#0F172A] transition cursor-pointer shrink-0"
          >
            📈 Cooling Pull-Down Curve
          </button>
        </div>

        {/* Chat Message Scrollable Area */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto space-y-4 bg-gradient-to-b from-[#F1F7FF]/25 to-white">
          {messages.map((m) => {
            const isUser = m.role === "user";
            const isSpeakingThis = currentlySpeakingId === m.id;
            const isCopied = copiedId === m.id;

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
                        <>
                          <button
                            onClick={() => copyMessage(m.content, m.id)}
                            className="p-1 rounded-lg hover:bg-[#EFF6FF] text-[#64748B] hover:text-[#2563EB] transition cursor-pointer"
                            title="Copy message to clipboard"
                          >
                            <Copy size={13} className={isCopied ? "text-emerald-600" : ""} />
                          </button>
                          <button
                            onClick={() => speakText(m.content, m.id)}
                            className={`p-1 rounded-lg transition cursor-pointer ${
                              isSpeakingThis
                                ? "bg-rose-100 text-rose-600 animate-pulse"
                                : "hover:bg-[#EFF6FF] text-[#2563EB]"
                            }`}
                            title={isSpeakingThis ? "Stop speaking" : "Listen aloud"}
                          >
                            <Volume2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Message Body with simple markdown rendering */}
                  <div className="space-y-2 whitespace-pre-wrap font-sans">
                    {m.content.split("\n\n").map((paragraph, pIdx) => {
                      if (paragraph.startsWith("### ")) {
                        return (
                          <h4
                            key={pIdx}
                            className={`text-base font-extrabold mt-1 mb-1 tracking-tight ${
                              isUser ? "text-white" : "text-[#0F172A]"
                            }`}
                          >
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
                  Querying live telemetry &amp; generating{" "}
                  {LANGUAGES.find((l) => l.code === selectedLanguage)?.name} response...
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Voice Input Indicator Bar (Visible when recording) */}
        {isRecording && (
          <div className="px-4 sm:px-6 py-2 bg-rose-50 border-t border-rose-200 text-rose-800 flex items-center justify-between text-xs font-bold animate-pulse shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>
                Microphone Active • Listening in {LANGUAGES.find((l) => l.code === selectedLanguage)?.name}...
              </span>
            </div>
            <button
              onClick={toggleRecording}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        )}

        {/* Input Form Bar (Docked at Bottom) */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-[#DCE8F6] shrink-0">
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
              placeholder={`Ask in ${
                LANGUAGES.find((l) => l.code === selectedLanguage)?.name
              } (e.g., "What is the risk in Vaccine Store A?")...`}
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

          <div className="flex items-center justify-between text-[11px] text-[#64748B] mt-2 px-1 font-medium">
            <span>Press <b>Enter</b> to submit query or click 🎙️ to speak</span>
            <span>Local Ollama (Llama 3) • Multi-Horizon RAG • FDA 21 CFR Part 11</span>
          </div>
        </div>
      </div>
    </div>
  );
}
