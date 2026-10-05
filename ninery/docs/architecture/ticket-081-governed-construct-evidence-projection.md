# Ticket #081: Governed Construct Evidence and Readiness Projection

`GovernedConstructEvidenceProjectionService.load()` reads one equipment identity, optional exact
variant, and a construct from the Ticket #063 strategy registry. Its Prisma repository resolves
persisted Equipment DNA evidence and Ticket #080 supporting context inside the same PostgreSQL
`REPEATABLE READ`, `READ ONLY` transaction. Results are a snapshot at read time, not historical
`asOf` reconstruction. There are no writes, snapshots, migrations, or new schema tables.

Stronger evidence retains its original one-of-six #066 class, source type, method, target level,
definition version, status, observation, limitations, and provenance. Equipment-level records
apply to the model; variant-level records apply only to the requested variant. Only active
primary-candidate records count in `directEvidenceRecordCount`. Other active class roles remain
visible but do not fill the primary-evidence gap. Disputed, withdrawn, and superseded rows are
separate excluded evidence. Unknown source classifications fail closed rather than entering
#066's `modeled_estimate` fallback. `other` is rejected even with an instrument method: the
existing schema does not prove that such a row is a controlled mechanical test. This projection
does not infer that an active legacy evidence
record has been governed under the #074-#080 external-claim process.

Ticket #080's current and historical supporting decisions remain distinct, with original lineage
and exclusion reasons. Current support retains reviewed direction and comparison target. Known
independence groups are deduplicated and reported separately by evidence authority; row count is
never used as an independence claim. Contradictory directions remain separate observations.
No supporting decision is converted to an Equipment DNA evidence record or one of the six classes.

The `descriptiveState` and gaps describe inventory, not permission to synthesize. Ticket #067
has no established synthesis policy, so `synthesis_policy_not_established` and
`synthesis_not_permitted` remain blockers even when direct evidence is present. All canonical,
numeric, synthesis, compatibility, recommendation, and Decision Book authority flags remain false.
The projection is not connected to the live recommendation, Player DNA, BatMatch, or Decision Book
paths. Later governed synthesis would require a separately approved empirical policy and authority
boundary; this ticket creates neither.
