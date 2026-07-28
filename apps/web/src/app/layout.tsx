import type { Metadata } from "next"
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google"
import { BRAND } from "@/lib/brand"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"
import { Providers } from "./providers"

/*
 * The Plex superfamily was drawn for enterprise infrastructure, which is exactly
 * what this is. Three roles, one voice: condensed for headings (density without
 * shouting), sans for prose and controls, mono for every Canton identifier.
 */
const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const condensed = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-condensed",
  subsets: ["latin"],
  weight: ["500", "600"],
})

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${condensed.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
}
