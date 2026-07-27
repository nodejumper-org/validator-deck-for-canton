import { vi, type Mock } from "vitest"
import type { CantonApiError } from "../errors"

/**
 * `vi.fn(async () => ...)` infers an empty parameter tuple, which makes
 * `spy.mock.calls[0]` untyped. Declaring the signature up front keeps the call
 * assertions type-safe across every client test.
 */
export type FetchSpy = Mock<(url: string, init?: RequestInit) => Promise<Response>>

export function fetchSpy(impl: (url: string, init?: RequestInit) => Promise<Response>): FetchSpy {
  return vi.fn(impl)
}

/** The (url, init) pair of the nth call, with init narrowed to non-optional. */
export function callAt(spy: FetchSpy, index = 0): [string, RequestInit] {
  const call = spy.mock.calls[index]
  if (!call) throw new Error(`fetch was not called ${index + 1} time(s)`)
  return [call[0], call[1] ?? {}]
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  })
}

/** Casts a spy to the `fetch` shape the clients expect. */
export const asFetch = (spy: FetchSpy): typeof fetch => spy as unknown as typeof fetch

/**
 * Awaits a promise that must reject and returns the error.
 * `promise.catch(e => e)` would type the result as a union with the success
 * value, which makes every assertion on the error fail to compile.
 */
export async function rejection<E = CantonApiError>(promise: Promise<unknown>): Promise<E> {
  try {
    await promise
  } catch (e) {
    return e as E
  }
  throw new Error("expected the promise to reject, but it resolved")
}
