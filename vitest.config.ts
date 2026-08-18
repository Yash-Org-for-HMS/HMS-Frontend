import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Separate from vite.config.ts because that one is an async factory (it
// conditionally loads the bundle analyzer), which Vitest can't merge cleanly.
// The `@` alias must stay in step with vite.config.ts and tsconfig.app.json.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // jsdom for the component tests; the pure-module tests don't care either way.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
