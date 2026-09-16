# @ninery/equipment-intelligence

Equipment DNA is an evidence-based equipment profile, not a guarantee of performance for every player.

The synthetic acquisition provenance architecture is documented in [the Equipment claim provenance ADR](../../docs/architecture/adr-equipment-claim-provenance-model.md).

The conservative trust gate from acquired claims to in-memory qualified evidence proposals is documented in [the Equipment claim qualification ADR](../../docs/architecture/adr-equipment-claim-qualification-contract.md).

## Purpose

The Equipment DNA Reader loads catalog facts, Equipment DNA profiles, scores, evidence, fit profiles, personalities, specifications, variants, and comparisons into one normalized domain object for the future Compatibility Engine.

## Facts, DNA, Fit, and Evidence

- Facts: `Equipment`, `EquipmentVariant`, and `EquipmentSpecification`
- DNA: `EquipmentDNAProfile`, `EquipmentDNAScore`, and `EquipmentCharacteristic`
- Fit: `EquipmentFitProfile` and `EquipmentPersonality`
- Evidence: `EquipmentEvidence`

The reader keeps these layers separate in the output so model-level scoring and variant details do not get blurred.

## Standard Scores

Scores are normalized from the stored source score into 0-100:

- `batControl`
- `balance`
- `swingWeight`
- `barrelForgiveness`
- `sweetSpotSize`
- `powerPotential`
- `confidenceBuilding`
- `transitionFriendliness`

Missing scores remain missing. They are not converted to zero.

## Attribute Registry

The canonical MVP bat attribute registry lives in `src/attributes`. It defines versioned snake_case attribute keys, domains, data types, value validation rules, parent-friendly explanations, recommendation-readiness flags, and compatibility metadata back to the current Equipment DNA scores.

The registry is metadata-only in version `1.0`. It does not change scoring formulas, ranking behavior, Prisma models, seed data, or API contracts.

See `src/attributes/README.md` for the full attribute list, transition-difficulty decision, readiness rules, and value validation behavior.

## Characteristic Mapping

Stable `EquipmentCharacteristic.code` values drive mapping:

- `BAT_CONTROL -> batControl`
- `SWING_BALANCE` or `BALANCE -> balance`
- `SWING_WEIGHT -> swingWeight`
- `BARREL_FORGIVENESS -> barrelForgiveness`
- `SWEET_SPOT_SIZE -> sweetSpotSize`
- `POWER_POTENTIAL -> powerPotential`
- `CONFIDENCE_BUILDING -> confidenceBuilding`
- `TRANSITION_FRIENDLINESS -> transitionFriendliness`

Display names are not used for matching.

## Normalization

The MVP expects source DNA scores to be stored on a 1-10 scale. Values at or below 10 are multiplied by 10. Values above 10 are treated as already 0-100. Final values are clamped between 0 and 100.

## Model-Level vs Variant-Level

For MVP, DNA scores are model-level and attach to `EquipmentDNAProfile`.

Variant requests load selected `EquipmentVariant` details and clearly return `sourceLevel: "model"` unless future variant-adjustment data exists. The reader does not invent variant adjustments.

## Eligibility

Recommendation eligibility considers:

- equipment status
- active DNA profile
- published profile status
- required characteristic coverage
- variant availability
- profile completeness
- evidence confidence

Draft profiles can be loaded for internal development with `includeDraft`, but are not public recommendation-ready.

## Evidence Confidence

Evidence confidence is separate from DNA scores and considers:

- number of scores with evidence
- evidence reliability
- evidence approval status
- certification level
- profile completeness
- publication status

MVP profiles are not marked `validated` unless explicit high-quality evidence supports it.

## Evidence and Evaluation Records

Ticket #020 adds a separate provenance layer in `src/evidence` for canonical Ticket #019 attributes. This layer records evidence sources, evaluation methods, raw and normalized values, attribute-specific confidence, evaluation versions, conflict detection, maturity, and recommendation-readiness assessment.

The new records are additive. They do not replace `EquipmentEvidence`, `EquipmentDNAScore`, or the current 0-100 score reader. Current recommendations continue to use the existing score pipeline.

See `src/evidence/README.md` for lifecycle rules, confidence model version, readiness model version, level enforcement, and Ticket #021 guidance.

## Demo Recommendation-Ready Profiles

Ticket #021 adds a development seed and readiness report for the three BatMatch demo bats:

- Rawlings ICON 2026 USA, selected variant `RAW-ICON-USA-30-22`
- Louisville Slugger Atlas 2026 USA, selected variant `LS-ATLAS-USA-30-22`
- Easton Hype Fire 2026 USA, selected variant `EAS-HYPE-USA-30-22`

The seed creates evidence-backed evaluations for required attributes: `length`, `weight`, `drop`, `certification`, `barrel_diameter`, `swing_effort`, `forgiveness`, `sweet_spot_support`, and `bat_control_support`. Optional evaluations are created for `construction`, `material`, and `power_potential` when the seeded catalog and scores support them.

Objective catalog facts use `manufacturer_specification` with `direct_specification`, sourced honestly from the existing seeded catalog fixture. Behavioral evaluations use `internal_derived` evidence plus a deterministic rubric record; they preserve the original characteristic code, source score, mapping function, and mapping version.

