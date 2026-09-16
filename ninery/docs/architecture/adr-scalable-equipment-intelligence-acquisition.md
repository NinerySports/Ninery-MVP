# Scalable Equipment Intelligence Acquisition and Evidence Strategy

## Status

Accepted as the Ticket #068 architecture direction. This decision adds no runtime ingestion, evidence, synthesis policy, schema migration, or recommendation behavior.

## Strategic decision

Ninery will build broad product coverage from claim-level, source-aware evidence while using physical measurement, Ninery human evaluation, and controlled mechanical testing selectively as calibration, validation, and research tools. Physical possession is not a prerequisite for catalog coverage or partial Equipment Intelligence.

The operating principle is:

> Measure selectively. Observe at scale. Model carefully. Preserve provenance. Explain everything.

The six Ticket #063 evidence classes remain unchanged:

1. `verified_catalog_fact`
2. `direct_physical_measurement`
3. `controlled_mechanical_test`
4. `structured_human_evaluation`
5. `structured_field_observation`
6. `modeled_estimate`

Evidence class describes what kind of support a claim provides. Source type describes where it originated. They are orthogonal. Neither document count nor extracted-claim count establishes independence.

## Acquisition pipeline

The future pipeline has explicit review boundaries:

```text
product discovery
  -> identity resolution and variant lock
  -> source discovery and access-policy check
  -> immutable source-document capture metadata
  -> claim extraction
  -> normalized claim proposal
  -> evidence-class and claim-kind classification
  -> upstream lineage and independence grouping
  -> verification, corroboration, and conflict assessment
  -> reviewed construct relationship
  -> Equipment DNA evidence read model
  -> construct sufficiency and synthesis readiness
  -> future governed synthesis
```

Discovery and extraction do not activate evidence. Normalization does not overwrite source wording. Construct mapping is a separately reviewed relationship. Synthesis remains downstream of a versioned policy.

## Source taxonomy

| Source type | Appropriate role | Important limitation |
|---|---|---|
| `manufacturer_primary` | Product identity, nominal specifications, materials, construction, available variants | Behavioral and superiority claims remain marketing or claims, not observed facts |
| `certification_authority` | Certification status and governed product identity | Does not establish feel or performance |
| `official_product_documentation` | Versioned manuals, catalogs, specification sheets | Publisher lineage may be the same as manufacturer content |
| `retailer_structured_data` | Discovery, SKU/UPC, availability, historical pages, specification cross-check | Often syndicated, stale, merged across variants, or transcribed incorrectly |
| `independent_expert_review` | Contextual qualitative observations and comparisons | Qualification, method, tester, variant, and incentives must be known |
| `structured_testing_publication` | Disclosed test observations or results | Method and fixture determine which claims are supported |
| `user_review` | Noisy field experience and issue discovery | Identity, selection bias, duplication, incentives, and conditions are often unresolved |
| `community_discussion` | Discovery and hypothesis generation | Unstructured anecdote; normally not direct construct evidence |
| `ninery_internal_measurement` | Specimen-specific physical facts | Does not imply behavior |
| `ninery_internal_evaluation` | Protocol-bound human observations | Evaluator/session dependence remains explicit |
| `ninery_controlled_test` | Controlled response under a documented method | Test output is not automatically a canonical construct |
| `structured_field_observation` | Player/context-specific real-world observation | Contextual rather than universal |
| `derived_model_output` | Explicitly versioned inference | Cannot corroborate its own inputs |

These are proposed source-origin identifiers, not additions to the six evidence classes.

## Claim kinds and authority

Claims should be classified as `factual_product_claim`, `subjective_observation`, `marketing_claim`, `comparative_observation`, `field_observation`, or `modeled_inference` before construct review.

Authority is claim-specific:

- Manufacturer and certification sources are strongest candidates for identity and nominal specifications.
- Retailers can corroborate identity or expose conflicts, but repeated feeds do not add independence.
- Expert reviews can support perceived demand, vibration, control, and response only as observations with disclosed context.
- Structured Ninery user observations can support player-specific field evidence. Public anecdotes remain lower-transparency source claims.
- Physical and mechanical sources are authoritative only for quantities and conditions their methods actually measure.
- No source is globally authoritative for every claim.

Marketing phrases such as "massive sweet spot", "explosive pop", "ultra-balanced", or "unmatched control" may be retained as marketing claims. They cannot automatically create Equipment DNA values or direct construct evidence.

## Claim-level provenance

The conceptual record chain is:

```text
Source -> SourceDocument -> ExtractedClaim -> NormalizedClaim
       -> EvidenceClassification -> ConstructRelationship
```

