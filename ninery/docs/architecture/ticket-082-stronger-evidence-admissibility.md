# Ticket #082: Stronger Construct Evidence Admissibility v1.0

## Contract

`assessStrongerConstructEvidence` is a deterministic, read-only domain assessment. Its four dispositions are `admissible`, `admissible_with_restrictions`, `excluded`, and `unresolved`. Sorted, deduplicated reason codes accompany every restricted result. The exported reason-code inventory is authoritative.

Exact v1.0 reason codes:

```text
unsupported_evidence_class, unsupported_source_type, unsupported_method,
unsupported_definition_version, unsupported_protocol_version, malformed_identity,
equipment_mismatch, observed_variant_mismatch, ambiguous_target_scope,
generalization_not_established, selected_variant_required, missing_required_provenance,
calibration_only, protocol_restriction, unresolved_dependence, repeat_evaluator,
shared_provenance, incompatible_value_representation, comparability_not_established,
malformed_raw_metadata, inactive_evidence, disputed_evidence, withdrawn_evidence,
superseded_evidence, construct_not_applicable, acquisition_contract_not_established,
independence_metadata_conflict
```

Observation identity, declared target, and admissible applicability are separate output fields. A declared equipment target does not establish equipment-wide empirical applicability. The actual Protocol v1.1 writer's equipment target plus observed variant is accepted only as restricted exact-variant calibration evidence. Requests without a selected variant remain unresolved; other variants are excluded. Physical measurements retain specimen identity. Catalog facts retain nominal catalog scope, not measured behavioral authority.

## Acquisition Boundaries

Known manufacturer specifications, physical measurements, and Protocol v1.1 human calibration records are checked against their existing source/method/version contracts. Protocol v1.0 human records remain historical and unresolved under this contract. Field observations and modeled estimates remain unresolved pending established acquisition contracts. Controlled mechanical testing has no approved acquisition combination here. Unknown sources are excluded, never classified by #066's modeled-estimate fallback.

Incomplete identity, provenance, unsupported versions/methods/classes, incompatible values, and inactive/disputed/withdrawn/superseded status produce explicit reasons. No historical records are rewritten.

## Dependence and Calibration

Evaluator independence is not established evidence-source independence. Different evaluators may share sessions, specimens, instruments, or upstream inputs. `knownIndependentStrongerGroups` therefore remains empty until an explicit source-independence governance contract exists, including when direct evidence is present. Per-record evaluator states, evaluator groups, and shared-provenance relationships remain unchanged. This restriction does not change direct-evidence counting or the separately governed supporting-context groups.

The existing evaluator-relationship assessor checks documented earlier sessions. Repeat evaluators do not add independent evaluator groups. Arbitrary independence-group strings are not evidence of independence. Shared evaluator, session, specimen, instrument, and upstream references are reported as relationships. Unestablished independence remains explicit. Calibration and protocol restrictions are retained even for active primary-candidate records.

## Values and Authority

Ordinal observations remain qualitative, including inverse degradation semantics. Numeric measurements preserve persisted values and units. Categorical facts, observation-only records, and unavailable values remain distinct. Cross-record comparability is not established by this ticket; no averaging, aggregation, contradiction adjudication, evidence weighting, or sufficiency thresholds are introduced.

All canonical, numeric synthesis, synthesis eligibility, compatibility, recommendation, and Decision Book authority flags remain false. Current records therefore carry restrictions rather than being declared universally admissible. Supporting context contributes zero direct evidence.

## #081 Integration and Snapshot

The #081 repository invokes this domain contract instead of duplicating classification. It exposes all dispositions, including unknown records, and keeps current/historical supporting context separate. Calibration-only records cannot increase ordinary direct-evidence counts. Existing zero-authority and synthesis blockers remain intact.

The production root repository runs one RepeatableRead transaction with `SET TRANSACTION READ ONLY`. Equipment, variant ownership, evidence, and #080 governed context share that snapshot. The internal transaction-client seam is for an already protected snapshot, not a replacement for root transaction enforcement.

## Verification

Build Equipment Intelligence before Database. The database `test:postgres` runner includes the new exact-variant, unchanged-row, status, supporting-successor, and overlapping-snapshot cases. Use only an explicitly isolated disposable PostgreSQL 16 URL. Never point these tests at development or production databases.

No persistence, Prisma schema, migrations, public API, UI, compatibility, or recommendation changes are part of this ticket. Empirical sufficiency and synthesis remain later work; Ticket #083 is not started.

## Implementation Verification (2026-10-05)

