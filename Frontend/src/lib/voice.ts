/**
 * Voice input/output for the What-If Assistant (English, Hindi, Marathi).
 *
 * Input:  the browser's speech recognition (Chrome / Edge, best for Hindi & Marathi). Browsers without it
 *         record the microphone instead; the recording is converted to 16 kHz WAV and transcribed by the backend.
 * Output: natural neural voices from the backend (/api/assistant/tts); falls back to the browser's speechSynthesis.
 */
import { synthesizeSpeech, transcribeAudio } from "../services/api";

export type VoiceLang = "en" | "hi" | "mr";
export const LOCALES: Record<VoiceLang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

// ------------------------------------------------------------------ speech recognition (browser)
type RecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionCtor(): RecognitionCtor | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function browserRecognitionSupported(): boolean {
  return recognitionCtor() !== null;
}

export function micSupported(): boolean {
  return browserRecognitionSupported() || (typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
}

export interface ListenHandlers {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

/** Start listening. Returns a function that stops listening (and delivers what was heard). */
export async function startListening(lang: VoiceLang, h: ListenHandlers): Promise<() => void> {
  const Ctor = recognitionCtor();
  if (Ctor) {
    const rec = new Ctor();
    rec.lang = LOCALES[lang];
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    let delivered = false;
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      h.onInterim((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      const code = e?.error || "error";
      if (code === "no-speech" || code === "aborted") return;
      h.onError(code === "not-allowed" ? "mic-denied" : code === "network" ? "network" : code);
    };
    rec.onend = () => {
      if (!delivered && finalText.trim()) {
        delivered = true;
        h.onFinal(finalText.trim());
      }
      h.onEnd();
    };
    rec.start();
    return () => rec.stop();
  }
  return startRecordingFallback(lang, h);
}

// ------------------------------------------------------------------ recorder fallback -> backend STT
async function startRecordingFallback(lang: VoiceLang, h: ListenHandlers): Promise<() => void> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    h.onError("mic-denied");
    h.onEnd();
    return () => {};
  }
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    try {
      const wav = await toWav16k(new Blob(chunks, { type: recorder.mimeType }));
      const res = await transcribeAudio(wav, lang);
      if (res.text.trim()) h.onFinal(res.text.trim());
    } catch (e) {
      h.onError(e instanceof Error ? e.message : "transcription-failed");
    } finally {
      h.onEnd();
    }
  };
  recorder.start();
  const timer = setTimeout(() => recorder.state === "recording" && recorder.stop(), 30000); // max 30 s
  h.onInterim("…");
  return () => {
    clearTimeout(timer);
    if (recorder.state === "recording") recorder.stop();
  };
}

/** Decode any recorded audio and re-encode as 16 kHz mono 16-bit WAV (accepted by Gemini and Whisper). */
async function toWav16k(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  await ctx.close();
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

// ------------------------------------------------------------------ speech output
function plainText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, "$2")
    .replace(/°C/g, " °C")
    .replace(/\n+/g, ". ");
}

export class Speaker {
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private token = 0;

  /** Speak `text` in `lang`; calls onEnd when finished or stopped. */
  async speak(text: string, lang: VoiceLang, onEnd: () => void): Promise<void> {
    this.stop();
    const token = ++this.token;
    try {
      const blob = await synthesizeSpeech(text, lang);
      if (token !== this.token) return; // stopped or replaced while loading
      this.url = URL.createObjectURL(blob);
      this.audio = new Audio(this.url);
      this.audio.onended = () => { if (token === this.token) { this.cleanup(); onEnd(); } };
      this.audio.onerror = () => { if (token === this.token) { this.cleanup(); onEnd(); } };
      await this.audio.play();
    } catch {
      if (token !== this.token) return;
      this.browserSpeak(text, lang, token, onEnd); // backend voice unavailable: use the browser's voice
    }
  }

  private browserSpeak(text: string, lang: VoiceLang, token: number, onEnd: () => void) {
    if (!("speechSynthesis" in window)) { onEnd(); return; }
    const u = new SpeechSynthesisUtterance(plainText(text));
    u.lang = LOCALES[lang];
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (voice) u.voice = voice;
    u.onend = u.onerror = () => { if (token === this.token) onEnd(); };
    speechSynthesis.speak(u);
  }

  stop() {
    this.token++;
    if (this.audio) { this.audio.pause(); this.cleanup(); }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
  }

  private cleanup() {
    if (this.url) URL.revokeObjectURL(this.url);
    this.audio = null;
    this.url = null;
  }
}
