/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Floating Storage Manager Voice & Chat Drawer
   Allows the storage manager to query live telemetry, excursion risks, and
   speak to the Ollama chatbot from ANY page across the dashboard.
───────────────────────────────────────────────────────────────────────────── */
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Globe2,
  Maximize2,
  Mic,
  MicOff,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../hooks/AppContext";
import { api } from "../services/api";

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸", locale: "en-US" },
  { code: "mr", name: "मराठी", flag: "🇮🇳", locale: "mr-IN" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳", locale: "hi-IN" },
  { code: "es", name: "Español", flag: "🇪🇸", locale: "es-ES" },
  { code: "de", name: "Deutsch", flag: "🇩🇪", locale: "de-DE" },
  { code: "fr", name: "Français", flag: "🇫🇷", locale: "fr-FR" },
  { code: "ja", name: "日本語", flag: "🇯🇵", locale: "ja-JP" },
  { code: "zh", name: "中文", flag: "🇨🇳", locale: "zh-CN" },
  { code: "ar", name: "العربية", flag: "🇸🇦", locale: "ar-SA" },
];

const STORAGE_DRAWER_MESSAGES_KEY = "coldguard.drawer.messages";
const STORAGE_DRAWER_LANG_KEY = "coldguard.drawer.language";
const STORAGE_DRAWER_AUTOSPEAK_KEY = "coldguard.drawer.autoSpeak";

