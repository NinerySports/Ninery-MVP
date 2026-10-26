# Ticket #086 — Durable Stronger-Evidence Acquisition Provenance

Baseline: main at 3162034a00324bd7e2bb332f9f422ff44094b593.
Branch: codex/ticket-086-durable-acquisition-provenance. No commit or deployment is authorized.

## Boundary

Registration records a durable declaration, not independently verified physical truth. Namespace ownership comes from trusted application construction and an injected CaptureAuthorizer. The authenticated capturer, assertion supplier, operator and evaluator are separate fields. Reference resolution means an immutable registered declaration exists; aliases and physical identity verification are not implemented.

The physical-measurement v1.0 and human-calibration v1.1 paths use StrongerEvidenceAcquisitionCaptureService. Valid packets derive complete manifests from the existing writer registries. Human calibration reconstructs evaluator context and repeats the protocol review inside the protected write boundary. A per-equipment/evaluator lock serializes those reviews. Catalog facts are reread after identity locks.

The actual operational commit commands delegate to captureOperationalPacket. There is deliberately no configured production credential provider and no fallback to legacy unbound writes. Confirmed commits reject until a real trusted application provider is integrated. Pure writers, validation, preparation and dry runs remain available. A caller-supplied credential, reviewer name, namespace string or confirmation flag alone grants nothing.

## Persistence

The additive migration adds CaptureNamespace, AcquisitionParticipant, EvidenceAcquisition, EvidenceAcquisitionRevision, AcquisitionEvidenceBinding, AcquisitionEvidenceMember and AcquisitionInputDeclaration. No old observation JSON is rewritten or backfilled.

Namespaces and participants are immutable registered declarations. A specimen binds to an exact variant; condition belongs to an acquisition revision. Different specimens can share a variant and the same specimen can be reused across acquisitions. Unknown specimens have no shared synthetic identity.

An acquisition is keyed by namespace, protocol family and original session key. Existing writer IDs/source references retain their global collision restrictions; namespaces do not relax them. An evidence row has one acquisition owner. Manifest membership may recur only within that acquisition's revision chain.

A revision is constructed, checked and sealed in one transaction. Deferred SQL constraints reject incomplete roots, revisions, bindings and input manifests. Children cannot be inserted after sealing. Sealed history is immutable. Same-root predecessor FKs, ordinal uniqueness, unique successor pointers and expected-predecessor checks prevent branches and competing successors. Withdrawal is terminal. Historical replay returns the original receipt with currentness explicitly false when appropriate; it never resurrects a withdrawn or superseded revision.

Registered evidence cannot be deleted or substantively mutated. Existing status transitions remain available. Registered variant reparenting and deletion of referenced catalog/evidence identities are restricted. This intentionally changes deletion behavior only where registered history exists.

## Fingerprints and replay

Command and revision fingerprints are versioned SHA-256 over recursively key-sorted, validated JSON. Meaningful array order and exact finite numbers are preserved. Server receipt timestamps and credentials are not fingerprint inputs. The old physical approximate comparator is not used for provenance hashes.

The former human CLI JSON.stringify comparison was removed with the duplicated transaction adapter. The shared service compares every selected persisted semantic field, independently of object key order. Source dates are compared in UTC; status is a separate live lifecycle restriction. Genuine historical packet registration is explicit and authenticated, verifies existing stored rows, and never rewrites them. Missing historical specimen provenance stays unresolved.

## Upstream declarations

not_declared, declared_inputs and declared_no_known_inputs are distinct. The latter requires supplier rationale and grants no independence. Initial resolved endpoints are exact evidence IDs or sealed acquisition revision IDs in the same equipment scope. Unsupported/external locators are preserved as unresolved references. Specimens and instruments are participants, not upstream evidence.

At most 64 direct inputs are accepted per revision. There is no recursive expansion, transitive independence, or ancestry eligibility claim. Direct input fingerprints/status are checked in the report snapshot; upstream revision succession is explanatory, never new evidence authority.

## Governance integration

Provenance is batch-loaded within the existing verified read-only RepeatableRead operational snapshot. No enrichment occurs after capture. Reports show unbound versus registered declarations, full revision history, supersession, withdrawal, completeness, consistency and unresolved reasons. The declaration and recorded inputs remain available for audit.

#082 admissibility, #083 dependence assessment, calibration-only restrictions, #081 direct counts, supporting-context zero contribution and all #085 authority flags are unchanged. Provenance withdrawal is labeled separately from evidence status: it does not silently rewrite readiness counts. Future decisions must explicitly bind to an exact provenance revision/fingerprint and implement their own validity gate.

