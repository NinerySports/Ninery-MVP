# Local Development

Use this document when local setup gets stuck.

## Readiness Checks

```bash
pnpm env:check
pnpm doctor
```

`env:check` validates required environment variables without printing secret values. `doctor` checks Node, pnpm, workspace folders, package scripts, `node_modules`, Prisma Client availability, and local configuration.

## Database Setup

```bash
pnpm db:validate
pnpm db:generate
pnpm db:push
pnpm db:seed
```

`db:push` and `db:seed` require a reachable development database. They are not run automatically during `pnpm install`.

## Windows File Locks

For `EPERM` or `EBUSY` errors:

1. Stop running dev servers.
2. Close Prisma Studio.
3. Close terminals in VS Code.
4. Close project-related Node processes.
5. Reopen the terminal.
6. Run `pnpm install`.
7. Run `pnpm db:generate`.
8. Run `pnpm doctor`.

Avoid deleting `node_modules` unless you intentionally choose to do a clean reinstall.
