# ADR: Standalone Evidence Synthesis and Controlled Canonical Promotion

Status: accepted for internal tooling

Ticket #054 adds a policy layer for interpreting independent standalone absolute physical bat evaluations. The policy is intentionally ordinal-only. It does not create 0-100 numeric references, it does not approve Omaha as a canonical anchor, and it does not change live recommendation scoring.

## Policy

Standalone evidence qualifies only when it is prospective, structured internal equipment evaluation evidence with `evaluationMode: standalone` or `interpretationMode: standalone_absolute`. Player-specific, Pilot Study, retrospective, synthetic, invalid, and numeric-reference evidence is excluded.

Two independent standalone sources with the same ordinal produce `single_ordinal_supported`. Adjacent ordinals produce `bounded_only` and require another evaluator. Wider disagreement produces `promotion_blocked_conflict`.

## Current DeMarini Interpretation

The current standalone evidence supports:

- `bat_control_support`: `moderate`, exact agreement, promotion candidate
- `forgiveness`: `low`, exact agreement, promotion candidate
- `swing_effort`: `moderate` to `demanding`, bounded only
- `sweet_spot_support`: `moderate` to `high`, bounded only

Comparative Omaha evidence may corroborate a bound, but it cannot create an absolute canonical ordinal because Omaha has no approved anchor authority.

## Commands

- `pnpm equipment:behavioral-evaluation:standalone-synthesis`
- `pnpm equipment:behavioral-evaluation:canonical-preview`
- `pnpm equipment:behavioral-evaluation:canonical-validation`
- `pnpm equipment:behavioral-evaluation:canonical-commit -- --confirm`

The commit command requires `--confirm`, runs transactionally, links promoted evaluations back to the source evidence records, and remains idempotent. It never activates live recommendation usage.
