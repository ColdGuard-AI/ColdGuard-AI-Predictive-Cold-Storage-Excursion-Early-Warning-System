import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
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
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import { api } from "../services/api";
import {
  getSpeechEngineMode,
  normalizeColdChainTranscript,
  setSpeechEngineMode,
  setSpeechRecognitionLang,
  VoiceInputSession,
  VoiceSynthesizer,
  WhisperAudioRecorder,
} from "../lib/audio";
import { AudioControlModal } from "./AudioControlModal";

interface WidgetMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  speechText?: string;
  language?: string;
  timestamp?: string;
  telemetryChips?: {
    zone_id: string;
    name: string;
    temperature: string;
    status: string;
    safe: boolean;
  }[];
}

const WIDGET_LANGS = [
  { code: "en", label: "EN", native: "English", flag: "🇬🇧", locale: "en-US" },
  { code: "mr", label: "MR", native: "मराठी", flag: "🇮🇳", locale: "mr-IN" },
  { code: "hi", label: "HI", native: "हिंदी", flag: "🇮🇳", locale: "hi-IN" },
];

const WELCOME_MESSAGES: Record<string, { content: string; speechText: string }> = {
  en: {
    content:
      "Hello! I am ColdGuard Assistant, powered by LoRA cold-chain domain intelligence. Ask me anything about room temperatures, active alerts, compressor status, or WHO guidelines.",
    speechText: "Hello! I am ColdGuard Assistant. How can I assist you with cold storage today?",
  },
  mr: {
    content:
      "नमस्कार! मी कोल्डगार्ड एआय सहाय्यक आहे. मी थेट सेन्सर टेलीमेट्री आणि लोरा (LoRA) कोल्ड-चेन तंत्रज्ञानाने जोडलेला आहे. आपण मला कोणत्याही कोल्ड रूमचे तापमान, अलार्म किंवा उपकरणांबद्दल विचारू शकता.",
    speechText:
      "नमस्कार! मी कोल्डगार्ड एआय सहाय्यक आहे. कोल्ड स्टोरेजचे तापमान आणि उपकरणांबद्दल आपण मला विचारू शकता.",
  },
  hi: {
    content:
      "नमस्ते! मैं कोल्डगार्ड एआई सहायक हूँ। मैं रियल-टाइम टेलीमेट्री और लोरा (LoRA) डोमेन मॉडल से संचालित हूँ। आप मुझसे कोल्ड स्टोरेज तापमान, अलर्ट या उपकरणों के बारे में पूछ सकते हैं।",
    speechText:
      "नमस्ते! मैं कोल्डगार्ड एआई सहायक हूँ। मैं कोल्ड स्टोरेज निगरानी में आपकी सहायता के लिए तैयार हूँ।",
  },
};

const QUICK_PROMPTS_BY_LANG: Record<string, string[]> = {
  en: [
    "Room temperatures?",
    "Active alerts?",
    "Vaccine Store A compressor?",
    "Will milk spoil if door left open?",
  ],
  mr: [
    "सर्व रूमचे तापमान किती आहे?",
    "सध्या काही अलार्म आहे का?",
    "व्हॅक्सिन स्टोअर ए मधील कंप्रेसर?",
    "डेअरी चिलरचा दरवाजा उघडा राहिल्यास?",
  ],
  hi: [
    "सभी रूम का तापमान क्या है?",
    "क्या अभी कोई एक्टिव अलर्ट है?",
    "वैक्सीन स्टोर ए का कंप्रेसर?",
    "दूध के लिए सुरक्षित तापमान?",
  ],
};

