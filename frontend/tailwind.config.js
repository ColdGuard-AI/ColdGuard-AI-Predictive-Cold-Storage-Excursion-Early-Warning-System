import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Premium Arctic Blue Design System ─────────────────────────────
        arctic: {
          primary: "#2563EB",       // Primary Blue
          "primary-hover": "#1D4ED8",
          sky: "#38BDF8",           // Sky Blue
          ice: "#EFF6FF",           // Ice Blue
          bg: "#F1F7FF",            // Page Background
          card: "#FFFFFF",          // White surface
          navy: "#0F172A",          // Deep Navy text
          secondary: "#475569",     // Secondary text
          border: "#DCE8F6",        // Subtle borders
          "border-hover": "#BAE6FD",
          glow: "rgba(37, 99, 235, 0.08)",
        },
        // Semantic status mappings (red, amber, green used only for meaningful states)
        healthy: {
          DEFAULT: "#10B981",
          bg: "#ECFDF5",
          border: "#A7F3D0",
          text: "#065F46",
        },
        warning: {
          DEFAULT: "#F59E0B",
          bg: "#FFFBEB",
          border: "#FDE68A",
          text: "#92400E",
        },
        critical: {
          DEFAULT: "#EF4444",
          bg: "#FEF2F2",
          border: "#FECACA",
          text: "#991B1B",
        },
        // Backward-compatible mappings
        ink: {
          DEFAULT: "#0F172A",
          950: "#020617",
          900: "#0F172A",
          800: "#1E293B",
          700: "#334155",
          600: "#475569",
          500: "#64748B",
        },
        neon: {
          DEFAULT: "#2563EB",
          soft: "#38BDF8",
          dim: "#1D4ED8",
        },
        fg: {
          DEFAULT: "#0F172A",
          muted: "#475569",
          faint: "#94A3B8",
        },
        warn: "#F59E0B",
        crit: "#EF4444",
        sky: {
          ...colors.sky,
          DEFAULT: "#38BDF8",
        },
        cyan: {
          ...colors.cyan,
          400: "#38BDF8",
          500: "#0284C7",
          600: "#2563EB",
        },
      },
      boxShadow: {
        "arctic-card": "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 8px 24px -4px rgba(37, 99, 235, 0.06)",
        "arctic-hover": "0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 16px 32px -4px rgba(37, 99, 235, 0.12)",
        "arctic-glow": "0 0 25px rgba(56, 189, 248, 0.25)",
      },
      fontFamily: {
        sans: ["'Outfit'", "'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
