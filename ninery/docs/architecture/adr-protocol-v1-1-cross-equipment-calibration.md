# Protocol v1.1 Cross-Equipment Calibration

## Status

Accepted for Ticket #062 as a read-only protocol-development framework.

## Decision

Equipment evidence independence and protocol participation are separate classifications:

- `equipmentEvidenceRelationship` answers whether an evaluator has prior qualifying sessions for one equipment ID. Its values remain `independent_evaluator` and `repeat_evaluator`.
- `protocolParticipationRelationship` answers whether that evaluator has participated anywhere in the genuine Protocol v1.1 calibration program. Its values are `first_protocol_participation` and `repeat_protocol_participant`.

An evaluator can simultaneously be `independent_evaluator` for Equipment B and `repeat_protocol_participant` for the broader program. This is expected, not contradictory. Equipment-level source counts must never be replaced with protocol participant counts.

## Archetypes And Contrast

Calibration archetypes are derived from existing catalog identity and specifications. Contrast uses only construction, certification, length, weight, drop, material, and barrel diameter where available. It produces a categorical experimental-design classification, never a numeric score, product ranking, Equipment DNA value, or performance inference.

## Generalization Boundary

Only genuine Protocol v1.1 records classified as `protocol_calibration_evidence` with `real_protocol_calibration_observation` provenance count. Protocol v1.0 evidence, comparative Omaha evidence, synthetic fixtures, and catalog-only candidates do not count.

A second represented equipment model starts cross-equipment calibration but does not establish support or validation. The framework defines a future comparison contract for construct coverage and interpretability, not for deciding which bat is better.

## Persistence

The framework is a derived read model over existing catalog and evidence records. No Prisma schema, migration, evidence write, canonical evaluation, numeric reference, or recommendation change is required.
