import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path alias in apps/web/tsconfig.json.
      "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
    },
  },
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    environment: "node",
  },
})
