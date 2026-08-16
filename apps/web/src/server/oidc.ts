import { APIError } from "better-auth/api"

/**
 * Single sign-on configuration, read from the environment.
 *
 * SSO is optional: this deck runs outside the fleet that owns a Keycloak, and
 * in docker-compose, so an unset `OIDC_ISSUER` means the provider is never
 * registered rather than a sign-in page with a button that cannot work. A
 * PARTIAL configuration is the dangerous case and throws — an issuer without a
 * client secret is a typo, not a decision to run without SSO.
 */
export const OIDC_PROVIDER_ID = "oidc"

export type OidcConfig = {
  issuer: string
  discoveryUrl: string
  clientId: string
  clientSecret: string
  adminGroup: string
  providerName: string
}

type Env = Record<string, string | undefined>

function required(env: Env, name: string): string {
  const value = env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. OIDC needs OIDC_ISSUER, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET together.`,
    )
  }
  return value
}

export function oidcConfigFromEnv(env: Env = process.env): OidcConfig | null {
  const issuer = env.OIDC_ISSUER?.replace(/\/+$/, "")
  if (!issuer) return null

  return {
    issuer,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    clientId: required(env, "OIDC_CLIENT_ID"),
    clientSecret: required(env, "OIDC_CLIENT_SECRET"),
    adminGroup: env.OIDC_ADMIN_GROUP || "deck-admin",
    providerName: env.OIDC_PROVIDER_NAME || "Keycloak",
  }
}

/**
 * The admission decision, and the only place an OIDC account's role comes from.
 *
 * The realm behind this provider is an organisation realm as well as the
 * operator's: it holds tenants' wallet end users, and Keycloak lets any user of
 * a realm obtain a token from any client in it. Being in the realm is therefore
 * not evidence of being an operator — this group is. Anything that is not a
 * list of strings containing it is refused, so a renamed mapper or a claim that
 * never arrives locks the door instead of opening it.
 *
 * It runs at EVERY sign-in (genericOAuth `overrideUserInfo`), which is what
 * makes a membership removed in Keycloak reach an account that already exists
 * here.
 */
export function mapOidcProfile(
  profile: Record<string, unknown>,
  adminGroup: string,
): { role: "admin" } {
  const groups = profile.groups
  const member =
    Array.isArray(groups) &&
    groups.every((g) => typeof g === "string") &&
    groups.includes(adminGroup)

  if (!member) {
    throw new APIError("FORBIDDEN", {
      message: `This account is not a member of ${adminGroup}. Ask an operator for access.`,
    })
  }
  return { role: "admin" }
}
