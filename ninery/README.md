# Ninery

Ninery is a baseball equipment intelligence platform. This monorepo contains the MVP web app, API, Prisma database package, and intelligence packages for Player DNA, Equipment DNA, and recommendations.

## Quick Start

### Prerequisites

- Windows 11 is supported.
- Node.js 22+ is recommended.
- pnpm 9.15.4 is used by this repo.
- A Supabase development PostgreSQL database is required for database push, seed, and demo recommendation flows.

### First-Time Setup

```bash
pnpm install
pnpm env:check
pnpm db:setup
pnpm doctor
pnpm dev
```

`pnpm db:setup` validates the Prisma schema, generates Prisma Client, runs `prisma db push`, and seeds development data. It requires a reachable development database.

### URLs

- Web: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/health
- Version: http://localhost:3001/version
- Demo recommendation: http://localhost:3001/dev/demo/recommendation
- BatMatch demo results page: http://localhost:3000/batmatch/demo/results

The demo recommendation route is development-only and is disabled when `NODE_ENV=production`.

### Daily Startup

```bash
pnpm dev
```

Use `Ctrl+C` to stop the applications.

## Common Commands

```bash
pnpm dev          # web and API together
pnpm dev:web      # web only
pnpm dev:api      # API only
pnpm build        # build all packages/apps
pnpm typecheck    # typecheck all packages/apps
pnpm test         # run available tests
pnpm lint         # run configured validation
pnpm clean        # remove generated build output only
```

Database commands:

```bash
pnpm db:validate
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm db:studio
pnpm db:setup
```

`db:push`, `db:seed`, and `db:setup` require Supabase access. Codex may not be able to run them against your remote development database.

## Environment

Copy `.env.example` to `.env` and fill in development-only values:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=ninery_dev"
PORT=3001
NODE_ENV=development
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Never commit `.env`, never share `DATABASE_URL`, and never use production credentials for local prototyping.

## Safe Database Practices

- `ninery_dev` is development only.
- `prisma db push` is used during prototyping.
- Do not run destructive database commands against production.
- Do not manually edit Prisma migration SQL.

## Windows EPERM / EBUSY Recovery

If `pnpm install` fails with `EPERM` or `EBUSY`:

1. Stop `pnpm dev` with `Ctrl+C`.
2. Close Prisma Studio.
3. Close active VS Code terminals.
4. Close Node processes associated with this project.
5. Reopen VS Code.
6. Use Command Prompt rather than PowerShell if script policy gets in the way.
7. Run `pnpm install`.
8. Run `pnpm db:generate`.
9. Run `pnpm doctor`.

Do not weaken PowerShell security settings, and do not terminate unrelated Node processes.

## Troubleshooting

- `pnpm not recognized`: enable Corepack or install pnpm, then reopen the terminal.
- PowerShell script restriction: use Command Prompt or `pnpm.cmd`.
- `PrismaClient` missing: run `pnpm install` and `pnpm db:generate`.
- `DATABASE_URL missing`: copy `.env.example` to `.env` and fill it in.
- Supabase direct connection unreachable: use the documented Session pooler connection string for local development.
- API port already in use: set `PORT=3002` or stop the process using port `3001`.

## BatMatch Demo Results

The MVP recommendation experience lives at `/batmatch/demo/results`. It calls the development-only API endpoint `GET /dev/demo/recommendation`, adapts the response into a web view model, and presents the best match, alternatives, Player DNA, confidence, missing information, and the Ninery trust statement without purchase or affiliate actions.

Local verification:

```bash
pnpm dev:api
pnpm dev:web
```

Then open http://localhost:3000/batmatch/demo/results. The web app uses `NEXT_PUBLIC_API_BASE_URL` and defaults to `http://localhost:3001` during local development.

## Security Notes

Development authorization is still a placeholder. Family-membership authorization is required before public launch. Health and version endpoints are intentionally safe and unauthenticated; they must not expose secrets, connection strings, table names, or stack traces.
