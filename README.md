# Canton Console

A web console for operating Canton participant and validator nodes: inspect node
identity and health, manage ledger users and their rights, browse and allocate
parties, review vetted packages, upload DAR files, and read validator wallet
state. Nodes are registered from the UI — nothing is hardcoded.

## Stack

- **Next.js 16** (App Router) with React 19 — route handlers are the backend
- **Tailwind CSS 4** + **shadcn/ui**
- **TanStack Query 5** for all client data
- **Drizzle ORM** on **PostgreSQL 18** (Docker)
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
npm run db:up                 # starts PostgreSQL 18 on localhost:5434
npm run dev                   # http://localhost:3000
```

`APP_SECRET` encrypts stored OIDC client secrets at rest (AES-256-GCM). Without
it the app refuses to store or read credentials.

The repo keeps a single `.env` at the root. Next only reads `.env` from the app
directory, so `scripts/link-root-env.mjs` links it into `apps/web` before dev,
build, and start. That runs automatically.

## Running everything in Docker

```bash
docker compose --profile app up --build
```

This starts PostgreSQL and the app together on port 3000. Set `APP_SECRET` in
`.env` first — compose passes it through.

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
- **Parties** — *All* is server-paged with a prefix search; *Local* runs a cached
  full scan (see below). Allocate new parties here.
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
  The scan runs server-side, is shared between callers, is cached for 5 minutes,
  and the UI polls it with live progress.
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

**This app has no login and stores node admin credentials.** It is built to run
on your own machine. Do not expose it to a network you do not control. If you
need it shared, put it behind an authenticating proxy and treat the database as
secret material.
