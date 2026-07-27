# Multi-stage: the runtime image carries only the standalone build output.
#
# Debian slim rather than Alpine: on musl, npm resolves wasm fallbacks for the
# native build tools that a macOS-generated lockfile does not carry.
FROM node:24-slim AS build
WORKDIR /app

# Manifests first, so the install layer caches on lockfile changes alone.
COPY package.json package-lock.json ./
COPY packages/canton-client/package.json packages/canton-client/
COPY apps/web/package.json apps/web/

# `npm install`, not `npm ci`: optional native deps resolve differently on linux
# than on the macOS where the lockfile is generated, and `npm ci` refuses rather
# than reconciling. The lockfile is still committed and still honoured here.
#
# Install and build share one stage on purpose: npm nests some packages under
# apps/web/node_modules, so copying only the root node_modules loses them.
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build --workspace apps/web

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
# Migrations run on first connect, so the image must carry them.
COPY --from=build /app/apps/web/drizzle ./apps/web/drizzle

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
