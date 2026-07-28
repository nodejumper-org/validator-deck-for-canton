import { NextResponse, type NextRequest } from "next/server"
import { hasSessionCookie } from "@/lib/session-cookie"

const PUBLIC_PATHS = ["/sign-in", "/sign-up"]

/**
 * Redirects unauthenticated visitors to sign-in and signed-in ones away from the
 * auth pages.
 *
 * This only checks that a session cookie is *present* — proxy runs before render,
 * potentially at the edge, where the database is unreachable. It is a routing convenience,
 * not the security boundary: every API route independently verifies the session
 * against the database via `authed()`.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const hasSession = hasSessionCookie(req.cookies.getAll())

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = "/sign-in"
    // Send them back where they were headed once signed in.
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (hasSession && isPublic) {
    const url = req.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Everything except Next internals, the auth endpoints themselves, and the
  // API (which returns 401 JSON rather than redirecting).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