Score-to-ordinal mapping version: `1.0`.

Standard support mapping:

- `0-19 -> very_low`
- `20-39 -> low`
- `40-59 -> moderate`
- `60-79 -> high`
- `80-100 -> very_high`

Swing-effort mapping is intentionally separate. Current recommendation code treats lower `scores.swingWeight` as easier to manage by applying `inverseScore(scores.swingWeight)`. Therefore `swingWeight` is interpreted as demand:

- `0-19 -> very_easy`
- `20-39 -> easy`
- `40-59 -> moderate`
- `60-79 -> demanding`
- `80-100 -> very_demanding`

The live recommendation engine does not consume these readiness records yet. Existing 0-100 scores, rankings, API responses, and BatMatch demo behavior remain unchanged.

Expected development result after running the seed against the current demo catalog:

- each selected demo equipment-plus-variant profile has all 9 required recommendation-ready attributes
- physical specification evaluations use `high` confidence from the seeded catalog fixture, not public-document validation
- derived behavioral evaluations use internal evaluated intelligence and are not labeled `validated`
- maturity is expected to be `evaluated`, not `validated`, `trusted`, or `living_intelligence`
- no experimental relational attributes are required for readiness

The seed is idempotent. It reuses the existing demo equipment, variants, DNA profiles, and scores; updates deterministic evidence/evaluation records when rerun; and does not create duplicate equipment records when a lookup fails.

Development commands:

```bash
pnpm equipment:dna:evaluations:seed
pnpm equipment:dna:readiness
```

To add a fourth demo profile, add the equipment lookup and selected SKU to `packages/database/prisma/seeds/equipment-dna-evaluations.seed.ts`, ensure the seeded catalog has the required variant and scores, then rerun the seed and report.


## Canonical Profile Shadow Comparison

Ticket #022 adds a shadow-only runtime loader and comparison engine for canonical Equipment DNA profiles. The loader composes active equipment-level evaluations with selected variant-level evaluations, preserves confidence, evidence summaries, rationale, readiness, and maturity, and reports duplicate active evaluations as domain errors instead of silently choosing one.

The legacy profile contract remains unchanged: `EquipmentDNAService` loads the active legacy `EquipmentDNAProfile`, normalizes `EquipmentDNAScore` values to the 0-100 score shape, and recommendation eligibility still uses the legacy profile completeness and evidence-confidence path.

Shadow comparison uses `EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION` `1.0` and `EQUIPMENT_DNA_SHADOW_COMPARISON_VERSION` `1.0`. Ordinal midpoint mapping is used only for diagnostics:

- `very_low -> 10`, `low -> 30`, `moderate -> 50`, `high -> 70`, `very_high -> 90`
- `very_easy -> 10`, `easy -> 30`, `moderate -> 50`, `demanding -> 70`, `very_demanding -> 90`

Difference thresholds are centralized: `0-10` aligned, `11-20` minor difference, and `21+` material difference. Missing legacy values remain missing and are never converted to zero.

Swing effort is compared with direct demand semantics. The current live recommendation code treats lower legacy `swingWeight` as easier to manage by inversely scoring it, so the shadow comparison documents legacy `swingWeight` as demand and compares it to canonical `swing_effort` demand. `transition_difficulty`, `confidence_building_potential`, and `balance_profile` are reported as incomparable because they are experimental or semantically ambiguous relative to legacy scores.

Specification checks compare canonical `length`, `weight`, signed `drop`, `certification`, and `barrel_diameter` against the selected catalog variant/model values. Mismatches are reported and never corrected automatically.

Development command:

```bash
pnpm equipment:dna:shadow
```

The command is diagnostic only. It does not persist results and does not pass canonical evaluations into Recommendation Intelligence.

## Canonical Admission Gate

Ticket #023 adds a deterministic admission gate for canonical Equipment DNA profiles. The gate evaluates a loaded canonical profile and its shadow comparison under `CANONICAL_EQUIPMENT_DNA_ADMISSION_POLICY_VERSION` `1.0`.

Admission is diagnostic only. It does not persist decisions, change eligibility, change recommendation scoring, change rankings, alter API contracts, or allow live recommendation use. Every decision returns `liveRecommendationUseAllowed: false`.

Internal candidate admission currently requires:

- recommendation readiness is true
- selected variant is explicit
- maturity is at least `evaluated`
- required physical attributes meet `high` confidence or better
- required behavioral/development attributes meet `moderate` confidence or better
- required specifications match catalog values: `length`, `weight`, signed `drop`, `certification`, and `barrel_diameter`
- no material evidence conflicts
- shadow comparison is `aligned`
- required behavior mapping coverage is 100% for `bat_control_support`, `swing_effort`, `forgiveness`, and `sweet_spot_support`
- all profile, registry, confidence, readiness, score-mapping, shadow-comparison, and ordinal-comparison versions are supported

Optional or experimental mappings such as `balance_profile`, `confidence_building_potential`, and `transition_difficulty` are warnings only. They do not qualify as trusted intrinsic comparisons and do not block readiness by themselves.

