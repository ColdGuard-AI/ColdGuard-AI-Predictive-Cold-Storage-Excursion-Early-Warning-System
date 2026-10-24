/**
 * ColdGuard AI Web Audio & Speech Recognition Engine
 * Provides hands-free voice querying, acoustic excursion sirens, and text-to-speech feedback.
 */
import { api } from "../services/api";

// Global AudioContext singleton
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Persisted audio preference
const AUDIO_STORAGE_KEY = "coldguard.audioEnabled";
const VOICE_STORAGE_KEY = "coldguard.voiceEnabled";

export function isAudioAlertsEnabled(): boolean {
  try {
    const val = localStorage.getItem(AUDIO_STORAGE_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setAudioAlertsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, String(enabled));
  } catch {}
}

export function isVoicePlaybackEnabled(): boolean {
  try {
    const val = localStorage.getItem(VOICE_STORAGE_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setVoicePlaybackEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, String(enabled));
  } catch {}
}

const AUTO_VOICE_RESULT_KEY = "coldguard.autoVoiceResult";

export function isAutoVoiceResultEnabled(): boolean {
  try {
    const val = localStorage.getItem(AUTO_VOICE_RESULT_KEY);
    return val === null ? true : val === "true"; // Default to true for voice results
  } catch {
    return true;
  }
}

export function setAutoVoiceResultEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_VOICE_RESULT_KEY, String(enabled));
  } catch {}
}

/**
 * Acoustic Sound Synthesizers using native Web Audio oscillators
 */
