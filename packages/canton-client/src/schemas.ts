import { z } from "zod"

/**
 * Schemas are deliberately permissive about unknown fields: Canton adds keys
 * between minor versions and a strict parse would break on upgrade. They are
 * strict about the fields we actually read.
 */

export const objectMetaSchema = z.object({
  resourceVersion: z.string().default(""),
  annotations: z.record(z.string(), z.string()).default({}),
})

// ---------------------------------------------------------------- ledger core

export const ledgerVersionSchema = z.object({
  version: z.string(),
  features: z
    .object({
      userManagement: z
        .object({
          supported: z.boolean().optional(),
          maxRightsPerUser: z.number().optional(),
          maxUsersPageSize: z.number().optional(),
        })
        .optional(),
      partyManagement: z.object({ maxPartiesPageSize: z.number().optional() }).optional(),
    })
    .default({}),
})
export type LedgerVersion = z.infer<typeof ledgerVersionSchema>

export const ledgerUserSchema = z.object({
  id: z.string(),
  primaryParty: z.string().default(""),
  isDeactivated: z.boolean().default(false),
  metadata: objectMetaSchema.optional(),
  identityProviderId: z.string().default(""),
})
export type LedgerUser = z.infer<typeof ledgerUserSchema>

// --------------------------------------------------------------- user rights

/**
 * On the wire a right is `{ kind: { CanActAs: { value: { party } } } }`, which is
 * awkward to render and match on. In app-space it becomes a flat discriminated
 * union; `rightToWire` is the only place that knows the original shape.
 */
export type UserRight =
  | { kind: "ParticipantAdmin" }
  | { kind: "IdentityProviderAdmin" }
  | { kind: "CanReadAsAnyParty" }
  | { kind: "CanActAs"; party: string }
  | { kind: "CanReadAs"; party: string }

export const USER_RIGHT_KINDS = [
  "ParticipantAdmin",
  "IdentityProviderAdmin",
  "CanReadAsAnyParty",
  "CanActAs",
  "CanReadAs",
] as const

/** The kinds that name a party; the rest are participant-wide. */
export const PARTY_RIGHT_KINDS = ["CanActAs", "CanReadAs"] as const

const rawRightSchema = z.object({
  kind: z.record(
    z.string(),
    z.object({ value: z.object({ party: z.string().optional() }).default({}) }),
  ),
})

export const userRightSchema = rawRightSchema.transform((raw, ctx): UserRight => {
  const entry = Object.entries(raw.kind)[0]
  if (!entry) {
    ctx.addIssue({ code: "custom", message: "right had no kind" })
    return z.NEVER
  }
  const [name, body] = entry
  switch (name) {
    case "ParticipantAdmin":
    case "IdentityProviderAdmin":
    case "CanReadAsAnyParty":
      return { kind: name }
    case "CanActAs":
    case "CanReadAs":
      return { kind: name, party: body.value.party ?? "" }
    default:
      ctx.addIssue({ code: "custom", message: `unknown right kind: ${name}` })
      return z.NEVER
  }
})

export function rightToWire(right: UserRight): unknown {
  switch (right.kind) {
    case "CanActAs":
    case "CanReadAs":
      return { kind: { [right.kind]: { value: { party: right.party } } } }
    default:
      return { kind: { [right.kind]: { value: {} } } }
  }
}

/** Stable key for de-duplicating and comparing rights. */
export function rightKey(right: UserRight): string {
  return "party" in right ? `${right.kind}:${right.party}` : right.kind
}

// -------------------------------------------------------------------- parties

export const partyDetailsSchema = z.object({
  party: z.string(),
  isLocal: z.boolean().default(false),
  localMetadata: objectMetaSchema.optional(),
  identityProviderId: z.string().default(""),
})
export type PartyDetails = z.infer<typeof partyDetailsSchema>

export const connectedSynchronizerSchema = z.object({
  synchronizerAlias: z.string().default(""),
  synchronizerId: z.string(),
  permission: z.string().default(""),
})
export type ConnectedSynchronizer = z.infer<typeof connectedSynchronizerSchema>

// ------------------------------------------------------------------- packages

export const vettedPackageSchema = z.object({
  packageId: z.string(),
  packageName: z.string().default(""),
  packageVersion: z.string().default(""),
  validFromInclusive: z.string().nullish(),
  validUntilExclusive: z.string().nullish(),
})
export type VettedPackage = z.infer<typeof vettedPackageSchema>

// ---------------------------------------------------------- response envelopes

export const usersPageSchema = z.object({
  users: z.array(ledgerUserSchema).default([]),
  nextPageToken: z.string().default(""),
})
export const userEnvelopeSchema = z.object({ user: ledgerUserSchema })
export const rightsEnvelopeSchema = z.object({ rights: z.array(userRightSchema).default([]) })
export const partiesPageSchema = z.object({
  partyDetails: z.array(partyDetailsSchema).default([]),
  nextPageToken: z.string().default(""),
})
export const allocatePartySchema = z.object({ partyDetails: partyDetailsSchema })
export const participantIdSchema = z.object({ participantId: z.string() })
export const ledgerEndSchema = z.object({ offset: z.number() })
export const connectedSynchronizersSchema = z.object({
  connectedSynchronizers: z.array(connectedSynchronizerSchema).default([]),
})
export const packageIdsSchema = z.object({ packageIds: z.array(z.string()).default([]) })
export const vettedPackagesSchema = z.object({
  vettedPackages: z
    .array(
      z.object({
        packages: z.array(vettedPackageSchema).default([]),
        participantId: z.string().default(""),
        synchronizerId: z.string().default(""),
        topologySerial: z.number().default(0),
      }),
    )
    .default([]),
  nextPageToken: z.string().default(""),
})
export const emptySchema = z.looseObject({})

// ------------------------------------------------------------- validator (Splice)

export const validatorVersionSchema = z.object({
  version: z.string(),
  commit_ts: z.string().optional(),
})
export type ValidatorVersion = z.infer<typeof validatorVersionSchema>

export const validatorUserSchema = z.object({
  party_id: z.string(),
  user_name: z.string(),
  featured: z.boolean().default(false),
})
export type ValidatorUser = z.infer<typeof validatorUserSchema>

export const validatorAdminUsersSchema = z.object({
  usernames: z.array(z.string()).default([]),
})

/** Amounts are decimal strings with 10 fraction digits — never parse for storage. */
export const walletBalanceSchema = z.object({
  round: z.number(),
  effective_unlocked_qty: z.string(),
  effective_locked_qty: z.string(),
  total_holding_fees: z.string(),
})
export type WalletBalance = z.infer<typeof walletBalanceSchema>

export const walletTransactionSchema = z.object({
  transaction_type: z.string().default(""),
  event_id: z.string().default(""),
  date: z.string(),
  sender: z.object({ party: z.string(), amount: z.string() }).nullish(),
  receivers: z.array(z.object({ party: z.string(), amount: z.string() })).default([]),
  holding_fees: z.string().default("0"),
  app_rewards_used: z.string().default("0"),
  validator_rewards_used: z.string().default("0"),
  sv_rewards_used: z.string().default("0"),
})
export type WalletTransaction = z.infer<typeof walletTransactionSchema>

export const walletTransactionsSchema = z.object({
  items: z.array(walletTransactionSchema).default([]),
})

export const dsoPartySchema = z.object({ dso_party_id: z.string() })