Outcome priority is fail-closed: invalid profiles, unsupported versions, material conflicts, not-ready profiles, insufficient confidence, specification mismatches, insufficient mapping coverage, material shadow disagreement, and insufficient maturity all block before any approval outcome. A profile can be `approved_for_internal_candidate`, but it still remains a shadow-only source until a future ticket explicitly changes the live recommendation engine.

Development command:

```bash
pnpm equipment:dna:admission
```

The report evaluates the three current BatMatch demo bats, continues past individual item failures, avoids secrets, and prints policy/profile versions, blockers, warnings, next actions, and a reminder that live recommendation use remains disabled.

## Numeric Reference Model

Ticket #026 adds `EQUIPMENT_DNA_NUMERIC_REFERENCE_MODEL_VERSION` `1.0` as a runtime layer on top of canonical Equipment DNA evaluations. The canonical ordinal value remains authoritative for human-readable Equipment DNA. Numeric references are optional, evidence-backed values on a `0_100` scale that preserve evaluation fidelity for future Recommendation Intelligence work.

Supported attributes in v1.0:

- `bat_control_support`
- `swing_effort`
- `forgiveness`
- `sweet_spot_support`
- `power_potential`
- `balance_profile`

Unsupported attributes in v1.0:

- `transition_difficulty`
- `confidence_building_potential`

`transition_difficulty` and `confidence_building_potential` remain relational. `balance_profile` is supported as an optional internal-derived numeric reference for shadow comparison, not as a live recommendation input.

Numeric references are loaded from existing active evaluation evidence. For the current demo profiles, the loader preserves the internal-derived source score and normalized score recorded by Ticket #021 evidence fixtures. It does not fabricate values, does not write new database records, and does not change current recommendation inputs.

Validation enforces:

- finite numeric values
- `0_100` scale
- values between `0` and `100`
- supported reference methods
- ordinal consistency
- confidence downgrade explanation when applicable

Ordinal consistency uses the same five-band semantics documented for Ticket #021:

- `very_low` or `very_easy`: `0-19`
- `low` or `easy`: `20-39`
- `moderate`: `40-59`
- `high` or `demanding`: `60-79`
- `very_high` or `very_demanding`: `80-100`

Architectural recommendation: do not add a dedicated Prisma model yet. The current Ticket #020 evaluation/evidence model is the correct source for v1.0 because it already stores ordinal values, source method, confidence, evaluator metadata, timestamps, and raw evidence metadata. A future persistence change should wait until Ticket #027 proves the recommendation engine’s source-selection contract.

Development command:

```bash
pnpm equipment:dna:numeric-reference
```

The report is diagnostic only. It confirms numeric reference availability and consistency for the three demo bats and does not activate canonical recommendations.

## Balance Profile Numeric Reference

Ticket #030 adds Balance Profile Numeric Reference v1.0 under `src/balance`. It keeps the canonical ordinal `balance_profile` authoritative and adds a runtime numeric reference contract for future internal candidate analysis.

Semantic audit result:

- legacy field: `balance`
- characteristic code: `SWING_BALANCE`
- legacy scale: `0-100`
- current engine use: `SWING_FEEL_BALANCE_FIT`
- current low-value meaning: closer to end-loaded balance behavior
- current high-value meaning: closer to balanced/light-feel support
- conversion decision: `inverse`
- canonical direction: `0 = most balanced`, `100 = most end-loaded`

Legacy-derived conversion uses:

```text
canonical = 100 - legacy
```

The conversion is allowed only as internal-derived, `legacy_preserved` evidence with honest confidence. It is not an objective balance-point measurement and must not be labeled validated without better evidence.

Canonical ordinal ranges:

- `0-19 -> very_balanced`
- `20-39 -> balanced`
- `40-59 -> slightly_end_loaded`
- `60-79 -> end_loaded`
- `80-100 -> very_end_loaded`

Current demo persisted references:

- Rawlings ICON: legacy `89 -> 11`, `very_balanced`
- Louisville Slugger Atlas: legacy `84 -> 16`, `very_balanced`
- Easton Hype Fire: legacy `74 -> 26`, `balanced`

Ticket #031 seeds one active equipment-level `balance_profile` evaluation and one linked internal-derived evidence record for each demo bat. The evidence preserves the original legacy balance score, inverse conversion metadata, canonical numeric value, and canonical ordinal value. Confidence is `moderate`; these records are not objective balance-point measurements.

The canonical-to-recommendation adapter uses `CANONICAL_BALANCE_TO_RECOMMENDATION_INPUT_VERSION` `1.0` to bridge canonical end-load tendency back into the current recommendation field direction:

```text
recommendation balance input = 100 - canonical balance_profile
```

That bridge keeps the six-attribute shadow candidate semantically compatible with the existing engine while preserving the canonical value unchanged in Equipment Intelligence.

Development commands:

```bash
pnpm equipment:dna:balance:seed
pnpm equipment:dna:balance-reference
pnpm recommendation:canonical:balance-comparison
```

These commands are development-only. Live recommendations still use legacy Equipment DNA, and readiness remains based on the original 9 required attributes.

## Predictability Support