export default function ManagerVoiceDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; time: string }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAWER_MESSAGES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        role: "assistant",
        content: "Hello! I am your ColdGuard Manager Voice Assistant. How can I help with facility telemetry or risk?",
        time: "Now",
      },
    ];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_DRAWER_LANG_KEY) || "en";
    } catch {
      return "en";
    }
  });
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_DRAWER_AUTOSPEAK_KEY) === "true";
    } catch {
      return false;
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Persist messages & preferences
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DRAWER_MESSAGES_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DRAWER_LANG_KEY, language);
    } catch {}
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DRAWER_AUTOSPEAK_KEY, String(autoSpeak));
    } catch {}
  }, [autoSpeak]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

  const activeLocale = useMemo(() => {
    return LANGUAGES.find((l) => l.code === language)?.locale || "en-US";
  }, [language]);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = activeLocale;

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (e: any) => {
        let str = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          str += e.results[i][0].transcript;
        }
        setInput(str);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const populateVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) setAvailableVoices(v);
    };
    populateVoices();
    window.speechSynthesis.onvoiceschanged = populateVoices;
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    let clean = text
      .replace(/###/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .replace(/\[.*?\]\(.*?\)/g, "")
      .replace(/—/g, "-")
      .trim();

    if (language === "hi") {
      clean = clean
        .replace(/\([A-Za-z\s0-9\-_%]+\)/g, " ")
        .replace(/°C/g, " डिग्री सेल्सियस")
        .replace(/\$([0-9,]+(?:\.[0-9]+)?)\s*USD/g, "$1 डॉलर")
        .replace(/•/g, "")
        .replace(/SOP-0(\d)/g, "एसओपी 0$1");
    } else {
      clean = clean
        .replace(/°C/g, " degrees Celsius")
        .replace(/•/g, "");
    }

    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 0.95;
    utter.pitch = 1.0;

    const voicesList = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const normLocale = activeLocale.toLowerCase().replace("_", "-");
    const normLang = language.toLowerCase();

    let voice = voicesList.find((v) => v.lang.toLowerCase().replace("_", "-") === normLocale);
    if (!voice) {
      voice = voicesList.find((v) => v.lang.toLowerCase().replace("_", "-").startsWith(normLang));
    }
    if (!voice && normLang === "hi") {
      voice = voicesList.find((v) => {
        const name = v.name.toLowerCase();
        return name.includes("hindi") || name.includes("lekha") || name.includes("neerja") || name.includes("kalpana") || name.includes("हिन्दी");
      });
    }

    if (voice) {
      utter.voice = voice;
      utter.lang = voice.lang;
    } else {
      utter.lang = activeLocale;
    }

    window.speechSynthesis.speak(utter);
  };

  const handleSend = async (txt?: string) => {
    const q = (txt || input).trim();
    if (!q || loading) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    const userMsg = {
      role: "user" as const,
      content: q,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.assistantChat({
        message: q,
        language,
        history: messages.slice(-4),
      });

      const aiMsg = {
        role: "assistant" as const,
        content: res.reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (autoSpeak) speak(res.reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Telemetry query failed. Please ensure backend is running.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearDrawer = () => {
    window.speechSynthesis?.cancel();
    try {
      localStorage.removeItem(STORAGE_DRAWER_MESSAGES_KEY);
    } catch {}
    setMessages([
      {
        role: "assistant",
        content: "Hello! I am your ColdGuard Manager Voice Assistant. How can I help with facility telemetry or risk?",
        time: "Now",
      },
    ]);
  };

  return (
    <>
      {/* Floating Action Button (Bottom-Right Orb) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer group border-2 border-white/30"
          title="Open Storage Manager AI Voice Copilot"
        >
          <div className="relative">
            <Bot size={22} className="animate-pulse" />
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
          </div>
          <span className="text-sm font-bold tracking-tight pr-1">Manager AI Voice</span>
        </button>
      )}

      {/* Slide-out Drawer Panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white border-l border-[#DCE8F6] shadow-2xl flex flex-col font-sans animate-slideLeft">
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-[#DCE8F6] bg-[#F8FAFC] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shadow-sm">
                <BrainCircuit size={19} />
              </div>
              <div>
                <div className="font-extrabold text-[#0F172A] text-sm leading-tight">
                  Manager Voice Assistant
                </div>
                <div className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Ollama RAG Grounded</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={clearDrawer}
                className="p-1.5 text-[#475569] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                title="Clear Conversation History"
              >
                <Trash2 size={16} />
              </button>
              <Link
                to="/manager/assistant"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-[#475569] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-lg transition"
                title="Expand to Full Workstation"
              >
                <Maximize2 size={16} />
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-[#475569] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Toolbar (Language & Voice) */}
          <div className="px-4 py-2 border-b border-[#DCE8F6] bg-white flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Globe2 size={14} className="text-[#2563EB]" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent font-bold text-[#0F172A] cursor-pointer focus:outline-none"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setAutoSpeak(!autoSpeak)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] transition cursor-pointer ${
                autoSpeak ? "bg-[#EFF6FF] text-[#2563EB]" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {autoSpeak ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{autoSpeak ? "Auto-TTS On" : "TTS Muted"}</span>
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#F1F7FF]/20">
            {messages.map((m, idx) => {
              const isUser = m.role === "user";
              return (
                <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  <div
                    className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm ${
                      isUser
                        ? "bg-[#2563EB] text-white rounded-tr-none font-medium"
                        : "bg-white border border-[#DCE8F6] text-[#0F172A] rounded-tl-none"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div
                      className={`text-[9px] mt-1.5 flex items-center justify-between ${
                        isUser ? "text-blue-100" : "text-[#64748B]"
                      }`}
                    >
                      <span>{m.time}</span>
                      {!isUser && (
                        <button
                          onClick={() => speak(m.content)}
                          className="hover:text-[#2563EB] p-0.5 cursor-pointer"
                          title="Listen"
                        >
                          <Volume2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="text-xs text-[#64748B] font-bold animate-pulse flex items-center gap-1.5 p-2">
                <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-ping" />
                Thinking &amp; analyzing telemetry...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Questions Pills */}
          <div className="p-2.5 bg-[#F8FAFC] border-t border-[#DCE8F6] flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <button
              onClick={() => handleSend("Current temperatures of all zones?")}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#DCE8F6] hover:bg-[#EFF6FF] text-[#0F172A] whitespace-nowrap cursor-pointer shadow-sm"
            >
              🌡️ All Temperatures
            </button>
            <button
              onClick={() => handleSend("Any excursion risks next 1 hour?")}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#DCE8F6] hover:bg-[#EFF6FF] text-[#0F172A] whitespace-nowrap cursor-pointer shadow-sm"
            >
              🚨 Excursion Risk
            </button>
            <button
              onClick={() => handleSend("Total financial inventory at risk?")}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#DCE8F6] hover:bg-[#EFF6FF] text-[#0F172A] whitespace-nowrap cursor-pointer shadow-sm"
            >
              💰 Financial Risk
            </button>
          </div>

          {/* Voice Input Indicator */}
          {isRecording && (
            <div className="px-4 py-1.5 bg-rose-50 border-t border-rose-200 text-rose-700 flex items-center justify-between text-xs font-bold animate-pulse">
              <span>Listening to speech in {LANGUAGES.find((l) => l.code === language)?.name}...</span>
              <button onClick={toggleRecording} className="text-rose-900 underline text-xs">
                Stop
              </button>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-[#DCE8F6]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleRecording}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isRecording
                    ? "bg-rose-500 text-white border-rose-600 animate-pulse"
                    : "bg-[#EFF6FF] text-[#2563EB] border-[#BAE6FD]"
                }`}
                title={isRecording ? "Stop voice" : "Voice-to-Text"}
              >
                {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about cold rooms, risk, inventory..."
                className="flex-1 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] px-3.5 py-2 text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-[#2563EB] text-white disabled:opacity-50 cursor-pointer"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
