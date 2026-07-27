export type CantonErrorCode =
  | "AUTH_FAILED"
  | "TIMEOUT"
  | "UNREACHABLE"
  | "CANTON_ERROR"
  | "BAD_RESPONSE"

export class CantonApiError extends Error {
  readonly code: CantonErrorCode
  readonly status: number | undefined
  readonly correlationId: string | undefined

  constructor(
    code: CantonErrorCode,
    message: string,
    options: { status?: number; correlationId?: string; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause })
    this.name = "CantonApiError"
    this.code = code
    this.status = options.status
    this.correlationId = options.correlationId
  }
}

export function isCantonApiError(e: unknown): e is CantonApiError {
  return e instanceof CantonApiError
}
