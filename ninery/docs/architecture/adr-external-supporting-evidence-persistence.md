# External Supporting-Evidence Persistence Model v1.0

## Status

Accepted for Ticket #075. This is an additive persistence boundary for Tickets #069-#074 and does not broaden the authority granted by Ticket #074.

## Decision

External expert observations are persisted as an immutable, claim-bound graph:

```text
Source -> Document -> Raw claim -> Normalized claim -> Construct relationship
                                      |                    |-> Qualification
                                      |                    |-> Human review
                                      |-> Dependency assessment
                                      |-> Conflict membership/resolution
                                      `-------------------------> Supporting-role decision
```

A supporting-role decision must reference one raw claim, its normalized claim, one current dependency assessment, one construct relationship, the relationship's qualification decision, and an accepted human review of that same claim/relationship. The only eligible constructs are `startup_demand` and `rotational_demand`, under policy `external_expert_supporting_role` version `1.0-provisional`.

## Database Guarantees

PostgreSQL foreign keys bind every decision to the same claim and construct relationship. Check constraints freeze all contribution and authority fields at zero/false, constrain eligible rows to `supporting_context`, and pin the provisional policy. Source provenance is derived through the document; claims do not carry a second source ID. Equipment/variant identity is checked against the catalog.

Evidence, assessments, relationships, qualifications, reviews, conflicts, resolutions, and supporting decisions are append-only. Corrections create new versioned records connected by supersession. Recursive triggers reject claim, document, dependency-assessment, and construct-relationship supersession cycles, including cycles longer than a direct self-reference. Idempotency keys are unique, and supporting decisions retain a deterministic request fingerprint.

The insertion trigger also fails closed unless the relationship is current, high-confidence, human accepted, construct-specific, and non-value-producing; qualification is eligible under contract 1.0; dependency is reviewed and known independent; and neither claim nor normalized claim is superseded, conflicting, or in an unresolved conflict.

## Service Guarantees

`ExternalSupportingEvidencePersistenceService` runs lookup, validation, policy evaluation, and insertion in one repository transaction. It rejects cross-claim or cross-construct IDs, unsupported enum values, source/document mismatches, equipment/variant mismatches, unknown or dependent provenance, non-human approvals, stale dependency/relationship records, unsupported constructs, and conflicting or superseded claims. Exact replay returns the existing immutable decision; reuse of an idempotency key with different input fails.

Current eligibility is deliberately derived, not copied onto history. Readers re-evaluate a stored decision against the latest conflict and supersession state. A later conflict or superseding record therefore makes support inactive without editing or deleting the historical decision.

## Authority Firewall

Supporting decisions cannot create canonical or numeric values and contribute no direct, structured, physical, or controlled evidence. They cannot grant synthesis, compatibility, recommendation, or Decision Book authority. There are no foreign keys from this graph to canonical evaluations, compatibility outputs, or recommendations.

## Rollout

The pending Ticket #075 migration may be revised because it has not merged or been applied. No source, document, observation, approval, qualification, or supporting-decision rows are seeded or backfilled. Ticket #071-#073 research fixtures remain research fixtures. No public API, web UI, recommendation score, ranking, or eligibility behavior changes.
