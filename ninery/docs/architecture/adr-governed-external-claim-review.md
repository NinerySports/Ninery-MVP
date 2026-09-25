# Governed external-claim review v1.0

Ticket #077 adds a backend-only human review boundary after Ticket #076 ingestion. It does not call Ticket #075, add evidence to #066/#067, or grant canonical, numeric, synthesis, compatibility, or recommendation authority.

## Decision contract

`GovernedExternalClaimReviewService` receives an opaque credential. An injected `ExternalClaimReviewerAuthorizer` must validate that credential and return an authorized reviewer identity. Caller-provided `reviewerType` or `reviewerReference` is not accepted as authorization. The service has no production hard-coded reviewer, UI, or general RBAC system.

The service reconstructs the durable #076 case at decision time. It binds a content decision to source, claim slot, document, extraction, raw and normalized claims, identity/scope, current dependency and construct interpretations, qualification ID and semantic fingerprint, current source-governance revision, and policy version. The caller must present the state fingerprint it inspected. A mismatch fails closed. An accepted review is a historical content decision, not a qualification rewrite or evidence promotion.

Content, dependency/independence, and construct findings use distinct append-only records and service operations. A reviewed dependency can identify known dependence or attested independence; the latter requires a human finding and an explicit independence group. Unknown dependency remains unknown. A construct successor carries reviewer provenance and can have the provisional `supporting_context` role only for `startup_demand` or `rotational_demand`, with accepted high-confidence review. None of these operations invokes supporting-role persistence. The #075 bridge remains a separate future boundary.

## History and freshness

The existing review table has nullable governed-binding columns so old #075 fixtures and history remain distinguishable. A new governed decision stores its exact binding, state fingerprint, decision fingerprint, reviewer, rationale, limitations, and optional same-lineage predecessor. PostgreSQL retains append-only history and checks governed binding against linked claim, identity, dependency, qualification, and governance rows. Exact replay returns its immutable decision; a materially different reuse of the key fails.

Current applicability is computed, never written onto an older decision. Later document/extraction lineage, normalization, identity, dependency, construct, qualification, source governance, conflict, or policy meaning makes a prior approval stale. An older decision remains readable and auditable. Pending means no applicable decision; rejected and returned decisions remain non-authorizing. Re-review appends a successor. Content approval never implies independent provenance, and an independence finding never implies content approval.

The review transaction first serializes with #076 ingestion for the same claim slot, then locks the source row before rereading current meaning. The source lock also orders review against new source-governance revisions that reference the source. Other writers must not bypass these governed services to claim current review authority. An isolated PostgreSQL 16 migration and integration run is required before this ticket is accepted for deployment; unit tests alone do not verify database triggers or transaction ordering.

## Boundaries

`context_only` stays context. `review_required` and `not_eligible` do not become promotable from review alone. Legacy review rows without `governedReviewVersion` are not #077 decisions. The future #078 bridge must check an applicable governed review, current independence and construct findings, the current #070/#074 policy, and #075's own fail-closed contract before persisting any supporting role. It must not mistake review for direct evidence or Equipment DNA synthesis.
