import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
// jspdf's own dependencies (and canvg's) plus the barcode library: used only by
// lazily loaded screens, so they must not land in a chunk index.html preloads.
const LAZY_ONLY = [
  "html2canvas", "canvg", "fflate", "fast-png", "iobuffer", "pako", "core-js", "raf", "performance-now",
  "rgbcolor", "stackblur-canvas", "svg-pathdata", "regenerator-runtime", "jsbarcode",
];

// Force vite restart

// https://vite.dev/config/
export default defineConfig(async () => {
  // Bundle analyzer (Phase 0, opt-in): `ANALYZE=1 npm run build` writes
  // dist/stats.html. Dynamic import + gate means a normal build never touches
  // the plugin, so it can't affect or break regular builds.
  const plugins: PluginOption[] = [react()];
  if (process.env.ANALYZE) {
    const { visualizer } = await import("rollup-plugin-visualizer");
    plugins.push(
      visualizer({ filename: "dist/stats.html", gzipSize: true, brotliSize: true, template: "treemap" }) as PluginOption,
    );
  }

  return {
  plugins,
  // `@` -> src, so cross-cutting imports read `@/components/...` instead of
  // climbing `../../../`. Must mirror tsconfig.app.json's paths mapping.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
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
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory")) return "vendor-charts";
          // Rich-text editor — only the form builder / consultation notes use it,
          // so keep it out of the login-critical catch-all vendor chunk.
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-editor";
          // Lottie player + wasm binding — only the (lazy) HeartbeatLottie needs it.
          if (id.includes("@lottiefiles")) return "vendor-lottie";
          // PDF export — left OUT of manual chunking on purpose. It is reached only
          // through a dynamic import, so Rollup places it in the async graph by
          // itself; naming it here instead produced a shared vendor chunk that
          // index.html modulepreloaded, downloading it for every visitor.
          if (id.includes("jspdf")) return;
          // Real-time client — only used inside queue/POS screens (all lazy), not at login.
          if (id.includes("socket.io") || id.includes("engine.io")) return "vendor-socket";
          // Icons are leaf modules: each goes with the screens that draw it, so the
          // login page no longer downloads every icon the app uses.
          if (id.includes("@mui/icons-material")) return;
          if (id.includes("@mui") || id.includes("@emotion")) return "vendor-mui";
          if (id.includes("react-router") || id.includes("@remix-run")) return "vendor-router";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "vendor-react";
          // Packages reached only from lazy screens (PDF export's helpers, the ID
          // card barcode) are left to Rollup, like jspdf above. Swept into the
          // catch-all below they were preloaded for every visitor: ~500KB of the
          // 770KB "vendor" chunk the login page waited for.
          if (LAZY_ONLY.some((p) => id.includes(`/node_modules/${p}/`))) return;
          // The rest stays in one shared chunk: leaving it all to Rollup scattered
          // small shared helpers into the charts/editor chunks, and the entry then
          // preloaded those whole chunks instead.
          return "vendor";
        },
      },
    },
  },
  };
});
