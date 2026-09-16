# ADR: Physical Evaluation Evidence Persistence

## Status

Accepted for Ticket #051.

## Context

Tickets #047 through #050 created a structured physical bat evaluation workflow that can prepare evidence for real sessions, including relative-only comparative evidence with deferred canonical interpretation. The missing step was controlled persistence into the existing Equipment DNA evidence store.

## Decision

Confirmed physical-evaluation commits persist records into `equipment_dna_evidence_records` only. They do not create `EquipmentDNAAttributeEvaluation` rows, numeric references, canonical ordinals, recommendation inputs, or live scoring changes.

The persistence identity is deterministic:

- target equipment
- target variant
- attribute key
- attribute definition version
- source type
- method
- source reference

For physical sessions, the source reference is `physical-bat-evaluation:<evidence-output-version>:<sessionId>:<attributeKey>`. Repeating the same confirmed commit updates or no-ops the existing logical evidence instead of creating duplicate records. A different session uses a different source reference and remains distinct evidence, even if its observations conflict.

## Atomicity

The commit path runs inside a Prisma transaction. A valid DeMarini/Omaha commit persists all four evidence records or fails clearly without partial promotion.

## Provenance

Persisted evidence preserves the physical session payload: target identity, variant, verification, condition, evaluation mode, interpretation mode, deferred canonical status, reference identity/specs/condition/limitations, comparison observations, evaluator safe identifier, evaluator category, evaluator confidence, trial counts, protocol/rubric versions, evaluation date, limitations, and notes.

## Guardrails

No-confirm commits write nothing. Development or synthetic fixtures cannot be committed as real evidence. Blocked sessions, damaged targets, invalid references, incomplete evidence, or contaminated sessions fail closed.

## Downstream Consumption

Ticket #046 behavioral evaluation can inventory persisted relative-only physical evidence and report directional evidence exists while still leaving the absolute canonical attribute unresolved. This preserves the boundary between evidence persistence and later canonical Equipment DNA promotion.
