import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

// ----------------------------------------------------------------------- auth
// These four tables are better-auth's required shape. Do not rename columns.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
})

// ---------------------------------------------------------------------- nodes

export const networkEnum = pgEnum("network", ["devnet", "testnet", "mainnet", "local"])

/**
 * A validator is a participant plus a Splice API, so both are one table: a row
 * with no `validatorApiUrl` is a plain participant and its validator pages are
 * hidden.
 *
 * Every node belongs to exactly one user. Deleting the user removes their nodes
 * and, by cascade, everything scanned from them.
 */
export const nodes = pgTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
  },
  (t) => [index("nodes_user_id_idx").on(t.userId)],
)

export type NodeRecord = typeof nodes.$inferSelect

// -------------------------------------------------------------- local parties

export const scanStatusEnum = pgEnum("scan_status", ["idle", "scanning", "ready", "error"])

/**
 * One row per node recording the state of its local-party sweep.
 *
 * The sweep is expensive (see local-parties.ts), so its result is persisted
 * rather than held in memory: a restart, a second server instance, or a cron run
 * all see the same answer.
 */
export const partyScans = pgTable("party_scans", {
  nodeId: text("node_id")
    .primaryKey()
    .references(() => nodes.id, { onDelete: "cascade" }),
  status: scanStatusEnum("status").notNull().default("idle"),
  /** Progress while running; final counts once ready. */
  pagesScanned: integer("pages_scanned").notNull().default(0),
  partiesSeen: integer("parties_seen").notNull().default(0),
  localCount: integer("local_count").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  /** Which run produced the rows currently in local_parties. */
  scannedAt: timestamp("scanned_at", { withTimezone: true }),
})

export type PartyScanRecord = typeof partyScans.$inferSelect

export const localParties = pgTable(
  "local_parties",
  {
    nodeId: text("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    party: text("party").notNull(),
    identityProviderId: text("identity_provider_id").notNull().default(""),
    /** When this party was first seen as local, preserved across rescans. */
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Composite key so a rescan can upsert on conflict and keep firstSeenAt.
  (t) => [primaryKey({ columns: [t.nodeId, t.party] })],
)

export type LocalPartyRecord = typeof localParties.$inferSelect
