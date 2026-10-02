import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Kutubxonalar alohida, barqaror chunk'larda — har deploydan keyin
        // brauzer ularni keshdan oladi, faqat ilova kodi qayta yuklanadi.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion';
          if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-socket';
          return undefined;
        },
      },
    },
  },
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
        // A bare local backend (`nest start`) has no `/api` prefix — the prod
        // nginx gateway strips it. REMOTE_API_STRIP_PREFIX=1 mimics that.
        ...(process.env.REMOTE_API_STRIP_PREFIX
          ? { rewrite: (p: string) => p.replace(/^\/api/, "") }
          : {}),
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
