# ADR: Confidence Building Split

Status: Approved with future work

## Context

The legacy `confidenceBuilding` score is used by `CONFIDENCE_BUILDING_FIT` and can also affect `DEVELOPMENT_GOAL_FIT` when the player's primary goal is `build_confidence`. Ticket #028 showed that this field accounts for residual score variance when the canonical numeric-reference candidate omits unsupported optional signals.

The concept mixes equipment behavior with a player-specific psychological and developmental response. A bat may provide predictable feedback, but it should not be represented as causing confidence by itself.

## Decision

The legacy confidence-building concept will be split.

Equipment Intelligence will own a future equipment-side concept, initially named `predictability_support`: stable, understandable, and repeatable performance feedback across typical swings and contact outcomes.

Compatibility Intelligence will own a future player-side concept, `confidence_compatibility`: how the equipment's behavior aligns with a specific player's skill, experience, development needs, confidence indicators, and current equipment context.

## Alternatives Considered

- Directly migrate `confidenceBuilding` to `confidence_building_potential`.
- Keep the current mixed signal as an intrinsic product fact.
- Retire the signal entirely and rely only on forgiveness and sweet spot support.

## Consequences

The legacy field remains authoritative only in the current live recommendation path. It must not be copied into canonical candidate inputs as a hidden compatibility score.

Parent-facing language should distinguish equipment predictability from player confidence support and must not guarantee psychological outcomes.

## Migration Implications

Preserve `confidenceBuilding` for historical reproducibility, deprecate it for future canonical use, and replace it with a split model. Direct value migration is blocked.

## Deferred Work

- Define and register `predictability_support`.
- Design `confidence_compatibility`.
- Decide how lower-level attributes such as forgiveness, barrel stability, feedback consistency, and swing effort contribute without double counting.
