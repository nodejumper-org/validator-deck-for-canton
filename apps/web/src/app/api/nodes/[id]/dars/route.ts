import { ledgerFor } from "@/server/client"
import { handler, HttpError } from "@/server/route-helpers"

/** Enough for any realistic DAR; keeps a stray upload from exhausting memory. */
const MAX_BYTES = 25 * 1024 * 1024

export const POST = handler(async (req, ctx: RouteContext<"/api/nodes/[id]/dars">) => {
  const { id } = await ctx.params
  const form = await req.formData()
  const file = form.get("file")

  if (!(file instanceof File)) {
    throw new HttpError(400, "NO_FILE", "Attach a .dar file under the `file` field")
  }
  if (!file.name.endsWith(".dar")) {
    throw new HttpError(400, "NOT_A_DAR", `${file.name} is not a .dar file`)
  }
  if (file.size > MAX_BYTES) {
    throw new HttpError(413, "TOO_LARGE", `${file.name} exceeds the 25 MB upload limit`)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const ledger = await ledgerFor(id)
  const validateOnly = form.get("validateOnly") === "true"

  if (validateOnly) {
    await ledger.validateDar(bytes)
    return { ok: true, validated: true, fileName: file.name, bytes: bytes.length }
  }

  await ledger.uploadDar(bytes, { vetAllPackages: form.get("vetAllPackages") !== "false" })
  return { ok: true, validated: false, fileName: file.name, bytes: bytes.length }
})
