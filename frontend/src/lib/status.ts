import type { ZoneSummary } from "../types/api";
import { fmtMinutes } from "./format";

export type Tone = "ok" | "warn" | "crit";

/** One plain-language sentence describing a zone's situation, for non-technical users. */
export function zoneHeadline(z: ZoneSummary): { tone: Tone; headline: string; detail: string } {
  if (z.temperature_status === "critical") {
    return {
      tone: "crit",
      headline: "Out of safe range",
      detail: `${z.temperature?.toFixed(1) ?? "—"}°C is outside ${z.lower_limit}–${z.upper_limit}°C. Check the products now.`,
    };
  }
  if (z.compressor_status === "stopped") {
    return { tone: "crit", headline: "Cooling has stopped", detail: `The compressor has been off for ${fmtMinutes(z.compressor_off_minutes)}.` };
  }
  const ttb = z.warning_time_to_breach_minutes;
  if (ttb != null && ttb <= 30) {
    return { tone: "warn", headline: `May go out of range in ~${fmtMinutes(ttb)}`, detail: "The AI forecast expects the temperature to leave the safe range soon." };
  }
  if (z.door_status === "open" && z.door_open_minutes >= 5) {
    return { tone: "warn", headline: "Door left open", detail: `Open for ${fmtMinutes(z.door_open_minutes)}. Warm air is getting in.` };
  }
  if (z.sensor_status !== "normal") {
    return { tone: "warn", headline: "Sensor needs checking", detail: "Readings look unreliable. Verify with a hand-held thermometer." };
  }
  if (z.risk_category === "medium" || z.risk_category === "high" || z.risk_category === "critical") {
    return { tone: "warn", headline: "Keep an eye on it", detail: `Risk score ${z.risk_score}/100 — temperature is moving toward a limit.` };
  }
  return { tone: "ok", headline: "All good", detail: `Holding ${z.temperature?.toFixed(1) ?? "—"}°C, safely inside ${z.lower_limit}–${z.upper_limit}°C.` };
}

export const TONE_COLORS: Record<Tone, { fg: string; bg: string; border: string }> = {
  ok: { fg: "#3dff8f", bg: "rgba(61,255,143,0.06)", border: "rgba(61,255,143,0.28)" },
  warn: { fg: "#fbbf24", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.45)" },
  crit: { fg: "#ff5c70", bg: "rgba(255,92,112,0.09)", border: "rgba(255,92,112,0.6)" },
};
