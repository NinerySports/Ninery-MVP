# ADR: Transition Compatibility Promotion Readiness

## Context

`transition_compatibility` is a player-relative shadow model that compares a player's current bat to a proposed bat using Player DNA readiness and canonical Equipment DNA specifications and numeric references. Ticket #035 validates promotion readiness without changing live recommendations.

## Validation Evidence

The synthetic matrix completed 15 of 18 transition evaluations. The incomplete-context player blocks where required current/player context is absent, which is expected fail-closed behavior. Transition compatibility shows useful score separation across equipment, player/equipment differentiation, safe missing-input behavior, language safety, and moderate double-counting risk. Stability review currently blocks promotion.

## Decision

Transition Compatibility remains shadow-only with promotion outcome `blocked_unstable_behavior`.

## Blockers

- Stability review reports excessive movement under minor perturbation.
- Current-equipment familiarity is still missing and limits confidence.
- Real-world transition outcome validation has not been collected.

## Consequences

The model is not approved for live ranking, live explanation, extended-shadow promotion, or internal-candidate ranking use in Ticket #035.

## Deferred Work

Collect current-equipment familiarity, review minor-perturbation thresholds, validate against more transition scenarios, and evaluate it as a replacement candidate for legacy transition readiness rather than an additive dimension.
