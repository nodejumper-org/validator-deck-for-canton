# syntax=docker/dockerfile:1.7
#
# Build context is the repo root, so the workspace layout is intact:
#   docker build -f apps/web/Dockerfile .
#
# Debian 13 (trixie) slim, named explicitly: the bare `24-slim` tag still
# tracks bookworm. Debian rather than Alpine: on musl, npm resolves wasm
# fallbacks for the native build tools that a macOS-generated lockfile does
# not carry.
FROM node:24-trixie-slim AS builder
WORKDIR /repo

# Manifests first, so the install layer caches on lockfile changes alone.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/canton-client/package.json packages/canton-client/
COPY apps/web/package.json apps/web/

# `npm install`, not `npm ci`: optional native deps resolve differently on linux
# than on the macOS where the lockfile is generated, and `npm ci` refuses rather
# than reconciling. The lockfile is still committed and still honoured here.
#
# Install and build share a stage on purpose: npm nests some packages under
# apps/web/node_modules, so copying only the root node_modules loses them.
RUN npm install --no-audit --no-fund

COPY packages/canton-client packages/canton-client
COPY apps/web apps/web
COPY scripts scripts

# Everything this app needs is read at runtime, so the image is the same for
# every environment — no NEXT_PUBLIC_* baked in, one image promotes dev to prod.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace apps/web

# ---

FROM node:24-trixie-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Docker sets HOSTNAME to the container id; the standalone server would bind to it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# The server is plain `node`, so the package managers the base image ships —
# npm, npx, corepack and yarn — have no use here, and their own bundled
# dependencies (undici, tar, brace-expansion, ip-address) were most of what an
# image scan flagged in this stage.
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Next standalone output preserves the workspace layout: the entrypoint is
# apps/web/server.js with dependencies vendored alongside.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public
# Migrations run on first connect, so the image must carry them.
COPY --from=builder /repo/apps/web/drizzle ./apps/web/drizzle
# The code stays owned by root, so the server process cannot rewrite it; only
# the cache directory Next writes to at runtime belongs to `node`.
RUN mkdir -p apps/web/.next/cache && chown node:node apps/web/.next/cache

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
