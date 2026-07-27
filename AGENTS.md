# Canton Console — notes for future sessions

## Layout

npm workspaces monorepo, two packages.

- `packages/canton-client` — framework-free Canton HTTP client. No React, no DB.
  Unit-tested against a stubbed `fetch`. Zod schemas here are the source of all
  Canton types.
- `apps/web` — Next.js 16 App Router. Route handlers under `src/app/api` are the
  backend; `src/server` holds everything server-only.

## Rules that are not obvious from the code

**All Canton access is JSON over `fetch`. Never add gRPC or protobuf.** The
predecessor project used gRPC with ~15k lines of generated code; the JSON Ledger
API v2 covers every operation this app needs.

**Node secrets never reach the browser.** `toPublic()` in `src/server/nodes.ts`
is the only path a node takes outward and it drops the sealed secret. A
compile-time assertion ties `PublicNode` to the wire type in `src/lib/types.ts`.

**Package vetting must be filtered by participant.** Always send
`topologyStateFilter.participantIds: [participantId]` — without it the node
returns 100 other participants and omits ours.

**`filter-party` is prefix-only.** UI copy must say "starts with". A substring
search is not possible server-side.

**Local parties cost a full scan.** ~111k parties, 12 requests, ~70s on devnet,
because local parties are identified by a namespace *suffix*. Handled by
`src/server/local-parties.ts`: single-flight per node, 5-minute TTL, polled by
the client. Never call it from the dashboard.

**Relative imports are extensionless.** Turbopack does not rewrite `.js`
specifiers to `.ts`. Both workspaces are only ever consumed by bundlers.

**`DATABASE_URL` picks the driver.** `postgres://…` uses node-postgres;
`pglite://memory` runs in-process Postgres and is what the tests use, so they
need no Docker but still exercise the real migrations.

**The root `.env` is linked into `apps/web`** by `scripts/link-root-env.mjs`,
which runs before dev/build/start. Next only reads `.env` from the app directory
and Turbopack runs handlers in a worker, so mutating `process.env` from
`next.config.ts` does not reach them.

## Design system

Tokens live in `apps/web/src/app/globals.css`.

- Two accents with strict roles: **indigo** for interactive/active state,
  **amber** for monetary (CC) figures. A colour outside its role is a bug.
- Identifiers always use the `.ident` class (IBM Plex Mono, 12px).
- Numbers that sit in comparable columns get tabular figures.
- Status is a small dot plus text, never colour alone.
- `PartyId` is the signature component: it splits `hint::fingerprint`, weights
  the hint, dims the fingerprint, and draws a deterministic colour rule per
  namespace.
- **Chart colours were validated with the dataviz skill's script.** Dark steps
  are chosen for the dark surface (L 0.48–0.67), not flipped from light. If you
  change them, re-run the validator rather than picking by eye.

## Commands

```bash
npm run dev / build / start
npm test            # offline
npm run smoke       # live, read-only, needs SMOKE_* in .env
npm run check       # tsc across both workspaces
npm run db:up       # PostgreSQL 18 in Docker
npm run db:generate # new migration after editing schema.ts
```