export const SoundEffects = {
  /** Double-tone notification chime (800Hz -> 1040Hz) */
  playChime() {
    if (!isAudioAlertsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  },

  /** Microphone listening start chirp (520Hz -> 780Hz) */
  playMicStart() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  },

  /** Microphone listening stop chirp (780Hz -> 520Hz) */
  playMicStop() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  },

  /** Urgent pulsing excursion siren (960Hz / 720Hz alternating warble) */
  playExcursionAlarm(durationSeconds = 2.4) {
    if (!isAudioAlertsEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    // Alternate frequency every 150ms
    const cycles = Math.floor(durationSeconds / 0.15);
    for (let i = 0; i < cycles; i++) {
      const t = now + i * 0.15;
      osc.frequency.setValueAtTime(i % 2 === 0 ? 960 : 720, t);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.setValueAtTime(0.25, now + durationSeconds - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSeconds + 0.05);
  },
};

/**
 * Text-to-Speech (TTS) Multilingual Voice Synthesizer
 */
export const VoiceSynthesizer = {
  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  },

  isSpeaking(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis.speaking;
  },

  stop() {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  },

  speak(
    text: string,
    langOrOnEnd?: string | (() => void),
    onEndCallback?: () => void,
    rate = 1.0
  ) {
    let langCode: string | undefined;
    let onEnd: (() => void) | undefined;
    if (typeof langOrOnEnd === "function") {
      onEnd = langOrOnEnd;
      langCode = undefined;
    } else {
      langCode = langOrOnEnd;
      onEnd = onEndCallback;
    }

    if (!this.isSupported() || !isVoicePlaybackEnabled()) {
      onEnd?.();
      return;
    }

    this.stop();

    const targetLang = langCode || getSpeechRecognitionLang() || "en-US";
    const primaryCode = targetLang.split("-")[0].toLowerCase();

    // Clean text for natural speech pronunciation tailored to the target language
    let clean = text
      .replace(/[\*#_`~]/g, "")
      .replace(/[•\-\|➔]/g, " ")
      .replace(/[\[\]\(\)\{\}]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (primaryCode === "mr") {
      clean = clean
        .replace(/°C/g, " अंश सेल्सिअस")
        .replace(/°F/g, " फॅरेनहाइट")
        .replace(/\bmin\b/gi, " मिनिटे")
        .replace(/%/g, " टक्के");
    } else if (primaryCode === "hi") {
      clean = clean
        .replace(/°C/g, " डिग्री सेल्सियस")
        .replace(/°F/g, " डिग्री फारेनहाइट")
        .replace(/\bmin\b/gi, " मिनट")
        .replace(/%/g, " प्रतिशत");
    } else if (primaryCode === "es") {
      clean = clean.replace(/°C/g, " grados Celsius").replace(/°F/g, " grados Fahrenheit");
    } else if (primaryCode === "fr") {
      clean = clean.replace(/°C/g, " degrés Celsius").replace(/°F/g, " degrés Fahrenheit");
    } else if (primaryCode === "de") {
      clean = clean.replace(/°C/g, " Grad Celsius").replace(/°F/g, " Grad Fahrenheit");
    } else if (primaryCode === "pt") {
      clean = clean.replace(/°C/g, " graus Celsius").replace(/°F/g, " graus Fahrenheit");
    } else if (primaryCode === "zh") {
      clean = clean.replace(/°C/g, " 摄氏度");
    } else if (primaryCode === "ja") {
      clean = clean.replace(/°C/g, " 度");
    } else if (primaryCode === "ar") {
      clean = clean.replace(/°C/g, " درجة مئوية");
    } else {
      clean = clean.replace(/°C/g, " degrees Celsius").replace(/°F/g, " degrees Fahrenheit");
    }

    const playWithVoices = (voicesList: SpeechSynthesisVoice[]) => {
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = rate;
      utterance.pitch = 1.0;

      let matchedVoice: SpeechSynthesisVoice | undefined;
      let effectiveLang = targetLang;

      if (primaryCode === "mr") {
        // Priority 1: Native Marathi voice
        matchedVoice =
          voicesList.find((v) => v.lang.toLowerCase() === "mr-in" || v.lang.toLowerCase().startsWith("mr") || v.name.toLowerCase().includes("marathi"));

        if (matchedVoice) {
          effectiveLang = matchedVoice.lang;
        } else {
          // Priority 2 (Standard Windows/Chrome support): Devanagari Hindi voice
          // Hindi TTS shares the Devanagari script & phonology and pronounces Marathi Devanagari text accurately
          matchedVoice =
            voicesList.find((v) => v.lang.toLowerCase() === "hi-in" && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Kalpana") || v.name.includes("Hemant") || v.name.includes("Swara"))) ||
            voicesList.find((v) => v.lang.toLowerCase().startsWith("hi")) ||
            voicesList.find((v) => v.name.toLowerCase().includes("hindi"));

          if (matchedVoice) {
            // Set lang to matched voice's lang so Chromium engine does not reject or cancel utterance
            effectiveLang = matchedVoice.lang || "hi-IN";
          } else {
            // Priority 3: Indian English voice (capable of pronouncing Indian vocabulary)
            matchedVoice =
              voicesList.find((v) => v.lang.toLowerCase() === "en-in" || v.name.toLowerCase().includes("india")) ||
              voicesList.find((v) => v.default) ||
              voicesList[0];
            if (matchedVoice) effectiveLang = matchedVoice.lang;
          }
        }
      } else if (primaryCode === "hi") {
        matchedVoice =
          voicesList.find((v) => v.lang.toLowerCase() === "hi-in" && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Kalpana") || v.name.includes("Hemant"))) ||
          voicesList.find((v) => v.lang.toLowerCase().startsWith("hi")) ||
          voicesList.find((v) => v.lang.toLowerCase() === "en-in") ||
          voicesList[0];
        if (matchedVoice) effectiveLang = matchedVoice.lang;
      } else {
        matchedVoice =
          voicesList.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase() && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Premium"))) ||
          voicesList.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
          voicesList.find((v) => v.lang.toLowerCase().startsWith(primaryCode) && (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Premium"))) ||
          voicesList.find((v) => v.lang.toLowerCase().startsWith(primaryCode)) ||
          voicesList[0];
        if (matchedVoice) effectiveLang = matchedVoice.lang;
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
      utterance.lang = effectiveLang;

      if (onEnd) {
        utterance.onend = () => {
          onEnd();
        };
        utterance.onerror = (err) => {
          console.warn("[VoiceSynthesizer] Speech synthesis utterance error:", err);
          onEnd();
        };
      }

      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {}

      // Short delay prevents race conditions in Chromium audio pipeline on Windows
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.error("[VoiceSynthesizer] SpeechSynthesis.speak failed:", err);
          onEnd?.();
        }
      }, 25);
    };

    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      const handleVoicesChanged = () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        playWithVoices(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener("voiceschanged", handleVoicesChanged);
      setTimeout(() => {
        window.speechSynthesis.removeEventListener("voiceschanged", handleVoicesChanged);
        playWithVoices(window.speechSynthesis.getVoices());
      }, 120);
    } else {
      playWithVoices(voices);
    }
  },
};

/**
 * Browser SpeechRecognition Wrapper for hands-free query input
 */
// Types for webkitSpeechRecognition
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface AppLanguage {
  code: string;
  label: string;
  nativeName: string;
  flag: string;
  whisperCode: string;
}

export const SPEECH_LANGUAGES: AppLanguage[] = [
  { code: "en-US", label: "English (US)", nativeName: "English (US)", flag: "🇬🇧", whisperCode: "en" },
  { code: "mr-IN", label: "Marathi (मराठी)", nativeName: "मराठी", flag: "🇮🇳", whisperCode: "mr" },
  { code: "hi-IN", label: "Hindi (हिन्दी)", nativeName: "हिन्दी", flag: "🇮🇳", whisperCode: "hi" },
  { code: "en-IN", label: "English (India)", nativeName: "English (India)", flag: "🇮🇳", whisperCode: "en" },
  { code: "en-GB", label: "English (UK)", nativeName: "English (UK)", flag: "🇬🇧", whisperCode: "en" },
  { code: "es-ES", label: "Spanish (Español)", nativeName: "Español", flag: "🇪🇸", whisperCode: "es" },
  { code: "fr-FR", label: "French (Français)", nativeName: "Français", flag: "🇫🇷", whisperCode: "fr" },
  { code: "de-DE", label: "German (Deutsch)", nativeName: "Deutsch", flag: "🇩🇪", whisperCode: "de" },
  { code: "pt-BR", label: "Portuguese (Português)", nativeName: "Português", flag: "🇧🇷", whisperCode: "pt" },
  { code: "zh-CN", label: "Chinese (中文)", nativeName: "中文 (简体)", flag: "🇨🇳", whisperCode: "zh" },
  { code: "ja-JP", label: "Japanese (日本語)", nativeName: "日本語", flag: "🇯🇵", whisperCode: "ja" },
  { code: "ar-SA", label: "Arabic (العربية)", nativeName: "العربية", flag: "🇸🇦", whisperCode: "ar" },
];

const SPEECH_LANG_STORAGE_KEY = "coldguard.speechLang";

export function getSpeechRecognitionLang(): string {
  try {
    const saved = localStorage.getItem(SPEECH_LANG_STORAGE_KEY);
    if (saved) return saved;
  } catch {}
  if (typeof navigator !== "undefined" && navigator.language) {
    const nav = navigator.language.toLowerCase();
    const found = SPEECH_LANGUAGES.find((l) => l.code.toLowerCase() === nav || l.code.toLowerCase().startsWith(nav.slice(0, 2)));
    if (found) return found.code;
  }
  return "en-US";
}

export function setSpeechRecognitionLang(code: string): void {
  try {
    localStorage.setItem(SPEECH_LANG_STORAGE_KEY, code);
  } catch {}
}

/**
 * Phonetic & Cold-Chain Domain Transcript Normalizer
 * Corrects typical browser speech recognition errors for HVAC, refrigeration, and cold-chain terms.
 * Handles domain vocabulary for zones, medical cargo, equipment, units, and Marathi/Hindi terms.
 */
export function normalizeColdChainTranscript(text: string): string {
  let t = text;

  const replacements: [RegExp, string][] = [
    // --- Zone Names ---
    [/\b(vaccine\s*room\s*a|waxing\s*store\s*a|wax\s*in\s*store\s*a|vax\s*store\s*a)\b/gi, "Vaccine Store A"],
    [/\b(vaccine\s*store\s*a|vaccine\s*a)\b/gi, "Vaccine Store A"],
    [/\b(dairy\s*killer\s*b|daily\s*chiller\s*b|chiller\s*b|dairy\s*b)\b/gi, "Dairy Chiller B"],
    [/\b(dairy\s*chiller\s*b)\b/gi, "Dairy Chiller B"],
    [/\b(meat\s*freezer\s*c|frieza\s*c|freezer\s*c|meat\s*c)\b/gi, "Meat Freezer C"],
    [/\b(pharma\s*cold\s*room\s*d|farmer\s*cold\s*room\s*d|pharma\s*room\s*d|cold\s*room\s*d)\b/gi, "Pharma Cold Room D"],
    [/\b(produce\s*staging\s*e|staging\s*e|produce\s*e)\b/gi, "Produce Staging E"],

    // --- Equipment & Components ---
    [/\b(impress|impress her|compress|compresser|commerce|compreser)\b/gi, "compressor"],
    [/\b(can dancer|condensor|condensar)\b/gi, "condenser"],
    [/\b(a vaporator|evaporater|evaporating coil)\b/gi, "evaporator"],
    [/\b(the frost|d frost|de-frost|defrosting)\b/gi, "defrost"],
    [/\b(glycol|gly col|gli col|glycol loop)\b/gi, "glycol"],
    [/\b(thermo couple|thermo-couple)\b/gi, "thermocouple"],
    [/\b(rt d|r t d)\b/gi, "RTD sensor"],
    [/\b(killer|chillar|kiler|triller)\b/gi, "chiller"],
    [/\b(freezer|freez er|frieza)\b/gi, "freezer"],
    [/\b(set point|set-point)\b/gi, "setpoint"],

    // --- Cargo & WHO Medical Terms ---
    [/\b(waxing|maxing|vexing|vaxine|vaccin|vaxines)\b/gi, "vaccines"],
    [/\b(mrna|m rna|m-rna)\b/gi, "mRNA"],
    [/\b(pfizer|fizer)\b/gi, "Pfizer"],
    [/\b(moderna)\b/gi, "Moderna"],
    [/\b(covaxin|co-vaxin)\b/gi, "Covaxin"],
    [/\b(covishield|covi shield)\b/gi, "Covishield"],
    [/\b(insuline|inslin)\b/gi, "insulin"],
    [/\b(biologic|biologix)\b/gi, "biologics"],

    // --- Operational & Excursion Events ---
    [/\b(calling|calling stop|calling shut|call in)\b/gi, "cooling stop"],
    [/\b(power cat|park at|par cut|power of|light cut|light of|power off|power outage)\b/gi, "power cut"],
    [/\b(black out|blackouts)\b/gi, "blackout"],
    [/\b(soil|spoiled|spoiling)\b/gi, "spoil"],
    [/\b(hit wave|hitwave|heat wave)\b/gi, "heatwave"],
    [/\b(ex curtain|discursion|ex-cursion|ex cursion|exertion|excursion)\b/gi, "excursion"],
    [/\b(indoor|out door|dough)\b/gi, "door"],
    [/\b(indoor open|door open|door ajar)\b/gi, "door open"],
    [/\b(sell see us|cell see us|degrees c|degree c)\b/gi, "degrees Celsius"],
    [/\b(degrees f|degree f)\b/gi, "degrees Fahrenheit"],
    [/\b(telemetry|tell emetry)\b/gi, "telemetry"],

    // --- Numbers & Durations ---
    [/\b(forty-five|forty five)\b/gi, "45"],
    [/\b(thirty)\b/gi, "30"],
    [/\b(fifteen)\b/gi, "15"],
    [/\b(twenty)\b/gi, "20"],
    [/\b(an hour|one hour)\b/gi, "1 hour"],
    [/\b(half an hour|half hour)\b/gi, "30 minutes"],
    [/\b(two hours)\b/gi, "2 hours"],

    // --- Multilingual Phonetic Normalization (Marathi / Hindi) ---
    [/\b(ताकमान|तापम)\b/gi, "तापमान"],
    [/\b(शीत ग्रह|शीतगर)\b/gi, "शीतगृह"],
    [/\b(कॉम्प्रेसर|कंप्रेसर)\b/gi, "कंप्रेसर"],
    [/\b(व्हॅक्सीन|व्हॅक्सिन)\b/gi, "लस (व्हॅक्सिन)"],
    [/\b(कोल्ड स्टोर|कोल्ड-स्टोर)\b/gi, "कोल्ड स्टोरेज"],
  ];

  for (const [regex, replacement] of replacements) {
    t = t.replace(regex, replacement);
  }

  return t;
}

export class VoiceInputSession {
  private recognition: any = null;
  private isListening = false;
  private currentLang = getSpeechRecognitionLang();
  private lastTranscript = "";
  private finalFired = false;
  private silenceTimer: any = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window !== "undefined") {
      const SpeechClass =
        (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
      if (SpeechClass) {
        try {
          this.recognition = new SpeechClass();
          // Use continuous = true so natural pauses do not abort speech recognition prematurely
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.maxAlternatives = 3;
          this.recognition.lang = this.currentLang;
        } catch {
          this.recognition = null;
        }
      }
    }
  }

  setLang(langCode: string) {
    this.currentLang = langCode;
    setSpeechRecognitionLang(langCode);
    if (this.recognition) {
      try {
        this.recognition.lang = langCode;
      } catch {}
    }
  }

  getLang(): string {
    return this.currentLang;
  }

  isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return !!(
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition
    );
  }

  start(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void,
    onStop: () => void,
    onVolume?: (volume: number) => void,
    silenceTimeoutMs = 2200,
  ) {
    this.initRecognition();
    if (!this.recognition) {
      onError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (this.isListening) {
      this.stop();
      return;
    }

    this.lastTranscript = "";
    this.finalFired = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    SoundEffects.playMicStart();
    this.isListening = true;
    this.recognition.lang = this.currentLang;

    // Start audio volume analyser if volume callback requested
    if (onVolume && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        .then((stream) => {
          if (!this.isListening) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          this.audioStream = stream;
          try {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.audioContext = new AudioCtx();
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!this.isListening || !this.analyser) return;
              this.analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              const normalized = Math.min(1.0, avg / 110.0);
              onVolume(normalized);
              this.animFrameId = requestAnimationFrame(checkVolume);
            };
            this.animFrameId = requestAnimationFrame(checkVolume);
          } catch {}
        })
        .catch(() => {});
    }

    const resetSilenceTimer = () => {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
      }
      this.silenceTimer = setTimeout(() => {
        if (this.isListening && this.lastTranscript.trim() && !this.finalFired) {
          this.finalFired = true;
          onFinal(this.lastTranscript.trim());
        }
      }, silenceTimeoutMs);
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      if (interim) {
        const cleanedInterim = normalizeColdChainTranscript(interim);
        this.lastTranscript = cleanedInterim;
        onInterim(cleanedInterim);
        resetSilenceTimer();
      }
      if (final) {
        const cleaned = normalizeColdChainTranscript(final.trim());
        if (cleaned) {
          this.lastTranscript = cleaned;
          onInterim(cleaned);
          resetSilenceTimer();
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech") {
        // If there was prior transcript, commit it gracefully
        if (!this.finalFired && this.lastTranscript.trim()) {
          this.finalFired = true;
          onFinal(this.lastTranscript.trim());
          return;
        }
        // Don't loudly error out on subtle silence, allow natural retry
        onError("No speech was detected. Please try speaking closer to your microphone.");
      } else if (event.error === "not-allowed") {
        this.cleanupAudio();
        this.isListening = false;
        SoundEffects.playMicStop();
        onError("Microphone access was denied. Please allow microphone permissions in your browser.");
      } else if (event.error === "network") {
        this.cleanupAudio();
        this.isListening = false;
        SoundEffects.playMicStop();
        onError("Network error with speech service. You can switch to Whisper API in Audio Settings.");
      } else if (event.error !== "aborted") {
        this.cleanupAudio();
        this.isListening = false;
        SoundEffects.playMicStop();
        onError(`Voice recognition error: ${event.error}`);
      }
    };

    this.recognition.onend = () => {
      this.cleanupAudio();
      this.isListening = false;
      SoundEffects.playMicStop();
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      // If speech was spoken as interim but no final event triggered before end, deliver it now
      if (!this.finalFired && this.lastTranscript.trim()) {
        this.finalFired = true;
        onFinal(this.lastTranscript.trim());
      }
      onStop();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      this.cleanupAudio();
      this.isListening = false;
      onError(`Could not start microphone session: ${e?.message || e}`);
    }
  }

  private cleanupAudio() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((t) => t.stop());
      this.audioStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
  }

  stop() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.cleanupAudio();
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
      this.isListening = false;
      SoundEffects.playMicStop();
    }
  }

  active(): boolean {
    return this.isListening;
  }
}

