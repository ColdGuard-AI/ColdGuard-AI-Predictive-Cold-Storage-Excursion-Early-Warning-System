import {
  BellRing,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Key,
  Mic,
  Play,
  Radio,
  Save,
  ShieldAlert,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  getSpeechEngineMode,
  getWhisperApiKey,
  getWhisperEndpoint,
  getWhisperProvider,
  isAudioAlertsEnabled,
  isVoicePlaybackEnabled,
  setAudioAlertsEnabled,
  setSpeechEngineMode,
  setVoicePlaybackEnabled,
  setWhisperApiKey,
  setWhisperEndpoint,
  setWhisperProvider,
  SoundEffects,
  VoiceSynthesizer,
} from "../lib/audio";

export function AudioControlModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [audioEnabled, setAudioState] = useState(isAudioAlertsEnabled);
  const [voiceEnabled, setVoiceState] = useState(isVoicePlaybackEnabled);
  const [engineMode, setEngineModeState] = useState<"whisper" | "browser">(getSpeechEngineMode);
  const [provider, setProviderState] = useState<"groq" | "openai" | "custom">(getWhisperProvider);
  const [apiKey, setApiKeyState] = useState(getWhisperApiKey);
  const [endpoint, setEndpointState] = useState(getWhisperEndpoint);
  const [showKey, setShowKey] = useState(false);
  const [savedBadge, setSavedBadge] = useState<string | null>(null);

  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const toggleAudio = (val: boolean) => {
    setAudioState(val);
    setAudioAlertsEnabled(val);
    if (val) {
      SoundEffects.playChime();
    }
  };

  const toggleVoice = (val: boolean) => {
    setVoiceState(val);
    setVoicePlaybackEnabled(val);
    if (val) {
      VoiceSynthesizer.speak("Voice guidance enabled.");
    } else {
      VoiceSynthesizer.stop();
    }
  };

  const handleSaveWhisperConfig = () => {
    setSpeechEngineMode(engineMode);
    setWhisperProvider(provider);
    setWhisperApiKey(apiKey);
    setWhisperEndpoint(endpoint);
    SoundEffects.playChime();
    setSavedBadge("Settings saved successfully!");
    setTimeout(() => setSavedBadge(null), 3000);
  };

  const handleTestSiren = () => {
    setIsPlayingTest(true);
    setTestSuccessMsg("Playing acoustic excursion siren test...");
    SoundEffects.playExcursionAlarm(2.0);
    setTimeout(() => {
      setIsPlayingTest(false);
      setTestSuccessMsg(null);
    }, 2200);
  };

  const handleTestVoice = () => {
    setIsPlayingTest(true);
    setTestSuccessMsg("Testing synthesized speech announcement...");
    VoiceSynthesizer.speak(
      "Attention cold storage team. Simulated excursion warning: Vaccine Storage A is projecting a breach in 26 minutes.",
      () => {
        setIsPlayingTest(false);
        setTestSuccessMsg(null);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg rounded-2xl border border-cyan-500/30 bg-[#0c1424] p-6 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Volume2 size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                Audio & Speech Intelligence
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Whisper API
                </span>
              </h3>
              <p className="text-xs text-slate-400">Warehouse excursion alarms & high-precision STT</p>
            </div>
          </div>
          <button
            onClick={() => {
              VoiceSynthesizer.stop();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Banner */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-950/30 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                audioEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Acoustic Siren Status
            </span>
          </div>
          <span
            className={`text-xs font-bold font-mono ${
              audioEnabled ? "text-emerald-400" : "text-slate-500"
            }`}
          >
            {audioEnabled ? "ARMED & ACTIVE" : "MUTED"}
          </span>
        </div>

        {/* Section: Speech-to-Text Engine Selection */}
        <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mic size={16} className="text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Speech-to-Text Recognition Engine
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
              API Powered
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={() => {
                setEngineModeState("whisper");
                setSpeechEngineMode("whisper");
              }}
              className={`p-3 rounded-xl border text-left transition ${
                engineMode === "whisper"
                  ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  : "border-white/5 bg-slate-950/40 hover:border-white/20 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-cyan-400" />
                  Whisper API
                </span>
                {engineMode === "whisper" && (
                  <CheckCircle2 size={14} className="text-cyan-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Accurate deep learning model. Recognizes refrigeration accents and technical terms cleanly.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setEngineModeState("browser");
                setSpeechEngineMode("browser");
              }}
              className={`p-3 rounded-xl border text-left transition ${
                engineMode === "browser"
                  ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                  : "border-white/5 bg-slate-950/40 hover:border-white/20 text-slate-400"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Cpu size={13} className="text-slate-400" />
                  Browser Speech
                </span>
                {engineMode === "browser" && (
                  <CheckCircle2 size={14} className="text-cyan-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Built-in browser WebSpeech API. Works offline without API key but may mishear complex words.
              </p>
            </button>
          </div>

          {/* Whisper API Configuration Box */}
          {engineMode === "whisper" && (
            <div className="space-y-3 pt-3 border-t border-white/10">
              {/* Provider Selection */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                  Whisper API Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setProviderState("groq")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                      provider === "groq"
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 font-bold"
                        : "border-white/5 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    ⚡ Groq Whisper
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderState("openai")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                      provider === "openai"
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 font-bold"
                        : "border-white/5 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    OpenAI Whisper
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderState("custom")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                      provider === "custom"
                        ? "border-purple-400 bg-purple-500/20 text-purple-300 font-bold"
                        : "border-white/5 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Custom Server
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {provider === "groq"
                    ? "Groq whisper-large-v3-turbo processes speech in ~250ms with zero lag."
                    : provider === "openai"
                    ? "OpenAI official whisper-1 transcription endpoint."
                    : "Local or private self-hosted Whisper endpoint compatible with OpenAI API format."}
                </p>
              </div>

              {/* API Key input */}
              {provider !== "custom" && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                      <Key size={12} className="text-cyan-400" />
                      {provider === "groq" ? "Groq API Key" : "OpenAI API Key"}
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {apiKey ? "Key configured" : "Optional if set in backend environment"}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKeyState(e.target.value)}
                      placeholder={provider === "groq" ? "gsk_..." : "sk-..."}
                      className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Saved privately in your local browser storage. You can get a free key from{" "}
                    {provider === "groq" ? (
                      <a
                        href="https://console.groq.com/keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 underline hover:text-cyan-300"
                      >
                        console.groq.com
                      </a>
                    ) : (
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 underline hover:text-cyan-300"
                      >
                        platform.openai.com
                      </a>
                    )}
                    .
                  </p>
                </div>
              )}

              {/* Custom Endpoint input */}
              {provider === "custom" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Custom Whisper URL Endpoint
                  </label>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpointState(e.target.value)}
                    placeholder="http://localhost:8000/v1/audio/transcriptions"
                    className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveWhisperConfig}
                className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-md"
              >
                <Save size={14} />
                Save Whisper API Settings
              </button>

              {savedBadge && (
                <p className="text-center text-xs text-emerald-400 font-semibold animate-pulse">
                  {savedBadge}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Audio Toggles */}
        <div className="mt-4 space-y-3">
          {/* Toggle 1: Emergency Audio Alarms */}
          <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
            <div>
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <BellRing size={15} className="text-cyan-400" />
                Emergency Excursion Siren
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pulsing acoustic sirens sound when an excursion is projected within 30 minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleAudio(!audioEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                audioEnabled ? "bg-cyan-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  audioEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Toggle 2: Synthesized Voice Guidance */}
          <div className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-3.5">
            <div>
              <div className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <Radio size={15} className="text-cyan-400" />
                Voice Guidance & Answer Readout
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Spoken readouts of What-If scenario answers and critical room alerts for hands-free warehouse work.
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleVoice(!voiceEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                voiceEnabled ? "bg-cyan-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  voiceEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Audio Test Controls */}
        <div className="mt-4 rounded-xl border border-white/5 bg-slate-950/70 p-3.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
            Test Audio Systems
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleTestSiren}
              disabled={isPlayingTest}
              className="py-2 px-3 rounded-lg border border-rose-500/30 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <ShieldAlert size={14} />
              <span>Test Siren</span>
            </button>
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={isPlayingTest}
              className="py-2 px-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-900/30 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Play size={14} />
              <span>Test Voice</span>
            </button>
          </div>
          {testSuccessMsg && (
            <p className="mt-2 text-center text-xs text-cyan-300 animate-pulse">
              {testSuccessMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              VoiceSynthesizer.stop();
              onClose();
            }}
            className="py-2 px-5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
