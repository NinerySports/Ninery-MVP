# ADR: First Genuine Transition Study Readiness

## Status

Accepted for Ticket #044.

## Context

Ninery has the pieces required for genuine Transition Compatibility v1.1 extended-shadow studies: persisted study lifecycle, familiarity, canonical Equipment DNA context assembly, guarded operator tooling, observation checkpoints, audit reconstruction, and validation reports. Before the first genuine study, operators need one state-based preflight that says what is ready, what is blocked, and what legitimate next action should happen.

## Decision

Ticket #044 adds a service-and-CLI-only first-study readiness layer. The readiness service orchestrates existing domain services and policies. It does not score readiness, create a model, create studies, create observations, capture predictions, or write audit events.

The readiness result is state-based:

- `ready`
- `required_action`
- `warning`
- `blocked`
- `not_applicable`
- lifecycle states such as `complete` and `not_ready`

The service returns one deterministic next action, selected from operational workflow priority: authorization, player identity, equipment verification, Player DNA, Equipment DNA, familiarity, acknowledgement, observer plan, study creation, prediction capture, observation start, checkpoint entry, and completion review.

## Consequences

Readiness remains separate from Transition Compatibility v1.1 model logic. The operator can run preflight before creating a study or against an existing study without fabricating genuine evidence. Observer planning records source roles and checkpoints only; it does not collect unnecessary human PII and does not influence model scoring.

No Prisma schema change is required. The first-study readiness layer derives state from existing records and services.

## Guardrails

- No public API.
- No web UI.
- No recommendation scoring change.
- No calibration.
- No model promotion.
- No live recommendation behavior change.
- No genuine evidence created by readiness reports.
