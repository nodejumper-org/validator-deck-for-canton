import { expect, test } from "vitest"
import { OIDC_PROVIDER_ID, oidcConfigFromEnv } from "./oidc"

const full = {
  OIDC_ISSUER: "https://keycloak.example.test/realms/ftp",
  OIDC_CLIENT_ID: "deck",
  OIDC_CLIENT_SECRET: "s3cret",
}

test("no issuer means no provider at all", () => {
  expect(oidcConfigFromEnv({})).toBeNull()
})

test("a complete environment derives the discovery URL and the defaults", () => {
  const cfg = oidcConfigFromEnv(full)!
  expect(cfg.discoveryUrl).toBe(
    "https://keycloak.example.test/realms/ftp/.well-known/openid-configuration",
  )
  expect(cfg.adminGroup).toBe("deck-admin")
  expect(cfg.providerName).toBe("Keycloak")
})

test("a trailing slash on the issuer does not double up in the discovery URL", () => {
  const cfg = oidcConfigFromEnv({ ...full, OIDC_ISSUER: `${full.OIDC_ISSUER}/` })!
  expect(cfg.discoveryUrl).toBe(
    "https://keycloak.example.test/realms/ftp/.well-known/openid-configuration",
  )
})

test("a half-configured environment throws and names the missing variable", () => {
  expect(() => oidcConfigFromEnv({ OIDC_ISSUER: full.OIDC_ISSUER })).toThrow(/OIDC_CLIENT_ID/)
})

test("the provider id is the stored literal", () => {
  expect(OIDC_PROVIDER_ID).toBe("oidc")
})
