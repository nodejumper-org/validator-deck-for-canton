import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"
import { admin } from "better-auth/plugins"
import { BRAND } from "@/lib/brand"
import { anyAccountExists, roleForNewUser } from "./accounts"
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
          // after is created by that admin and starts as a plain user. A second
          // admin is made deliberately on the /accounts page, never by what a
          // creation call happens to carry.
          before: async (u) => ({ data: { ...u, role: await roleForNewUser() } }),
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

        // The admin plugin is happy to write any role onto any account,
        // including the caller's own. The page hides that action but the
        // endpoint does not, and an admin demoting themselves can leave the
        // deck with no admin at all.
        if (ctx.path === "/admin/set-role") {
          const targetId = (ctx.body as { userId?: string } | undefined)?.userId
          // Returns `{ session, user } | null`, so this holds both — naming it
          // `session` would read as the session alone. A global before-hook runs
          // ahead of the endpoint's own adminMiddleware, so ctx.context.session
          // is not populated yet and this is the way to the caller.
          const caller = await getSessionFromCtx(ctx)

          if (targetId && caller?.user.id === targetId) {
            throw new APIError("BAD_REQUEST", {
              message: "You cannot change your own role. Ask another admin.",
            })
          }

        }
      }),
    },
    plugins: [
      admin(),
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
