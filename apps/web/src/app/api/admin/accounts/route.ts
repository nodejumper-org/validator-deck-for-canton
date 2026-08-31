import { listAccounts } from "@/server/accounts"
import { adminOnly } from "@/server/route-helpers"

export const GET = adminOnly(async () => ({ accounts: await listAccounts() }))
