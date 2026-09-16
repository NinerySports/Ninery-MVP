# Equipment Source, Document, and Claim Provenance Model

## Status

Accepted for Ticket #069 as a domain-only, synthetic-fixture foundation. No production ingestion or persistence is authorized.

## Domain graph

```text
EquipmentSource
  -> EquipmentSourceDocument
  -> EquipmentSourceClaim
  -> EquipmentNormalizedClaim
  -> EquipmentClaimConstructRelationship
```

Identity assertions, extraction runs, dependencies, modeled-input lineage, review, verification, and supersession are explicit adjacent records. The implementation is in `packages/equipment-intelligence/src/evidence/acquisition`; it validates immutable inputs, produces deterministic analysis, and performs no I/O.

Source type and claim type are orthogonal to the unchanged Ticket #063 evidence classes. A source is a publisher or producer; a document is a specific artifact/revision. A document can contain many raw claims. A raw claim preserves what was said and can yield multiple normalized claims. Every normalized claim retains its raw parent and lineage group, so normalization never creates independence.

Source types cover manufacturer, certification authority, official documentation, retailer, expert review, testing publication, user/community sources, Ninery measurement/evaluation/test/field systems, and model output. Claim types distinguish specifications, subjective/comparative/field observations, marketing, measurement/test observations, modeled output, certification, and identity.

Authority is claim-specific: `authoritative`, `primary`, `secondary`, `observational`, `unknown`, or `not_authoritative_for_claim`. A manufacturer can be authoritative for nominal dimensions but is not behavioral authority for "massive sweet spot."

## Lineage and independence

Dependency relationships are `original`, `syndicated_from`, `derived_from`, `copied_from`, `shared_upstream`, `independent_observation`, and `unknown_dependency`. Unknown dependency remains conservative.

Every raw claim carries an informational-origin group. Normalized and AI-extracted derivatives inherit it. Known syndicated, copied, shared-upstream, and modeled derivatives must share their upstream group. Validation rejects missing references, self-dependencies, contradictory groups, self-supersession, and dependency/model cycles.

Document, source, claim, and independent-group counts remain separate. Exact normalized agreement does not prove corroboration. Human review does not add independence.

## Identity and temporal firewalls

Identity assertions can bind manufacturer, model, year, certification, construction revision, dimensions, drop, SKU, manufacturer ID, UPC, equipment ID, and variant ID. Their certainty is `exact_variant_match`, `equipment_model_match`, `family_only`, `ambiguous`, `conflicting`, or `unresolved`.

Applicability requires compatible asserted fields. Family-only, ambiguous, conflicting, and unresolved identities cannot cross the firewall. Tests prove 2026 Atlas USA cannot inherit 2026 BBCOR, 2025 USA, or ambiguous Atlas claims.

Publication and retrieval dates remain distinct. Documents preserve revisions, fingerprints, availability, upstream references, and supersession. Historical claims remain present; newer claims do not overwrite them, and superseded claims do not create current conflicts.

## Verification, review, and conflicts

Verification states are `unverified_extracted`, `source_confirmed`, `corroborated`, `conflicting`, `review_required`, and `superseded`. Review states are independently represented as `not_reviewed`, `review_not_required`, `review_pending`, `reviewed_accepted`, `reviewed_with_limitations`, and `reviewed_rejected`.

Independent disagreements sharing a current identity and claim key remain explicit conflicts. The analyzer preserves both claims, chooses no winner, and applies no invented tolerance.

## Qualitative, marketing, AI, and model firewalls

The synthetic observation "easy to get through the zone" retains its raw wording, normalizes to `easy_to_swing`, and maps to `startup_demand` as `candidate_only`. It does not create `startup_demand = low`.

The synthetic phrase "massive sweet spot" remains a `marketing_claim`, is `not_authoritative_for_claim`, and maps to `not_applicable`. Marketing cannot become direct, supporting, or calibration evidence through keyword matching.

AI extraction records processing provenance, not source provenance. It cannot verify a claim, become an evidence source, increase independence, or create a construct conclusion. Modeled outputs retain model/version and immutable input claims/groups, inherit dependency on those inputs, and cannot corroborate them.

