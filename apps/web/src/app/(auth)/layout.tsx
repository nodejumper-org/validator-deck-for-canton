import type { ReactNode } from "react"
import { LogoMark } from "@/components/logo"
import { BRAND } from "@/lib/brand"

/**
 * Sign-in and sign-up sit outside the app shell — there is no navigation to
 * offer until there is a session.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <LogoMark className="size-5" />
          <span className="font-heading text-[17px] font-semibold tracking-tight">
            {BRAND.fullName}
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