Ticket #032 adds `predictability_support` as the equipment-side replacement for the intrinsic portion of legacy
`confidenceBuilding`. It describes stable, understandable, repeatable bat response across typical swings and contact
outcomes. It does not describe player confidence, psychological outcomes, transition ease, player preference, or
overall product quality.

The attribute is active, equipment-level, evaluated-intrinsic, optional for readiness, and versioned at `1.0`.
Readiness remains the original 9 required attributes.

Composite v1.0 uses fixed weights:

- `forgiveness`: `40%`, direct
- `sweet_spot_support`: `35%`, direct
- `swing_effort`: `25%`, inverse into manageability

`balance_profile` is excluded because balanced is not universally more predictable and can be player-relative.
`barrel_stability` is excluded until active demo evaluations exist. `confidence_building_potential` is excluded
because the legacy mixed signal must not feed its equipment-side replacement.

The demo seed creates one active equipment-level `predictability_support` evaluation and one linked internal-derived
evidence record per demo bat. The optional numeric reference is `derived_from_evaluation`, integer `0_100`, and
confidence is capped at `moderate`. Parent-facing copy may say the bat tends to provide a consistent and
understandable response; it must not say the bat will make a player confident.

Development commands:

```bash
pnpm equipment:dna:predictability:seed
pnpm equipment:dna:predictability-support
pnpm recommendation:canonical:predictability-diagnostic
```

The recommendation bridge strategy is `profile_only`: direct substitution into legacy `confidenceBuilding` remains
blocked until future `confidence_compatibility` work.

## Optional Signal Canonicalization Policy

Ticket #029 adds `OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION` `1.0` in `src/policy`. This is an architecture policy only. It does not change live recommendation formulas, rankings, eligibility, confidence calculations, API contracts, database schema, database values, candidate mappings, or web UI.

Policy outcomes:

- `balance -> balance_profile`: approved as Equipment Intelligence. It is an evaluated-intrinsic balance profile with ordinal plus optional numeric-reference representation. The numeric direction is `0 = most balanced` and `100 = most end-loaded`; current legacy support-oriented values use an inverse conversion.
- `confidenceBuilding -> predictability_support + confidence_compatibility`: split. Equipment Intelligence may later own `predictability_support`; Compatibility Intelligence must own player-specific `confidence_compatibility`. Direct migration from the legacy score is blocked.
- `transitionFriendliness -> transition_compatibility`: compatibility-only. Transition requires current equipment, proposed equipment, and player context. Legacy `transitionFriendliness` is inverse to `transition_difficulty`, but a simple inversion is not the future canonical model.

All three legacy fields are preserved for historical recommendation reproducibility. `confidenceBuilding` and `transitionFriendliness` are deprecated for future canonical Equipment DNA candidate inputs. `balance_profile` is now available for internal shadow comparison, but live recommendation activation remains out of scope.

Development command:

```bash
pnpm equipment:dna:optional-signal-policy
```

The report prints policy decisions, current engine usage, future blockers, recommended implementation order, and confirms the live recommendation source remains `legacy`.

## Structured Physical Bat Evaluation Protocol

Ticket #047 adds `PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION` `1.0` in `src/physical-evaluation`.
The protocol creates reusable, structured equipment-side evidence for unresolved behavioral attributes:
`swing_effort`, `forgiveness`, `sweet_spot_support`, and `bat_control_support`.

The protocol verifies physical identity, records condition, evaluator category, reference bats, trial counts,
structured rubric responses, raw observations, limitations, and provenance. Completed attribute protocols emit
#046-compatible `structured_internal_equipment_evaluation` evidence records. They do not create live
recommendation inputs, active canonical evaluations, public APIs, or UI changes.

Important boundaries:

- damaged bats block behavioral evidence output
- evaluators cannot enter arbitrary 0-100 canonical scores
- Jackson Pilot Study outcomes, player-specific conclusions, transition scores, and recommendation-fit claims are rejected
- same-evaluator repeat sessions are not treated as independent confirmation
- reference comparisons remain qualitative unless a later approved numeric mapping exists
- no sensor measurement claims are made without actual sensor data

Development commands:

```bash
pnpm equipment:physical-evaluation:protocol
pnpm equipment:physical-evaluation:readiness
pnpm equipment:physical-evaluation:prepare -- --file=docs/examples/physical-bat-evaluation.example.json
pnpm equipment:physical-evaluation:validation
```

The 2023 DeMarini The Goods (-10) USA is ready to undergo structured physical evaluation, but no real physical
session is seeded. Its behavioral Equipment DNA, canonical readiness, and genuine-study readiness remain incomplete
until a human completes the protocol and the evidence is reviewed.

Ticket #048 adds standalone physical evaluation mode v1.0 for cases where no suitable verified physical reference bat is available. Comparative mode remains unchanged. Standalone mode requires explicit reference-unavailability context and uses absolute categorical observations: `very_low`, `low`, `moderate`, `high`, `very_high`, and `unable_to_assess`.

Standalone trial policy:

- dry-swing attributes require at least 8 dry swings
- `forgiveness` and `sweet_spot_support` require at least 8 contact trials
- reference alternation count may be 0
- no standalone observation creates a 0-100 numeric reference
- a single standalone session remains estimated-confidence evidence until corroborated

