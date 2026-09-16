# External Supporting-Evidence Persistence Model v1.0

## Status

Accepted for Ticket #075 as an additive persistence boundary for the domain work in Tickets #069–#074.

## Why a separate model is necessary

`EquipmentDNAEvidenceRecord` is an evidence-calculation input. It does not provide durable, first-class records for source and document revisions, extraction provenance, identity certainty, informational lineage, qualification decisions, human review, conflict membership, policy decisions, or supersession. Encoding those concepts in its JSON fields would weaken referential integrity and make supporting observations appear eligible for canonical evidence calculations.

Ticket #075 therefore adds a separate acquisition and supporting-context graph. It does not modify `EquipmentDNAEvidenceRecord`, `EquipmentDNAAttributeEvaluation`, synthesis, compatibility, or recommendation models.

## Persisted graph

```text
ExternalEvidenceSource -> ExternalEvidenceDocument
                       -> ExternalEvidenceClaim -> ExternalEvidenceNormalizedClaim
                                                  -> QualificationDecision
                                                  -> SupportingRoleDecision

IdentityAssertion ----^       ClaimDependency records lineage
ExtractionRun --------^       ConflictCase retains disagreements
ReviewDecision -----------------------------^ explicit human gate
```

Document and claim supersession are self-references. Supersession preserves history; it never overwrites an older artifact. Conflict cases retain all member claims and select no automatic winner.

## Authority firewall

Supporting-role decisions are not evidence records and have no foreign key to canonical evaluations, compatibility records, or recommendations. The database enforces:

- all direct, structured, physical, and controlled contribution counts equal zero;
- canonical and numeric creation flags remain false;
- synthesis, compatibility, and recommendation authority remain false;
- an eligible decision has role `supporting_context` and references a review decision;
- an ineligible decision has role `not_applicable`.

The application must additionally confirm that an eligible decision's referenced review was made by a human, accepted or accepted with limitations, and targets the same observation. The database cannot safely infer this polymorphic semantic relationship from a foreign key alone.

## Conservative rollout

No rows are seeded or backfilled. In particular, the Ticket #071 Atlas acquisition pilot and Ticket #072–#073 calibration observations remain research fixtures and are not promoted. No human review records are fabricated. Production ingestion remains a separate, explicitly reviewed operation.

All provenance tables use restrictive deletion. The new schema is additive, and existing evidence, evaluation, synthesis, compatibility, and recommendation behavior is unchanged.
