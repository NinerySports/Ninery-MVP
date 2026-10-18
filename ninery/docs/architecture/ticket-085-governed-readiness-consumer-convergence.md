# Ticket #085: Governed Equipment Evidence and Readiness Consumer Boundary Convergence

Baseline: main at d9b1aec6e40b0416c3208048c90dcf2480d93184. Implementation branch: codex/ticket-085-governed-readiness-consumer-convergence. Changes remain uncommitted for independent review.

## Original defects

Authentic Protocol v1.1 writer-generated records reproduced two inconsistent consumer interpretations:

- Distinct evaluators/sessions became independentSourceCount=2 and independent_same_method in the old readiness assessor. #083 instead reports not_established and no established groups.
- An equipment-target calibration observation made on variant A was counted by a readiness report for variant B. #082 correctly excludes it with observed_variant_mismatch.

Regressions retain the first reproduction in an explicitly marked legacy simulation and demonstrate the corrected operational results. Variant exclusion is also exercised through the actual database report loader and formatter.

## New boundary

Equipment Intelligence owns composeGovernedOperationalEvidenceReport and formatGovernedOperationalEvidenceReport. They distinguish raw inventory, unassessed inventory, applicable calibration observations, admissible construct observations, excluded/unresolved decisions, dependence diagnostics, and zero-contribution supporting context. Primary direct counts, descriptive states, gaps and blockers come from the unchanged #081 composition. Admission comes from #082; relationships come from #083. No new classifier, threshold or positive-independence policy is added.

The report always states sourceIndependence=not_established, keeps knownIndependentStrongerGroups empty, and states readiness=synthesis_not_permitted. Calibration-only records never become ordinary direct evidence. Numeric measurement representations remain recorded observations, not newly synthesized values. Raw provenance remains available programmatically and selected acquisition details remain visible in the text report.

Database owns GovernedOperationalEvidenceReportService and the shared CLI loader. The existing PrismaGovernedConstructEvidenceProjectionRepository now also captures operational reports. Its existing root transaction orchestration is reused by single-construct and operational reads, rather than copied into a new adapter. Equipment, selected variant, catalog specifications, evidence inventory and all requested constructs are read in the same read-only RepeatableRead transaction. Evidence is captured once per report; all #082 assessments use that captured inventory. Supporting context joins the same transaction through the #084 verified factory. Report composition/formatting outside the owned transaction is pure and performs no subsequent database reads.

The new operational entry verifies protection with the #084 factory before reading inventory. Existing #081 runtime settings verification remains in the shared evidence capture. Borrowed clients cannot be roots, do not create nested transactions or change settings, and are reverified on every operational load. Snapshot verification/expiration failures propagate to the CLI; output is emitted only after successful loading/composition. No schema, migrations, evidence writes or history rewrites were introduced.

## Operational integration and compatibility

Both runnable commands now delegate to the same shared CLI loader:

- equipment:dna:evidence -> equipment-dna-evidence.report.ts
- equipment:dna:synthesis-readiness -> equipment-dna-synthesis-readiness.report.ts

The readiness command still requires --equipment and --variant. Evidence inventory permits an omitted variant: #082 then leaves variant-specific observations unresolved rather than generalizing them. Optional --construct must be a #081 strategy-registry construct; unsupported requests reject without legacy fallback or success output. Omitting it evaluates every supported strategy construct. Unsupported raw attributes remain explicitly unassessed diagnostic inventory, not implicitly classified evidence.

Other-variant records remain visible in raw equipment inventory and exclusion diagnostics, but cannot contribute to selected-variant readiness. --specimen is supported by the evidence command as an explicitly labeled inventory-display filter only; construct assessments retain the selected equipment/variant scope. Empty, duplicate and unsupported CLI options reject.

The old free-standing reports' global cross-equipment coverage heuristic is not treated as a governed readiness conclusion. Catalog nominal facts and recorded physical/qualitative observations remain descriptive inventory. The operational text format intentionally changes to expose governed categories and reasons.

Caller audit found the old readiness assessor used by its old operational report and its simulation tests. The old evidence builder was used by both old operational reports, read-model/simulation tests, and #082's conversion of explicitly classified records to evidence-item representations. Neither operational report now calls those legacy assessors. There were no application/recommendation callers of these report assessors in the inspected tree.

The legacy builder and readiness assessor are retained without silently rewriting historical/simulation semantics. Their results now explicitly identify legacy_descriptive_inventory and legacy_simulation_only respectively, and their source comments state their non-operational role. The old independenceGroup field remains legacy descriptive metadata; it is not an input to operational source-independence authority. #082 still uses the builder only after its explicit classification, not its fallback/support summaries. Older behavioral/calibration simulations and canonical previews are not integrated into this new operational path or granted new authority.

## Verification (2026-10-17)

