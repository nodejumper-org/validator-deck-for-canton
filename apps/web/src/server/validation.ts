import { z } from "zod"

/**
 * The normalised right shape shared by every user route. Kept here rather than in
 * one route file so grant, revoke, and create all validate identically.
 */
export const rightSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ParticipantAdmin") }),
  z.object({ kind: z.literal("IdentityProviderAdmin") }),
  z.object({ kind: z.literal("CanReadAsAnyParty") }),
  z.object({ kind: z.literal("CanActAs"), party: z.string().min(1, "Party is required") }),
  z.object({ kind: z.literal("CanReadAs"), party: z.string().min(1, "Party is required") }),
])

export const rightsBodySchema = z.object({
  rights: z.array(rightSchema).min(1, "At least one right is required"),
})

export const createUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  primaryParty: z.string().optional(),
  rights: z.array(rightSchema).default([]),
})

export const updateUserSchema = z
  .object({
    primaryParty: z.string().optional(),
    isDeactivated: z.boolean().optional(),
  })
  .refine((v) => v.primaryParty !== undefined || v.isDeactivated !== undefined, {
    message: "Nothing to update",
  })

/**
 * The dashboard's `?network=` parameter. A Zod enum rather than a hand-rolled
 * check so an unknown value becomes a 400 through the `ZodError` branch already
 * in `route-helpers.ts`.
 */
export const networkParamSchema = z.enum(["devnet", "testnet", "mainnet", "local"])
