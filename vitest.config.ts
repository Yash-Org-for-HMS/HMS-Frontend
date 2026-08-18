import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Separate from vite.config.ts because that one is an async factory (it
// conditionally loads the bundle analyzer), which Vitest can't merge cleanly.
// The `@` alias must stay in step with vite.config.ts and tsconfig.app.json.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