Additional command:

```bash
pnpm equipment:physical-evaluation:template -- --mode=standalone
```

Ticket #049 adds verified external reference equipment for comparative physical evaluation. Reference records now distinguish:

- `catalog_reference`: existing Ninery catalog equipment/variant IDs
- `verified_external_reference`: a real physical comparison bat with verified identity but no Ninery catalog/recommendation authority

Verified external references require structured manufacturer/model/year, certification, length, weight, drop, condition, verification source, timestamp, and verifier. They may include barrel diameter and product identifiers. They must not use fake catalog IDs and must not automatically create Equipment DNA, BatMatch eligibility, recommendations, or catalog rows.

The first external-reference example is the 2023 Louisville Slugger Omaha USA 30/19/-11, product identifier `WBL26640101930`, as context for the 2023 DeMarini The Goods USA 30/20/-10. The 1 oz / one-drop difference and one-piece alloy versus two-piece hybrid construction are preserved as limitations.

Development command:

```bash
pnpm equipment:physical-evaluation:external-reference-template
```

Ticket #050 separates comparative evidence completeness from absolute canonical interpretation. A complete comparative session can now prepare `relative_only` evidence when the reference bat has no approved canonical Equipment DNA baseline. The evidence preserves target identity, reference specs and limitations, trial counts, evaluator confidence, comparison observations, and `canonicalInterpretationStatus: deferred`.

Relative-only evidence creates no ordinal, no 0-100 numeric reference, no active canonical evaluation, and no live recommendation change. Ticket #046 can inventory the directional physical evidence while still reporting `insufficient_evidence` until a valid absolute canonical interpretation is supported.

Ticket #052 adds comparative evidence synthesis for persisted physical sessions. The synthesis layer groups repeated `relative_only` physical-evaluation evidence by attribute, dimension, session, and evaluator identity, then reports directional consensus such as `clearly_more_demand` or `clearly_less_support`.

The synthesis is read-only. It does not create active canonical evaluations, absolute ordinals, numeric references, API responses, UI changes, or live recommendation inputs. The DeMarini The Goods / Louisville Slugger Omaha evidence remains reference-unanchored because the Omaha bat is a verified external comparison instrument without approved canonical Equipment DNA authority.

Development commands:

```bash
pnpm equipment:behavioral-evaluation:synthesis
pnpm equipment:behavioral-evaluation:synthesis-validation
```

When adding another physical evaluation session, use a stable evaluator reference. Multiple sessions from the same evaluator improve repeatability notes but do not count as independent confirmation.

Ticket #053 adds Canonical Reference Anchor Strategy v1.0. It determines whether strong comparative behavioral evidence can legitimately progress toward absolute canonical Equipment DNA interpretation.

Anchor levels are:

- `not_anchor_eligible`
- `provisional_anchor`
- `ordinal_anchor`
- `numeric_anchor`
- `validated_anchor`

Catalog presence is not anchor readiness. Existing Rawlings ICON, Louisville Slugger Atlas, and Easton Hype Fire demo behavioral values are currently `provisional_anchor` because they are legacy-derived/internal seed intelligence. They are labeled honestly and are not approved as DeMarini anchors.

The DeMarini/Omaha comparative case remains deferred: Omaha is a verified external reference with no catalog or canonical authority and no approved same-attribute anchor is available. Standalone absolute evidence is now handled by the Ticket #054 synthesis and promotion policy below rather than by treating Omaha as an anchor.

### Standalone Evidence Synthesis And Canonical Promotion

Ticket #054 adds standalone absolute evidence synthesis v1.0. The policy reviews independent standalone physical evaluations and separates outcomes into exact agreement, adjacent agreement, material disagreement, and insufficient independent evidence.

Current DeMarini standalone evidence produces two promotable exact-agreement attributes: `bat_control_support = moderate` and `forgiveness = low`. `swing_effort` remains bounded from `moderate` to `demanding`, and `sweet_spot_support` remains bounded from `moderate` to `high`; both require another evaluator before a single canonical ordinal can be promoted. Omaha comparative evidence can corroborate a bound, but it is not an absolute anchor and does not create an ordinal by itself.

Use:

```cmd
pnpm equipment:behavioral-evaluation:standalone-synthesis
pnpm equipment:behavioral-evaluation:canonical-preview
pnpm equipment:behavioral-evaluation:canonical-validation
pnpm equipment:behavioral-evaluation:canonical-commit -- --confirm
```

The confirmed commit is idempotent and writes only active canonical ordinal evaluations supported by exact independent standalone agreement. It links evaluations to source evidence records, creates no 0-100 numeric references, and does not change live recommendation scoring, rankings, API contracts, or the web UI.

### Standalone Ordinal Persistence Repair

Ticket #055 fixes the persistence boundary for standalone physical evidence. Standalone prepare/review already derives absolute ordinals from raw observations. New confirmed standalone physical-evaluation commits now persist that derived value in `EquipmentDNAEvidenceRecord.normalizedValue` and also record `derivedStandaloneOrdinal` plus `standaloneOrdinalPersistenceVersion` in evidence provenance.

