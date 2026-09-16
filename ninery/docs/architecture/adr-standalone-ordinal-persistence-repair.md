Status: accepted for internal tooling

Ticket #055 repairs the persistence boundary between standalone physical bat evaluations and standalone absolute evidence synthesis.

## Context

Ticket #048 introduced standalone physical evaluation mode. The evaluator review already derived valid ordinal values from raw standalone observations. Ticket #051 persisted physical evidence, but the persistence path did not store the derived ordinal in `EquipmentDNAEvidenceRecord.normalizedValue`. Ticket #054 then correctly excluded those rows from standalone synthesis because persisted evidence appeared to have no standalone ordinal value.

## Decision

Confirmed standalone physical-evaluation commits now persist the derived ordinal into `normalizedValue` and record `derivedStandaloneOrdinal` plus `standaloneOrdinalPersistenceVersion` in `rawValue`.

Historical repair uses the same `deriveStandaloneCanonicalInterpretation()` helper as the prepare/review flow. Repair does not infer from summaries, canonical previews, numeric references, recommendations, or external anchors.

## Repair Scope

Eligible rows must be active structured physical evidence for the target equipment with:

- `evaluationMode: standalone` or `interpretationMode: standalone_absolute`
- real evidence provenance: `real_observation` or `real_structured_physical_evaluation`
- preserved raw dimensions using standalone observation vocabulary
- no existing conflicting `normalizedValue`
- a derived ordinal that passes the Equipment DNA attribute registry validator

Comparative `relative_only` rows remain ordinal-free and are never converted by this repair.

## Guardrails

The repair command requires `--confirm` for writes. Preview and validation commands write nothing. Repair updates only existing `EquipmentDNAEvidenceRecord` rows, creates no `EquipmentDNAAttributeEvaluation` rows, creates no numeric references, and does not change live recommendations, rankings, APIs, or UI behavior.

## Commands

- `pnpm equipment:physical-evaluation:standalone-ordinal-validation`
- `pnpm equipment:physical-evaluation:standalone-ordinal-repair-preview`
- `pnpm equipment:physical-evaluation:standalone-ordinal-repair -- --confirm`

After repair, run standalone synthesis and canonical validation before any separate canonical promotion workflow.
