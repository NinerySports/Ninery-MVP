# ADR: Transition Compatibility

Status: Approved with future work

## Context

The legacy `transitionFriendliness` score is used by `TRANSITION_READINESS_FIT` and can affect `DEVELOPMENT_GOAL_FIT` when the player's primary goal is `prepare_for_transition`. It can also influence alternative labeling through high transition-readiness dimensions.

The existing canonical registry key is `transition_difficulty`, which is semantically inverse to `transitionFriendliness`. Ticket #028 showed the legacy field accounts for residual variance, but transition is not a universal product-level fact.

## Decision

Future transition ownership belongs to Compatibility Intelligence as `transition_compatibility`.

`transition_compatibility` means the expected adjustment demand when a specific player moves from their current equipment to a proposed equipment setup. It requires current equipment, proposed equipment, and player context.

Product-level transition evaluations are not approved. High legacy transition friendliness means low transition difficulty, but a simple numeric inversion is not the future canonical solution.

## Alternatives Considered

- Invert `transitionFriendliness` into `transition_difficulty`.
- Preserve a product-level transition score for score parity.
- Retire transition from future recommendations.

## Consequences

Transition can remain useful, but only as a player-relative calculation. Future work should define components such as size change demand, mass change demand, drop change demand, balance change demand, swing effort change demand, construction change demand, and experience adjustment demand.

## Migration Implications

Preserve `transitionFriendliness` for historical recommendation reproducibility. Deprecate it as an Equipment DNA field. Do not migrate it into product-level canonical evaluations.

## Deferred Work

- Design the `transition_compatibility` model.
- Define required current-equipment and player-context inputs.
- Relocate or deprecate `transition_difficulty` after a replacement exists.