// ═══════════════════════════════════════════════════════════════════
// WHISPER SPEECH-TO-TEXT RECORDER (Groq, OpenAI, or Custom Whisper API)
// ═══════════════════════════════════════════════════════════════════

export function getWhisperProvider(): "groq" | "openai" | "custom" {
  try {
    return (localStorage.getItem("coldguard.whisperProvider") as any) || "groq";
  } catch {
    return "groq";
  }
}

export function setWhisperProvider(p: "groq" | "openai" | "custom"): void {
  try {
    localStorage.setItem("coldguard.whisperProvider", p);
  } catch {}
}

export function getWhisperApiKey(): string {
  try {
    return localStorage.getItem("coldguard.whisperApiKey") || "";
  } catch {
    return "";
  }
}

export function setWhisperApiKey(key: string): void {
  try {
    localStorage.setItem("coldguard.whisperApiKey", key.trim());
  } catch {}
}

export function getWhisperEndpoint(): string {
  try {
    return localStorage.getItem("coldguard.whisperEndpoint") || "";
  } catch {
    return "";
  }
}

export function setWhisperEndpoint(url: string): void {
  try {
    localStorage.setItem("coldguard.whisperEndpoint", url.trim());
  } catch {}
}

export function getSpeechEngineMode(): "whisper" | "browser" {
  try {
    return (localStorage.getItem("coldguard.speechEngineMode") as any) || "browser";
  } catch {
    return "browser";
  }
}

