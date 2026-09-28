# Governed Reviewed-Dimension Qualification Convergence v1.0

## Decision and Lifecycle

Ticket #078 adds qualification convergence, not supporting persistence:

```text
#076 D1/C1 -> Q1
#077 human dependency review -> D2
#077 human construct review -> C2
#078 current durable inputs -> unchanged #070 -> Q2
#077 explicit human content review -> R2
STOP
```

Q1 describes D1/C1, not their reviewed successors. R1 becomes historical.
Neither row is relinked, copied forward, or rewritten. Convergence never creates
a content review; the existing #077 operation remains its sole authority.

## Components

`ReviewedDimensionQualificationConvergenceService.inspect(locator)` reports
current or needs_convergence; `converge(locator)` appends/reuses a deterministic
qualification. `PrismaReviewedQualificationRepository` loads durable inputs and
persists into the existing qualification table. `assessReviewedQualification`
executes the unchanged #070 contract.

`PrismaGovernedReviewRepository.loadCase` projects matching Q2 into #077's case.
Its internal `qualificationConvergence` is current, needs_convergence, or blocked;
blocked cases expose a deterministic reason. No public endpoint is added.

## Durable Inputs and Currentness

The original #076 locator anchors immutable IDs, historical fingerprints,
document/extraction currentness, identity scope, and unresolved conflicts.
Exactly one D leaf and C leaf is resolved through supersession edges, not time.
Both require #077 human-reviewed provenance/fingerprints and accepted/limited
review state. Unknown dependency, unreviewed/legacy rows, rejection, ambiguous
lineage, unsupported dimension policy, and conflicts fail closed.

Dimension reviews remain separate and may continue while qualification needs
convergence. New content review may not finalize the unqualified successor state.

The source must have exactly one current governance revision. Existing #076
governance assessment proves active bounded authority and dependency scope.
A safe successor is assessed under its own ID/meaning. Inactive, ambiguous, or
incompatible authority is blocked, never copied from Q1.

`proposedEvidenceClass` is the original durable #070 input, validated against
the existing six-class contract. Historical NULL throws
`missing_durable_proposed_evidence_class`; Q1 and governed `evidenceClass` are
never fallbacks. The approved eighth migration adds nullable TEXT with no
default/backfill. Historical identities retain their old #076 formula.
Subjective/comparative `evidenceClass` stays `unclassified`; the proposal field
grants no evidence authority.

Dependency ancestry is reconstructed as context with shared lineage groups,
not additional normalized supporting observations. Cycles, missing upstream
provenance, and ambiguous ancestry fail closed. Original groups follow #076's
document convention; independent observations require explicit reviewed groups.

## Q2 Identity and Selector

The deterministic SHA-256 includes convergence version, actual #070 contract,
reconstructed graph, normalized ID, target identity, exact D/C IDs and reviewed
attestations, governance ID/scope and operational policy, plus #070's assessment.
This proves D meaning despite no qualification-to-dependency FK.

The UUID and unique idempotency key derive from that fingerprint. The selector
recomputes exact current meaning and accepts exactly one matching row only if
its ID, fingerprint, construct lineage, source governance, key, and complete
persisted assessment match. Ambiguous/inconsistent matches fail closed. Unrelated
newer rows never win by timestamp or ID. No match means needs_convergence.
Creation/review timestamps do not choose currentness; execution/retrieval
metadata that is part of #070 evidence input remains preserved.

## Transactions and Races

Convergence uses transaction-scoped Prisma writes, ReadCommitted isolation,
claim-slot advisory transaction lock, and source FOR UPDATE. State is reconstructed
after locks. #077 uses the same locks, including a locked transactional case read.
Upstream dependency slots/sources are locked during traversal. A database abort
under cross-lineage lock contention fails closed and commits no stale state.

Source FOR UPDATE blocks direct governance inserts via PostgreSQL FK key-share
locks, including writers not using application advisory locks. Unique idempotency
keys complement serialized identical convergence. Exceptions roll back Q2.

Tests exercise both orderings: successors committed before lock acquisition are
incorporated; writers arriving after reconstruction wait and then stale the old
qualification. A content review from a prior case is reloaded under locks and
rejected on changed fingerprint or missing current qualification.

## Stable Content Review and History

Q2 projects its complete assessment, ID/fingerprint, current governance, and
dimension presentation. R2 binds normalized meaning, identity/scope, D2, C2,
Q2 ID/fingerprint, governance, ingestion provenance, and #077 policy. R1 stays
historical. Content-review rows are not qualification inputs, so R2 creates no
D3/C3/Q3. Later D3/C3/governance/policy changes require a distinct matching Q.
All prior rows stay append-only and queryable.

## Verification

```cmd
pnpm --filter @ninery/database prisma:validate
pnpm --filter @ninery/database prisma:generate
pnpm --filter @ninery/database build
pnpm --filter @ninery/database typecheck
pnpm --filter @ninery/database test
pnpm --filter @ninery/database test:postgres
pnpm --filter @ninery/equipment-intelligence typecheck
pnpm --filter @ninery/equipment-intelligence test
git diff --check
```

PostgreSQL tests require `TEST_DATABASE_URL` for an isolated disposable PG16
environment. The upgrade test also requires loopback, a database name containing
`ticket_078` and `disposable`, and CREATE DATABASE. It builds a separate seven-
migration fixture from exact baseline `52c108cf255b71f349e4dfa065e832dac5088e21`,
generates the matching old client, runs actual historical #076 ingestion, applies
only migration eight, and checks unchanged rows, NULL/no-default, readable Q1,
fail-closed convergence, and new ingestion. No old SQL is edited.

## Authority Firewall

Qualification is not promotion. #075 persistence is never invoked. #074's
startup_demand/rotational_demand bounds, #075 composite lineage, #070's taxonomy,
and accepted-with-limitations semantics remain unchanged. There is no #066/#067
integration, canonical/numeric DNA, modeled estimate, synthesis, recommendation,
ranking, fit, Decision Book change, UI change, or Atlas identity mutation.
The future supporting bridge is separate. Ticket #079 is not implemented.
