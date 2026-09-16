# ADR: Transition Compatibility Stability Diagnostics

## Context

Ticket #035 blocked `transition_compatibility` promotion with outcome `blocked_unstable_behavior`. Ticket #036 diagnoses the reproduced instability without changing the approved v1.0 model.

## Diagnostic Evidence

The diagnostics reproduced one failed minor perturbation: `equipment.swing_effort 48 -> 50` moved the score from `95.97` to `78.41`, flipped the band, and changed reason selection. The primary cause is piecewise threshold discontinuity. The analysis also found moderate physical-component overlap and three correctly blocked incomplete-context evaluations caused by missing `experienceReadiness`.

## Decision

The stability conclusion is `stable_after_threshold_calibration`. The recommended analytical package is `linear_interpolation`.

## Blockers

- Piecewise demand thresholds create sharp score jumps near boundaries.
- Current-equipment familiarity is still absent and limits confidence.
- Physical change components have moderate overlap.

## Consequences

The production v1.0 transition compatibility model remains unchanged and blocked from promotion. A future implementation ticket may test threshold smoothing or linear interpolation as a v1.1 candidate.

## Deferred Work

Implement no production changes until a later ticket defines, tests, and validates a calibrated model. Capture current-equipment familiarity and review mass/drop overlap before any live ranking use.
