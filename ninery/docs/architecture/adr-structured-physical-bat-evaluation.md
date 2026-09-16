# ADR: Structured Physical Bat Evaluation Protocol v1.0

## Status

Accepted for Ticket #047.

## Context

The DeMarini The Goods 2023 USA 30/20 variant is catalog/specification ready, but four behavioral Equipment DNA attributes remain unresolved: `swing_effort`, `forgiveness`, `sweet_spot_support`, and `bat_control_support`. Ticket #046 can consume legitimate behavioral evidence, but it must not consume Jackson Pilot Study outcomes or fabricated values.

## Decision

Ninery will use a reusable Structured Physical Bat Evaluation Protocol v1.0 in `@ninery/equipment-intelligence`. The protocol validates physical identity, records condition, evaluator category, reference bats, trial counts, structured rubric responses, raw observations, limitations, and provenance. Completed attribute protocols emit #046-compatible `structured_internal_equipment_evaluation` evidence records.

No Prisma schema change is required for Ticket #047. The existing evidence model can represent the resulting evidence packet, and persistence is intentionally not automatic because there is no real completed DeMarini evaluation yet.

## Guardrails

- Evaluators cannot enter arbitrary 0-100 canonical scores.
- Damaged bats block behavioral evidence output.
- Player-specific, Pilot Study, retrospective transition, and recommendation claims are blocked.
- Same-evaluator repeats are repeatability evidence, not independent confirmation.
- Reference comparisons remain qualitative unless a future approved mapping supports numeric conversion.
- No sensor claims are made without actual sensor data.

## Consequences

The DeMarini is ready to undergo structured physical evaluation, but it remains behaviorally incomplete, not canonical profile ready, not genuine-study ready, and not live recommendation eligible until real structured evidence is collected and reviewed.