Historical standalone rows can be repaired with the same derivation helper used by prepare/review:

```cmd
pnpm equipment:physical-evaluation:standalone-ordinal-validation
pnpm equipment:physical-evaluation:standalone-ordinal-repair-preview
pnpm equipment:physical-evaluation:standalone-ordinal-repair -- --confirm
```

The repair command updates only existing standalone absolute evidence rows that have preserved raw observations and no conflicting ordinal. Comparative `relative_only` evidence remains ordinal-free. Repair creates no `EquipmentDNAAttributeEvaluation` rows, no numeric references, no migrations, no API changes, no UI changes, and no live recommendation changes.

### Physical Evaluation Conflict Adjudication

Ticket #056 adds a read-only conflict-resolution and adjudication layer for physical evaluations. It analyzes standalone absolute ordinals and preserved raw rubric dimensions, classifies disagreement, and produces targeted next-evidence prescriptions.

Key policies:

- disagreement is preserved as evidence
- majority vote does not create canonical truth
- `response_degradation` is inverse semantics for forgiveness
- Omaha comparative evidence remains corroborating only and non-dispositive
- possible sweet-spot construct conflation is flagged without changing the registry
- prior evaluator ordinals, raw observations, comparative synthesis, and canonical candidates are hidden from the next evaluator
- conflict analysis and adjudication plans create no canonical evaluations, numeric references, migrations, API changes, UI changes, or live recommendation changes

Development commands:

```cmd
pnpm equipment:behavioral-evaluation:conflict-analysis
pnpm equipment:behavioral-evaluation:adjudication-plan
pnpm equipment:behavioral-evaluation:adjudication-validation
```

The adjudication plan is intended to guide the next physical session without coaching the evaluator toward expected results.

### Physical Evaluation Protocol Calibration

Ticket #057 adds a read-only construct-calibration layer over immutable standalone observations. It distinguishes same-dimension evaluator disagreement from stable cross-dimension construct divergence, reports descriptive possible-outlier observations without excluding them, and keeps comparative evidence corroborating and non-dispositive.

After five qualifying independent evaluators, persistent structural disagreement pauses general evaluator collection for protocol or construct review. Sweet-spot breadth and response quality are analyzed separately; forgiveness preserves handle/end asymmetry and inverse `response_degradation`. These findings recommend a future protocol review only and do not change the current registry, canonical evaluations, numeric references, or recommendation behavior.

```cmd
pnpm equipment:behavioral-evaluation:protocol-calibration -- --equipment=<id>
pnpm equipment:behavioral-evaluation:construct-analysis -- --equipment=<id>
pnpm equipment:behavioral-evaluation:pilot-learning-report -- --equipment=<id>
pnpm equipment:behavioral-evaluation:protocol-calibration-validation
```

### Physical Evaluation Protocol v1.1 Preview

Ticket #058 turns the five-evaluator calibration findings into a preview-only future operator questionnaire. Protocol v1.0 and its evidence remain immutable. The preview adds separate swing-effort trial blocks, controlled contact-location testing for forgiveness, refined bat-control tasks, and candidate Sweet Spot Breadth and Sweet Spot Response Quality subconstructs.

The sweet-spot candidates are not canonical registry attributes. Ticket #058's preview performed no persistence; Protocol v1.1 observations remain calibration-only and cannot be promoted, converted to numeric references, or supplied to recommendations.

Ticket #059 enables explicitly confirmed calibration persistence without promoting the protocol to production. Controlled contact uses 18 total swings: six centered, six modest near-center handle-side misses, and six modest near-center end-side misses. Records are transactional, deterministic, immutable after creation, and idempotent on exact repeats. They contain no normalized value and remain excluded from canonical, numeric-reference, recommendation, and transition paths.

Ticket #060 makes evaluator independence explicit. `SESSION COUNT != INDEPENDENT SOURCE COUNT`: the first qualifying session by an evaluator for an equipment item is `independent_evaluator`; later sessions by that same evaluator are `repeat_evaluator`, including across Protocol v1.0 and v1.1. Repeat sessions remain legitimate calibration evidence but add zero independent sources. Prepare and commit validate the declaration against existing physical evidence and block contradictions without modifying historical rows.

```cmd
pnpm equipment:physical-evaluation:protocol-v1-1-preview
pnpm equipment:physical-evaluation:evidence-independence -- --equipment=<id>
pnpm equipment:physical-evaluation:questionnaire-v1-1-preview
pnpm equipment:physical-evaluation:protocol-v1-1-validation
pnpm equipment:physical-evaluation:protocol-v1-1-session-template
pnpm equipment:physical-evaluation:protocol-v1-1-prepare -- --file=<file>
pnpm equipment:physical-evaluation:protocol-v1-1-commit -- --file=<file> --confirm
pnpm equipment:physical-evaluation:protocol-v1-1-show -- --equipment=<id>
pnpm equipment:physical-evaluation:protocol-v1-1-pilot-validation
pnpm equipment:physical-evaluation:protocol-v1-1-learning-report -- --equipment=<id>
pnpm equipment:physical-evaluation:protocol-v1-1-learning-report-validation
```

