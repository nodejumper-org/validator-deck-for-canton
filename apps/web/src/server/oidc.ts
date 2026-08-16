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