Branch: `codex/ticket-082-stronger-construct-evidence-admissibility`; unchanged HEAD: `c294162ac59c4ad15245b31e68243af13315d0cd`. The initial working tree was clean. No commit, push, PR, or merge was created.

Added files:

- `packages/equipment-intelligence/src/evidence/stronger-construct-evidence-admissibility.ts`
- `packages/equipment-intelligence/src/__tests__/stronger-construct-evidence-admissibility.test.ts`
- `packages/equipment-intelligence/src/__tests__/stronger-evidence.fixture.ts`
- `packages/database/src/__tests__/stronger-evidence-admissibility-postgres.integration.test.ts`
- `packages/database/src/__tests__/stronger-evidence.fixture.ts`
- `docs/architecture/ticket-082-stronger-evidence-admissibility.md`

Modified files:

- `packages/equipment-intelligence/src/evidence/index.ts`
- `packages/database/package.json`
- `packages/database/src/governed-construct-evidence-projection.ts`
- `packages/database/src/prisma-governed-construct-evidence-projection-repository.ts`
- `packages/database/src/__tests__/governed-construct-evidence-projection.test.ts`
- `packages/database/src/__tests__/governed-construct-evidence-projection-postgres.integration.test.ts`

Validation results:

- Equipment Intelligence: build/typecheck passed; 384 tests passed, including 35 new admissibility cases.
- Database: build/typecheck passed; 78 unit tests passed.
- Recommendation Intelligence: typecheck passed.
- Prisma validate passed; schema and migrations unchanged.
- `git diff --check` passed.
- PostgreSQL 16.15: eight repository migrations applied to a fresh disposable cluster; full serial suite passed 47/47 with no skips, including five new #082 cases and the populated seven-to-eight upgrade.
- Initial PostgreSQL run: 46/47 passed; the existing #078 fixture creation encountered `PrismaClientInitializationError` (localhost connection unavailable). No expectation was changed; the complete rerun passed.

Commands used the underlying `tsc`, Node test runner, and Prisma CLI directly. Equivalent workspace entry points are `pnpm --filter @ninery/database build`, `typecheck`, `test`, `test:postgres`, and `prisma:validate`, plus Equipment Intelligence `build`, `typecheck`, `test` and Recommendation Intelligence `typecheck`.

Disposable infrastructure: `%TEMP%/ninery-ticket082-disposable-pg`, localhost port 55435, database `ticket_079_disposable_082` (legacy test safety guard requires the ticket-079 disposable naming pattern). Server stopped after verification; temporary cluster files remain for inspection. No development or production database was connected to or changed.

Known limitations: metadata cannot establish generalization, field/model acquisition admissibility, mechanical protocol authority, or cross-record comparability. These cases are explicitly restricted/unresolved/excluded, not silently inferred. The contract does not rederive measurement aggregates or certify the correctness of recorded measurements; it preserves recorded values and checks acquisition provenance and representation. No empirical sufficiency policy, synthesis, or downstream authority is established.

## Evaluator/Source Independence Correction (2026-10-08)

Inspection confirmed that the original projection mapped `independent_evaluator` groups into `knownIndependentStrongerGroups`. The earlier empty-summary assertion covered calibration-only records and did not exercise that direct-evidence branch.

The production correction leaves the summary explicitly empty, without changing per-record evaluator relationships or shared provenance. Seven projection regressions cover distinct evaluators sharing each of session, specimen, instrument, and upstream input, plus independent/repeat/unresolved evaluator states. Their repository fixtures intentionally exercise `construct_evidence` in the projection to prevent the calibration gate from masking the defect; this does not authorize real calibration records as ordinary construct evidence.

Correction files: `packages/database/src/governed-construct-evidence-projection.ts`, `packages/database/src/__tests__/governed-construct-evidence-projection.test.ts`, and this document. Other working-tree changes belong to the preceding #082 implementation and were preserved.

Validation: database build/typecheck and 85 unit tests passed; Equipment Intelligence build/typecheck and 384 tests passed; Recommendation Intelligence typecheck, Prisma validation, and diff checks passed. The full serial PostgreSQL suite passed 47/47, zero skips, on PostgreSQL 16.15 in a fresh `%TEMP%/ninery-ticket082-correction-pg` cluster (localhost 55436, database `ticket_079_disposable_082_correction`), including the populated upgrade and coherent snapshot tests. Only disposable infrastructure received migrations/test writes.

Source independence remains unestablished pending a separately approved governance contract. No thresholds, weighting, synthesis, or source-independence policy were added. No schema/migration change, development/production database access, commit, push, PR, merge, or Ticket #083 work occurred.
