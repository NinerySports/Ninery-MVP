# Production External-Claim Ingestion v1.0

## Status

Accepted for Ticket #076 as the application boundary that prepares external claims for review. It stops before human approval and Ticket #075 supporting-evidence persistence.

## Pipeline

```text
captured source material
  -> Source -> Document Revision -> Extraction Run -> Raw Claim
  -> Normalized Proposal -> Identity Assertion -> Dependency Assessment
  -> Construct Relationship Proposal -> #070 Qualification
  -> derived Review-Ready / Quarantined Case
  -> STOP
```

`GovernedExternalClaimIngestionService` isolates each claim in its own repository transaction. `PrismaExternalClaimIngestionRepository` creates the linked #075 records atomically. One failed claim does not block unrelated claims; a failed claim transaction leaves no partial lineage that could appear trusted.

## Reuse

The implementation reuses the Ticket #069 source, document, extraction, raw claim, normalized claim, identity, dependency, construct relationship, conflict, and supersession semantics; the Ticket #070 qualification function and four outcomes; the Ticket #074 role boundary; and the Ticket #075 relational models and append-only constraints. It adds no evidence class and no Prisma model or migration.

## Revisions And Replay

- Source identity is keyed by a stable publisher/source key and checked against persisted publisher metadata.
- Document identity includes the SHA-256 fingerprint of bounded captured content. A URL is not treated as immutable.
- Exact content replay under the same processing versions resolves to deterministic UUIDs and one qualification idempotency key.
- Changed content creates a new document revision linked through `supersedesDocumentId`; old content provenance is retained.
- Changed extractor implementation, version, schema, or provider/model creates a new extraction run and claim lineage while retaining the document.
- Changed normalization or construct-mapping version creates a new interpretation; it never rewrites the raw claim.
- Retries resolve completed deterministic records and safely resume missing work inside the claim transaction.

Only bounded excerpts, structured claim values, external references, capture metadata, and fingerprints are retained. Full copyrighted editorial pages are outside this contract.

## AI Boundary

AI may extract and propose. AI extraction is persisted as `unverified_extracted` with `review_pending`, including extractor and provider/model provenance. AI cannot mark its output reviewed, establish source independence, create an independence group, approve a construct relationship, or call the supporting-role persistence service. An AI independence proposal becomes `unknown_dependency`.

## Normalization And Identity

Normalization preserves raw source language. Known deterministic units and controlled vocabulary may be normalized; unknown vocabulary is retained as a proposal and quarantined. Family-only identity cannot bind an exact variant. Ambiguous, conflicting, unresolved, and cross-variant identity becomes review-ready rather than guessed.

The contaminated Atlas USA equipment and variant UUIDs are rejected before persistence. The controlled pilot targets only the clean Atlas USSSA equipment `748ae67e-0b10-40d6-8ef6-28d6953d1d40` and variant `0844a8e0-8b9a-42ba-9b6f-50f288832e58`.

## Dependency And Constructs

Known upstream lineage may be persisted as dependent. Semantic similarity alone establishes neither dependency nor independence. Suspected syndication uses `unknown_dependency` plus an explicit rationale. Automated construct mappings remain `candidate_only` and `review_pending`; marketing mappings are `not_applicable`. No construct value is created, and Protocol v1.1 constructs remain distinct.

## Qualification And Review Readiness

The existing #070 contract produces `qualified`, `context_only`, `review_required`, or `not_eligible`, including reasons, gaps, blockers, warnings, limitations, contract version, and proposed target. Qualification remains separate from approval.

The review-ready case is derived from current durable lineage. It exposes source, document, wording, normalization, extraction provenance, identity, dependency, mapping, qualification, quarantine reasons, and the next human decision. Ticket #076 does not persist queues, assignments, SLAs, or reviewer work items.

## Authority Firewall

Every projection explicitly reports false for human approval, established independence, supporting-role creation, canonical and numeric values, synthesis, and recommendation authority. There are no compatibility, ranking, or Decision Book writes. Future review orchestration may add genuine review decisions; a later governed capability may invoke Ticket #075 and supporting-evidence read models only after those independent gates pass.

## Atlas Pilot