No positive independence, comparability, sufficiency, synthesis, canonical promotion or recommendation authority is introduced.

## Verification and operation

Run database test for all unit suites. test:postgres:acquisition is separate because its safety guard requires dedicated localhost port 55486 and ticket086_empty_disposable or ticket086_upgrade_disposable. The older #085 integration suite retains its distinct dedicated-cluster guard.

Both DATABASE_URL and TEST_DATABASE_URL must be explicitly overridden per subprocess. The #086 suite checks host, port, database, PostgreSQL 16 and the freshly initialized ticket086 work-directory cluster before test writes. Never point it at development or production.

The historical #078 upgrade regression now selects exactly its original first eight migration folders, excluding later migrations; it still verifies its original seven-to-eight transition. #086 empty and populated-baseline upgrade checks are separate.

No dependencies were installed. Prisma client generation uses installed packages. Pre-existing strict type errors in the legacy writer CLI files are recorded separately from package typechecks; a compiler-host comparison against baseline is used to identify introduced diagnostics.

## Deferred

A real production credential provider, physical identity verification, aliases, broad asset/RBAC management, observation-value correction, cross-equipment endpoint policy, comparability, positive independence and synthesis remain outside this ticket. Correction changes provenance assertions/manifests only; a new physical observation requires a new acquisition session. Historical record values cannot be corrected by pretending a repeat measurement occurred.

## Implementation verification (2026-10-18)

- Equipment Intelligence full suite: 467 passed, no failures/skips. Database final full unit suite: 163 passed, no failures/skips (20 acquisition unit cases).
- Final #086 PostgreSQL: 28/28 on the clean database and 29/29 on the populated baseline-upgrade database. The additional upgrade assertion verifies preservation and non-registration of the original baseline row. These are two runs, not 57 distinct tests.
- Legacy #075–#084 PostgreSQL: 57 distinct cases passed across split executions. The first broad run timed out after 44 individual passes; a focused 21-case rerun and the original one-case seven-to-eight upgrade completed coverage (nine cases overlap). No single full-suite success is claimed. The older #085 dedicated-cluster integration file was not rerun; its operational invariants are covered by unit tests and the new shared-loader PostgreSQL cases.
- Both finalized migration paths passed from scratch using installed psql: eight baseline migrations, optional legacy seed, then the additive #086 migration. Prisma validation/client generation passed. No pre-existing migration was edited.
- Both package builds and no-emit typechecks passed, as did Recommendation Intelligence typecheck and strict governed report-entrypoint typecheck. Legacy writer CLI standalone strict checking retains pre-existing diagnostics: compiler-host comparison reports 20 baseline/current diagnostics and no introduced errors.
- Actual pnpm writer dry runs succeeded; confirmed commits reached CAPTURE_NOT_AUTHORIZED with no legacy fallback. Authenticated writes were verified through the real shared service using test-only authorizers, not by claiming production activation.
- Test development exposed a UTC timestamp comparison bug in a new SQL guard and an incomplete historical-conflict fixture; both were corrected before the passing runs. A combined CLI harness timeout interrupted the temporary server; resumable terminal runs replaced that harness, and server identity was reverified. Transient localhost connection failures were not counted as passes.

Commands used existing local Node/TypeScript/Prisma/tsx/psql binaries. Unit execution used node --test against compiled database/Equipment Intelligence test files. The focused integration command was node --test --test-concurrency=1 dist/__tests__/acquisition-provenance-postgres.integration.test.js with explicit disposable URL overrides.

Both documented pnpm evidence and synthesis-readiness commands completed successfully against disposable fixtures and displayed the new provenance section while preserving all authority restrictions. Final coverage includes repeated acquisitions of the same declared specimen with changed condition and no source-independence grant.

## Independent-review corrections and verification (2026-10-19)

The full independent review was read and all three findings were reproduced before source edits. Ordinary raw SQL could seal a one-member physical manifest, or a full manifest with a registered specimen declaration and null specimenId; operational reports incorrectly labeled both complete and consistent. With a warmed connection pool and a test-only insert delay, distinct first captures in a shared namespace reproduced P2002 at the empty-update Prisma upsert.

The additive #086 migration now enforces the fixed five-member physical v1.0 and thirteen-dimension human v1.1 registries, packet/root/version identity, and member protocol identity independently of caller-declared counts. At commit, registered specimen, operator, evaluator and instrument declarations must match their registry foreign keys, kinds, keys, namespace and applicable specimen scope. Unresolved declarations require null identities. Missing required declarations fail closed. Existing immutability, snapshot, scope and authority constraints were retained.