export function setSpeechEngineMode(mode: "whisper" | "browser"): void {
  try {
    localStorage.setItem("coldguard.speechEngineMode", mode);
  } catch {}
}

/**
 * High-Precision Whisper Audio Recorder using standard MediaRecorder & backend API
 */
export class WhisperAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      navigator.mediaDevices !== undefined &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    );
  }

  active(): boolean {
    return this.isRecording;
  }

  async start(onError: (err: string) => void, onVolume?: (volume: number) => void) {
    if (!this.isSupported()) {
      onError("Audio recording is not supported in this browser.");
      return;
    }
    if (this.isRecording) {
      return;
    }

    try {
      // Acoustic constraints for high-clarity voice capture:
      // Active noise suppression, echo cancellation, auto gain, mono channel
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      this.audioChunks = [];

      // Setup live volume tracking if requested
      if (onVolume) {
        try {
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          this.audioContext = new AudioCtx();
          const source = this.audioContext.createMediaStreamSource(this.stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          source.connect(this.analyser);

          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!this.isRecording || !this.analyser) return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(1.0, avg / 110.0);
            onVolume(normalized);
            this.animFrameId = requestAnimationFrame(checkVolume);
          };
          this.animFrameId = requestAnimationFrame(checkVolume);
        } catch {}
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      SoundEffects.playMicStart();
      this.isRecording = true;
      this.mediaRecorder.start(200);
    } catch (err: any) {
      this.cleanupAudio();
      this.isRecording = false;
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        onError("Microphone permission was denied. Please allow microphone access in your browser.");
      } else {
        onError(`Could not start microphone: ${err.message || err}`);
      }
    }
  }

  private cleanupAudio() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
  }

  async stop(
    onTranscribed: (text: string) => void,
    onError: (err: string) => void,
    onProcessing?: (status: boolean) => void,
    targetLanguage?: string,
  ) {
    if (!this.isRecording || !this.mediaRecorder) return;

    SoundEffects.playMicStop();
    this.isRecording = false;
    onProcessing?.(true);

    this.mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        this.cleanupAudio();

        if (audioBlob.size < 1200) {
          onProcessing?.(false);
          onError("Audio recording was too short. Please speak clearly into your microphone.");
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64Audio = reader.result as string;
            const provider = getWhisperProvider();
            const apiKey = getWhisperApiKey();
            const customEndpoint = getWhisperEndpoint();
            const effectiveLang = (targetLanguage || getSpeechRecognitionLang()).slice(0, 2);

            const res = await api.transcribe({
              audio_base64: base64Audio,
              provider,
              api_key: apiKey ? apiKey : null,
              custom_endpoint: customEndpoint ? customEndpoint : null,
              language: effectiveLang,
            });

            onProcessing?.(false);

            if (res.ok && res.transcript) {
              onTranscribed(res.transcript.trim());
            } else {
              onError(res.error || "Whisper API did not return transcribed text.");
            }
          } catch (e: any) {
            onProcessing?.(false);
            onError(`Transcription error: ${e.message || String(e)}`);
          }
        };
      } catch (err: any) {
        this.cleanupAudio();
        onProcessing?.(false);
        onError(`Audio processing error: ${err.message || String(err)}`);
      }
    };

    try {
      this.mediaRecorder.stop();
    } catch {
      this.cleanupAudio();
    }
  }

  async stopAndGetBase64(
    onAudioBase64: (base64Audio: string) => void,
    onError: (err: string) => void,
    onProcessing?: (status: boolean) => void,
  ) {
    if (!this.isRecording || !this.mediaRecorder) return;

    SoundEffects.playMicStop();
    this.isRecording = false;
    onProcessing?.(true);

    this.mediaRecorder.onstop = async () => {
      try {
        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
        this.cleanupAudio();

        if (audioBlob.size < 1200) {
          onProcessing?.(false);
          onError("Audio recording was too short. Please speak clearly into your microphone.");
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          onProcessing?.(false);
          const base64Audio = reader.result as string;
          onAudioBase64(base64Audio);
        };
      } catch (err: any) {
        this.cleanupAudio();
        onProcessing?.(false);
        onError(`Audio processing error: ${err.message || String(err)}`);
      }
    };

    try {
      this.mediaRecorder.stop();
    } catch {
      this.cleanupAudio();
    }
  }
}
