# Ticket #084: Standalone Supporting Context Snapshot Enforcement

The public Prisma repository accepts only a root client and owns a read-only RepeatableRead interactive transaction. Legacy Boolean arguments are rejected. Direct root load calls reject rather than silently starting an unrelated snapshot.

The asynchronous fromProtectedTransaction factory verifies PostgreSQL transaction_isolation and transaction_read_only before exposing a non-exported adapter. Borrowed adapters never create a nested transaction or modify caller settings. Both callback entry and direct load recheck settings on the same transaction client; verification is not cached. Root borrowing and unsuitable transaction settings fail closed before evidence queries. Expired Prisma P2028 errors propagate unchanged; other verification failures have a dedicated error and retained cause.

The #081 repository uses the verified factory within its existing snapshot. Nested lineage, qualification, conflict and eligibility reads retain that same transaction. #082 admissibility, #083 dependence, current/historical classifications, provenance and counts are unchanged. No schema, migration, persistence writes, positive independence, synthesis or downstream authority is introduced.

Unit tests cover ownership misuse, legacy markers, malformed or unavailable settings, per-read validation and expired transactions. PostgreSQL tests cover actual incompatible settings, standalone/borrowed result equivalence and concurrent committed successors, plus existing #075 through #083 boundaries. Only disposable PostgreSQL 16 is permitted. Mock tests do not establish database guarantees.

Runtime checks assume genuine Prisma clients in trusted application code; deliberately fabricated objects can impersonate query results. Borrowed adapters must stay within their originating transaction lifetime. The old two-argument API is intentionally unsupported; one-argument standalone consumers remain compatible.

## Verification

Focused projection unit suite: 16 passed. Complete database unit suite: 101 passed. Equipment Intelligence: 446 passed. Database and Equipment Intelligence builds and no-emit typechecks passed; Recommendation Intelligence typecheck, Prisma validation and git diff checks passed.

The verified disposable PostgreSQL 16.15 cluster used localhost port 55438 and a newly created ticket_079_disposable_084 database under the temporary ninery-ticket083-pg cluster directory. SQL verified the database, host, port, data directory and version before migration. All eight existing migrations applied. The initial serial integration run had 55 passes and two #078 connection-pool timeout failures. The unchanged suite rerun with temporary connect_timeout=30, pool_timeout=30 and connection_limit=10 passed all 57 tests, zero failures or skips. No repository connection configuration or test expectations changed. No development or production database was used.

Commands executed from the repository root:

```cmd
node_modules\.bin\tsc.cmd -p packages/database/tsconfig.json
node_modules\.bin\tsc.cmd -p packages/database/tsconfig.json --noEmit
node_modules\.bin\tsc.cmd -p packages/equipment-intelligence/tsconfig.json
node_modules\.bin\tsc.cmd -p packages/equipment-intelligence/tsconfig.json --noEmit
node_modules\.bin\tsc.cmd -p packages/recommendation-intelligence/tsconfig.json --noEmit
git diff --check
```

From packages/equipment-intelligence: `node --test dist/__tests__/*.test.js`.

From packages/database, after setting only the verified disposable DATABASE_URL or TEST_DATABASE_URL as appropriate:

```cmd
node node_modules/prisma/build/index.js validate --schema prisma/schema.prisma
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
node --test dist/__tests__/governed-supporting-context-projection.test.js
node --test dist/__tests__/external-supporting-evidence-persistence.test.js dist/__tests__/external-claim-ingestion.test.js dist/__tests__/external-claim-review.test.js dist/__tests__/durable-proposed-evidence-class.test.js dist/__tests__/reviewed-qualification.test.js dist/__tests__/governed-supporting-context-bridge.test.js dist/__tests__/governed-supporting-context-projection.test.js dist/__tests__/governed-construct-evidence-projection.test.js
node --test --test-concurrency=1 dist/__tests__/external-supporting-evidence-postgres.integration.test.js dist/__tests__/external-claim-ingestion-postgres.integration.test.js dist/__tests__/external-claim-review-postgres.integration.test.js dist/__tests__/reviewed-qualification-postgres.integration.test.js dist/__tests__/reviewed-qualification-upgrade-postgres.integration.test.js dist/__tests__/governed-supporting-context-bridge-postgres.integration.test.js dist/__tests__/governed-supporting-context-projection-postgres.integration.test.js dist/__tests__/governed-construct-evidence-projection-postgres.integration.test.js dist/__tests__/stronger-evidence-admissibility-postgres.integration.test.js
```
