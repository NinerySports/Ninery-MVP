# ADR: Comparative Relative Evidence Interpretation

## Status

Accepted for Ticket #050.

## Context

The first real DeMarini The Goods versus Louisville Slugger Omaha physical session produced complete structured comparative observations, but the Omaha is a verified external reference with no Ninery catalog authority and no approved canonical Equipment DNA baseline. Requiring the operator to supply an absolute ordinal would turn relative evidence into an unsupported canonical claim.

## Decision

Comparative physical observations are first-class evidence even when canonical interpretation is deferred. Complete comparative sessions now record `relative_only` interpretation when no approved reference-anchored inference policy exists.

Relative-only evidence preserves:

- target equipment and variant identity
- reference type, identity, specifications, and limitations
- comparison rubric observations
- trial counts and evaluator confidence
- protocol, rubric, and reference-comparison versions
- `canonicalInterpretationStatus: deferred`

Relative-only evidence does not create:

- canonical ordinal values
- 0-100 numeric references
- active canonical evaluations
- live recommendation changes

## Reference Anchoring

`reference_anchored` remains a future policy option. It should be used only when the reference equipment has an approved canonical baseline and a deterministic inference policy supports the translation from relative observations to absolute Equipment DNA. Ticket #050 does not implement that derivation.

## Ticket #046 Integration

The behavioral evaluator can now recognize clean structured relative-only evidence as directional support while still reporting `insufficient_evidence` for absolute canonical Equipment DNA. This lets the evidence inventory remain honest: the observation exists, but the canonical ordinal is unresolved.

## Consequences

The DeMarini/Omaha session can prepare four evidence records without fabricated ordinals. Future comparative sessions that disagree can coexist as evidence and be handled by conflict policy later. Standalone mode is unchanged because it already uses an approved absolute categorical observation path.
