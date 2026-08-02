# @ninery/equipment-intelligence

Equipment DNA is an evidence-based equipment profile, not a guarantee of performance for every player.

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
