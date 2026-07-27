export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

/**
 * Every route handler answers with either the payload or
 * `{ error: { code, message } }`. The message is Canton's own text wherever the
 * failure came from the node, so it is surfaced verbatim rather than reworded.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData
  const res = await fetch(path, {
    ...init,
    headers: {
      // FormData must set its own multipart boundary.
      ...(isFormData ? {} : { "content-type": "application/json" }),
      ...init?.headers,
    },
  })

  const text = await res.text()
  let payload: unknown = {}
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      throw new ApiError("BAD_RESPONSE", text.slice(0, 300), res.status)
    }
  }

  if (!res.ok) {
    const envelope = payload as { error?: { code?: string; message?: string } }
    throw new ApiError(
      envelope.error?.code ?? "UNKNOWN",
      envelope.error?.message ?? res.statusText,
      res.status,
    )
  }
  return payload as T
}