A claim needs, when applicable:

- source identity, type, publisher, reference/URL, access terms, publication date, retrieval date, and document revision/hash;
- raw claim text or a copyright-safe locator/excerpt;
- extraction method, extractor/model identity and version, extraction time, and review status;
- equipment, model year, certification, variant, SKU, manufacturer ID, and UPC identity assertions;
- raw value, normalized value, unit conversion and vocabulary versions;
- claim kind, evidence class, verification state, quality dimensions, and limitations;
- upstream claim/document lineage, independence group, and dependency certainty;
- candidate construct relationship, relationship role, mapping method, reviewer, and version;
- supersession history without destructive overwrite.

Quality remains explainable across source authority, identity certainty, method transparency, independence, specificity, recency, and variant match. Ticket #068 does not invent a combined numeric confidence score.

## Verification and independence

Proposed verification states are:

- `unverified_extracted`: captured or machine-extracted, not verified;
- `source_verified`: source and faithful extraction confirmed;
- `cross_source_corroborated`: compatible claims from genuinely independent upstream groups;
- `conflicting`: material disagreement preserved;
- `review_required`: ambiguity prevents responsible use;
- `superseded`: retained historically but replaced for current use.

`source_verified` means the source really made the claim, not that every claim is objectively true.

Independence is assigned from upstream origin, not URL or publisher count. A dependency edge may be `original`, `syndicated_from`, `copied_from`, `shares_upstream_source`, `independent_observation`, or `dependency_unknown`. Unknown dependency is not presumed independent.

Example: one manufacturer and three retailers all state a 2 5/8-inch barrel. If the retailers repeat the manufacturer feed, there are four documents and four claims but one independent claim group. A separately measured specimen is another evidence class and independence group, limited to that specimen.

## AI governance

AI may locate identity candidates, extract claim sentences, propose claim kinds, normalize units, map controlled synonyms, flag duplicates/conflicts, summarize limitations, and propose construct relationships for human or deterministic review.

The firewalls are absolute:

```text
AI extracted != verified
AI classified != observed
AI inferred != fact
AI summarized != independent source
```

Example: a review says, "Reviewers found the bat easy to get through the zone." AI may preserve that raw claim, propose normalized descriptor `easy_to_swing`, and propose `startup_demand` as a candidate relationship. It may not create `startup_demand = low`. Source provenance, AI model/version, extraction output, descriptor mapping, limitations, and review state remain separate.

Qualitative descriptors belong in a versioned controlled vocabulary with original wording retained. Synonym mapping can normalize language such as `balanced` or `slightly_end_loaded`; novel, comparative, context-dependent, marketing, or ambiguous language requires review. Vocabulary terms are not automatically canonical Equipment DNA values.

## Identity, time, and freshness

Evidence must be locked to the strongest known identity tuple: manufacturer, model family, model year, certification, construction revision, length, weight, drop, SKU, manufacturer product ID, UPC, and Ninery IDs. Missing or conflicting identity fields trigger review. No evidence may leak between USA, USSSA, and BBCOR versions, model years, sizes, or similarly named products without an explicit relationship.

Source publication and retrieval dates are distinct. New retrievals create versions or supersession relationships; they do not overwrite history. Freshness policy varies by claim: certification and active availability need more frequent review than historical construction facts. Page disappearance does not delete captured provenance.

## Revised role of selective primary research

- **Physical measurement:** verify specimen identity, dimensions, mass, balance, and other directly measurable quantities; characterize reference specimens and detect catalog discrepancies. Never infer behavior automatically.
- **Ninery human evaluation:** calibrate vocabulary and constructs, study evaluator repeatability and cross-equipment discrimination, investigate conflicts, and validate external observational interpretation. It is not mandatory for every product.
- **Controlled mechanical testing:** calibrate response constructs, test repeatability, anchor interpretation, and investigate high-value conflicts. It should not remain mandatory per product for all seven response constructs.
- **Structured field observation:** provide contextual real-world behavior across player and use conditions, with selection and dependence limitations preserved.

Protocol v1.1 and controlled tests become calibration/reference evidence that can help earn future policies for interpreting scalable external observations. Neither is discarded or downgraded.

## Reference and calibration set

Ninery should select reference equipment across certification, construction, material, length/weight class, drop, model family, design archetype, and intended player level. Selection should maximize interpretable coverage and contrasts, not target an unsupported sample count. A reference set can calibrate language, methods, source relationships, model uncertainty, and transfer limits while leaving untested products explicitly less deep.

