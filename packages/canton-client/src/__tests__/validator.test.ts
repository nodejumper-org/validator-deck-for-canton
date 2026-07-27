import { expect, test } from "vitest"
import { createValidatorClient } from "../validator"
import * as f from "./fixtures"
import { asFetch, callAt, fetchSpy, jsonResponse } from "./helpers"

function harness(payload: unknown, status = 200) {
  const spy = fetchSpy(async () => jsonResponse(payload, status))
  const client = createValidatorClient({
    baseUrl: "https://validator.example",
    getToken: async () => "tok",
    fetchImpl: asFetch(spy),
  })
  return { client, spy }
}

test("reads the splice version", async () => {
  const { client, spy } = harness({ version: "0.6.12", commit_ts: "2026-07-09T19:50:09Z" })
  expect((await client.getVersion()).version).toBe("0.6.12")
  expect(callAt(spy)[0]).toBe("https://validator.example/api/validator/version")
})

test("reads the validator user and party", async () => {
  const { client, spy } = harness(f.validatorUserResponse)
  const u = await client.getValidatorUser()
  expect(u.party_id).toBe(f.PARTICIPANT_ID)
  expect(u.featured).toBe(true)
  expect(callAt(spy)[0]).toContain("/api/validator/v0/validator-user")
})

test("dedupes onboarded usernames", async () => {
  const { client } = harness({
    usernames: ["auth0|a", "auth0|a", "auth0|b", "svc@clients"],
  })
  expect(await client.listOnboardedUsers()).toEqual(["auth0|a", "auth0|b", "svc@clients"])
})

test("keeps wallet amounts as strings", async () => {
  const { client } = harness(f.walletBalanceResponse)
  const b = await client.getWalletBalance()
  expect(b.effective_unlocked_qty).toBe("2003398.0180157556")
  expect(typeof b.effective_unlocked_qty).toBe("string")
  expect(b.round).toBe(54683)
})

test("posts page_size when listing wallet transactions", async () => {
  const { client, spy } = harness(f.walletTransactionsResponse)
  const items = await client.listWalletTransactions({ pageSize: 25 })
  expect(items).toHaveLength(1)
  expect(items[0]!.app_rewards_used).toBe("55.7187007429")
  const [url, init] = callAt(spy)
  expect(url).toContain("/api/validator/v0/wallet/transactions")
  expect(init.method).toBe("POST")
  expect(JSON.parse(init.body as string)).toEqual({ page_size: 25 })
})

test("defaults the transaction page size", async () => {
  const { client, spy } = harness(f.walletTransactionsResponse)
  await client.listWalletTransactions()
  expect(JSON.parse(callAt(spy)[1].body as string)).toEqual({ page_size: 50 })
})

test("unwraps the dso party id", async () => {
  const { client } = harness({ dso_party_id: "DSO::1220be58" })
  expect(await client.getDsoPartyId()).toBe("DSO::1220be58")
})

test("readiness is true on 2xx and false on failure", async () => {
  const ok = harness({}, 200)
  expect(await ok.client.isReady()).toBe(true)

  const bad = createValidatorClient({
    baseUrl: "https://validator.example",
    getToken: async () => "tok",
    fetchImpl: (async () => {
      throw new TypeError("fetch failed")
    }) as unknown as typeof fetch,
  })
  expect(await bad.isReady()).toBe(false)
})
