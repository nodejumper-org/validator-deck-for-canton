import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { BRAND } from "@/lib/brand"
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
      // Registration is open by design: this is self-hosted, and whoever runs it
      // decides who can reach it. See the security note in the README.
      cookiePrefix: BRAND.cookiePrefix,
    },
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
