import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
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
