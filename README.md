# Validator Deck for Canton

A web app for operating Canton participant and validator nodes: inspect node
identity and health, manage ledger users and their rights, browse and allocate
parties, review vetted packages, upload DAR files, and read validator wallet
state. Nodes are registered from the UI — nothing is hardcoded.

## Stack

- **Next.js 16** (App Router) with React 19 — route handlers are the backend
- **Tailwind CSS 4** + **shadcn/ui**
- **TanStack Query 5** for all client data
- **Drizzle ORM** on **PostgreSQL 18** (Docker)
- **better-auth** for email/password accounts and sessions
- **Zod 4** — every Canton response is parsed, and the schemas are the types
- **Vitest** for tests, **Recharts** for the dashboard charts

Canton is reached over its **JSON Ledger API v2** and the **Splice validator
HTTP API**. There is no gRPC and no protobuf code generation.

## Requirements

- Node.js ≥ 20.11 (developed on 24)
- Docker (for PostgreSQL)

## Setup

```bash
npm install
cp .env.example .env
openssl rand -hex 32          # paste into APP_SECRET in .env
openssl rand -hex 32          # and into BETTER_AUTH_SECRET
npm run db:up                 # starts PostgreSQL 18 on localhost:5434
npm run dev                   # http://localhost:3000
```

Open the app and create an account. Registration is open — the person running
the deployment controls who can reach it.

`APP_SECRET` encrypts stored OIDC client secrets at rest (AES-256-GCM). Without
it the app refuses to store or read credentials. `BETTER_AUTH_SECRET` signs
session cookies; it falls back to `APP_SECRET` if unset.

The repo keeps a single `.env` at the root. Next only reads `.env` from the app
directory, so `scripts/link-root-env.mjs` links it into `apps/web` before dev,
build, and start. That runs automatically.

## Running everything in Docker

```bash
docker compose up --build
```

Builds the image from source and starts it alongside PostgreSQL on
`127.0.0.1:3000`. Fill `APP_SECRET` and `BETTER_AUTH_SECRET` in `.env` first —
compose passes them through.

For day-to-day work you usually want the database in Docker and Next on the host,
which is what `npm run db:up && npm run dev` gives you.

## Deployment

**One `docker-compose.yml` for everything.** Locally it builds the image; on a
deploy host, where there is no source tree, the same file pulls
`ghcr.io/<owner>/validator-deck-web:$IMAGE_TAG` instead. The image reads every
setting at runtime, so **the same artifact is promoted from dev to prod** rather
than rebuilt — dev and prod differ only in the values in their host `.env`.

The stack publishes `web` on `127.0.0.1:${WEB_PORT}` and nothing else. **TLS is
not its job**: install a reverse proxy on the host and point it there.

### How a deploy runs

**No deploy is automatic.** `.github/workflows/deploy-dev.yml` is
`workflow_dispatch` only — run it from the Actions tab, picking the ref, and it
tags the image `dev`. A push to `dev` runs `ci.yml` and stops there. The deploy
calls a reusable workflow, which:

1. runs `npm run check` and `npm test`,
2. builds and pushes `ghcr.io/<owner>/validator-deck-web:<tag>`,
3. copies `docker-compose.yml` to `~/canton-validator-deck/` on the host,
4. rewrites only the `IMAGE_TAG` line in the host `.env`, then
   `docker compose pull && up -d --wait`.

**Releases are cut by tag.** Pushing a `v*.*.*` tag runs
`.github/workflows/release.yml`: it tests, publishes
`ghcr.io/<owner>/validator-deck-web:<version>`, and creates the GitHub release —
but touches no host. To run a released version somewhere, set that version as
`IMAGE_TAG` in the host `.env` and `docker compose pull && up -d`.

The host `.env` is operator-managed and survives deploys. Create it once from
`.env.example`; the workflow fails loudly if it is missing rather than starting
with defaults.

### First-time host setup

```bash
mkdir -p ~/canton-validator-deck && cd ~/canton-validator-deck
# copy .env.example here as .env, then fill in:
#   APP_SECRET, BETTER_AUTH_SECRET   openssl rand -hex 32, twice
#   POSTGRES_PASSWORD                compose derives the container's DATABASE_URL from it
#   BETTER_AUTH_URL                  the public https origin, exactly
#   WEB_PORT                         what your reverse proxy forwards to
```

Then point the host's reverse proxy at `127.0.0.1:$WEB_PORT` and give it a
certificate. Repository settings the workflows expect — as **secrets** on each
GitHub Environment (`dev`, `prod`): `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`,
and optionally `SSH_PORT`.

## Accounts