The existing DeMarini measurements, 41 human records, Protocol v1.0 history, Protocol v1.1 session, provenance, and independence semantics remain immutable calibration data. Atlas remains a candidate reference product, but Ticket #068 does not require or perform its measurement or evaluation.

## Minimum viable profile and depth

A minimum viable equipment profile requires:

- resolved product/model-year identity and at least one resolved variant;
- source-verified nominal specifications required for eligibility and display;
- source lineage and verification status;
- explicit conflicts, unresolved fields, freshness, and coverage status;
- no unsupported behavioral conclusions.

Coverage and depth are separate:

| Depth | Meaning |
|---|---|
| `identified` | Identity candidate resolved enough for catalog tracking |
| `catalog_verified` | Required nominal facts are source verified |
| `evidence_enriched` | Additional independent or contextual claims are classified and traceable |
| `partial_equipment_dna` | Some constructs have policy-eligible evidence; missing constructs remain explicit |
| `calibrated` | Selective Ninery primary research supports interpretation |
| `synthesis_eligible` | A future construct-specific policy, not depth alone, permits synthesis |

A product can have broad catalog coverage with shallow DNA depth. It must not be labeled fully characterized merely because many pages were collected.

## Atlas example

This example uses only existing catalog facts for `66f59356-029f-4df7-9177-0d0f36ef3e9c`, variant `a485a596-ea15-4622-ac2e-452b7fd9c934`, SKU `LS-ATLAS-USA-30-20`.

| Stage | Evidence | Class/source type/state | Responsible statement | Prohibited statement |
|---|---|---|---|---|
| Identified | 2026 Louisville Slugger Atlas USA and exact variant identity | Catalog identity; existing internal catalog; identity resolved | "This record represents the 30/20/-10 USA variant." | Claims about feel or performance |
| Catalog verified | 30 in, 20 oz nominal, -10, USA, one-piece alloy | `verified_catalog_fact`; existing catalog fixture; source status must remain accurately described | Display nominal specifications with provenance | Treat nominal mass as measured specimen mass |
| Evidence enriched | **Hypothetical, not real evidence:** a traced independent review observation | `structured_human_evaluation` or field class only after classification; external source type; review state | Report that a named source made a contextual observation | Convert review language directly to canonical DNA |
| Partial Equipment DNA | **Hypothetical future:** policy-eligible claims for only selected constructs | Mixed evidence with reviewed construct relationships | Explain supported constructs, uncertainty, and omissions | Claim complete profile, validation, or recommendation authority |

Scalable acquisition can take Atlas through catalog verification now. Later stages require actual evidence and approved policies; this ADR fabricates neither.

## Scalability matrix

| Area | 100 products | 1,000 products | 5,000+ products |
|---|---|---|---|
| Identity/catalog | Automated import plus manual resolution | Rules, identifiers, deduplication, exception queue | Publisher connectors, entity resolution, revision monitoring |
| Claim extraction | Assisted extraction with broad review | Automated extraction plus sampled and exception review | Versioned models, quality monitoring, targeted review |
| Human review | Review most ambiguous claims | Prioritized queues by impact and uncertainty | Risk-based queues, sampling, escalation specialists |
| External observations | Curated expert sources | Structured source partnerships and user programs | Scaled structured feedback with dependence controls |
| Physical/mechanical work | Deliberate reference set | Selective archetypes and conflicts | Calibration maintenance, drift checks, high-impact exceptions |
| Maintenance | Scheduled source checks | Automated freshness and conflict detection | Change feeds, lineage-aware reprocessing, archival controls |
| Primary risk | Inconsistent manual classification | Identity leakage and review bottlenecks | Source dependency, model drift, stale lineage, governance scale |

Routine extraction, deterministic normalization, duplicate candidate detection, freshness checks, and queue prioritization should be automated. Identity ambiguity, unsupported conversions, novel descriptors, marketing-to-construct proposals, suspected syndication, material conflicts, model-year uncertainty, and high-impact inference require human review.

## Modeled estimates and circularity

Modeled estimates may be considered only after relevant calibration coverage exists. Every output must carry model/version, immutable input evidence IDs, training scope, uncertainty, missing inputs, applicability warnings, and generation date. It remains `modeled_estimate`, never measurement or observation.

An estimate inherits dependency on every input group. It cannot count as independent corroboration of an input or train and validate on the same unpartitioned evidence. Graph traversal must prevent cycles such as source claim -> model estimate -> corroboration of source claim.

## Ticket #067 reassessment

