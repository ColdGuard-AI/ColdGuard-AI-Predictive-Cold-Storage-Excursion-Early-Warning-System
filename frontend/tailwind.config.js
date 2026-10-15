/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#070908", 900: "#0b0e0d", 800: "#101413", 700: "#161b1a", 600: "#1d2422", 500: "#2a3330" },
        neon: { DEFAULT: "#3dff8f", soft: "#8affbf", dim: "#1fae5c" },
        fg: { DEFAULT: "#f2f5f3", muted: "#9aa6a0", faint: "#6b7671" },
        warn: "#fbbf24",
        crit: "#ff5c70",
        sky: "#7cc7ff",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,255,143,0.18), 0 0 18px -6px rgba(61,255,143,0.35)",
        "glow-crit": "0 0 0 1px rgba(255,92,112,0.35), 0 0 18px -6px rgba(255,92,112,0.5)",
      },
    },
  },
  plugins: [],
};
