# Ninery

Ninery is a baseball equipment intelligence platform. This repository is the initial monorepo foundation for the MVP.

## Workspace

- `apps/web` - Next.js web application
- `apps/api` - NestJS API application
- `apps/marketing` - marketing site placeholder
- `packages/ui` - shared UI primitives
- `packages/config` - shared configuration
- `packages/types` - shared TypeScript types
- `packages/database` - Prisma and database package
- `packages/design-tokens` - shared design tokens
- `packages/validators` - shared validation schemas

## Getting Started

```bash
pnpm install
pnpm lint
pnpm build
```

Copy `.env.example` to `.env` when you are ready to connect local services.

## Notes

This foundation intentionally avoids product features. The current apps and packages contain placeholders only so the workspace can install, lint, and build while the product architecture is still forming.
