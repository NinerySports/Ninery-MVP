# ADR: Transition Shadow Admin Workflow Verification

## Status

Accepted for deterministic internal workflow fixtures.

## Context

Ticket #039 created service-and-CLI-only Transition Extended-Shadow administration. Ticket #040 verifies those services by exercising complete administrative lifecycles through the service layer and checking minimized PlatformEvent audit coverage.

## Decision

Add deterministic Ticket #040 workflow fixtures for:

- happy-path completion
- cancellation
- invalidation
- unauthorized mutation rejection
- append-only observation correction
- prediction immutability
- duplicate active-study protection

The workflow exercise uses the Ticket #039 `TransitionShadowAdminService`; lifecycle mutations are not performed through direct database writes. Direct Prisma writes are limited to narrowly scoped cleanup of prior Ticket #040 fixture records and audit events before rerunning the deterministic exercise.

## Fixture Classification

Ticket #040 fixtures are labeled as `development_fixture`, `admin_workflow_fixture`, and `not_real_world_evidence`. They must never be counted as genuine field observations or real-world model validation evidence.

## Audit Architecture

Audit events use the existing `PlatformEvent` model with `entityType = "TransitionShadowAdminAudit"`. Payloads are minimized and include actor, role, capability, action, study identifier, fixture version, synthetic labels, reason when required, and small before/after summaries.

## Idempotency

Before each workflow exercise, the command deletes only studies whose `studyKey` contains `ticket-040-admin-workflow`, their observations, their familiarity records, and PlatformEvent audit rows for Ticket #040 fixture IDs/version. Genuine studies and Ticket #038 fixtures are not broadly deleted.

## Consequences

Ninery can now prove the internal extended-shadow workflow is executable and auditable before any admin UI exists. Transition Compatibility v1.1 remains extended-shadow only and is not promoted to live ranking, scoring, explanation, or recommendation use.
