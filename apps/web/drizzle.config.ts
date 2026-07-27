import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://canton:canton@localhost:5434/canton_dashboard",
  },
})
