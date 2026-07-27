import { expect, test } from "vitest"
import { createLedgerClient } from "../ledger"
import * as f from "./fixtures"
import { asFetch, callAt, fetchSpy, jsonResponse, rejection } from "./helpers"

/** Builds a client plus the fetch spy driving it, replying with each payload in turn. */
function harness(...payloads: unknown[]) {
  const queue = [...payloads]
  const spy = fetchSpy(async () => jsonResponse(queue.shift() ?? {}))
  const client = createLedgerClient({
    baseUrl: "https://ledger.example",
    getToken: async () => "tok",
    fetchImpl: asFetch(spy),
  })
  return { client, spy }
}

test("parses the version payload", async () => {
  const { client } = harness(f.versionResponse)
  const v = await client.getVersion()
  expect(v.version).toBe("3.5.8")
  expect(v.features.userManagement?.maxUsersPageSize).toBe(1000)
})

test("unwraps participant id and ledger end", async () => {
  const { client: a } = harness({ participantId: f.PARTICIPANT_ID })
  expect(await a.getParticipantId()).toBe(f.PARTICIPANT_ID)
  const { client: b } = harness({ offset: 1995044 })
  expect(await b.getLedgerEnd()).toBe(1995044)
})

test("returns connected synchronizers", async () => {
  const { client } = harness(f.connectedSynchronizersResponse)
  const syncs = await client.getConnectedSynchronizers()
  expect(syncs).toHaveLength(1)
  expect(syncs[0]!.synchronizerAlias).toBe("global")
})

test("lists users with pagination params", async () => {
  const { client, spy } = harness(f.usersResponse)
  const page = await client.listUsers({ pageSize: 50, pageToken: "abc" })
  expect(page.users[0]!.id).toBe("2b7fafd8-c0f4-44d1-a327-dcc6222970b8")
  expect(page.nextPageToken).toBe("Ch5hdXRoMHw2OTI3Z")
  const url = new URL(callAt(spy)[0])
  expect(url.pathname).toBe("/v2/users")
  expect(url.searchParams.get("pageSize")).toBe("50")
  expect(url.searchParams.get("pageToken")).toBe("abc")
})

test("unwraps the single-user envelope", async () => {
  const { client } = harness({ user: f.usersResponse.users[0] })
  const user = await client.getUser("2b7fafd8-c0f4-44d1-a327-dcc6222970b8")
  expect(user.primaryParty).toBe(f.PARTICIPANT_ID)
})

test("normalises right kinds into a discriminated union", async () => {
  const { client } = harness(f.rightsResponse)
  const rights = await client.listUserRights("u1")
  expect(rights).toEqual([
    { kind: "ParticipantAdmin" },
    { kind: "CanActAs", party: f.PARTICIPANT_ID },
    { kind: "CanReadAs", party: f.PARTICIPANT_ID },
  ])
})

test("parses the party-free admin right kinds", async () => {
  const { client } = harness({
    rights: [
      { kind: { IdentityProviderAdmin: { value: {} } } },
      { kind: { CanReadAsAnyParty: { value: {} } } },
    ],
  })
  expect(await client.listUserRights("u1")).toEqual([
    { kind: "IdentityProviderAdmin" },
    { kind: "CanReadAsAnyParty" },
  ])
})

test("encodes a user id containing a pipe into the path", async () => {
  const { client, spy } = harness(f.rightsResponse)
  await client.listUserRights("auth0|6927f768")
  expect(callAt(spy)[0]).toBe("https://ledger.example/v2/users/auth0%7C6927f768/rights")
})

test("serialises rights back to Canton wire form when granting", async () => {
  const { client, spy } = harness(f.rightsResponse)
  await client.grantUserRights("u1", [
    { kind: "CanActAs", party: "alice::122" },
    { kind: "ParticipantAdmin" },
  ])
  const [, init] = callAt(spy)
  expect(JSON.parse(init.body as string)).toEqual({
    userId: "u1",
    rights: [
      { kind: { CanActAs: { value: { party: "alice::122" } } } },
      { kind: { ParticipantAdmin: { value: {} } } },
    ],
  })
  expect(init.method).toBe("POST")
})

test("revokes rights with PATCH", async () => {
  const { client, spy } = harness(f.rightsResponse)
  await client.revokeUserRights("u1", [{ kind: "CanReadAs", party: "bob::122" }])
  expect(callAt(spy)[1].method).toBe("PATCH")
})

