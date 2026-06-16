import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Force vite restart

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own cacheable chunks so they
        // (a) aren't duplicated across route chunks and (b) stay cached across
        // deploys when only app code changes. Order matters: more specific
        // matches first (react-router before react; charts/d3 before the rest).
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory")) return "vendor-charts";
          // Rich-text editor — only the form builder / consultation notes use it,
          // so keep it out of the login-critical catch-all vendor chunk.
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
          if (id.includes("@mui") || id.includes("@emotion")) return "vendor-mui";
          if (id.includes("react-router") || id.includes("@remix-run")) return "vendor-router";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
          return "vendor";
        },
      },
    },
  },
});
