import { createHttp, type HttpOptions } from "./http.js"
import {
  dsoPartySchema,
  emptySchema,
  validatorAdminUsersSchema,
  validatorUserSchema,
  validatorVersionSchema,
  walletBalanceSchema,
  walletTransactionsSchema,
  type ValidatorUser,
  type ValidatorVersion,
  type WalletBalance,
  type WalletTransaction,
} from "./schemas.js"

const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
})

export function createValidatorClient(opts: HttpOptions) {
  const http = createHttp(opts)

  return {
    getVersion: (): Promise<ValidatorVersion> =>
      http.json(validatorVersionSchema, "/api/validator/version"),

    getValidatorUser: (): Promise<ValidatorUser> =>
      http.json(validatorUserSchema, "/api/validator/v0/validator-user"),

    /** The node returns duplicates for users onboarded more than once. */
    listOnboardedUsers: (): Promise<string[]> =>
      http
        .json(validatorAdminUsersSchema, "/api/validator/v0/admin/users")
        .then((r) => [...new Set(r.usernames)]),

    getWalletBalance: (): Promise<WalletBalance> =>
      http.json(walletBalanceSchema, "/api/validator/v0/wallet/balance"),

    /** Note this endpoint is POST, not GET, and takes snake_case params. */
    listWalletTransactions: (o: { pageSize?: number } = {}): Promise<WalletTransaction[]> =>
      http
        .json(
          walletTransactionsSchema,
          "/api/validator/v0/wallet/transactions",
          json({ page_size: o.pageSize ?? 50 }),
        )
        .then((r) => r.items),

    getDsoPartyId: (): Promise<string> =>
      http
        .json(dsoPartySchema, "/api/validator/v0/scan-proxy/dso-party-id")
        .then((r) => r.dso_party_id),

    /** Readiness is a health signal, not an error condition — never throws. */
    async isReady(): Promise<boolean> {
      try {
        await http.json(emptySchema, "/api/validator/readyz")
        return true
      } catch {
        return false
      }
    },
  }
}

export type ValidatorClient = ReturnType<typeof createValidatorClient>
