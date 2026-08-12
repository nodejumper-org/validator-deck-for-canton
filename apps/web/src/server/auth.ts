import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { admin } from "better-auth/plugins"
import { BRAND } from "@/lib/brand"
import { anyAccountExists } from "./accounts"
import { getDb } from "./db"
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
          // The first account bootstraps the instance and owns it; everyone
          // after is created by that admin and stays a plain user — including
          // admin-created ones, which is what keeps "one admin" true.
          before: async (u) => ({
            data: { ...u, role: (await anyAccountExists()) ? "user" : "admin" },
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
    plugins: [admin()],
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
