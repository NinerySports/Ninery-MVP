# ADR: Real-World Equipment Catalog Onboarding v1.0

## Status

Accepted for internal development workflow.

## Context

Genuine transition studies can encounter equipment that is not yet in the Ninery catalog. Ticket #045 uses the 2023 DeMarini The Goods (-10) USA, target variant 30 in / 20 oz / -10, as the first validation product.

## Decision

Real-world equipment onboarding is a separate workflow from recommendation activation. It may create catalog identity, variant, specification, evidence, and supported canonical Equipment DNA evaluations, but it does not allow live recommendation ranking.

The existing Prisma schema is sufficient for v1.0:

- `Equipment` stores model identity and activation-blocking status.
- `EquipmentVariant` stores purchasable size/weight/drop variants.
- `EquipmentSpecification` stores structured catalog facts.
- `EquipmentDNAEvidenceRecord` stores source, method, raw value, normalized value, provenance, and status.
- `EquipmentDNAAttributeEvaluation` stores supported canonical evaluations linked to evidence.

No migration is required for Ticket #045.

## Evidence Hierarchy

Evidence is classified as manufacturer specification, retailer product specification, structured internal evaluation, physical equipment verification, observational evidence, derived internal reference, or unknown/unverified. These domain classifications are mapped onto the existing Prisma evidence enum while preserving the original classification in notes/provenance.

Objective specifications can support physical canonical evaluations. Qualitative claims can be retained as evidence, but they do not become exact numeric references.

## Unknown Policy

Unknown remains a valid state. The workflow must not convert unknown attributes to 0, 50, copied values, similar-model values, or fabricated ordinal values.

## Conflicting Evidence

Conflicting evidence is preserved and reported. The workflow does not silently choose a favorable claim or average qualitative statements into numeric precision.

## Numeric Reference Policy

Numeric references are allowed for objective specifications such as length, weight, drop, and barrel diameter. Qualitative claims such as light swing weight or large sweet spot may inform future review, but they do not create exact numeric references.

## Promotion Boundary

Catalog presence is not recommendation readiness. Recommendation readiness is not genuine-study readiness. Genuine-study readiness is not live recommendation activation. Newly onboarded equipment remains `coming_soon` and activation-blocked until a future promotion ticket explicitly changes that boundary.

## DeMarini v1.0 Outcome

The 2023 DeMarini The Goods (-10) USA can be represented with its 30/20 variant and objective specifications. Required behavioral Equipment DNA attributes remain unresolved because Ticket #045 provides no measured or structured behavioral evidence for swing effort, forgiveness, sweet spot support, or bat control support.