The operational snapshot loads participant identities and independently audits the same structure. Incomplete membership or registry mismatch cannot report complete/consistent; an evidence row absent from a revision cannot report current membership or a currentRevisionId. Unresolved specimen identity remains explicitly unresolved. Audit declarations are preserved; registration establishes no physical or independent verification.

Namespace and participant establishment use native INSERT ON CONFLICT DO NOTHING followed by identity/issuer verification in the same ReadCommitted transaction. No ownership UPDATE is attempted. Equivalent concurrent establishment converges, conflicting issuers roll back, and authenticated replay remains idempotent.

Correction scope is exactly seven existing #086 files: migration.sql, acquisition-provenance.ts, acquisition-provenance-projection.ts, stronger-evidence-acquisition-capture.ts, their two acquisition test files, and this document. No #082–#085 policy, admissibility, dependence, variant, snapshot, readiness or authority implementation was changed during this correction.

Final verification supersedes the earlier incomplete legacy coverage:

- Database units: 169/169; Equipment Intelligence units: 467/467; no failures or skips.
- #086 PostgreSQL: 44/44 on fresh schema and 45/45 on populated eight-to-nine upgrade, including legacy-row preservation.
- Complete legacy #075–#084 PostgreSQL: 56/56 in one uninterrupted run. Historical #078 populated seven-to-eight upgrade: 1/1. Dedicated #085 PostgreSQL: 8/8. All ran on disposable PostgreSQL 16.15.
- Added six projection units and sixteen PostgreSQL cases. Four projection regressions fail against preserved original code; fourteen raw-SQL cases fail against original SQL because malformed commits are accepted; the distinct-root namespace regression fails against the original service with P2002. All pass after correction.
- Database and Equipment Intelligence emitting builds and no-emit typechecks pass. Recommendation Intelligence no-emit typecheck and Prisma schema validation pass. Standalone writer CLI strict checks retain 20 baseline/current diagnostics, with no introduced diagnostic after normalizing equivalent JSON union-type display order; these standalone checks are not a clean pass.
- Actual physical and human CLI dry runs succeed with Writes performed: no. Both confirmed paths reject CAPTURE_NOT_AUTHORIZED with a caller envelope. The dedicated smoke equipment has zero evidence rows and zero acquisitions afterward. Authenticated persistence is exercised by both actual protocol builders through the shared service in the PostgreSQL suites.
- Two freshly initialized clusters under the correction chat's work directory were verified by port, data_directory and server version, then cleanly stopped. Both DATABASE_URL and TEST_DATABASE_URL were explicitly overridden for database and CLI subprocesses. No development or production database was accessed, no dependency installed, and no database constraints were disabled.
- During test development, SQL delimiter interpolation was repaired before the migration passed, and a leftover test-only function from an unsuccessful schema setup was cleared before the final clean 44/44 run. These unsuccessful attempts are not counted as passes.

Branch remains codex/ticket-086-durable-acquisition-provenance at 3162034a00324bd7e2bb332f9f422ff44094b593. Working-tree scope remains the original 12 modified tracked paths and nine untracked entries, with nothing staged. No commit, push, pull request, merge or deployment was performed. Production capture activation and independent physical truth remain unavailable by design.

## Final independent-review corrections (2026-10-20)

The full latest independent report and verification evidence were read. Both additional P2 scenarios were reproduced against unchanged source before edits: ordinary SQL sealed a correct/ordinal-2 successor whose hashed payload said withdraw/ordinal-99/other-actor, and both report modes left four physical siblings current after transaction-local replica-mode injection of live-row notes drift.

Lifecycle authority is the immutable relational chain and its exactly corresponding hashed payload: an initial capture/register_existing at ordinal 1 has no predecessor; corrections/withdrawal reference the immediately previous sealed revision in the same acquisition, increment ordinal by one, and cannot follow withdrawal. A revision's operation, ordinal, predecessor and authenticated actor columns must match the payload verbatim. Superseded revisions remain historical; withdrawal is terminal; only the latest consistent non-withdrawn member revision can be current, with no fallback to older history.

The deferred SQL seal guard now rejects missing, mistyped or contradictory lifecycle payload fields with ACQUISITION_LIFECYCLE_MISMATCH. It does not normalize them. Existing same-root foreign keys, ordinal/successor uniqueness, immutable history and terminal-withdrawal checks remain. The projection independently checks payload-column equality and the complete ordered chain before assigning currentness.

