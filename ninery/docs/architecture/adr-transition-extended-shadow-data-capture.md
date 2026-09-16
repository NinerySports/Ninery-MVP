# ADR: Transition Extended Shadow Data Capture

## Status

Accepted for development fixtures.

## Context

Transition Compatibility v1.1 is approved for extended shadow observation only. Ninery needs persistent data capture for predictions, familiarity context, structured observations, and descriptive outcome comparison without changing live recommendation behavior.

## Decision

Add additive Prisma tables for current equipment familiarity, transition extended-shadow studies, and transition extended-shadow observations. The study stores immutable-shaped Transition v1.1 prediction snapshots with input and prediction hashes. Observations are structured checkpoints with source, confidence, context, and fixture labeling.

The extended-shadow comparison reports descriptive alignment only. It never recommends a model change or live promotion.

## Guardrails

- Transition v1.0 remains the production path.
- Transition v1.1 remains shadow-only.
- Development fixtures are labeled `development_fixture`, `synthetic_observation`, and `not_real_world_evidence`.
- Observations must not claim causation, medical/psychological state, or proof that a model is correct.
- Invalidated studies remain available for audit but are not treated as evidence of alignment.

## Commands

```powershell
pnpm transition:extended-shadow:seed
pnpm transition:extended-shadow:report
pnpm transition:extended-shadow:validation
```

## Consequences

The repository can now collect reproducible, auditable shadow observations for Transition v1.1. Later work may add reviewer workflows or calibration analysis, but Ticket #038 intentionally does not tune formulas, weights, thresholds, public APIs, routes, or UI.
