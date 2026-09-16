# Real-World Equipment Onboarding Operator Guide

Use this workflow when a genuine player workflow references a bat that is not yet in the catalog.

## Commands

- `pnpm equipment:onboarding:prepare`
- `pnpm equipment:onboarding:validate`
- `pnpm equipment:onboarding:show`
- `pnpm equipment:onboarding:evidence`
- `pnpm equipment:onboarding:readiness`
- `pnpm equipment:onboarding:commit -- --confirm`

Read-only commands perform no writes. Commit requires `--confirm`.

## Adding The Next Bat

Create an onboarding packet with:

- manufacturer, model, model year, certification, barrel diameter, construction, material, product identifier
- real variants only, with listed length, weight, and signed drop
- evidence records with source type, source reference, raw value, normalized value when supported, method, and notes

Do not add performance values unless evidence supports them. Claims such as balanced, easy swinging, forgiving, or large sweet spot are stored as claims, not objective measurements.

## Operator Checks

Before commit:

- identity is unambiguous
- variant exists as a real product size
- objective specification evidence supports physical attributes
- unsupported behavioral attributes remain unresolved
- no conflicting evidence is hidden
- live recommendation activation remains blocked

After commit:

- rerun `pnpm equipment:onboarding:readiness`
- rerun Ticket #044 first-study readiness manually when evaluating a genuine transition study
- do not start a genuine study unless the Ticket #044 workflow reports readiness
