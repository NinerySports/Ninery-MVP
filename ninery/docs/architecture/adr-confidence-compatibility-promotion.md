# ADR: Confidence Compatibility Promotion Readiness

## Context

`confidence_compatibility` is a player-relative shadow model that uses Player DNA support needs and canonical Equipment DNA support signals. Ticket #035 validates whether it is ready for broader use without changing live recommendations.

## Validation Evidence

The synthetic matrix completed 18 of 18 confidence evaluations across six deterministic player profiles and three demo bats. The current demo validation found low equipment score separation, limited player/equipment differentiation, high double-counting risk with existing forgiveness, bat-control, sweet-spot, and development dimensions, and a stability blocker under minor perturbation checks.

## Decision

Confidence Compatibility remains shadow-only with promotion outcome `blocked_unstable_behavior`.

## Blockers

- Stability review reports excessive movement under minor perturbation.
- Average per-player score range is low.
- Double-counting risk is high if added as an independent weighted ranking dimension.

## Consequences

The model may continue to be inspected internally, but it is not approved for live ranking, live explanation, extended-shadow promotion, or internal-candidate ranking use in Ticket #035.

## Deferred Work

Review score compression, improve stability around threshold behavior, resolve overlap as a replacement candidate rather than an additive dimension, and collect real-world outcome validation.
