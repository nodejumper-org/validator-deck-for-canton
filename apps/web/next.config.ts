import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The workspace client ships as TypeScript source, so Next must compile it.
  transpilePackages: ["@canton/client"],
  // Native/driver packages must not be bundled by the server compiler.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // Produces apps/web/.next/standalone for the Docker runtime stage.
  output: "standalone",
}

export default nextConfig
