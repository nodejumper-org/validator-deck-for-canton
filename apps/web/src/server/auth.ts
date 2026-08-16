import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { admin, genericOAuth } from "better-auth/plugins"
import { BRAND } from "@/lib/brand"
import { anyAccountExists, roleForNewUser } from "./accounts"
import { getDb } from "./db"
import { mapOidcProfile, OIDC_PROVIDER_ID, oidcConfigFromEnv } from "./oidc"
import * as schema from "./schema"

/**
 * better-auth needs a Drizzle instance up front, but ours is created
 * asynchronously (it runs migrations on first connect). Building the auth
 * instance lazily keeps that ordering correct and avoids opening a pool at
 * import time, which would break the test suite.
 */
async function build() {
  const db = await getDb()

  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.APP_SECRET
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -hex 32` and put it in .env",
    )
  }

  const oidc = oidcConfigFromEnv()

  return betterAuth({
    secret,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      // No mail server is configured, so requiring verification would lock
      // everyone out. Turn this on once you wire up email.
      requireEmailVerification: false,
      minPasswordLength: 10,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      // Sign-up is open only while the user table is empty (see hooks below);
      // the first account is the admin. README "Security" has the model.
      cookiePrefix: BRAND.cookiePrefix,
    },
    databaseHooks: {
      user: {
        create: {
          // The first PASSWORD account bootstraps the instance and owns it;
          // everyone after is created by that admin and stays a plain user —
          // including admin-created ones, which is what keeps "one admin"
          // true. An account arriving through OIDC already carries the role
          // its Keycloak group decided, and roleForNewUser leaves it alone.
          before: async (u) => ({
            data: { ...u, role: await roleForNewUser(u as { role?: unknown }) },
          }),
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email" && (await anyAccountExists())) {
          throw new APIError("FORBIDDEN", {
            message: "Sign-up is closed. Ask the operator for an account.",
          })
        }
      }),
    },
    // Linking is explicit and narrow. Without a trusted provider better-auth
    // refuses to attach an OIDC identity to an existing local account whose
    // email is unverified — which every operator-created account is — and the
    // first sign-in of the human who bootstrapped this deck fails with
    // `account not linked`, which reads as a broken client secret. The
    // provider is our own Keycloak and mapOidcProfile has already run, so the
    // only identities that reach linking are operators.
    account: oidc
      ? {
          accountLinking: {
            enabled: true,
            trustedProviders: [OIDC_PROVIDER_ID],
            requireLocalEmailVerified: false,
          },
        }
      : undefined,
    plugins: [
      admin(),
      // Registered only when the environment configures it: this deck also
      // runs where there is no Keycloak, and a half-present provider would be
      // a sign-in button that cannot work.
      ...(oidc
        ? [
            genericOAuth({
              config: [
                {
                  providerId: OIDC_PROVIDER_ID,
                  discoveryUrl: oidc.discoveryUrl,
                  clientId: oidc.clientId,
                  clientSecret: oidc.clientSecret,
                  scopes: ["openid", "profile", "email"],
                  // Re-run on every sign-in rather than at creation only:
                  // this is what makes a group removed in Keycloak reach an
                  // account that already exists here.
                  overrideUserInfo: true,
                  // The cast is the type system catching up with the admin
                  // plugin: `role` is its column, and better-auth types this
                  // callback against the base user only. Nothing wider than
                  // `role` is written — mapOidcProfile returns that one field
                  // or throws.
                  mapProfileToUser: (profile) =>
                    mapOidcProfile(
                      profile as unknown as Record<string, unknown>,
                      oidc.adminGroup,
                    ) as unknown as Partial<{ name: string }>,
                },
              ],
            }),
          ]
        : []),
    ],
  })
}

export type AuthInstance = Awaited<ReturnType<typeof build>>

let instance: AuthInstance | null = null

export async function getAuth(): Promise<AuthInstance> {
  instance ??= await build()
  return instance
}

/** Tests only: drop the memoised instance alongside the database handle. */
export function resetAuthForTests(): void {
  instance = null
}
