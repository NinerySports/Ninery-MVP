# Ticket #078 Final Report

Disposition: IMPLEMENTED_READY_FOR_REVIEW.

## Required 36-Item Report

1. Starting commit: `52c108cf255b71f349e4dfa065e832dac5088e21`. HEAD remains there;
   no commit was created.
2. Branch: `codex/ticket-078-reviewed-claim-supporting-context-bridge`. Not renamed,
   recreated, pushed, merged, or submitted as a PR.
3. Files: nine tracked files modified and thirteen files added; full inventory below.
4. Schema: only the approved nullable `ExternalEvidenceNormalizedClaim.proposedEvidenceClass String?`.
   No further schema change or backfill.
5. Migration: `20260926000000_preserve_proposed_evidence_class`. Eight total. All eight
   applied from zero to a fresh isolated PostgreSQL 16.15 cluster/database. A separate
   populated seven-migration database successfully upgraded using only migration eight.
6. Service/repository: `ReviewedDimensionQualificationConvergenceService` and
   `PrismaReviewedQualificationRepository` reconstruct current durable state, assess,
   select, and append/reuse Q2. No automatic content review.
7. Q2 identity: versioned SHA-256 of graph, target/normalized identity, current D/C
   IDs and attestations, governance scope/revision, policy versions, and actual #070
   assessment. Deterministic UUID and unique key derive from that fingerprint.
8. D2 proof: unique supersession leaf, #077 human-reviewed fingerprints, accepted
   state, known dependency meaning, and valid ancestry/group. Recomputed at write
   and current-Q read time; no direct dependency FK required.
9. C2 proof: unique current reviewed construct leaf, valid #077 provenance/policy,
   and existing normalized-claim/construct composite FK on Q2.
10. Governance/policy: unique active bounded governance leaf is assessed through
    existing #076 policy. Its actual revision/scope and #070 contract enter Q2 meaning.
    Source version and governance model version remain separate.
11. #070 reuse: unchanged `qualifyEquipmentClaim` runs against reconstructed graph
    using durable validated proposal. Q1's result is not copied.
12. Q2 persistence: transaction-scoped append to the existing qualification table;
    all assessment fields and current C/G bindings persisted. Q1 remains unchanged.
13. Selector: exact semantic applicability and complete persisted-output validation,
    never newest timestamp/ID. No match means needs_convergence; ambiguity fails closed.
14. Idempotency: exact replay returns existing Q2; concurrent identical operations
    produce one row. Changed D/C/G/policy meaning does not reuse it. Content-review
    exact-key replay returns R2 only while its exact reviewed state is still current.
15. Concurrency: shared slot advisory lock, source FOR UPDATE, locked upstream context,
    transaction reloading, and unique key. Both successor/convergence orderings and
    stale R2 submissions are tested. Direct governance FK writers are also blocked.
16. #077 integration: locked case loader projects Q2, its complete assessment,
    current D2/C2 IDs, governance, and fingerprint. Blocked/pending convergence is
    explicit and prevents new content approval.
17. R1: remains historical/stale; never made current by Q2. Document/extraction
    history remains no_longer_current; dimension change is distinguishable.
18. R2: explicit existing #077 human operation binds exact D2/C2/Q2, normalized
    meaning, target scope, governance, ingestion provenance, and review policy.
19. Stable convergence: Q1 -> D2/C2 -> Q2 -> R2 tested. R2 creates no D3/C3/Q3 and
    remains current immediately afterward; content review is not qualification input.
20. Later successors: D3/C3 or changed governance require distinct convergence and
    stale Q2/R2 applicability. Prior Q2/R2 are retained.
21. History: Q1/D1/C1 byte-preservation and R1/R2 queryability tested; Q2 mutation is
    rejected by existing append-only controls. Post-insert failure rolls back Q2.
22. #075 firewall: no production supporting persistence added or invoked. Existing
    #075 code/lineage behavior unchanged and PostgreSQL regression passes.
23. #066/#067 firewall: no integration or writes introduced.
24. Authority firewall: no canonical/numeric DNA, modeled estimates, synthesis,
    recommendation/ranking/fit/Decision Book authority, public endpoint, or UI change.
25. Database unit tests: 71 passed, zero failures/skips. Build/typecheck pass.
26. #075 PostgreSQL: passed in the final serial run.
27. #076 PostgreSQL: passed, including durable proposal and unclassified separation.
28. #077 PostgreSQL: passed with exact-state review behavior retained.
29. #078 PostgreSQL: eleven behavior/race tests plus populated upgrade pass. Together
    with #075-#077: 15 passed, zero failures/skips in final serial run.
30. Equipment Intelligence: build/typecheck pass; 349 tests passed, zero failures/skips.
31. `git diff --check`: passes; only LF/CRLF conversion warnings.
32. Environment artifacts: initdb restricted-token warnings completed successfully;
    temporary-schema client resolution fixed by copying installed client and disabling
    auto-install; Windows engine-DLL generation lock recovered after clients exited;
    transaction-start/connection timing failures recovered using bounded test-only waits
    and disposable URL connection settings. No production semantics changed for them.
    One production history-label regression was corrected without weakening its test.
33. Contaminated Atlas: untouched. Tests use isolated synthetic equipment; existing
    rejection/identity regressions remain intact.
34. `../.pnpm-store/` and `packages/database/({id`: untouched, unstaged, not deleted.
35. Unresolved blockers: none. Historical NULL remains intentionally non-convergeable.
    The migration has only been applied to disposable validation databases, not
    development/production. Deployment remains a separate operator action.
36. Disposition: IMPLEMENTED_READY_FOR_REVIEW. No commit, push, PR, merge, or #079.

## File Inventory

Modified (relative to `ninery/`):

