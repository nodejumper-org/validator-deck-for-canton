import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const networkEnum = pgEnum("network", ["devnet", "testnet", "mainnet", "local"])

/**
 * A validator is a participant plus a Splice API, so both are one table: a row
 * with no `validatorApiUrl` is a plain participant and its validator pages are
 * hidden.
 */
export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  network: networkEnum("network").notNull().default("devnet"),
  ledgerApiUrl: text("ledger_api_url").notNull(),
  validatorApiUrl: text("validator_api_url"),
  authTokenUrl: text("auth_token_url").notNull(),
  authClientId: text("auth_client_id").notNull(),
  /** AES-256-GCM sealed. Never leaves the server. */
  authClientSecretEnc: text("auth_client_secret_enc").notNull(),
  authAudience: text("auth_audience"),
  authScope: text("auth_scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type NodeRecord = typeof nodes.$inferSelect