Ticket #061 adds a deterministic, read-only learning report for the first genuine Protocol v1.1 calibration session. It compares v1.1 dimension separation with the immutable v1.0 cohort and includes a same-evaluator cross-protocol review. That review is descriptive calibration evidence only: it is not independent replication and cannot support causal claims.

The report keeps Sweet Spot Breadth and Sweet Spot Response Quality as candidate subconstructs, preserves inverse `response_degradation` semantics, and reports protocol weaknesses instead of rewriting historical observations. Its current decision vocabulary supports collecting more calibration evidence, refining specific dimensions, preserving the protocol while expanding the pilot, or requiring construct review. One evaluated equipment model never permits cross-equipment generalization.

The learning report has no persistence path. It creates or modifies no canonical evaluations, numeric references, registry attributes, recommendation inputs, rankings, or historical evidence.

### Protocol v1.1 Cross-Equipment Calibration

Ticket #062 adds a derived, read-only pilot framework for expanding Protocol v1.1 to materially different catalog bats. Equipment-level evaluator independence remains scoped to `equipmentId + evaluatorId`. Protocol participation is tracked separately, so an evaluator can be `independent_evaluator` for a new equipment model and simultaneously `repeat_protocol_participant` in the broader calibration program.

Calibration archetypes contain catalog-supported identity only: construction, certification, length, weight, drop, material, and barrel diameter where present. They never infer balance, swing effort, forgiveness, sweet spot, control, or performance. Candidate contrast is categorical (`insufficient_catalog_data`, `low_contrast`, `moderate_contrast`, or `high_contrast`) and has no numeric score or commercial ranking.

Generalization readiness is conservative. One represented model is `single_equipment_only`; a genuine second-model session can move only to `cross_equipment_started`. The framework never emits a `validated` state. Historical v1.0 or Omaha comparative evidence, development fixtures, and catalog presence without genuine v1.1 evidence do not count as cross-equipment coverage.

```cmd
pnpm equipment:physical-evaluation:protocol-v1-1-cross-equipment-status
pnpm equipment:physical-evaluation:protocol-v1-1-pilot-candidates -- --baseline=<equipment-id>
pnpm equipment:physical-evaluation:protocol-v1-1-cross-equipment-prepare -- --equipment=<id> --variant=<uuid> --evaluator=<id>
```

All three commands are read-only. Preparation reports identity, archetype, both evaluator relationships, prior sessions, and equipment-scoped source contribution without creating a session or populating evaluator answers.

### Multi-Source Evidence Strategy

Ticket #063 defines six non-interchangeable evidence classes: verified catalog facts, direct physical measurements, controlled mechanical tests, structured human evaluations, structured field observations, and modeled estimates. Facts, measurements, perceptions, field experiences, and inferences retain distinct provenance and trust labels throughout synthesis.

Direct measurements preserve the original value and unit, all trials, aggregation, equipment and variant identity, method, operator, instrument identity/resolution/calibration status, condition, limitations, and protocol version. Nominal catalog specifications are never overwritten by measured specimen reality. Repetition is classified by operator and instrument relationship rather than evaluator-independence terminology.

The construct evidence map covers all 13 Protocol v1.1 dimensions plus relevant physical/catalog properties. Source roles are candidates for future empirical validation, not scientific conclusions. Measurements never directly assign swing demand, control, forgiveness, or sweet-spot values. Field observations remain player-context evidence, and modeled estimates must retain model/version, input lineage, uncertainty, training scope, and distribution warnings.

Corroboration remains categorical and noncausal. Conflicting evidence is preserved and routed to methodological review rather than averaged. Construct lifecycle supports later redefinition, redundancy review, or retirement, but Ticket #063 retires nothing.

```cmd
pnpm equipment:dna:multi-source-evidence-strategy
pnpm equipment:dna:physical-measurement-feasibility
pnpm equipment:dna:physical-measurement-pilot -- --equipment=<baseline-id> --compare=<comparison-id>
```

The pilot plan proposes only methods and trial counts. It records no measurements and creates no Atlas session or evidence.

### Physical Measurement Protocol v1.0

Ticket #064 operationalizes specimen-specific `actual_mass`, `overall_length`, `balance_point`, `barrel_diameter`, and `handle_diameter` observations. It preserves every raw trial and original unit alongside a deterministic median, instrument and operator provenance, physical identity verification, specimen condition, deviations, and calibration-pending repeatability metrics.

Catalog values remain nominal facts and are never overwritten. Confirmed packets create immutable `objective_measurement` evidence atomically and idempotently. Physical measurements cannot create behavioral ordinals, numeric behavioral references, live Equipment DNA, compatibility changes, or recommendation changes. The non-engineer procedure is documented in `docs/physical-measurement/ninery-physical-measurement-protocol-v1.0.md`.

Ticket #065 adds `circumference_derived_diameter` and `circumference_derived_outer_diameter` as explicit alternatives to the unchanged direct-caliper methods. Operators enter circumference trials only. The system derives diameter from the median with `Math.PI`, preserves the original unit and trials, and marks the result as a non-independent deterministic derivation. Prepare remains direct-caliper by default; alternate methods require explicit `--barrel-method=circumference-derived` or `--handle-method=circumference-derived` selection.

