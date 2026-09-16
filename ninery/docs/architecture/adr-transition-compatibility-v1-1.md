# ADR: Transition Compatibility v1.1 Linear Interpolation Candidate

## Context

Ticket #035 blocked Transition Compatibility v1.0 promotion with `blocked_unstable_behavior`. Ticket #036 reproduced the instability around a minor `equipment.swing_effort 48 -> 50` perturbation and classified the primary cause as `PIECEWISE_THRESHOLD_DISCONTINUITY`. The recommended calibration package was `linear_interpolation`, with projected eligibility for extended shadow after implementation and validation.

## Decision

Add a separate `v1_1_linear_interpolation` candidate under `src/compatibility/transition/v1_1`. Do not modify v1.0. The candidate keeps v1.0 weights, bands, missing-input safeguards, reason thresholds, and shadow-only status, while replacing component step thresholds with piecewise-linear interpolation for length, weight, drop, balance, and swing-effort changes.

## Interpolation Approach

The interpolation curves are deterministic, bounded, monotonic, and traceable. They smooth the existing v1.0 threshold semantics instead of introducing learned curves. Swing-effort remains canonical demand: higher proposed effort can increase adjustment demand, and lower proposed effort may still create timing adjustment demand.

## Readiness Bounds

Readiness modifiers remain bounded with a minimum multiplier of `0.35`, maximum multiplier of `1.2`, maximum absolute demand reduction of `20`, maximum absolute demand increase of `12`, and neutral readiness of `60`. High readiness may reduce demand but cannot erase a material equipment change.

## Alternatives Considered

- Broaden bands: rejected because it would hide threshold instability rather than fix component demand.
- Change physical component weights: deferred because Ticket #036 identified moderate overlap but did not approve a concrete weight package.
- Promote v1.1 directly: rejected because synthetic validation is not enough for live recommendation use.

## Validation Result

The candidate reproduces the v1.0 swing-effort instability and materially reduces the v1.1 score jump. Boundary sweeps pass continuity and monotonicity checks. Missing current equipment and missing required experience readiness remain blocking. Same-equipment transition remains highly manageable but is not forced to 100.

The v1.1 analytical outcome is `approved_for_extended_shadow`. Live ranking use, live explanation use, and live recommendation use remain disabled.

## Consequences

v1.0 remains the production transition compatibility model. v1.1 is available only for diagnostics and extended-shadow validation. No database schema, persisted data, API route, public contract, web UI, BatMatch demo output, or live recommendation behavior changes.

## Remaining Blockers

Real-world outcome validation is still required before any promotion beyond extended shadow. Current-equipment familiarity is still missing and limits confidence. Physical overlap across length, weight, and drop should be reviewed in a future ticket before considering internal candidate use.
