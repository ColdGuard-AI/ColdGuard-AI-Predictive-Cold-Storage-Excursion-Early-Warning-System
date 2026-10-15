import { describe, expect, it, vi } from "vitest";
import { eventSpans } from "../components/charts";
import { fmtDelta, fmtMinutes, fmtTemp } from "../lib/format";
import { ApiError, api, describeErrorBody } from "../services/api";
import type { Reading } from "../types/api";

describe("describeErrorBody", () => {
  it("uses FastAPI string details", () => {
    expect(describeErrorBody({ detail: "Zone 'x' not found" }, 404)).toBe("Zone 'x' not found");
  });
  it("flattens validation errors", () => {
    const body = { detail: [{ loc: ["body", "scenario"], msg: "Input should be 'normal'" }] };
    expect(describeErrorBody(body, 422)).toBe("scenario: Input should be 'normal'");
  });
  it("falls back to the status code", () => {
    expect(describeErrorBody(null, 500)).toBe("Request failed with status 500");
  });
});

describe("api client failures", () => {
  it("reports an unreachable backend clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.health()).rejects.toThrow(/Cannot reach the ColdGuard backend/);
    vi.unstubAllGlobals();
  });
  it("surfaces HTTP error details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "boom" }), { status: 500 })));
    const err = await api.zones().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe("boom");
    vi.unstubAllGlobals();
  });
});

describe("formatters", () => {
  it("handles missing values", () => {
    expect(fmtTemp(null)).toBe("—");
    expect(fmtMinutes(undefined)).toBe("—");
    expect(fmtDelta(null)).toBe("—");
  });
  it("formats values", () => {
    expect(fmtTemp(5.04)).toBe("5.0°C");
    expect(fmtMinutes(95)).toBe("1 h 35 min");
    expect(fmtDelta(-0.42)).toBe("−0.4°C");
  });
});

describe("eventSpans", () => {
  const mk = (i: number, door: string): Reading => ({
    timestamp: new Date(Date.UTC(2026, 0, 1, 8, i)).toISOString(), zone_id: "zone-a", sensor_id: "s", temperature: 5,
    humidity: 50, compressor_status: "running", door_status: door, ambient_temperature: 25, scenario: "normal",
  });
  it("returns no spans for empty data", () => {
    expect(eventSpans([], () => true)).toEqual([]);
  });
  it("groups consecutive readings", () => {
    const rs = [mk(0, "closed"), mk(1, "open"), mk(2, "open"), mk(3, "closed"), mk(4, "open")];
    expect(eventSpans(rs, (r) => r.door_status === "open")).toHaveLength(2);
  });
});
