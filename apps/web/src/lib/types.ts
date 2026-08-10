/**
 * Wire types shared by the route handlers and the browser.
 *
 * The browser cannot import server modules (they open database connections), so
 * these live in their own file. `apps/web/src/server/nodes.ts` asserts that its
 * `PublicNode` is assignable to `NodeSummary`, which keeps the two in step.
 */

export type Network = "devnet" | "testnet" | "mainnet" | "local"

export type NodeSummary = {
  id: string
  name: string
  network: Network
  ledgerApiUrl: string
  validatorApiUrl: string | null
  authTokenUrl: string
  authClientId: string
  authAudience: string | null
  authScope: string | null
  /** The stored client secret is never sent to the browser. */
  hasSecret: boolean
  createdAt: string
  updatedAt: string
}

export type Probe = { ok: boolean; detail: string; latencyMs: number }

export type TestResult = {
  ledger: Probe
  validator: Probe | null
}

export type ConnectedSynchronizer = {
  synchronizerAlias: string
  synchronizerId: string
  permission: string
}

export type SurfaceError = { surface: string; message: string }

export type NodeOverview = {
  node: NodeSummary
  participantId: string | null
  ledgerVersion: string | null
  validatorVersion: string | null
  ledgerEnd: number | null
  synchronizers: ConnectedSynchronizer[]
  counts: { users: number; packages: number }
  errors: SurfaceError[]
}

export type UserRight =
  | { kind: "ParticipantAdmin" }
  | { kind: "IdentityProviderAdmin" }
  | { kind: "CanReadAsAnyParty" }
  | { kind: "CanActAs"; party: string }
  | { kind: "CanReadAs"; party: string }

export type LedgerUser = {
  id: string
  primaryParty: string
  isDeactivated: boolean
  identityProviderId: string
}

export type PartyDetails = {
  party: string
  isLocal: boolean
  identityProviderId: string
}

export type PartiesPage = {
  parties: PartyDetails[]
  nextPageToken: string
}

export type LocalScanState =
  | { status: "idle" }
  | { status: "scanning"; progress: { pages: number; seen: number } }
  | { status: "ready"; parties: PartyDetails[]; total: number; scannedAt: number }
  | { status: "error"; message: string }

export type VettedPackage = {
  packageId: string
  packageName: string
  packageVersion: string
  validFromInclusive?: string | null
  validUntilExclusive?: string | null
}

export type PackagesResult = {
  packages: VettedPackage[]
  participantId: string
  versionsByName: { name: string; versions: string[] }[]
}

export type DarUploadResult = {
  ok: true
  validated: boolean
  fileName: string
  bytes: number
}

export type WalletTransaction = {
  transaction_type: string
  event_id: string
  date: string
  sender?: { party: string; amount: string } | null
  receivers: { party: string; amount: string }[]
  holding_fees: string
  app_rewards_used: string
  validator_rewards_used: string
  sv_rewards_used: string
}

export type ValidatorSummary = {
  version: string | null
  ready: boolean
  validatorUser: { party_id: string; user_name: string; featured: boolean } | null
  dsoPartyId: string | null
  onboardedUsers: string[]
  balance: {
    round: number
    effective_unlocked_qty: string
    effective_locked_qty: string
    total_holding_fees: string
  } | null
  transactions: WalletTransaction[]
  errors: SurfaceError[]
}

export type NodeHealth = {
  id: string
  name: string
  network: Network
  ledgerOk: boolean
  validatorOk: boolean | null
  synchronizerConnected: boolean
  ledgerEnd: number | null
  ledgerVersion: string | null
  validatorVersion: string | null
  latencyMs: number
  error: string | null
}

export type DashboardResult = {
  nodes: NodeHealth[]
  totals: {
    nodes: number
    healthy: number
    users: number
    packages: number
    balanceCC: string
    synchronizers: number
  }
  charts: {
    walletActivity: { date: string; net: number }[]
    rightsDistribution: { kind: string; users: number }[]
    versionSprawl: { name: string; versions: number }[]
    rewardMix: { date: string; app: number; validator: number; sv: number }[]
  }
}

/** Per-node facts the network-scoped dashboard needs. Amounts stay decimal strings. */
export type NodeStats = {
  id: string
  name: string
  hasValidator: boolean
  /** False when this node's ledger reads failed: the zeros below are unknown, not real. */
  ok: boolean
  users: number
  deactivatedUsers: number
  packages: number
  unlockedCC: string
  lockedCC: string
  holdingFees: string
  /** ISO date of the newest wallet transaction; null when there are none. */
  lastActivityAt: string | null
}

export type AttentionSeverity = "bad" | "warn" | "info"

export type AttentionItem = {
  key: string
  severity: AttentionSeverity
  nodeId: string
  nodeName: string
  title: string
  detail?: string
}