- Equipment Intelligence final full unit suite: 467 passed, zero failures/skips (21 new #085 cases).
- Database full unit suite: 116 passed, zero failures/skips (15 new #085 cases).
- Full serial PostgreSQL regression run: 64 passed, zero failures/skips, including the first seven #085 cases and all existing #075-#084 integration cases.
- After adding the eighth #085 case for two actual writer evaluators, the final focused PostgreSQL suite passed 8/8 with zero failures/skips. Together these runs cover all 57 existing cases and all 8 final #085 cases; this is not a claim of a single 65-case full-suite run.
- Both packages built; database, Equipment Intelligence and Recommendation Intelligence no-emit typechecks passed. Both actual report entry files passed a separate strict NodeNext typecheck.
- Both actual tsx report entrypoints passed smoke checks against disposable fixtures. An unsupported construct exited 1 with no report output. An initial smoke-harness SQL quoting error was corrected before these successful checks; it was not an application failure.
- Prisma validation and git diff checks passed; schema/migration paths are unchanged.

The new unit cases exercise authentic human and physical-measurement writers, different evaluators/sessions/specimens/instruments, missing/shared upstream information, arbitrary group strings, status/protocol/acquisition restrictions, exclusion versus inventory, wording, forwarding #081 results, unsafe borrowing, ordering and error propagation.

The PostgreSQL cases exercise actual shared CLI predicates, ownership, selected/absent variants, repeatable-read/read-only settings, writable/ReadCommitted rejection, concurrent committed evidence/status/catalog/support successors, expiration, unchanged persisted evidence/support rows, and source-independence reporting. Mock tests alone are not presented as database verification.

### Disposable environment

A fresh PostgreSQL 16.15 cluster was initialized at %TEMP%/ninery-ticket085-pg, bound to 127.0.0.1:55440. SQL verified the port, server version and data directory before creating the new ticket_079_disposable_085 database. All eight existing migrations applied to that new database only. New integration tests reject URLs outside this exact local disposable database/port; existing suites retain their prior disposable guards. Development and production databases were not accessed.

Both DATABASE_URL and TEST_DATABASE_URL were overridden per subprocess to postgresql://postgres@127.0.0.1:55440/ticket_079_disposable_085?connect_timeout=30&pool_timeout=30&connection_limit=10. Nothing was written to repository .env files. PostgreSQL's pg_ctl startup hit a Windows restricted-token error; launching postgres.exe directly under the same sandbox account succeeded. No elevated permissions were used. The temporary cluster is retained for reproducibility and the server is stopped after verification.

### Commands actually executed

Commands used the existing binaries directly (no dependency installation). From the repository's ninery directory:

~~~cmd
node_modules\.bin\tsc.cmd -p packages/equipment-intelligence/tsconfig.json
node_modules\.bin\tsc.cmd -p packages/database/tsconfig.json
node_modules\.bin\tsc.cmd -p packages/equipment-intelligence/tsconfig.json --noEmit
node_modules\.bin\tsc.cmd -p packages/database/tsconfig.json --noEmit
node_modules\.bin\tsc.cmd -p packages/recommendation-intelligence/tsconfig.json --noEmit
node_modules\.bin\tsc.cmd --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --esModuleInterop packages/database/prisma/reports/equipment-dna-evidence.report.ts packages/database/prisma/reports/equipment-dna-synthesis-readiness.report.ts
git diff --check
~~~

From packages/equipment-intelligence:

~~~cmd
node --test dist/__tests__/*.test.js
node --test dist/__tests__/governed-operational-evidence-report.test.js
~~~

From packages/database (Prisma/integration/smoke subprocesses used only the explicit disposable URLs above):

~~~cmd
node node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma
node node_modules/prisma/build/index.js validate --schema prisma/schema.prisma
node --test dist/__tests__/external-supporting-evidence-persistence.test.js dist/__tests__/external-claim-ingestion.test.js dist/__tests__/external-claim-review.test.js dist/__tests__/durable-proposed-evidence-class.test.js dist/__tests__/reviewed-qualification.test.js dist/__tests__/governed-supporting-context-bridge.test.js dist/__tests__/governed-supporting-context-projection.test.js dist/__tests__/governed-construct-evidence-projection.test.js dist/__tests__/governed-operational-evidence-report.test.js
node --test --test-concurrency=1 dist/__tests__/external-supporting-evidence-postgres.integration.test.js dist/__tests__/external-claim-ingestion-postgres.integration.test.js dist/__tests__/external-claim-review-postgres.integration.test.js dist/__tests__/reviewed-qualification-postgres.integration.test.js dist/__tests__/reviewed-qualification-upgrade-postgres.integration.test.js dist/__tests__/governed-supporting-context-bridge-postgres.integration.test.js dist/__tests__/governed-supporting-context-projection-postgres.integration.test.js dist/__tests__/governed-construct-evidence-projection-postgres.integration.test.js dist/__tests__/stronger-evidence-admissibility-postgres.integration.test.js dist/__tests__/governed-operational-evidence-report-postgres.integration.test.js
node --test --test-concurrency=1 dist/__tests__/governed-operational-evidence-report-postgres.integration.test.js
~~~

Actual CLI smoke checks invoked Node with the installed tsx/cli module, each report path, --equipment=<disposable-fixture-id>, --variant=<disposable-fixture-id>, and --construct=startup_demand. The negative check used --construct=unapproved and asserted exit 1 and empty stdout. The package test and test:postgres runners include the new suites.

## Deferred and remaining limits

No positive independence, comparability policy, sufficiency threshold, aggregation, synthesis, canonical promotion, fit/recommendation change, review UI/RBAC, acquisition workflow or Ticket #086 work is included. Reports remain snapshots at read time, not historical as-of reconstruction. All-equipment inventory and #083 pairwise diagnostics retain existing scale limits; this ticket adds no pagination or benchmarking. Programmatic legacy/simulation users must honor their explicit interpretation markers; they are not a substitute for the operational facade.

Independent review is required before any commit or pull request.
