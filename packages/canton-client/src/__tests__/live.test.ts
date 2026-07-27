import { describe, expect, test } from "vitest"
import { createLedgerClient } from "../ledger.js"
import { createTokenProvider } from "../token.js"
import { createValidatorClient } from "../validator.js"

/**
 * Read-only checks against a real Canton node. Skipped unless SMOKE_* is set, so
 * `npm test` stays offline and deterministic; `npm run smoke` loads .env and runs
 * them. This is what catches wire-format drift that fixtures cannot.
 *
 * Nothing here writes: no user creation, no party allocation, no DAR upload.
 */
const env = process.env
const configured = Boolean(env.SMOKE_LEDGER_API_URL && env.SMOKE_AUTH_CLIENT_ID)

const getToken = () =>
  createTokenProvider("smoke", {
    tokenUrl: env.SMOKE_AUTH_TOKEN_URL ?? "",
    clientId: env.SMOKE_AUTH_CLIENT_ID ?? "",
    clientSecret: env.SMOKE_AUTH_CLIENT_SECRET ?? "",
    audience: env.SMOKE_AUTH_AUDIENCE,
    scope: env.SMOKE_AUTH_SCOPE,
  })

describe.skipIf(!configured)("live ledger API", () => {
  const ledger = () =>
    createLedgerClient({
      baseUrl: env.SMOKE_LEDGER_API_URL ?? "",
      getToken: getToken(),
      timeoutMs: 30_000,
    })

  test("reports a Canton 3.x version", async () => {
    const v = await ledger().getVersion()
    expect(v.version).toMatch(/^3\./)
  })

  test("returns a namespaced participant id", async () => {
    expect(await ledger().getParticipantId()).toMatch(/::[0-9a-f]{4,}$/)
  })

  test("returns a positive ledger offset", async () => {
    expect(await ledger().getLedgerEnd()).toBeGreaterThan(0)
  })

  test("is connected to at least one synchronizer", async () => {
    const syncs = await ledger().getConnectedSynchronizers()
    expect(syncs.length).toBeGreaterThan(0)
    expect(syncs[0]!.synchronizerId).toContain("::")
  })

  test("lists users and parses their rights", async () => {
    const client = ledger()
    const { users } = await client.listUsers({ pageSize: 100 })
    expect(users.length).toBeGreaterThan(0)

    const rights = await client.listUserRights(users[0]!.id)
    // Every right must land in the normalised union, not fall through as unknown.
    for (const r of rights) {
      expect([
        "ParticipantAdmin",
        "IdentityProviderAdmin",
        "CanReadAsAnyParty",
        "CanActAs",
        "CanReadAs",
      ]).toContain(r.kind)
    }
  })

  test("pages parties and honours the prefix filter", async () => {
    const client = ledger()
    const page = await client.listParties({ pageSize: 5 })
    expect(page.parties).toHaveLength(5)
    expect(page.nextPageToken).not.toBe("")

    // `filter-party` is a prefix match, so a mid-string fragment finds nothing.
    const prefix = await client.listParties({ pageSize: 100, filterParty: "cbtc" })
    const midString = await client.listParties({ pageSize: 100, filterParty: "btc-rfq" })
    expect(prefix.parties.length).toBeGreaterThan(0)
    expect(midString.parties).toHaveLength(0)
  })

  test("returns this participant's vetted packages with names and versions", async () => {
    const client = ledger()
    const participantId = await client.getParticipantId()
    const pkgs = await client.listVettedPackages(participantId)

    expect(pkgs.length).toBeGreaterThan(0)
    expect(pkgs.every((p) => p.packageId.length === 64)).toBe(true)
    expect(pkgs.some((p) => p.packageName !== "" && p.packageVersion !== "")).toBe(true)
  })

  test("rejects a corrupt DAR with Canton's own error text", async () => {
    const err = await ledger()
      .validateDar(new TextEncoder().encode("not-a-dar"))
      .then(
        () => null,
        (e: { code: string; message: string }) => e,
      )
    expect(err).not.toBeNull()
    expect(err!.code).toBe("CANTON_ERROR")
    expect(err!.message).toContain("INVALID_DAR")
  })
})

describe.skipIf(!configured || !env.SMOKE_VALIDATOR_API_URL)("live validator API", () => {
  const validator = () =>
    createValidatorClient({
      baseUrl: env.SMOKE_VALIDATOR_API_URL ?? "",
      getToken: getToken(),
      timeoutMs: 30_000,
    })

  test("reports a Splice version", async () => {
    expect((await validator().getVersion()).version).toMatch(/^\d+\.\d+/)
  })

  test("is ready", async () => {
    expect(await validator().isReady()).toBe(true)
  })

  test("identifies the validator user and party", async () => {
    const user = await validator().getValidatorUser()
    expect(user.party_id).toContain("::")
    expect(user.user_name).not.toBe("")
  })

  test("returns wallet balances as decimal strings", async () => {
    const b = await validator().getWalletBalance()
    expect(typeof b.effective_unlocked_qty).toBe("string")
    expect(b.effective_unlocked_qty).toMatch(/^\d+\.\d+$/)
    expect(b.round).toBeGreaterThan(0)
  })

  test("lists wallet transactions", async () => {
    const txs = await validator().listWalletTransactions({ pageSize: 10 })
    expect(Array.isArray(txs)).toBe(true)
    if (txs[0]) expect(txs[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test("dedupes onboarded usernames", async () => {
    const users = await validator().listOnboardedUsers()
    expect(new Set(users).size).toBe(users.length)
  })

  test("resolves the DSO party", async () => {
    expect(await validator().getDsoPartyId()).toMatch(/^DSO::/)
  })
})
