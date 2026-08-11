import type { NextConfig } from "next"

// The single root .env is linked to apps/web/.env by scripts/link-root-env.mjs,
// which runs before dev/build/start. Next then loads it the normal way.

const nextConfig: NextConfig = {
  // The workspace client ships as TypeScript source, so Next must compile it.
  transpilePackages: ["@validator-deck/canton-client"],
  // Native/driver packages must not be bundled by the server compiler.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // Produces apps/web/.next/standalone for the Docker runtime stage.
  output: "standalone",
  // The default bottom-left indicator sits exactly on the account menu at the
  // foot of the rail.
  devIndicators: { position: "bottom-right" },
}

export default nextConfig