export default function FloatingChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"en" | "mr" | "hi">("en");
  const [speechEngineMode, setEngineModeState] = useState<"whisper" | "browser">(getSpeechEngineMode);
  const [audioModalOpen, setAudioModalOpen] = useState(false);

  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      id: "w-1",
      role: "assistant",
      content: WELCOME_MESSAGES.en.content,
      speechText: WELCOME_MESSAGES.en.speechText,
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

  // Live audio waveform and timer states
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [interimSpeech, setInterimSpeech] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const whisperRecorder = useRef(new WhisperAudioRecorder());
  const voiceSession = useRef(new VoiceInputSession());
  const recordingTimer = useRef<any>(null);

  // Listen to open-chat custom events from sidebar or elsewhere
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("coldguard:open-chat", handleOpen);
    return () => window.removeEventListener("coldguard:open-chat", handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, loading]);

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

  const handleLanguageChange = (code: "en" | "mr" | "hi") => {
    setSelectedLang(code);
    const langObj = WIDGET_LANGS.find((l) => l.code === code);
    setSpeechRecognitionLang(langObj?.locale || "en-US");

    // If chat only has initial welcome message, switch it to the target language
    if (messages.length === 1 && messages[0].role === "assistant") {
      const welcome = WELCOME_MESSAGES[code] || WELCOME_MESSAGES.en;
      setMessages([
        {
          id: `w-${code}`,
          role: "assistant",
          content: welcome.content,
          speechText: welcome.speechText,
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
  };

  const handleSendMessage = async (text?: string) => {
    const textToSend = (text !== undefined ? text : inputValue).trim();
    if (!textToSend || loading) return;

    VoiceSynthesizer.stop();
    setIsSpeaking(false);
    setSpeakingMessageId(null);

    const userMsg: WidgetMessage = {
      id: `u-${Date.now()}`,
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
      const historyTurns = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.chat({
        message: textToSend,
        history: historyTurns,
        language: selectedLang,
      });

      const botMsg: WidgetMessage = {
        id: `b-${Date.now()}`,
        role: "assistant",
        content: res.reply || "No response received.",
        speechText: res.speech_text || res.reply,
        language: res.language || selectedLang,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        telemetryChips: res.telemetry_chips || [],
      };

      setMessages((prev) => [...prev, botMsg]);

      if (autoTts && botMsg.speechText) {
        handleSpeakMessage(botMsg);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err?.message || "Failed to reach ColdGuard AI."}`,
          language: selectedLang,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeakMessage = (msg: WidgetMessage) => {
    if (isSpeaking && speakingMessageId === msg.id) {
      VoiceSynthesizer.stop();
      setIsSpeaking(false);
      setSpeakingMessageId(null);
      return;
    }
    VoiceSynthesizer.stop();
    setIsSpeaking(true);
    setSpeakingMessageId(msg.id);
    const langObj = WIDGET_LANGS.find((l) => l.code === (msg.language || selectedLang));
    const targetLocale = langObj?.locale || (selectedLang === "mr" ? "mr-IN" : selectedLang === "hi" ? "hi-IN" : "en-US");
    VoiceSynthesizer.speak(msg.speechText || msg.content, targetLocale, () => {
      setIsSpeaking(false);
      setSpeakingMessageId(null);
    });
  };

  const handleTranslateAndSpeak = async (msg: WidgetMessage) => {
    try {
      setLoading(true);
      VoiceSynthesizer.stop();
      setIsSpeaking(false);
      setSpeakingMessageId(null);

      const res = await api.chat({
        message: `Translate and summarize the following cold-chain operational status in fluent ${selectedLang === "mr" ? "Marathi (मराठी)" : selectedLang === "hi" ? "Hindi (हिंदी)" : "English"}: "${msg.content}"`,
        language: selectedLang,
      });

      const translatedMsg: WidgetMessage = {
        id: `trans-${Date.now()}`,
        role: "assistant",
        content: res.reply || msg.content,
        speechText: res.speech_text || res.reply,
        language: selectedLang,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        telemetryChips: res.telemetry_chips || [],
      };

      setMessages((prev) => [...prev, translatedMsg]);
      handleSpeakMessage(translatedMsg);
    } catch (err: any) {
      console.error("Translation failed:", err);
    } finally {
      setLoading(false);
    }
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

    const langObj = WIDGET_LANGS.find((l) => l.code === selectedLang);
    const targetLocale = langObj?.locale || (selectedLang === "mr" ? "mr-IN" : selectedLang === "hi" ? "hi-IN" : "en-US");

    if (speechEngineMode === "whisper") {
      if (whisperRecorder.current.isSupported()) {
        setIsRecording(true);
        whisperRecorder.current.start(
          (err) => {
            if (recordingTimer.current) clearInterval(recordingTimer.current);
            setIsRecording(false);
          },
          (vol) => setVolumeLevel(vol)
        );
        return;
      }
    }

    // WebSpeech continuous mode
    if (voiceSession.current.isSupported()) {
      voiceSession.current.setLang(targetLocale);
      setIsRecording(true);
      voiceSession.current.start(
        (interimText) => {
          setInterimSpeech(interimText);
          setInputValue(interimText);
        },
        (finalText) => {
          const cleanText = normalizeColdChainTranscript(finalText.trim());
          if (cleanText) {
            setInterimSpeech(cleanText);
            setInputValue(cleanText);
          }
        },
        (err) => {
          if (recordingTimer.current) clearInterval(recordingTimer.current);
          setIsRecording(false);
        },
        () => {
          if (recordingTimer.current) clearInterval(recordingTimer.current);
          setIsRecording(false);
        },
        (vol) => setVolumeLevel(vol),
        2200
      );
    } else {
      setIsRecording(true);
      whisperRecorder.current.start(
        (err) => {
          if (recordingTimer.current) clearInterval(recordingTimer.current);
          setIsRecording(false);
        },
        (vol) => setVolumeLevel(vol)
      );
    }
  };

  const stopRecordingAndSend = (autoSend = false) => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
    }

    if (voiceSession.current.active()) {
      voiceSession.current.stop();
      setIsRecording(false);
      const currentText = normalizeColdChainTranscript(inputValue.trim() || interimSpeech.trim());
      if (currentText && autoSend) {
        handleSendMessage(currentText);
      }
      return;
    }

    if (whisperRecorder.current.active()) {
      setIsRecording(false);
      setIsTranscribing(true);

      whisperRecorder.current.stop(
        (transcribedText) => {
          setIsTranscribing(false);
          const cleanText = normalizeColdChainTranscript(transcribedText.trim());
          if (cleanText) {
            setInputValue(cleanText);
            setInterimSpeech(cleanText);
            if (autoSend) {
              handleSendMessage(cleanText);
            }
          }
        },
        (err) => {
          setIsTranscribing(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `err-${Date.now()}`,
              role: "assistant",
              content: `Voice error: ${err}\n(Tip: Toggle to 🌐 WebSpeech mode at the top for instant browser speech recognition).`,
              language: selectedLang,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        },
        undefined,
        selectedLang
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
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const quickPrompts = QUICK_PROMPTS_BY_LANG[selectedLang] || QUICK_PROMPTS_BY_LANG.en;

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans">
      {/* Purely Circular Floating Action Icon */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(6,182,212,0.45)] hover:shadow-[0_0_28px_rgba(6,182,212,0.7)] hover:scale-110 active:scale-95 transition-all cursor-pointer border border-cyan-300/40"
          title="Open ColdGuard AI Assistant Pop-up Window"
          aria-label="Open ColdGuard AI Assistant Pop-up"
        >
          <Bot size={20} className="text-white group-hover:rotate-12 transition-transform drop-shadow" />
          {/* Small live indicator ping dot */}
          <span className="absolute top-0 right-0 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-slate-950"></span>
          </span>
        </button>
      )}

      {/* Pop-up Window (Strictly pop-up, never maximized to a tab) */}
      {isOpen && (
        <div className="flex h-[580px] w-[370px] sm:w-[430px] max-w-[94vw] max-h-[88vh] flex-col rounded-2xl border border-cyan-500/30 bg-slate-950/95 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header with Small Symbols */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-sm">
                <Bot size={14} className="text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white tracking-tight">ColdGuard AI</span>
                  <span className="text-[9px] text-purple-300 font-mono bg-purple-950/40 border border-purple-500/30 px-1 py-0.2 rounded">
                    LoRA
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">Assistant Pop-up</div>
              </div>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-1.5">
              {/* Language Selector */}
              <div className="flex rounded-lg border border-white/10 bg-slate-900/90 p-0.5">
                {WIDGET_LANGS.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code as any)}
                    className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition ${
                      selectedLang === lang.code
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/30"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title={lang.native}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Dual-Engine Mode Toggle */}
              <button
                type="button"
                onClick={handleToggleSpeechEngine}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[10px] font-semibold transition ${
                  speechEngineMode === "whisper"
                    ? "border-amber-500/50 bg-amber-950/40 text-amber-300"
                    : "border-cyan-500/50 bg-cyan-950/40 text-cyan-300"
                }`}
                title="Toggle between ⚡ Whisper API and 🌐 WebSpeech"
              >
                {speechEngineMode === "whisper" ? (
                  <>
                    <Zap size={10} className="text-amber-400 fill-amber-400" />
                    <span>Whisper</span>
                  </>
                ) : (
                  <>
                    <Globe size={10} className="text-cyan-400" />
                    <span>WebSpeech</span>
                  </>
                )}
              </button>

              {/* Mic Settings Button */}
              <button
                type="button"
                onClick={() => setAudioModalOpen(true)}
                className="p-1 rounded-lg border border-white/10 text-slate-400 hover:text-cyan-300 hover:border-cyan-400/40 transition"
                title="Configure Mic & Whisper API Key"
              >
                <Sliders size={12} />
              </button>

              {/* Auto Voice TTS Toggle */}
              <button
                type="button"
                onClick={() => setAutoTts(!autoTts)}
                className={`p-1 rounded-lg border transition ${
                  autoTts
                    ? "text-cyan-300 border-cyan-500/40 bg-cyan-950/40"
                    : "text-slate-400 border-white/10 hover:text-slate-200"
                }`}
                title="Auto-speak incoming responses"
              >
                {autoTts ? <Volume2 size={12} /> : <VolumeX size={12} />}
              </button>

              {/* Close Button (No maximize button exists) */}
              <button
                type="button"
                onClick={() => {
                  VoiceSynthesizer.stop();
                  setIsOpen(false);
                }}
                className="p-1 rounded-lg border border-white/10 text-slate-400 hover:text-rose-400 hover:border-rose-400 transition"
                title="Close Pop-up Window"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs bg-slate-950/70">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5 px-1 text-[10px] text-slate-500 font-mono">
                  {m.role === "user" ? (
                    <span>You • {m.timestamp}</span>
                  ) : (
                    <span className="text-cyan-400 font-semibold flex items-center gap-1">
                      <Sparkles size={9} /> ColdGuard AI • {m.timestamp}
                    </span>
                  )}
                </div>

                <div
                  className={`rounded-xl px-3 py-2 max-w-[85%] leading-relaxed shadow-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none border border-cyan-400/30"
                      : "bg-slate-900/90 text-slate-100 rounded-tl-none border border-white/10"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Telemetry Chips */}
                  {m.telemetryChips && m.telemetryChips.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex flex-wrap gap-1">
                      {m.telemetryChips.map((chip) => (
                        <span
                          key={chip.zone_id}
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                            chip.safe
                              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                              : "bg-rose-950/40 border-rose-500/40 text-rose-300"
                          }`}
                        >
                          <span className="font-semibold">{chip.name}:</span>
                          <span>{chip.temperature}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bubble audio trigger & translation */}
                  {m.role === "assistant" && (
                    <div className="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(m)}
                        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition hover:text-cyan-300 ${
                          isSpeaking && speakingMessageId === m.id
                            ? "text-cyan-300 font-semibold bg-cyan-950/40 border border-cyan-500/30"
                            : "hover:bg-white/5"
                        }`}
                        title="Play audible voice synthesis for this response"
                      >
                        {isSpeaking && speakingMessageId === m.id ? (
                          <>
                            <Square size={9} className="fill-rose-400 text-rose-400" />
                            <span>Stop voice</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={10} className="text-cyan-400" />
                            <span>
                              {m.language === "mr"
                                ? "मराठीत ऐका (Listen)"
                                : m.language === "hi"
                                ? "हिंदी में सुनें"
                                : "Listen Voice"}
                            </span>
                          </>
                        )}
                      </button>

                      {/* If message is in a different language from selected language, give 1-click translate & speak */}
                      {m.language !== selectedLang && (
                        <button
                          type="button"
                          onClick={() => handleTranslateAndSpeak(m)}
                          className="flex items-center gap-1 text-[9px] text-purple-300 hover:text-purple-200 bg-purple-950/40 border border-purple-500/20 px-1.5 py-0.5 rounded transition"
                          title="Translate this response to the active language and speak aloud"
                        >
                          <Sparkles size={9} />
                          <span>
                            {selectedLang === "mr" ? "मराठीत भाषांतर करा" : selectedLang === "hi" ? "हिंदी अनुवाद" : "Translate"}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 max-w-xs text-[11px] text-cyan-300 animate-pulse">
                <div className="h-2.5 w-2.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                <span>Consulting cold-chain telemetry…</span>
              </div>
            )}

            {isTranscribing && (
              <div className="flex items-center gap-2 rounded-xl bg-purple-950/40 border border-purple-500/40 px-3 py-2 max-w-xs text-[11px] text-purple-300 animate-pulse">
                <Radio size={12} className="text-purple-400 animate-spin" />
                <span>Transcribing via Whisper API…</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="flex items-center gap-1 px-3 py-1 bg-slate-950 border-t border-white/5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] text-slate-500 font-medium shrink-0 flex items-center gap-0.5">
              <HelpCircle size={10} className="text-cyan-400" />
            </span>
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p)}
                className="shrink-0 text-[10px] rounded-full border border-cyan-500/20 bg-cyan-950/30 px-2 py-0.5 text-cyan-300 hover:border-cyan-400/50 hover:bg-cyan-900/40 transition whitespace-nowrap"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Active Voice Recording Panel */}
          {isRecording && (
            <div className="border-t border-rose-500/30 bg-gradient-to-r from-rose-950/70 via-slate-900/95 to-purple-950/60 p-2 text-xs backdrop-blur-md animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="font-bold text-rose-200 text-[11px]">
                    Rec {formatSeconds(recordingSeconds)}
                  </span>
                  <span className="rounded bg-white/10 px-1 text-[9px] font-mono text-cyan-300">
                    {speechEngineMode === "whisper" ? "⚡ Whisper" : "🌐 WebSpeech"}
                  </span>
                </div>

                {/* 5-Bar Volume Decibel Waveform */}
                <div className="flex items-center gap-0.5 h-3 px-1.5 rounded bg-black/40 border border-white/5">
                  {[0.4, 0.8, 1.0, 0.6, 0.9].map((f, i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-full bg-cyan-400 transition-all duration-75"
                      style={{
                        height: `${Math.max(3, Math.min(12, volumeLevel * 40 * f + 3))}px`,
                        opacity: Math.max(0.4, volumeLevel * 1.5),
                      }}
                    />
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => stopRecordingAndSend(true)}
                    className="flex items-center gap-0.5 rounded bg-emerald-600 hover:bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white transition shadow-sm"
                  >
                    <Check size={10} /> Send
                  </button>
                  <button
                    type="button"
                    onClick={() => stopRecordingAndSend(false)}
                    className="flex items-center gap-0.5 rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-200 transition"
                  >
                    <Edit3 size={10} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="flex items-center gap-0.5 rounded bg-rose-950/60 hover:bg-rose-900 px-1.5 py-0.5 text-[10px] text-rose-300 transition"
                  >
                    <X size={10} />
                  </button>
                </div>
              </div>

              {/* Interim Text */}
              <div className="mt-1 text-[11px] text-cyan-200 italic line-clamp-1">
                "{interimSpeech || inputValue || "Listening… speak naturally"}"
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-2 border-t border-white/10 bg-slate-900/90">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              {/* Voice Mic Button with small engine indicator */}
              <button
                type="button"
                onClick={toggleRecording}
                className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${
                  isRecording
                    ? "border-rose-400 bg-rose-500/30 text-rose-300 animate-pulse shadow-[0_0_10px_#F43F5E]"
                    : "border-white/10 bg-slate-800 text-slate-300 hover:border-cyan-400 hover:text-cyan-300"
                }`}
                title={`Click to speak with ${speechEngineMode === "whisper" ? "Whisper API" : "WebSpeech"}`}
              >
                {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
                <span
                  className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${
                    speechEngineMode === "whisper" ? "bg-amber-400" : "bg-cyan-400"
                  }`}
                />
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  selectedLang === "mr"
                    ? "तापमान किंवा अलार्मविषयी विचारा..."
                    : selectedLang === "hi"
                    ? "तापमान या अलर्ट के बारे में पूछें..."
                    : "Ask about temperatures, alerts, rules..."
                }
                className="flex-1 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40 transition"
              />

              <button
                type="submit"
                disabled={!inputValue.trim() || loading}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                  inputValue.trim() && !loading
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow hover:from-cyan-400 hover:to-blue-500 cursor-pointer"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      )}

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