## Synthetic scenarios

The fixture proves:

1. One manufacturer sentence yields length, weight, and drop normalized claims in one lineage.
2. Manufacturer plus three syndicated retailer pages yields four documents and claims but one underlying group.
3. An independent reviewer remains observational and produces only a candidate construct relationship.
4. AI processing remains processing provenance.
5. Independent 2.625-inch and 2.5-inch claims remain an unresolved conflict.
6. Certification, year, variant, and ambiguous identity leakage is blocked.
7. A modeled derivative inherits its manufacturer's lineage.
8. Superseded and current claims both remain available.

All data is synthetic and explicitly limited as non-evidence.

## Qualified evidence boundary

`EquipmentDNAEvidenceRecord` should remain the boundary between acquisition knowledge and evidence eligible for Tickets #066/#067:

```text
acquired claim
  -> identity, lineage, classification, and review qualification
  -> qualified evidence
  -> EquipmentDNAEvidenceRecord
  -> #066 evidence read model
  -> #067 sufficiency/readiness
```

This prevents pages, extracted sentences, AI output, and unreviewed construct mappings from entering evidence calculations. Ticket #069 qualifies no fixture and changes neither #066 nor #067.

## Additive Prisma proposal

Schema proposal prepared; migration not authorized by Ticket #069.

| Concept | Purpose / key fields | Integrity and lifecycle | Timing |
|---|---|---|---|
| `EquipmentSource` | Stable publisher, source type, operator, status | Unique stable key; type/state indexes; history retained | First ingestion |
| `EquipmentSourceDocument` | Source artifact and revision, reference, dates, fingerprint | Unique source/reference/revision; immutable revisions | First ingestion |
| `EquipmentClaimExtractionRun` | Manual/parser/AI method, extractor/version/time/schema | Immutable run; no hidden reasoning | First ingestion |
| `EquipmentClaimIdentityAssertion` | Product/variant bindings and certainty | Equipment, variant, SKU, year, certification indexes | First ingestion |
| `EquipmentSourceClaim` | Raw claim, source/document/extraction/identity/lineage | Append-only; document/group/type/state indexes | First ingestion |
| `EquipmentNormalizedClaim` | Versioned derivative, key/value/unit/method | Raw/key/version uniqueness; scalar fields plus JSON fallback | First ingestion |
| `EquipmentClaimDependency` | Syndication and upstream lineage | Claim/upstream/type uniqueness; no self/cycles | First ingestion |
| `EquipmentClaimConstructRelationship` | Candidate/reviewed mapping, role and rationale | Claim/construct/version uniqueness; append-only versions | Before construct use |
| `EquipmentClaimReviewDecision` | Actor, decision, reason and target | Append-only audit; target/time/reviewer indexes | First ingestion |
| `EquipmentVocabularyMapping` | Versioned descriptors and synonyms | Vocabulary/version/term uniqueness | Can wait |
| `EquipmentModeledEstimateLineage` | Model output and immutable inputs/groups | Output/input uniqueness; model/group indexes | Can wait |
| `EquipmentClaimConflictCase` | Durable conflict workflow | Identity/key/status indexes; append-only decisions | Can wait; derive initially |

Foreign keys should restrict destructive provenance deletion. Supersession should use self-references. JSON is appropriate for source metadata, limitations, raw structured values, and method-specific details, but not core identity, lineage, state, relationship, or indexable claim fields.

The first production slice needs source, document, extraction run, identity assertion, raw claim, normalized claim, dependency, and review decision. Vocabulary, modeled lineage, and durable conflict workflow can wait for their corresponding production capabilities.

## Compatibility and next scope

The six evidence classes, physical measurements, Protocol v1.1 history, #066 read model, #067 policies, and real DeMarini evidence remain untouched. No Atlas evidence, canonical value, numeric reference, recommendation input, or database record is created.

Ticket #070 should design a fixture-only qualification contract mapping an accepted normalized claim to a proposed `EquipmentDNAEvidenceRecord`, including rejection reasons and an approval checkpoint for the smallest first-ingestion Prisma schema. It should not implement acquisition, production AI, synthesis, or recommendations.