The shared provenance projection now batch-loads every manifest member's live semantics inside the verified read-only RepeatableRead snapshot, including members outside the requested inventory. Per-revision drift is shared across its members: one missing or changed live member makes all siblings inconsistent/incomplete and clears their verified current revision. Individual evidence IDs, latest recorded revision IDs and full history remain available. An unrelated valid acquisition stays current. Evidence status remains a separate lifecycle restriction and is excluded from semantic fingerprints as before.

Exactly six files were edited in this correction: the #086 migration, acquisition-provenance.ts, acquisition-provenance-projection.ts, the two acquisition test files, and this document. Neither protocol builder, capture authorization/namespace service nor #082–#085 policy/authority code was changed.

Verification: database units 186/186; Equipment Intelligence units 469/469; #086 PostgreSQL 59/59 fresh and 60/60 populated upgrade; complete legacy #075–#084 PostgreSQL 56/56; historical seven-to-eight migration 1/1; dedicated #085 PostgreSQL 8/8. No final suite failures or skips. Added ten units and thirteen PostgreSQL cases, and strengthened the existing live-drift unit to assert every sibling. Seven new lifecycle SQL rejection cases fail against old SQL; ten unit assertions fail against the preserved original projection. Both supported protocol families pass positive lifecycle transitions and both governed report modes after correction. Original fingerprint-drift, protocol membership, participant identity and namespace concurrency regressions still pass.

Both package builds and no-emit typechecks, Recommendation Intelligence typecheck, strict governed report-entrypoint check and Prisma validation pass. Standalone legacy writer CLI checks retain 20 baseline/current diagnostics and no introduced diagnostics after equivalent JSON-union display-order normalization; those standalone files are not cleanly typechecked. Real writer dry runs succeed, both confirmed paths still reject CAPTURE_NOT_AUTHORIZED, both report entrypoints succeed, and smoke equipment has zero evidence/acquisition rows.

Testing used only explicitly configured, verified local PostgreSQL 16.15 clusters. Destructive database resets were confined to the known disposable names. Fault injection used transaction-local replica mode only; ordinary lifecycle SQL rejection tests kept all triggers enabled. Final checks confirm origin replication role and removal of the test delay function. During development a report-format test assertion was corrected and a test assertion was adjusted to the public report authority type; final fresh/upgrade runs pass. No production credential provider was added, no authority flag was opened, and no development/production database was accessed.

Final branch/HEAD remain codex/ticket-086-durable-acquisition-provenance / 3162034a00324bd7e2bb332f9f422ff44094b593. The working-tree inventory remains the same 13 modified tracked files and nine untracked entries as at the start of this correction. Nothing was staged, committed, pushed or submitted as a pull request. The prior four fixes and existing governance boundaries remain intact.

## Receipt and upstream integrity corrections (2026-10-21)

Capture, existing-packet registration, correction, withdrawal and their idempotent replays now obtain currentness from the same acquisition-wide integrity audit as protected reporting, including every required member and its ownership binding. Capture transactions use RepeatableRead and retry up to five complete transactions on Prisma serialization conflicts. Reports retain their verified read-only RepeatableRead boundary. Receipts retain the requested historical revision ID/fingerprint, expose latestRevisionId separately from currentRevisionId, and return diagnostic reasons when currentness fails. Replay never rewrites or repairs history. Currentness describes the audited transaction snapshot, not an evergreen assertion or independently verified physical identity.

Supplier-declared inputs are authoritative declarations. Resolution may add only targetFingerprint to an evidence/revision input; it cannot replace type, endpoint, unresolved reference or basis. Deferred SQL sealing compares the complete declared/resolved input multisets and validates supported states, cardinality, limits, duplicates and required rationale. Child guards bind relational endpoint columns to their JSON declaration. The shared audit independently rechecks the same correspondence before completeness, consistency or currentness can be affirmative. Unresolved external locators and declared-no-known-inputs remain declarations, never positive independence or dependency-completeness claims. No recursive ancestry expansion or new evidence authority is introduced.

## Superseded revision integrity correction (2026-10-21)

Verified currentness now requires immutable stored integrity for every predecessor in the acquisition chain, including sealing, payload and snapshot fingerprints, complete manifests, participant and ownership bindings, declared/resolved input correspondence, and lifecycle continuity. The shared audit propagates stored failures and `acquisition_predecessor_integrity_drift` to successors, clearing consistency, completeness and verified currentness for all affected siblings. Recorded latest and historical revision identities remain available; replay never repairs history or substitutes an older revision.

Historical snapshots may legitimately differ from live evidence after an accepted correction. Such live differences, unresolved declarations and upstream endpoint currentness restrictions do not become predecessor corruption. The gate covers the acquisition revision chain, not recursive upstream ancestry, which remains not evaluated. Authority and production credential restrictions are unchanged.