Sign up with an email and a password of at least 10 characters. **Nodes belong to
the account that registered them** — another account cannot see them, use them,
or even confirm they exist. Deleting an account removes its nodes and everything
scanned from them.

There is no email verification, because no mail server is configured. Turn
`requireEmailVerification` on in `apps/web/src/server/auth.ts` once you wire one
up.

## Registering a node

Open **Nodes → Register node**. You need:

| Field | What it is |
|---|---|
| Ledger API URL | The JSON Ledger API v2 base URL |
| Validator API URL | The Splice validator base URL. Leave empty for a participant-only node — the validator page then stays hidden |
| Token endpoint | OIDC token URL, usually ending `/protocol/openid-connect/token` |
| Client ID / secret | OIDC client credentials |
| Audience / Scope | Usually the validator URL and `daml_ledger_api` |

Press **Test** on the node row to confirm both APIs answer before going further;
it reports each surface separately with its latency.

## What each page does

- **Dashboard** — cross-node stat tiles, a health matrix, and four charts: CC
  received per day, reward mix, rights distribution, and package version sprawl.
- **Nodes** — register, edit, remove, and test nodes.
- **Overview** — participant ID, Canton and Splice versions, connected
  synchronizers, ledger offset, user and package counts.
- **Users** — create, deactivate, and delete ledger users; grant and revoke all
  five right kinds.
- **Parties** — *All* is server-paged with a prefix search; *Local* reads a
  stored list refreshed on a schedule (see below). Allocate new parties here.
- **Packages** — vetted packages with names and versions, a version-sprawl
  breakdown, and DAR upload with a validate-first dry run.
- **Validator** — wallet balance, mining round, DSO party, onboarded users, and
  recent wallet activity.

## Things worth knowing about Canton

These shaped the design and are easy to trip over:

- **`filter-party` is a prefix match**, not a substring match. The parties search
  box says "starts with" because that is what it does.
- **Local parties need a full scan.** They are identified by the participant's
  namespace, which is a *suffix* of the party ID, so the node cannot filter for
  them. On devnet that is ~111,000 parties over 12 requests and about 70 seconds.

  Because that is far too slow to do per page load, the result is **stored in
  Postgres** (`local_parties`, `party_scans`) and refreshed by a scheduler. The
  page reads the stored list instantly and shows when it was last refreshed;
  **Refresh** forces a rescan and streams live progress. Allocating a party also
  invalidates the stored list.

  The scheduler runs every 10 minutes by default and rescans any node whose list
  is older than 30 minutes. Change the cadence with `PARTY_SCAN_CRON`, or set it
  to `off` to rely on the Refresh button alone.
- **Package listing must be filtered by participant.** Without
  `topologyStateFilter.participantIds`, the node returns the first 100
  participants on the synchronizer and usually omits yours.
- **Access tokens live 300 seconds.** They are cached per node and refreshed 60
  seconds early, single-flight.

## Testing

```bash
npm test        # unit tests — no Docker needed, uses in-process Postgres (PGlite)
npm run smoke   # read-only checks against a real node; needs SMOKE_* in .env
npm run check   # TypeScript across both workspaces
```

`npm run smoke` is the one that catches wire-format drift: it exercises the real
Ledger and validator APIs, including that the prefix filter behaves as documented
and that a corrupt DAR returns `INVALID_DAR`. It never writes.

## Database

Schema lives in `apps/web/src/server/schema.ts`. After changing it:

```bash
npm run db:generate   # writes a new SQL migration to apps/web/drizzle/
```

Migrations are applied automatically on first connect, in both Postgres and the
PGlite instance the tests use — so tests exercise the real migrations.

## Security

- Accounts are email/password with server-side sessions. Every API route verifies
  the session against the database; the proxy redirect is a convenience, not the
  boundary.
- Node OIDC client secrets are encrypted at rest with AES-256-GCM and **never
  sent to the browser** — responses carry `hasSecret: true` instead.
- Nodes are scoped to their owner on every read and write.

Before putting this on a public network:

- serve it over HTTPS — the stack listens on loopback only, so the host's reverse
  proxy terminates TLS and should set HSTS, `nosniff`, `DENY` framing, and a
  strict referrer policy;
- set `BETTER_AUTH_URL` to the real origin, exactly, including the scheme;
- use distinct `APP_SECRET` and `BETTER_AUTH_SECRET` values;
- treat the database as secret material — it holds credentials that can
  administer your Canton nodes.

Registration is open by default. If that is not what you want, restrict access at
the network edge or add an invite check in `apps/web/src/server/auth.ts`.

The container runs as the unprivileged `node` user and the image carries no
`.env` — runtime configuration comes from compose only.
