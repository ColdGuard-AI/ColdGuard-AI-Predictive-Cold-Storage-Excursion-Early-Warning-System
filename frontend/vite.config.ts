/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In development, /api is proxied to the FastAPI backend so no CORS setup is needed.
// Set VITE_API_BASE_URL to call a backend on another origin instead.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target: env.VITE_PROXY_TARGET || "http://127.0.0.1:8000", changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: { manualChunks: { recharts: ["recharts"], react: ["react", "react-dom", "react-router-dom"], three: ["three", "@react-three/fiber", "@react-three/drei"] } },
      },
    },
    test: { environment: "node" },
  };
});
