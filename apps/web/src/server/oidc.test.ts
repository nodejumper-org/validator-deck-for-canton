import { expect, test } from "vitest"
import { mapOidcProfile, OIDC_PROVIDER_ID, oidcConfigFromEnv, ssoButtonProps } from "./oidc"

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

test("a member of the admin group becomes an admin", () => {
  expect(mapOidcProfile({ groups: ["deck-admin", "grafana-editor"] }, "deck-admin")).toEqual({
    role: "admin",
  })
})

test("a realm user who is not a member is refused", () => {
  expect(() => mapOidcProfile({ groups: ["grafana-editor"] }, "deck-admin")).toThrow(/deck-admin/)
})

test("a missing groups claim is a refusal, not an empty membership", () => {
  expect(() => mapOidcProfile({}, "deck-admin")).toThrow(/deck-admin/)
})

test("a groups claim that is not a list of strings is refused", () => {
  expect(() => mapOidcProfile({ groups: "deck-admin" }, "deck-admin")).toThrow(/deck-admin/)
  expect(() => mapOidcProfile({ groups: [1, 2] }, "deck-admin")).toThrow(/deck-admin/)
})

test("only the provider name crosses to the browser", () => {
  const props = ssoButtonProps(full)
  expect(props).toEqual({ providerName: "Keycloak" })
  expect(JSON.stringify(props)).not.toContain("s3cret")
})

test("no provider, no button", () => {
  expect(ssoButtonProps({})).toBeNull()
})
