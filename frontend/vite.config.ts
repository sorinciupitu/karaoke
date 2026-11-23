import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // The pitch shifter is registered as an AudioWorklet, which needs a real ES
  // module (no IIFE wrapper).
  worker: { format: "es" },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:7777",
      "/auth": "http://localhost:7777",
      "/media": "http://localhost:7777",
    },
  },
  test: {
    environment: "node",
  },
});
