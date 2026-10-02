# Ticket #080: Current Governed Supporting-Context Projection

`GovernedSupportingContextProjectionService.loadGovernedSupportingContext()` reads immutable
`ExternalSupportingRoleDecision` rows for one equipment identity and one of the two
provisional constructs, `startup_demand` or `rotational_demand`. An optional variant
includes equipment-level assertions and assertions for that exact variant, never
other variants. The result separates currently applicable rows from historical rows
and gives each historical row explicit exclusion reasons and its original lineage.

The repository uses one PostgreSQL `REPEATABLE READ` transaction with `SET TRANSACTION
READ ONLY`. This is a coherent snapshot at read time, not a guarantee that the result
will remain current. Arbitrary historical `asOf` is deliberately unsupported: the
durable schema does not provide a complete temporal reconstruction of all relevant
catalog and governance state.

Each row is rechecked against the original ingestion fingerprint, current claim and
document, current governed source, current D/C leaves, exact converged Q2, current
accepted human R2 and its fingerprinted interpretation, catalog identity, conflict
state, and the Ticket #074 supporting-role policy. The implementation reuses the
Ticket #079 current-lineage reader in read-only mode; it never calls the persistence
method. The original `eligible` flag describes the write-time decision only.
Reasons are deterministic codes, not a claim that the historical decision was wrong
when originally recorded. An unrecognized or incomplete lineage fails closed.

The pure overlay retains direction, comparison target, provenance, and status. It
does not produce an `EquipmentDNAEvidenceRecord` or any of the six Equipment DNA
evidence classes. Direct, canonical, numeric, synthesis, and recommendation
authority are all zero. The projection does not alter #066/#067 readiness or any
recommendation path. Multiple rows and dependent or unknown sources are displayed
with provenance, not counted as independent corroboration; no readiness source-count
policy is established here.

The Atlas USSSA identifiers used in a PostgreSQL test are disposable fixture data,
not proof that the production pilot has a persisted #079 decision. No pilot data is
created by the projection. The contaminated Atlas USA identity is untouched.

Validation with a fresh disposable PostgreSQL 16 cluster:

1. Apply existing migrations to that **disposable** database only.
2. Set `TEST_DATABASE_URL` to its URL.
3. Run `pnpm --filter @ninery/database test:postgres` (serial by script).

Never aim this command at a development or production database. The projection has
no schema change or migration. A later governance decision is required before
supporting context can affect sufficiency, synthesis, or recommendation authority.
