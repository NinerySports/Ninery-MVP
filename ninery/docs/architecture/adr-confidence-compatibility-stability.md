# ADR: Confidence Compatibility Stability Diagnostics

## Context

Ticket #035 blocked `confidence_compatibility` promotion with outcome `blocked_unstable_behavior`. Ticket #036 diagnoses the reproduced instability without changing the approved v1.0 model.

## Diagnostic Evidence

The diagnostics reproduced one failed minor perturbation: `equipment.forgiveness 80 -> 82` moved the score from `86.58` to `69.38`, flipped the band, and changed reason selection. The matrix also showed low equipment separation, six near-tie scenarios, and high overlap with existing Recommendation Intelligence components.

## Decision

The stability conclusion is `explanation_only_recommended`. The recommended analytical package is `explanation_only`.

## Blockers

- Low equipment separation makes ranking interpretation fragile.
- High component overlap creates double-counting risk.
- The reproduced perturbation shows score, band, and reason instability.

## Consequences

The production v1.0 confidence compatibility model remains unchanged and blocked from promotion. Any explanation-only use mode requires a later implementation ticket and validation pass.

## Deferred Work

Analyze reduced-overlap weights, stronger predictability focus, and replacement-for-legacy-confidence use modes. Do not add confidence compatibility as an independent live ranking dimension.
