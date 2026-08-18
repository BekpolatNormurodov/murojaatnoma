import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // DEV-ONLY: proxy the API + realtime socket to the live backend so local dev
  // is same-origin (no CORS) and the WebSocket upgrades. Set REMOTE_API to
  // point elsewhere. Has no effect on the production build. Do NOT rely on this
  // in prod — there the gateway serves /api and /socket.io same-origin.
  server: {
    proxy: {
      "/api": {
        target: process.env.REMOTE_API || "https://murojaatnoma.uz",
        changeOrigin: true,
        secure: true,
      },
      "/socket.io": {
        target: process.env.REMOTE_API || "https://murojaatnoma.uz",
        changeOrigin: true,
        secure: true,
        ws: true,
      },
    },
  },
});
