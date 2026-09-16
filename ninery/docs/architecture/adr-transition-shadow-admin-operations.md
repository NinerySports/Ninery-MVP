# ADR: Transition Extended-Shadow Internal Operations

## Status

Accepted for service-and-CLI internal operations.

## Context

Ticket #038 created persistent extended-shadow prediction and observation data. Ticket #039 needs internal workflows for operating that program, but the repository does not yet include authenticated internal web administration or protected internal API conventions.

## Decision

Use `service_and_cli_only` delivery mode. Add pure domain services for authorization, eligibility, lifecycle operations, audit events, checkpoint review, completion review, operational summaries, and language guardrails. Do not add public routes, unsecured admin routes, or public UI.

No Prisma schema change is required. The existing `PlatformEvent` model can store minimized transition-shadow admin audit events with `entityType = "TransitionShadowAdminAudit"`. Service tests use an in-memory repository to verify lifecycle behavior without requiring database access.

## Guardrails

- Transition Compatibility v1.0 remains unchanged.
- Transition Compatibility v1.1 remains extended-shadow only.
- Admin operation authority is separate from model authority.
- Missing or inactive actors fail closed.
- Invalidation requires stronger capability than observation entry.
- Prediction snapshots remain immutable after capture.
- Observations remain attributable and conflicting observations are retained.
- Development fixtures remain distinct from genuine observations.
- Reports do not calculate model accuracy or recommend live promotion.

## Consequences

Internal operators can use service and CLI/report surfaces safely while Ninery lacks secure admin UI/API infrastructure. Ticket #040 can add protected routes or screens only after authenticated internal access patterns exist.