- `packages/database/package.json`
- `packages/database/prisma/schema.prisma`
- `packages/database/src/external-claim-ingestion.ts`
- `packages/database/src/prisma-external-claim-ingestion-repository.ts`
- `packages/database/src/external-claim-review.ts`
- `packages/database/src/prisma-external-claim-review-repository.ts`
- `packages/database/src/index.ts`
- `packages/database/src/__tests__/external-claim-ingestion.test.ts`
- `packages/database/src/__tests__/external-claim-ingestion-postgres.integration.test.ts`

Added:

- `packages/database/prisma/migrations/20260926000000_preserve_proposed_evidence_class/migration.sql`
- `packages/database/src/durable-proposed-evidence-class.ts`
- `packages/database/src/reviewed-dimension-qualification-convergence.ts`
- `packages/database/src/prisma-reviewed-dimension-qualification-convergence-repository.ts`
- `packages/database/src/__tests__/durable-proposed-evidence-class.test.ts`
- `packages/database/src/__tests__/reviewed-qualification.test.ts`
- `packages/database/src/__tests__/reviewed-qualification.fixture.ts`
- `packages/database/src/__tests__/reviewed-qualification-postgres.integration.test.ts`
- `packages/database/src/__tests__/reviewed-qualification-upgrade-postgres.integration.test.ts`
- `docs/architecture/adr-durable-proposed-evidence-class.md`
- `docs/architecture/adr-reviewed-dimension-qualification-convergence.md`
- `docs/architecture/ticket-078-approved-schema-progress.md` (superseded checkpoint pointer)
- `docs/architecture/ticket-078-final-report.md`

No old migration SQL changed. Temporary test env was removed. Generated dist/client
outputs are not staged. Disposable clusters are stopped after validation.

## Approved Proposal/Upgrade Proof

`evidenceClass` remains governed persisted classification. `proposedEvidenceClass`
is durable qualification input only. New ingestion uses the same validated proposal
for #070 and storage; it does not accept a second separately supplied field.
Proposal participates in normalized identity, so changed proposals cannot silently
reuse prior qualification. Exact same-proposal replay remains deterministic.

The upgrade test actually generates a seven-migration client and executes exact
baseline #076 code to populate Q1/history before applying migration eight. It
compares old normalized fields and Q1 rows unchanged, proves nullable TEXT/no
default, reads Q1 through current #076, rejects NULL through the production #078
service, and proves new ingestion captures proposal while retaining unclassified.
No proposal is inferred from Q1, governed class, source, or fixture metadata.

## Independent Review Remediation 01

The independent review found that `reviewClaim` returned an existing idempotent
decision before reconstructing the current governed case. The replay branch now
keeps its conflicting-key check first, then loads the case within the same
slot-advisory/source-row-locked transaction as a new review. It checks current
qualification applicability, the exact reviewed-state fingerprint, and whether
the stored decision has a successor before returning it. Exact replay while
current returns the same R2 without a new row. Replay after D3, C3, or a new
governance revision fails closed; the historical R2 remains queryable. The
source/slot locks serialize replay with the established successor writers.

The focused PostgreSQL tests replay the original key while current and after
each successor, verify conflicting-key rejection and no duplicate or mutation,
and hold a D3 writer lock to prove an exact-key replay waits and observes the
committed successor. Older unit and #077 PostgreSQL assertions that permitted
historical replay were updated to the new fail-closed contract. No schema or
migration change was needed for this remediation.

Remediation validation on a fresh disposable PostgreSQL 16.15 cluster: all eight
migrations applied from zero; Prisma validation passed; database build and
typecheck passed; database unit tests 71/71 passed; serial #075-#078 and
populated seven-to-eight upgrade tests 15/15 passed; Equipment Intelligence
typecheck and tests 349/349 passed. The first run exposed two older stale-replay
test expectations, classified as test-expectation defects and corrected before
the all-green rerun. No production/managed database was used.

## Execution

Authoritative cluster: PostgreSQL 16.15, new
`%TEMP%/ninery-ticket-078-authoritative-pg-20260926`, local port 55483;
`ninery_ticket_078_authoritative_disposable` plus a separately generated upgrade
database. No protected database used. Eight migrations applied from zero.

Installed CLI equivalents were used instead of pnpm script chaining. Commands ran
in `packages/database` or `packages/equipment-intelligence`, as appropriate:

```cmd
node_modules\.bin\prisma.cmd validate
node_modules\.bin\prisma.cmd generate
..\..\node_modules\.bin\tsc.cmd -p tsconfig.json
..\..\node_modules\.bin\tsc.cmd -p tsconfig.json --noEmit
node --test dist/__tests__/external-supporting-evidence-persistence.test.js dist/__tests__/external-claim-ingestion.test.js dist/__tests__/external-claim-review.test.js dist/__tests__/durable-proposed-evidence-class.test.js dist/__tests__/reviewed-qualification.test.js
node --env-file=..\..\.ticket-078-final.env node_modules\prisma\build\index.js migrate deploy --schema=prisma\schema.prisma
node --env-file=..\..\.ticket-078-final.env --test --test-concurrency=1 dist/__tests__/external-supporting-evidence-postgres.integration.test.js dist/__tests__/external-claim-ingestion-postgres.integration.test.js dist/__tests__/external-claim-review-postgres.integration.test.js dist/__tests__/reviewed-qualification-postgres.integration.test.js dist/__tests__/reviewed-qualification-upgrade-postgres.integration.test.js
node --test dist/__tests__/*.test.js
git diff --check
git status --short
git rev-parse HEAD
```

The temporary env used only the isolated local database and bounded test connection
settings. It is not a new canonical environment-file convention. The package's
`test` and serial `test:postgres` scripts now include #078. See the architecture ADR
for canonical pnpm commands and safe disposable PostgreSQL prerequisites.