Ticket #067 does not currently impose mandatory source counts or evidence classes: all profiles have empty `requiredEvidenceClasses`, no minimum independent-source threshold, `not_established` policy, and synthesis disabled. Its classification of seven response constructs as insufficient follows their current primary-candidate mapping, not a permanent mandate.

Recommended future reinterpretation:

- Controlled mechanical testing should be calibration/reference and conflict-resolution evidence, not universally mandatory product-level evidence.
- Protocol v1.1 should be calibration/reference evidence for the six demand/control constructs, not universally mandatory product-level evidence.
- Strong external observations may eventually support synthesis only under empirically earned, construct-specific policies with identity, lineage, independence, quality, conflict, and transfer limits.
- Do not alter #067 until acquisition evidence, calibration studies, and governance justify explicit provisional policies.

Readiness must remain construct-specific. Scalability is not a reason to weaken it or invent thresholds.

## Architecture gap analysis

| Capability | Status | Recommended action |
|---|---|---|
| Six evidence classes | Supported | Keep unchanged |
| Construct mapping and sufficiency | Supported | Reinterpret primary candidates as calibration roles where earned later |
| Evidence read model/firewalls | Supported | Extend inputs later without changing synthesis boundaries |
| Catalog onboarding and variant identity | Partially supported | Add robust aliases, external identifiers, and identity assertions |
| Source taxonomy | Partially supported | Add orthogonal source-origin taxonomy |
| Claim-level provenance | Partially supported in JSON/reference fields | Add first-class source, document, claim, normalization, and relationship records |
| Source lineage/independence | Partially supported by references/groups | Add dependency edges and upstream-group resolution |
| Duplicate/syndicated detection | Missing | Add fingerprints plus reviewed dependency classification |
| AI extraction provenance | Missing as first-class data | Add extraction-run/model/version records separate from source claims |
| Temporal/versioned evidence | Partially supported | Add document versions, effective dates, and explicit supersession edges |
| Qualitative normalization | Missing | Add versioned vocabulary, mappings, and review status |
| Modeled-estimate lineage | Possible in JSON only | Add immutable input links and cycle validation before modeling |
| Human review queue | Missing | Add impact/risk-based review cases and decisions |
| Freshness/source maintenance | Partially supported by `retrievedAt` | Add policies, checks, source status, and reprocessing lineage |
| Coverage/depth status | Conceptual only | Add a derived read model before persistence |

## Prisma assessment

The current `EquipmentDNAEvidenceRecord` can truthfully hold limited external evidence through source type/name/reference, dates, raw and normalized JSON, method, evaluator, status, and equipment/variant links. It is sufficient for prototypes and preserves the existing six-class projection in the read model.

It is not sufficient as a normalized production acquisition graph. In particular it cannot first-class represent reusable sources and versioned documents, multiple claims per document, claim-to-claim dependencies, syndication groups, extraction runs, quality dimensions, identity assertions, review decisions, vocabulary mappings, or modeled-input lineage.

A future migration should be separately designed around additive entities conceptually named `EvidenceSource`, `SourceDocument`, `SourceDocumentVersion`, `ExtractedClaim`, `NormalizedClaim`, `ClaimDependency`, `ClaimIdentityAssertion`, `ClaimConstructRelationship`, `ExtractionRun`, and `EvidenceReviewCase`. Existing evidence records should be linked, not rewritten. Ticket #068 creates no schema or migration.

## Freshness and source governance

Production collection requires policy and legal review for attribution, URL/reference retention, quotation length, copyright-sensitive review content, terms of service, robots/access restrictions, licensed data, user consent, deletion requests, incentives, and AI processing. This ADR provides architecture, not legal conclusions.

## Consequences and next ticket

Existing evidence classes, historical records, protocol semantics, read models, conflict preservation, sufficiency states, and recommendation firewalls remain unchanged. The reinterpretation is operational: selective primary research calibrates a broader source-aware acquisition system.

The recommended next ticket is **Equipment Intelligence Source, Document, and Claim Provenance Model v1.0**. It should define domain types and validation first, exercise fixture-only ingestion and lineage/duplication cases, and present any additive Prisma proposal for approval before migration. It should not implement scraping, AI extraction, synthesis, or recommendation participation.

## Ticket #068 firewalls

- Database writes performed: no
- Real evidence created or modified: no
- Historical evidence modified or reinterpreted: no
- External evidence fabricated: no
- Behavioral synthesis performed: no
- Canonical Equipment DNA changed: no
- Numeric reference values changed: no
- Modeled estimates created: no
- Recommendation, player compatibility, or Decision Book behavior changed: no
- Scraper or AI ingestion pipeline implemented: no
- Prisma migration created: no
- Ticket #069 started: no