The pilot adapter contains five controlled, bounded real-source captures: Louisville Slugger, Direct Sports, Academy, BatDigest, and BatReviews. These are inputs to the production service, not imports of the Ticket #071 in-memory graph. Publisher references and capture dates are retained; uncertain editorial vocabulary and dependency remain quarantined.
# Ticket #076 remediation contracts

## Trust boundary

Ingestion fields are discovery proposals. The production Prisma repository resolves source classification from an existing ExternalEvidenceSource and equipment applicability from the current Equipment/EquipmentVariant catalog. An unknown source is registered only as an unresolved derived-source proposal, receives unknown authority, and remains review-required. Caller-provided authority, certainty, UUIDs, reviewer names, booleans, and independence groups cannot establish governed authority.

Dependency assessments created by ingestion are always system-authored, review_pending proposals. Ticket #076 never creates an accepted human review. A future accepted assessment must reference a real governed review record satisfying Ticket #075 provenance.

Editorial, comparative, subjective, and marketing material is persisted with the literal proposal marker unclassified. This marker is not a seventh Equipment DNA evidence class. It prevents the material from entering any of the six governed evidence-class paths until a legitimate later review classifies it.

## Semantic idempotency

Identifiers use recursively key-sorted canonical JSON. Semantically unordered limitation arrays are de-duplicated and sorted; structured values retain array order. Stage fingerprints bind source/document revision, extraction provenance, raw content and claim semantics, resolved identity, normalized value/unit/method/class/vocabulary, dependency proposal, construct proposal, and qualification contract inputs. Changed semantics create a successor proposal rather than replaying stale state.

Document revision identity includes the governed source, external locator, bounded-content fingerprint, document type, title, publication time, model year, explicit publisher revision label, and availability. Capture time is capture-event metadata: recapturing byte-identical immutable content does not create a document revision merely because the clock changed. A changed content fingerprint, publisher revision, publication identity, or availability does. The current schema retains the first capture timestamp on a deduplicated revision; a future capture-event ledger may record every recapture without changing revision identity.

Extraction identity combines the source document revision, a caller-supplied logical run key, execution timestamp, method, extractor identity/version, schema version, and provider/model. A retry must retain the logical run key and execution timestamp and therefore resolves the same lineage. An intentional same-version re-extraction uses a new logical run key and execution timestamp and creates a new historical extraction. A version change also creates new extraction lineage. Wall-clock time is never the sole identity input.

Replay verifies more than the chain of stored UUIDs. The repository reconstructs each deterministic stage ID from persisted semantic fields and fails closed with `SEMANTIC_FINGERPRINT_MISMATCH` when persisted semantics no longer match identity. Trusted source classification, publisher identity, source version, and resolved authority are included in qualification identity, so changed governance produces a new historical qualification rather than returning stale authority.

Expected PostgreSQL unique and serialization races (P2002, P2034) receive at most three attempts. Other failures are not retried.

## Current state and history

Qualification rows remain immutable historical decisions. Every durable review projection additionally evaluates unresolved conflict membership. If any current conflict is unresolved, every member is operationally review-required, including a claim that was historically qualified before the conflict opened.

Multiple extraction runs over the same document remain one dependent source/document lineage. The run with the latest executedAt value, then deterministic extraction-run ID, is operationally current. Older runs remain replayable and auditable but are marked non-current; re-extraction never creates independent corroboration.

The operational claim slot is the document revision plus stable source location, canonical claim key/property, and resolved equipment/variant scope. The claim key distinguishes independent assertions that share a section and claim type, such as certification and barrel diameter. Re-extractions with the same anchor, property, and identity scope compete only within their own slot. Current selection orders by execution time descending, extraction ID descending, then normalized-claim ID descending, so equal timestamps remain deterministic and an extraction can never supersede itself.

Initial writes and exact replay both return the durable projection reconstructed from persisted lineage. That projection retains source classification and publisher, document ID/revision/locator, raw wording and source location, extraction logical run/provider/model/version/time, normalized value/unit/method/version/vocabulary/evidence-class proposal, identity applicability, dependency and syndication state, construct mapping/version/confidence, immutable historical qualification, operational conflict/supersession state, exact quarantine reasons, blockers, and the specific next human decision.

The clean Atlas USSSA inputs are controlled, bounded real-source capture fixtures. They are not live acquisition, independent proof of capture, or evidence authority. Production services perform all ingestion, and the contaminated Atlas USA equipment and variant IDs remain hard blocked.
