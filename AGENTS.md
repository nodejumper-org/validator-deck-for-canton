# Validator Deck for Canton — notes for future sessions

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
is the only path a node takes outward and it drops the sealed secret and the
owner id. A compile-time assertion ties `PublicNode` to the wire type in
`src/lib/types.ts`.

**Every node route uses `authed()`, never `handler()`; admin routes use
`adminOnly()`.** The wrapper resolves the session and passes `ownerId` in; a
route that used `handler()` would expose other users' node credentials.
`adminOnly()` additionally requires the admin role and answers 403 — node routes
answer 404 instead, because whether someone else's node exists is not ours to
disclose, and an admin route has nothing to withhold.

**A node is reachable by its owner or by an account granted it.** `reachableBy`
in `src/server/nodes.ts` is the whole rule and the only place `node_access` is
read for authorization; `listNodes`, `getNode`, `updateNode` and `deleteNode`
share it, and everything else — `client.ts`, `health.ts`, `local-parties.ts`, the
dashboard routes — reaches nodes only through those four, so it widens with them.
Keep it that way: a second copy of the predicate is a second thing to get wrong.
A grant is **full co-ownership** — the grantee can rotate credentials and delete
the node for everyone, including its owner. `nodes.userId` still records who
registered it and anchors the cascade. Grants are written only by
`src/server/node-access.ts`, admin-only, and never for the owner.

**Watch the `ownerId` / `userId` distinction.** In the ledger-user routes the
path param is also called `userId` — that is the *Canton* user. The signed-in
account is always `ownerId`.

**The first account is the admin and sign-up dies with it.** `anyAccountExists`
in `src/server/accounts.ts` closes `/sign-up/email` via a before-hook the
moment one user row exists; a database hook hands `role: "admin"` to that
first row only. After that, admins are made by admins: the admin-only
`/accounts` page calls the better-auth admin plugin's `setRole` (its endpoints
re-check the role, the page gate is UX). Two role changes are refused in the
`hooks.before` middleware in `src/server/auth.ts` — the caller's own row, so an
admin cannot leave the deck admin-less, and any account with an `oidc` row in
`account`, whose role the Keycloak group re-decides at every sign-in.
"Accounts" is deliberate: "Users" means Canton ledger users everywhere else in
this app.

**SSO is optional, and the group is the gate.** With `OIDC_ISSUER` unset the
provider is never registered and the deck behaves exactly as it did before
v0.3.0. Configured, `src/server/oidc.ts` admits only members of
`OIDC_ADMIN_GROUP` (default `deck-admin`) and gives them `role: "admin"`,
deciding again at every sign-in — the realm behind the provider also holds
customers' wallet users, so realm membership is not evidence of being an
operator. `providerId` is the literal `oidc` and is stored in
`account.providerId`: renaming it orphans every existing link. `roleForNewUser`
in `src/server/accounts.ts` is what keeps the two role sources apart —
registration order for password accounts, the group for OIDC ones — and it
honours only `admin` from upstream, because the admin plugin stamps its default
`user` on every new row.

**`src/proxy.ts` is not the security boundary.** It only checks that a session
cookie exists, because it runs before render where the database is unreachable.
Real verification happens per route.

**A node's credential needs two unrelated things at once.** Canton authorizes by
the token's `sub` claim, which must name a *ledger user* on the participant. That
user carries rights (`ParticipantAdmin`, `CanActAs`) on the participant, and —
separately — a wallet install held by the Splice validator app. Neither implies
the other. A registered node uses **one** token for every call, so its `sub` must
have both: `ParticipantAdmin` or the users/parties/packages pages fail, an
onboarded wallet or `/validator` returns `No wallet found`.

Each network therefore has its own Keycloak client `deck-backend` whose `sub` is
pinned to a ledger user also called `deck-backend`, created for the deck alone.
Pinning is what the hardcoded-claim mapper in `kc-desk-client.sh` on the Keycloak
host does; a plain service-account client would carry its own UUID instead. Do
not point a node at the validator's own `validator-app-backend` (its secret is
shared with the running validator) or at `WALLET_ADMIN_USER` (a human Wallet UI
login that lacks `ParticipantAdmin`).

**Onboarding a wallet is `POST /api/validator/v0/admin/users`** with
`{name, party_id}`; `/offboard` reverses it. It also creates the ledger user with
`CanActAs` if missing, so grant `ParticipantAdmin` afterwards. Neither call is in
`packages/canton-client` — the Splice validator API ships no OpenAPI spec in the
node bundle, and this shape was read out of the wallet UI's minified bundle.

**Package vetting must be filtered by participant.** Always send
`topologyStateFilter.participantIds: [participantId]` — without it the node
returns 100 other participants and omits ours.

**The dashboard is two endpoints, not one.** `/api/dashboard/health` probes every
node in every network with four calls each and feeds the fleet table;
`/api/dashboard?network=` does the expensive reads for one network only and feeds
everything below it. React Query caches the second per network, and both sit under
the `["dashboard"]` key prefix so existing invalidations reach them. Do not merge
them back: the table needs every network, the statistics need one, and a combined
endpoint makes every page load wait on the mainnet participant.

