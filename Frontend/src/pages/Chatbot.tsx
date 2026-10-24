import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Check,
  Clock,
  Copy,
  Cpu,
  Edit3,
  Globe,
  HelpCircle,
  Mic,
  MicOff,
  Radio,
  RotateCcw,
  Send,
  Sliders,
  Sparkles,
  Square,
  Thermometer,
  Trash2,
  User,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { useApp } from "../hooks/AppContext";
import { api } from "../services/api";
import {
  getSpeechEngineMode,
  getWhisperApiKey,
  getWhisperEndpoint,
  getWhisperProvider,
  normalizeColdChainTranscript,
  setSpeechEngineMode,
  setSpeechRecognitionLang,
  VoiceInputSession,
  VoiceSynthesizer,
  WhisperAudioRecorder,
} from "../lib/audio";
import { AudioControlModal } from "../components/AudioControlModal";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  speechText?: string;
  language?: string;
  timestamp: string;
  telemetryChips?: {
    zone_id: string;
    name: string;
    temperature: string;
    status: string;
    safe: boolean;
  }[];
  loraMeta?: {
    adapter: string;
    base_model: string;
    engine: string;
    latency_ms: number;
    supported_languages: string[];
  };
}

// Supported languages constrained to English, Marathi, Hindi
const CHAT_LANGUAGES = [
  { code: "en", locale: "en-US", label: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "mr", locale: "mr-IN", label: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { code: "hi", locale: "hi-IN", label: "Hindi", nativeName: "हिंदी", flag: "🇮🇳" },
];

const PROMPTS_BY_LANG: Record<string, string[]> = {
  en: [
    "What is the current temperature across all cold rooms?",
    "Are there any active alerts or excursions right now?",
    "Is the compressor running properly in Vaccine Store A?",
    "What are the WHO temperature rules for vaccines?",
    "Will milk spoil if the chiller door stays open for 30 minutes?",
  ],
  mr: [
    "सर्व कोल्ड रूमचे सध्याचे तापमान किती आहे?",
    "सध्या काही अलार्म किंवा तापमान धोका आहे का?",
    "व्हॅक्सिन स्टोअर ए मधील कंप्रेसर चालू आहे का?",
    "लस (व्हॅक्सिन) साठवणुकीचे सुरक्षित तापमान काय आहे?",
    "डेअरी चिलरचा दरवाजा उघडा राहिल्यास काय होईल?",
  ],
  hi: [
    "सभी कोल्ड रूम का वर्तमान तापमान क्या है?",
    "क्या अभी कोई एक्टिव अलर्ट या तापमान खतरा है?",
    "क्या वैक्सीन स्टोर ए का कंप्रेसर सही चल रहा है?",
    "डब्ल्यूएचओ के अनुसार वैक्सीन का सुरक्षित तापमान क्या है?",
    "दूध और डेयरी का तापमान 6 डिग्री से ऊपर जाने पर क्या असर होगा?",
  ],
};

const WELCOME_MESSAGES: Record<string, string> = {
  en: "Hello! I am ColdGuard AI Assistant, powered by LoRA cold-chain domain intelligence. You can ask me anything about current temperatures, active alerts, compressor status, or WHO/FDA storage rules in English, Marathi, or Hindi.",
  mr: "नमस्कार! मी कोल्डगार्ड एआय सहाय्यक आहे. मी थेट सेन्सर टेलीमेट्री आणि लोरा (LoRA) तंत्रज्ञानाने जोडलेला आहे. आपण मला कोणत्याही कोल्ड रूमचे तापमान, अलार्म किंवा उपकरणांबद्दल मराठी, हिंदी किंवा इंग्रजीत प्रश्न विचारू शकता.",
  hi: "नमस्ते! मैं कोल्डगार्ड एआई सहायक हूँ। मैं रियल-टाइम टेलीमेट्री और लोरा (LoRA) डोमेन मॉडल से संचालित हूँ। आप मुझसे सभी कोल्ड स्टोरेज के तापमान, अलर्ट या डब्ल्यूएचओ नियमों के बारे में हिंदी, मराठी या अंग्रेजी में पूछ सकते हैं।",
};

export default function Chatbot() {
  const { notify } = useApp();
  const [selectedLang, setSelectedLang] = useState<"en" | "mr" | "hi">("en");
  const [speechEngineMode, setEngineModeState] = useState<"whisper" | "browser">(getSpeechEngineMode);
  const [audioModalOpen, setAudioModalOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      role: "assistant",
      content: WELCOME_MESSAGES["en"],
      speechText: "Hello! I am ColdGuard AI Assistant. How can I assist you with cold storage today?",
      language: "en",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [autoTts, setAutoTts] = useState(true);

  // Live audio feedback states
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimSpeech, setInterimSpeech] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const whisperRecorder = useRef(new WhisperAudioRecorder());
  const voiceSession = useRef(new VoiceInputSession());
  const recordingTimer = useRef<any>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      VoiceSynthesizer.stop();
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      if (whisperRecorder.current.active()) {
        whisperRecorder.current.stop(() => {}, () => {});
      }
      voiceSession.current.stop();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLanguageChange = (code: "en" | "mr" | "hi") => {
    setSelectedLang(code);
    const langObj = CHAT_LANGUAGES.find((l) => l.code === code);
    setSpeechRecognitionLang(langObj?.locale || "en-US");
    notify("info", `Language set to ${langObj?.flag} ${langObj?.label}`);

    // If only welcome message exists, update its language
    if (messages.length === 1 && messages[0].role === "assistant") {
      setMessages([
        {
          id: `welcome-${code}`,
          role: "assistant",
          content: WELCOME_MESSAGES[code],
          speechText: WELCOME_MESSAGES[code],
          language: code,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  const handleToggleSpeechEngine = () => {
    const nextMode = speechEngineMode === "whisper" ? "browser" : "whisper";
    setEngineModeState(nextMode);
    setSpeechEngineMode(nextMode);
    notify(
      "info",
      nextMode === "whisper"
        ? "Switched to ⚡ Whisper API (Cloud STT with domain tuning)"
        : "Switched to 🌐 Browser WebSpeech (Enhanced Continuous recognition)"
    );
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputValue).trim();
    if (!textToSend || loading) return;

    VoiceSynthesizer.stop();
    setIsSpeaking(false);
    setSpeakingMessageId(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      language: selectedLang,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setInterimSpeech("");
    setLoading(true);

    try {
      const historyTurns = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.chat({
        message: textToSend,
        history: historyTurns,
        language: selectedLang,
      });

      const assistantMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: res.reply || "No response received.",
        speechText: res.speech_text || res.reply,
        language: res.language || selectedLang,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        telemetryChips: res.telemetry_chips || [],
        loraMeta: res.lora_meta,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Play audio automatically if auto TTS is active
      if (autoTts && assistantMsg.speechText) {
        handleSpeakMessage(assistantMsg);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Error: ${err?.message || "Failed to contact chat service. Please check your backend."}`,
        language: selectedLang,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (isSpeaking && speakingMessageId === msg.id) {
      VoiceSynthesizer.stop();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }

    VoiceSynthesizer.stop();
    const textToSpeak = msg.speechText || msg.content;
    const langObj = CHAT_LANGUAGES.find((l) => l.code === (msg.language || selectedLang));
    const locale = langObj?.locale || "en-US";

    setIsSpeaking(true);
    setSpeakingMessageId(msg.id);

    VoiceSynthesizer.speak(textToSpeak, locale, () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    });
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAndSend(true);
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    VoiceSynthesizer.stop();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
    setInterimSpeech("");
    setVolumeLevel(0);
    setRecordingSeconds(0);

    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }
    recordingTimer.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    const langObj = CHAT_LANGUAGES.find((l) => l.code === selectedLang);
    const targetLocale = langObj?.locale || (selectedLang === "mr" ? "mr-IN" : selectedLang === "hi" ? "hi-IN" : "en-US");

    // Engine Selection: Whisper API vs Browser WebSpeech
    if (speechEngineMode === "whisper") {
      if (!whisperRecorder.current.isSupported()) {
        notify("warn", "Audio recording not supported in browser. Falling back to Browser WebSpeech.");
        startBrowserRecording(targetLocale);
        return;
      }

      setIsRecording(true);
      whisperRecorder.current.start(
        (err) => {
          if (recordingTimer.current) clearInterval(recordingTimer.current);
          setIsRecording(false);
          notify("crit", `Microphone error: ${err}`);
        },
        (volume) => {
          setVolumeLevel(volume);
        }
      );
    } else {
      startBrowserRecording(targetLocale);
    }
  };

  const startBrowserRecording = (locale: string) => {
    if (!voiceSession.current.isSupported()) {
      notify("warn", "WebSpeech API not supported in browser. Falling back to Whisper STT.");
      setIsRecording(true);
      whisperRecorder.current.start(
        (err) => {
          if (recordingTimer.current) clearInterval(recordingTimer.current);
          setIsRecording(false);
          notify("crit", `Microphone error: ${err}`);
        },
        (vol) => setVolumeLevel(vol)
      );
      return;
    }

    voiceSession.current.setLang(locale);
    setIsRecording(true);

    voiceSession.current.start(
      (interimText) => {
        setInterimSpeech(interimText);
        setInputValue(interimText);
      },
      (finalText) => {
        const cleaned = normalizeColdChainTranscript(finalText.trim());
        if (cleaned) {
          setInterimSpeech(cleaned);
          setInputValue(cleaned);
        }
      },
      (err) => {
        if (recordingTimer.current) clearInterval(recordingTimer.current);
        setIsRecording(false);
        notify("warn", err);
      },
      () => {
        if (recordingTimer.current) clearInterval(recordingTimer.current);
        setIsRecording(false);
      },
      (vol) => {
        setVolumeLevel(vol);
      },
      2200 // 2.2s silence timeout for natural speaking pauses
    );
  };

  const stopRecordingAndSend = (autoSend = false) => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }

    // Handle Browser WebSpeech
    if (voiceSession.current.active()) {
      voiceSession.current.stop();
      setIsRecording(false);
      const text = inputValue.trim() || interimSpeech.trim();
      if (text && autoSend) {
        handleSendMessage(text);
      }
      return;
    }

    // Handle Whisper STT
    if (whisperRecorder.current.active()) {
      setIsRecording(false);
      setIsTranscribing(true);

      whisperRecorder.current.stop(
        (transcribedText) => {
          setIsTranscribing(false);
          const cleaned = normalizeColdChainTranscript(transcribedText.trim());
          if (cleaned) {
            setInputValue(cleaned);
            setInterimSpeech(cleaned);
            if (autoSend) {
              handleSendMessage(cleaned);
            } else {
              notify("success", "Speech transcribed! Review or press Send.");
            }
          }
        },
        (err) => {
          setIsTranscribing(false);
          notify(
            "warn",
            `Whisper transcription: ${err}. Try switching to WebSpeech or check API key in Mic Settings.`
          );
        }
      );
    }
  };

  const cancelRecording = () => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }
    if (voiceSession.current.active()) {
      voiceSession.current.stop();
    }
    if (whisperRecorder.current.active()) {
      whisperRecorder.current.stop(() => {}, () => {});
    }
    setIsRecording(false);
    setIsTranscribing(false);
    setVolumeLevel(0);
    setInterimSpeech("");
    notify("info", "Voice recording cancelled.");
  };

  const clearChat = () => {
    VoiceSynthesizer.stop();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: WELCOME_MESSAGES[selectedLang],
        speechText: WELCOME_MESSAGES[selectedLang],
        language: selectedLang,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    notify("info", "Chat history cleared.");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify("success", "Message copied to clipboard!");
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const currentPrompts = PROMPTS_BY_LANG[selectedLang] || PROMPTS_BY_LANG["en"];

  return (
    <div className="mx-auto flex h-[620px] max-h-[85vh] w-full max-w-[500px] flex-col gap-2 font-sans rounded-2xl border border-cyan-500/30 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-2.5 shadow-md">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/40 border border-cyan-400/50 shadow-sm">
            <Bot size={15} className="text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-white tracking-tight">ColdGuard AI</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/40 bg-purple-950/50 px-1.5 py-0.2 text-[9px] font-medium text-purple-300">
                <Cpu size={10} className="text-purple-400" /> LoRA
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Assistant Pop-up · Whisper & WebSpeech
            </p>
          </div>
        </div>

        {/* Language Selector + Engine Toggle + TTS Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Pills (English, Marathi, Hindi Only) */}
          <div className="flex items-center rounded-xl border border-white/10 bg-slate-950/80 p-1">
            {CHAT_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageChange(lang.code as any)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedLang === lang.code
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </button>
            ))}
          </div>

          {/* Dual-Engine Mode Toggle Pill */}
          <button
            type="button"
            onClick={handleToggleSpeechEngine}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
              speechEngineMode === "whisper"
                ? "border-amber-500/50 bg-amber-950/40 text-amber-300 hover:border-amber-400"
                : "border-cyan-500/50 bg-cyan-950/40 text-cyan-300 hover:border-cyan-400"
            }`}
            title="Click to toggle between Whisper API (Cloud STT) and Browser WebSpeech (Continuous Local STT)"
          >
            {speechEngineMode === "whisper" ? (
              <>
                <Zap size={13} className="text-amber-400 fill-amber-400" />
                <span>⚡ Whisper API</span>
              </>
            ) : (
              <>
                <Globe size={13} className="text-cyan-400" />
                <span>🌐 WebSpeech</span>
              </>
            )}
          </button>

          {/* Mic & Audio Settings Launcher */}
          <button
            type="button"
            onClick={() => setAudioModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300 transition"
            title="Configure Microphone, Acoustic Settings & Whisper API Key"
          >
            <Sliders size={13} />
            <span className="hidden sm:inline">Mic Settings</span>
          </button>

          {/* Auto TTS Toggle */}
          <button
            type="button"
            onClick={() => {
              setAutoTts(!autoTts);
              notify("info", !autoTts ? "Auto-Speak Answers Enabled" : "Auto-Speak Muted");
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              autoTts
                ? "border-cyan-500/40 bg-cyan-950/40 text-cyan-300 shadow-sm"
                : "border-white/10 bg-slate-900/60 text-slate-400 hover:text-slate-200"
            }`}
            title="Auto-speak incoming assistant responses"
          >
            {autoTts ? <Volume2 size={14} className="text-cyan-400" /> : <VolumeX size={14} />}
            <span>Auto Voice</span>
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={clearChat}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-400 hover:border-rose-500/40 hover:text-rose-300 transition"
            title="Clear Chat History"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Main Chat Feed */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-inner space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-500 font-mono">
              {msg.role === "user" ? (
                <>
                  <span>You</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                    <Sparkles size={11} /> ColdGuard AI
                  </span>
                  {msg.loraMeta && (
                    <span className="text-[10px] text-purple-300 bg-purple-950/40 border border-purple-500/30 px-1.5 py-0.2 rounded">
                      LoRA ({msg.loraMeta.latency_ms}ms)
                    </span>
                  )}
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </>
              )}
            </div>

            <div
              className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-md text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none border border-cyan-400/30"
                  : "bg-slate-900/90 text-slate-100 rounded-tl-none border border-white/10"
              }`}
            >
              {/* Message Content */}
              <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

              {/* Live Telemetry Chips Attached to Assistant Answer */}
              {msg.telemetryChips && msg.telemetryChips.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1 w-full mb-0.5">
                    <Thermometer size={11} className="text-cyan-400" /> Live Room Readings:
                  </span>
                  {msg.telemetryChips.map((chip) => (
                    <div
                      key={chip.zone_id}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono border ${
                        chip.safe
                          ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                          : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                      }`}
                    >
                      <span className="font-sans font-semibold">{chip.name}:</span>
                      <strong>{chip.temperature}</strong>
                      <span className="text-[10px] opacity-80">({chip.status})</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons on Bubble */}
              {msg.role === "assistant" && (
                <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-white/5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSpeakMessage(msg)}
                      className={`flex items-center gap-1 hover:text-cyan-300 transition ${
                        isSpeaking && speakingMessageId === msg.id ? "text-cyan-400 font-semibold animate-pulse" : ""
                      }`}
                    >
                      {isSpeaking && speakingMessageId === msg.id ? (
                        <>
                          <Square size={12} className="fill-rose-400 text-rose-400" />
                          <span>Stop Audio</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={12} />
                          <span>Speak Aloud</span>
                        </>
                      )}
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(msg.content)}
                      className="flex items-center gap-1 hover:text-slate-200 transition"
                    >
                      <Copy size={11} /> Copy
                    </button>
                  </div>
                  {msg.language && (
                    <span className="text-[10px] font-mono text-slate-500 uppercase">
                      Lang: {msg.language}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Consulting LLM / Telemetry Indicator */}
        {loading && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900/60 border border-white/10 px-4 py-3 max-w-xs text-xs text-cyan-300 animate-pulse">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>Consulting live telemetry & LoRA cold-chain model…</span>
          </div>
        )}

        {/* Transcribing Indicator */}
        {isTranscribing && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-purple-950/40 border border-purple-500/40 px-4 py-3 max-w-sm text-xs text-purple-300 animate-pulse">
            <Radio size={14} className="text-purple-400 animate-spin" />
            <span>Transcribing speech with Whisper API in {selectedLang.toUpperCase()}…</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Suggestions */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
        <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0 font-medium">
          <HelpCircle size={13} className="text-cyan-400" /> Try asking:
        </span>
        {currentPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            className="shrink-0 text-xs rounded-full border border-cyan-500/20 bg-cyan-950/30 px-3 py-1 text-cyan-300 hover:border-cyan-400/50 hover:bg-cyan-900/40 transition-colors whitespace-nowrap"
          >
            "{prompt}"
          </button>
        ))}
      </div>

      {/* Input Bar with Enhanced Voice Recording Interface */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3 shadow-xl backdrop-blur-md">
        {/* Dynamic Live Recording Panel */}
        {isRecording && (
          <div className="mb-2.5 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/60 via-slate-900/90 to-purple-950/50 p-3 text-xs shadow-lg backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              {/* Left: Indicator, Engine Badge, Timer */}
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <span className="font-bold text-rose-200 tracking-wide flex items-center gap-1.5">
                  Recording {formatSeconds(recordingSeconds)}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono text-cyan-300 flex items-center gap-1">
                  {speechEngineMode === "whisper" ? (
                    <>
                      <Zap size={11} className="text-amber-400 fill-amber-400" /> Whisper STT
                    </>
                  ) : (
                    <>
                      <Globe size={11} className="text-cyan-400" /> WebSpeech Continuous
                    </>
                  )}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">
                  {CHAT_LANGUAGES.find((l) => l.code === selectedLang)?.flag}{" "}
                  {CHAT_LANGUAGES.find((l) => l.code === selectedLang)?.nativeName}
                </span>
              </div>

              {/* Center: Live Real-time Decibel Audio Waveform */}
              <div className="flex items-center gap-1 h-5 px-3 py-0.5 rounded-lg bg-black/40 border border-white/5">
                {[0.4, 0.8, 1.0, 0.6, 0.9, 0.5, 0.7].map((factor, i) => {
                  const barHeight = Math.max(4, Math.min(20, volumeLevel * 75 * factor + 4));
                  return (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-gradient-to-t from-cyan-500 to-rose-400 transition-all duration-75"
                      style={{
                        height: `${barHeight}px`,
                        opacity: Math.max(0.3, volumeLevel * 1.5),
                      }}
                    />
                  );
                })}
              </div>

              {/* Right: Quick Action Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => stopRecordingAndSend(true)}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition shadow-sm"
                  title="Submit transcribed question immediately"
                >
                  <Check size={12} /> Send Now
                </button>
                <button
                  type="button"
                  onClick={() => stopRecordingAndSend(false)}
                  className="flex items-center gap-1 rounded-lg border border-white/20 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 transition"
                  title="Finish recording and place text in input box for editing"
                >
                  <Edit3 size={11} /> Done / Edit
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 px-2 py-1 text-[11px] font-medium text-rose-300 transition"
                  title="Cancel recording"
                >
                  <X size={11} /> Cancel
                </button>
              </div>
            </div>

            {/* Live Interim Transcript Preview */}
            <div className="mt-2 flex items-start gap-2 text-xs">
              <span className="text-slate-400 font-medium shrink-0 pt-0.5">Heard so far:</span>
              <p className="font-sans text-cyan-200 italic line-clamp-2">
                "{interimSpeech || inputValue || "Listening… speak naturally into your microphone"}"
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Voice Input Button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-all ${
              isRecording
                ? "border-rose-400 bg-rose-500/30 text-rose-300 animate-pulse shadow-[0_0_15px_#F43F5E]"
                : "border-white/10 bg-slate-800 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
            }`}
            title={
              isRecording
                ? "Click to finish and send speech query"
                : `Click to speak with ${speechEngineMode === "whisper" ? "Whisper API" : "WebSpeech"} in ${
                    CHAT_LANGUAGES.find((l) => l.code === selectedLang)?.label
                  }`
            }
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            {/* Small engine indicator dot */}
            <span
              className={`absolute top-1 right-1 h-2 w-2 rounded-full ${
                speechEngineMode === "whisper" ? "bg-amber-400" : "bg-cyan-400"
              }`}
            />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              selectedLang === "mr"
                ? "तापमान, अलार्म किंवा उपकरणांविषयी कोणताही प्रश्न विचारा..."
                : selectedLang === "hi"
                ? "तापमान, अलर्ट या कोल्ड स्टोरेज नियमों के बारे में पूछें..."
                : "Ask anything about room temperatures, active alerts, or cold storage rules..."
            }
            className="flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${
              inputValue.trim() && !loading
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md hover:from-cyan-400 hover:to-blue-500 cursor-pointer"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Audio & Mic Configuration Modal */}
      <AudioControlModal
        open={audioModalOpen}
        onClose={() => {
          setAudioModalOpen(false);
          setEngineModeState(getSpeechEngineMode());
        }}
      />
    </div>
  );
}
