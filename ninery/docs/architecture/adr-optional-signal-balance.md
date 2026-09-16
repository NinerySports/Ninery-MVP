# ADR: Optional Signal Balance

Status: Approved with future work

## Context

Tickets #019 through #028 introduced canonical Equipment DNA attributes, evidence-backed evaluations, numeric references, candidate shadow runs, and residual analysis. Ticket #028 showed that the legacy `balance` score accounts for part of the remaining variance between the legacy authoritative recommendation path and the numeric-reference-aware canonical candidate.

The current engine uses `scores.balance` in `SWING_FEEL_BALANCE_FIT`, comparing it with the player's preferred swing feel. That makes the current use partially relational even though balance has a defensible equipment-intrinsic meaning.

## Decision

`balance` will remain an Equipment Intelligence concept as `balance_profile`.

The future canonical meaning is the distribution of mass along the bat and the resulting tendency for the barrel to feel more balanced or more end-loaded during movement. It is an evaluated-intrinsic equipment characteristic.

Future numeric-reference policy may support a `0_100` scale where `0` means most balanced and `100` means most end-loaded, but the current legacy direction appears support-oriented or inverse. Existing seeded legacy values must not be treated as canonical numeric references without direction validation and evidence-backed conversion.

## Alternatives Considered

- Preserve legacy `balance` directly for score parity.
- Treat balance as compatibility-only because the current engine compares it to player preference.
- Retire balance and rely only on swing effort.

## Consequences

Balance can become both an Equipment DNA input and a player-preference compatibility input later. It must not independently determine whether a bat is good or bad.

Manufacturer marketing terms alone are insufficient for validated confidence. Objective balance-point, center-of-mass, standardized swing-balance measurement, or combined evidence is preferred.

## Migration Implications

Preserve legacy `balance` for historical reproducibility. Direct migration is conditional and requires direction confirmation, ordinal consistency validation, and supporting evidence.

## Deferred Work

- Implement Balance Profile Numeric Reference.
- Define conversion from legacy balance to canonical balanced-to-end-loaded direction if legacy data is reused.
- Add evidence-backed balance evaluations.

## Implementation Note: Ticket #030

Ticket #030 audited the live engine usage and confirmed inverse conversion for legacy-derived balance references. Current scoring treats higher legacy `balance` values as closer to balanced/light-feel support, while the canonical numeric direction is `0 = most balanced` and `100 = most end-loaded`.

The approved legacy-derived conversion is `canonical = 100 - legacy`, with `moderate` confidence and `legacy_preserved` provenance. These references are internal-derived and are not objective balance-point measurements.

The current demo database does not expose active canonical `balance_profile` attributes for the three BatMatch demo profiles, so balance-aware candidate selection remains blocked. No Prisma schema change or database write was required.