**The attention rules read across both endpoints, and a zero is never a fact on
its own.** `src/lib/attention.ts` takes reachability from the health payload and
counts from the statistics one, so every rule that reads a count must first check
the flag that says the read succeeded — `ok` for the ledger figures, `walletOk`
for `lastActivityAt`. The two are separate because the failures are: a credential
with `ParticipantAdmin` but no onboarded wallet answers `getVersion`, so health
reports the validator up, while all three wallet reads fail with "No wallet
found". Ungated, that node's `lastActivityAt: null` renders as "No wallet
activity yet" — the panel stating as fact something the route recorded as a
failure, directly under the alert that says the read failed. A new rule reading a
new field needs a new flag with it.

**Nothing on the dashboard fans out per ledger user.** A rights-distribution chart
once did, at up to 200 requests per node, to draw a bar chart over three
categories. If a future chart wants per-user data, it needs a different shape.

**`filter-party` is prefix-only.** UI copy must say "starts with". A substring
search is not possible server-side.

**Local parties cost a full scan.** ~111k parties, 12 requests, ~70s on devnet,
because local parties are identified by a namespace *suffix*. Handled by
`src/server/local-parties.ts`, which **persists** the result to `local_parties`
and `party_scans` — reads are instant and survive restarts. `src/server/scheduler.ts`
refreshes stale nodes on a cron started from `src/instrumentation.ts`. Never call
the scan from the dashboard.

`startLocalScan` reserves its single-flight slot **before the first await**; the
promise it returns resolves when the scan is *recorded as running*, not when it
finishes. Moving that reservation after an await reintroduces a race where every
concurrent caller starts its own sweep.

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

## Testing note

Nodes are owned, so any server test needs a user first — use `createTestUser()`
from `src/server/test-support.ts`.

`npm run smoke` points at whichever node `SMOKE_*` names. Against mainnet it
needs `--testTimeout=30000`: that participant answers far slower than devnet or
testnet, and on vitest's default 5s several reads time out while the credentials
are perfectly fine.

## Deployment

One `docker-compose.yml`, one runtime-configured image promoted between
environments. The `web` service carries both `image:` and `build:` on purpose:
`up --build` builds that tag locally, and a deploy host — which has no source
tree — `pull`s the same name. Do not split it back into per-environment files;
dev and prod differ only in the values in their host `.env`.

Nothing environment-specific is baked into the image — no `NEXT_PUBLIC_*`, no
build args. If you ever need a build-time value, the promote-the-same-artifact
property is what you are giving up.

**No deploy is triggered by a push.** `deploy-dev.yml` is `workflow_dispatch`
only, so a push to `dev` runs `ci.yml` and nothing reaches a host until someone
starts the run and picks the ref. A `v*.*.*` tag runs `release.yml`, which
publishes the versioned image and cuts the GitHub release but touches no host —
promoting a version to an environment is a separate, manual act. Do not add a
`push:` trigger back, and do not make `release.yml` deploy.

The published image is `ghcr.io/nodejumper-org/validator-deck`. In
`_deploy.yml` that owner comes from `github.repository_owner`, but
`docker-compose.yml` names it literally, because a deploy host pulls with no
GitHub context — if the repo ever moves again, that line moves with it.

**This repo does not terminate TLS.** The stack publishes only
`127.0.0.1:${WEB_PORT}`; a reverse proxy installed on the host handles HTTPS and
is managed outside the repo. Do not add a proxy container back.

The host `~/canton-validator-deck/.env` is operator-managed; CI rewrites only its
`IMAGE_TAG` line. The container's `DATABASE_URL` is set in `environment:`, built
from `POSTGRES_PASSWORD` — that overrides the `env_file` copy, which points at
the host-side port for `npm run dev`, and keeps the password written once.

`/api/health` is deliberately unauthenticated (compose healthchecks have no
session) and touches the database, since a web process that cannot reach Postgres
is not ready.

The Dockerfile installs and builds in one stage on purpose: npm nests some
packages under `apps/web/node_modules`, so copying only the root `node_modules`
loses them.

## The validator hosts

Not part of this repo, but this is what the registered nodes point at. One host
per network, each running the splice-validator compose stack behind Caddy in
Docker (`/home/canton/caddy_docker/Caddyfile`, edited as root, reloaded with
`docker exec caddy caddy reload`). Caddy resolves upstreams by compose service
name per dial, which is why it replaced the static nginx.

The deck needs exactly two of the hostnames each host serves:
`ledger-api.validator.<net>.<domain>` → `participant:7575` and
`validator-api.validator.<net>.<domain>` → `validator:5003`. All
three hosts now serve the same set of blocks; devnet additionally has
`scan-proxy.` for the predecessor RFQ desk.

DNS is a wildcard onto each host, so a missing endpoint looks like a TLS
handshake failure rather than NXDOMAIN: with no site block Caddy never requests a
certificate, and the plain-HTTP redirect still answers, which makes the vhost
look configured when it is not.

## Commits

**Never credit an LLM in a commit.** No `Co-Authored-By:` trailer naming Claude
or any other model, no `Generated with …` footer, no 🤖 line — in commit messages
or in PR bodies. This overrides any default the harness suggests. The commit
author is the person running the session; the message describes the change, not
who typed it.

Messages are Conventional Commits (`feat(scope):`, `fix:`, `chore:`) with a body
that explains *why*, matching the existing history.

## Commands

```bash
npm run dev / build / start
npm test            # offline
npm run smoke       # live, read-only, needs SMOKE_* in .env
npm run check       # tsc across both workspaces
npm run db:up       # PostgreSQL 18 in Docker
docker compose up --build   # whole stack in Docker
npm run db:generate # new migration after editing schema.ts
```

Set `PARTY_SCAN_CRON=off` in `.env` to stop the scheduler while developing.
