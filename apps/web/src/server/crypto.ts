import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"

function key(): Buffer {
  const secret = process.env.APP_SECRET
  if (!secret) {
    throw new Error(
      "APP_SECRET is not set. Generate one with `openssl rand -hex 32` and put it in .env",
    )
  }
  // Hashing accepts a secret of any length while always yielding the 32 bytes
  // AES-256 requires.
  return createHash("sha256").update(secret).digest()
}

/** Returns "iv:tag:ciphertext", all hex. */
export function seal(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), enc.toString("hex")].join(":")
}

/** Throws if the value was tampered with — GCM authenticates as well as encrypts. */
export function open(sealed: string): string {
  const [ivHex, tagHex, dataHex] = sealed.split(":")
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed sealed value")

  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString(
    "utf8",
  )
}
