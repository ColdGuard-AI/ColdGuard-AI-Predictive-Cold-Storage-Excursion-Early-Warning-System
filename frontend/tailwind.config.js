/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 
          DEFAULT: "#0B1220", 
          950: "#070D18", 
          900: "#0D1626", 
          800: "#131F35", 
          700: "#1E2D4A", 
          600: "#253B61", 
          500: "#334B75" 
        },
        neon: { 
          DEFAULT: "#22D3EE", 
          soft: "#67E8F9", 
          dim: "#0891B2" 
        },
        fg: { 
          DEFAULT: "#F8FAFC", 
          muted: "#94A3B8", 
          faint: "#64748B" 
        },
        warn: "#F59E0B",
        crit: "#F43F5E",
        sky: "#38BDF8",
        cyan: {
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
        },
      },
      fontFamily: {
        sans: ["'Outfit'", "'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34,211,238,0.25), 0 0 20px -4px rgba(34,211,238,0.35)",
        "glow-cyan": "0 0 25px rgba(34, 211, 238, 0.22), inset 0 0 15px rgba(34, 211, 238, 0.08)",
        "glow-crit": "0 0 0 1px rgba(244,63,94,0.35), 0 0 20px -4px rgba(244,63,94,0.5)",
      },
    },
  },
  plugins: [],
};