Ticket #065A defines exact-replay semantic equality for physical measurements. PostgreSQL JSON key ordering is ignored, while all evidence identity, date, unit, method, trial, specimen, operator, instrument, surface/location, and derivation content remains strict. `pnpm equipment:physical-measurement:status -- --file=<packet>` verifies create/unchanged/conflict disposition without writing.

Development commands:

```bash
pnpm equipment:behavioral-evaluation:anchor-readiness
pnpm equipment:behavioral-evaluation:anchor-inventory
pnpm equipment:behavioral-evaluation:anchor-validation
```

These commands are read-only. They do not create canonical evaluations, numeric references, live recommendation inputs, APIs, UI, or migrations.
## API Endpoints

The API app exposes:

- `GET /equipment/:equipmentId/dna`
- `GET /equipment/variants/:variantId/dna`
- `GET /equipment/:equipmentId/dna/explanations/:attribute`
- `GET /equipment/eligible`
- `GET /equipment/:sourceEquipmentId/compare/:targetEquipmentId`

Catalog access and internal draft access are distinguished with the `includeDraft=true` option.

## Rawlings ICON Demo Fixture

`rawlingsIconDemoFixture` documents the development profile target:

- Rawlings ICON 2026 USA
- 30 inch, drop 8
- feedback: light swing, good pop, large sweet spot, no known complaints
- comparable models: Easton Hype Fire, Louisville Slugger Atlas

The fixture does not invent manufacturer specifications or unsupported claims.

## Compatibility Engine

The future Compatibility Engine will consume normalized Equipment DNA together with Player DNA. It should use:

- mapped scores
- missing characteristics
- evidence confidence
- fit profiles
- variant details
- eligibility reasons

## Local Supabase Workflow

No schema changes are required by this package. If Prisma Client is stale, run:

```bash
pnpm --filter @ninery/database prisma:generate
```

## MVP Limitations

- variant-level adjustments are not implemented yet
- evidence confidence is deterministic but intentionally conservative
- public/internal access is represented by `includeDraft`; full authorization is future API work
- repository tests use deterministic mocks, not external APIs

## Evidence Read Model

`buildEquipmentDNAEvidenceReadModel()` assembles a read-only, provenance-aware inventory from catalog facts and persisted evidence. It preserves the Ticket #063 classes `verified_catalog_fact`, `direct_physical_measurement`, `controlled_mechanical_test`, `structured_human_evaluation`, `structured_field_observation`, and `modeled_estimate` as separate buckets, including explicit empty buckets.

Variant catalog specifications and physical specimen observations remain separate claims. Physical records retain specimen, session, protocol, method, operator, raw observation, normalized representation, deterministic derivation, quality, and limitations. Circumference-derived diameter is explicitly derived and not an independent measurement.

Construct support reuses `equipmentDNAConstructEvidenceMap`. States are `no_evidence`, `single_source_support`, `multiple_source_support`, `mixed_evidence`, and `review_required`. They describe inventory only, not truth, confidence, causality, or synthesis readiness. Catalog/specimen comparisons remain descriptive and use no invented materiality threshold.

Catalog/specimen relationship comparison normalizes mass to grams and length/diameter to millimeters with the existing deterministic physical-unit converter. Strict numeric equality after conversion yields `consistent_or_no_material_difference`; any nonzero difference remains `descriptive_difference`. No epsilon, tolerance, percentage, rounding, or materiality assumption is applied.

```cmd
pnpm equipment:dna:evidence -- --equipment=<equipment-uuid> [--variant=<variant-uuid>] [--specimen=<specimen-reference>]
```

The existing Prisma schema is sufficient. The report creates no evidence, evaluations, modeled estimates, canonical values, numeric references, or recommendation inputs.

## Construct Synthesis Readiness

Ticket #067 adds a separate, read-only gate after evidence inventory. Availability remains expressed by the Ticket #066 support states; sufficiency uses `insufficient_evidence`, `emerging_evidence`, `review_required`, and `synthesis_eligible`. Policy state is independently versioned as `not_established`, `provisional`, or `established`.

Evidence roles are `direct_construct_evidence`, `supporting_context`, `calibration_evidence`, and `not_applicable`. Profiles derive these roles from the Ticket #063 construct evidence map. Record, session, source/evaluator, and independent-source counts remain distinct. Repeated sessions from one evaluator retain one independence group.

Current Protocol v1.1 profiles are version `1.0` and intentionally `not_established`; they cannot become synthesis eligible. Demand/control constructs treat structured human evaluation as primary candidate evidence. Response constructs retain controlled mechanical testing as primary and human evaluation as supporting. `usable_contact_region_breadth` and `centered_response_consistency` remain separate, and higher `response_degradation` continues to mean less forgiveness.

```cmd
pnpm equipment:dna:synthesis-readiness -- --equipment=<equipment-uuid> --variant=<variant-uuid> [--construct=<construct-id>]
```

Readiness performs no synthesis and creates no canonical value, numeric reference, modeled estimate, recommendation input, or database write.
