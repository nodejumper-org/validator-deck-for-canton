import { CantonApiError } from "./errors"
import { createHttp, type HttpOptions } from "./http"
import {
  allocatePartySchema,
  connectedSynchronizersSchema,
  emptySchema,
  ledgerEndSchema,
  ledgerVersionSchema,
  packageIdsSchema,
  participantIdSchema,
  partiesPageSchema,
  rightToWire,
  rightsEnvelopeSchema,
  userEnvelopeSchema,
  usersPageSchema,
  vettedPackagesSchema,
  type LedgerUser,
  type PartyDetails,
  type UserRight,
  type VettedPackage,
} from "./schemas"

/** Builds "?a=1&b=2", dropping only undefined and empty-string values. */
function query(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
})

export function createLedgerClient(opts: HttpOptions) {
  const http = createHttp(opts)
  const userPath = (userId: string) => `/v2/users/${encodeURIComponent(userId)}`

  return {
    getVersion: () => http.json(ledgerVersionSchema, "/v2/version"),

    getParticipantId: () =>
      http.json(participantIdSchema, "/v2/parties/participant-id").then((r) => r.participantId),

    getLedgerEnd: () => http.json(ledgerEndSchema, "/v2/state/ledger-end").then((r) => r.offset),

    getConnectedSynchronizers: () =>
      http
        .json(connectedSynchronizersSchema, "/v2/state/connected-synchronizers")
        .then((r) => r.connectedSynchronizers),

    async listUsers(o: { pageSize?: number; pageToken?: string } = {}) {
      const r = await http.json(
        usersPageSchema,
        `/v2/users${query({ pageSize: o.pageSize, pageToken: o.pageToken })}`,
      )
      return { users: r.users, nextPageToken: r.nextPageToken }
    },

    getUser: (userId: string): Promise<LedgerUser> =>
      http.json(userEnvelopeSchema, userPath(userId)).then((r) => r.user),

    createUser: (i: {
      userId: string
      primaryParty?: string
      rights?: UserRight[]
    }): Promise<LedgerUser> =>
      http
        .json(
          userEnvelopeSchema,
          "/v2/users",
          json({
            user: {
              id: i.userId,
              primaryParty: i.primaryParty ?? "",
              isDeactivated: false,
              identityProviderId: "",
            },
            rights: (i.rights ?? []).map(rightToWire),
          }),
        )
        .then((r) => r.user),

    updateUser: (i: {
      userId: string
      primaryParty?: string
      isDeactivated?: boolean
    }): Promise<LedgerUser> => {
      const user: Record<string, unknown> = { id: i.userId }
      const paths: string[] = []
      if (i.primaryParty !== undefined) {
        user.primaryParty = i.primaryParty
        paths.push("primary_party")
      }
      if (i.isDeactivated !== undefined) {
        user.isDeactivated = i.isDeactivated
        paths.push("is_deactivated")
      }
      if (paths.length === 0) {
        return Promise.reject(
          new CantonApiError("BAD_RESPONSE", "updateUser called with no fields to change"),
        )
      }
      return http
        .json(userEnvelopeSchema, userPath(i.userId), {
          ...json({ user, updateMask: { paths } }),
          method: "PATCH",
        })
        .then((r) => r.user)
    },

    deleteUser: (userId: string): Promise<void> =>
      http.json(emptySchema, userPath(userId), { method: "DELETE" }).then(() => undefined),

    listUserRights: (userId: string): Promise<UserRight[]> =>
      http.json(rightsEnvelopeSchema, `${userPath(userId)}/rights`).then((r) => r.rights),

    grantUserRights: (userId: string, rights: UserRight[]): Promise<UserRight[]> =>
      http
        .json(
          rightsEnvelopeSchema,
          `${userPath(userId)}/rights`,
          json({ userId, rights: rights.map(rightToWire) }),
        )
        .then((r) => r.rights),

    revokeUserRights: (userId: string, rights: UserRight[]): Promise<UserRight[]> =>
      http
        .json(rightsEnvelopeSchema, `${userPath(userId)}/rights`, {
          ...json({ userId, rights: rights.map(rightToWire) }),
          method: "PATCH",
        })
        .then((r) => r.rights),

    /** `filterParty` is a PREFIX match on the party id, not a substring match. */
    async listParties(o: { pageSize?: number; pageToken?: string; filterParty?: string } = {}) {
      const r = await http.json(
        partiesPageSchema,
        `/v2/parties${query({
          pageSize: o.pageSize,
          pageToken: o.pageToken,
          "filter-party": o.filterParty,
        })}`,
      )
      return { parties: r.partyDetails, nextPageToken: r.nextPageToken }
    },

    allocateParty: (i: { partyIdHint?: string }): Promise<PartyDetails> =>
      http
        .json(allocatePartySchema, "/v2/parties", json({ partyIdHint: i.partyIdHint ?? "" }))
        .then((r) => r.partyDetails),

    /**
     * Vetted packages carry name + version, unlike GET /v2/packages which is ids only.
     * The participant filter is mandatory: without it the node returns the first 100
     * participants on the synchronizer and ours is usually not among them.
     */
    async listVettedPackages(participantId: string): Promise<VettedPackage[]> {
      const r = await http.json(
        vettedPackagesSchema,
        "/v2/package-vetting/list",
        json({ topologyStateFilter: { participantIds: [participantId] } }),
      )
      return r.vettedPackages.flatMap((entry) => entry.packages)
    },

    listPackageIds: (): Promise<string[]> =>
      http.json(packageIdsSchema, "/v2/packages").then((r) => r.packageIds),

    /** Dry run: checks the DAR parses and upgrades cleanly, changing nothing. */
    validateDar: (bytes: Uint8Array): Promise<void> =>
      http.binary("/v2/dars/validate", bytes).then(() => undefined),

    uploadDar: (bytes: Uint8Array, o: { vetAllPackages?: boolean } = {}): Promise<void> =>
      http
        .binary(
          `/v2/dars${query({
            vetAllPackages: o.vetAllPackages === undefined ? undefined : String(o.vetAllPackages),
          })}`,
          bytes,
        )
        .then(() => undefined),
  }
}

export type LedgerClient = ReturnType<typeof createLedgerClient>