test("creates a user with primary party and rights", async () => {
  const { client, spy } = harness({ user: f.usersResponse.users[0] })
  await client.createUser({
    userId: "svc-1",
    primaryParty: "alice::122",
    rights: [{ kind: "CanActAs", party: "alice::122" }],
  })
  const body = JSON.parse(callAt(spy)[1].body as string)
  expect(body.user.id).toBe("svc-1")
  expect(body.user.primaryParty).toBe("alice::122")
  expect(body.user.isDeactivated).toBe(false)
  expect(body.rights).toEqual([{ kind: { CanActAs: { value: { party: "alice::122" } } } }])
})

test("builds a snake_case update mask covering only supplied fields", async () => {
  const { client, spy } = harness({ user: f.usersResponse.users[0] })
  await client.updateUser({ userId: "u1", isDeactivated: true })
  const [, init] = callAt(spy)
  const body = JSON.parse(init.body as string)
  expect(init.method).toBe("PATCH")
  expect(body.updateMask).toEqual({ paths: ["is_deactivated"] })
  expect(body.user.isDeactivated).toBe(true)
  expect(body.user).not.toHaveProperty("primaryParty")
})

test("includes both mask paths when both fields change", async () => {
  const { client, spy } = harness({ user: f.usersResponse.users[0] })
  await client.updateUser({ userId: "u1", primaryParty: "alice::122", isDeactivated: false })
  const body = JSON.parse(callAt(spy)[1].body as string)
  expect(body.updateMask.paths).toEqual(["primary_party", "is_deactivated"])
})

test("rejects an update with no fields rather than sending an empty mask", async () => {
  const { client } = harness({})
  const err = await rejection(client.updateUser({ userId: "u1" }))
  expect(err.message).toMatch(/no fields/i)
})

test("deletes a user", async () => {
  const { client, spy } = harness({})
  await client.deleteUser("u1")
  const [url, init] = callAt(spy)
  expect(init.method).toBe("DELETE")
  expect(new URL(url).pathname).toBe("/v2/users/u1")
})

test("lists parties and forwards filter-party", async () => {
  const { client, spy } = harness(f.partiesResponse)
  const page = await client.listParties({ pageSize: 100, filterParty: "cbtc" })
  expect(page.parties).toHaveLength(2)
  expect(page.parties[0]!.isLocal).toBe(true)
  const url = new URL(callAt(spy)[0])
  expect(url.searchParams.get("filter-party")).toBe("cbtc")
  expect(url.searchParams.get("pageSize")).toBe("100")
})

test("omits empty query params entirely", async () => {
  const { client, spy } = harness(f.partiesResponse)
  await client.listParties({})
  expect(new URL(callAt(spy)[0]).search).toBe("")
})

test("allocates a party and returns the allocated details", async () => {
  const { client, spy } = harness({ partyDetails: f.partiesResponse.partyDetails[0] })
  const party = await client.allocateParty({ partyIdHint: "cbtc-rfq-faucet" })
  expect(party.party).toContain("cbtc-rfq-faucet")
  expect(JSON.parse(callAt(spy)[1].body as string)).toEqual({ partyIdHint: "cbtc-rfq-faucet" })
})

test("always scopes vetted packages to the given participant", async () => {
  const { client, spy } = harness(f.vettedPackagesResponse)
  const pkgs = await client.listVettedPackages(f.PARTICIPANT_ID)
  expect(pkgs).toHaveLength(2)
  expect(pkgs[1]).toMatchObject({ packageName: "splice-amulet", packageVersion: "0.1.22" })
  const body = JSON.parse(callAt(spy)[1].body as string)
  expect(body.topologyStateFilter.participantIds).toEqual([f.PARTICIPANT_ID])
})

test("lists bare package ids", async () => {
  const { client } = harness({ packageIds: ["aaa", "bbb"] })
  expect(await client.listPackageIds()).toEqual(["aaa", "bbb"])
})

test("uploads a DAR as octet-stream with vetAllPackages", async () => {
  const { client, spy } = harness({})
  await client.uploadDar(new Uint8Array([1, 2, 3]), { vetAllPackages: true })
  const [url, init] = callAt(spy)
  expect(new URL(url).pathname).toBe("/v2/dars")
  expect(new URL(url).searchParams.get("vetAllPackages")).toBe("true")
  expect(new Headers(init.headers).get("content-type")).toBe("application/octet-stream")
})

test("sends vetAllPackages=false explicitly rather than dropping it", async () => {
  const { client, spy } = harness({})
  await client.uploadDar(new Uint8Array([1]), { vetAllPackages: false })
  expect(new URL(callAt(spy)[0]).searchParams.get("vetAllPackages")).toBe("false")
})

test("validates a DAR without uploading it", async () => {
  const { client, spy } = harness({})
  await client.validateDar(new Uint8Array([1]))
  expect(new URL(callAt(spy)[0]).pathname).toBe("/v2/dars/validate")
})
