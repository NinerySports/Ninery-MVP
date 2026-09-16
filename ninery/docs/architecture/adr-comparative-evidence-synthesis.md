# ADR: Comparative Evidence Synthesis

Status: accepted

Ticket: #052

## Context

Ticket #051 persists structured physical bat evaluation evidence as relative-only comparative records. The first real packet compares the 2023 DeMarini The Goods USA 30/20/-10 against a verified external 2023 Louisville Slugger Omaha USA 30/19/-11 reference.

The Omaha reference is useful for physical comparison, but it has no Ninery catalog authority, recommendation authority, or approved canonical Equipment DNA baseline. Therefore the system can summarize comparative agreement but must not infer absolute canonical ordinals or numeric references.

## Decision

Ninery now has a read-only comparative evidence synthesis layer in `@ninery/equipment-intelligence`. It:

- consumes persisted `structured_internal_equipment_evaluation` evidence with `interpretationMode: relative_only`
- groups evidence by behavioral attribute and rubric dimension
- treats evaluator identity as the independence key
- reports dimension agreement, conflicts, attribute comparative direction, consensus strength, and next evidence action
- keeps canonical interpretation deferred when the reference is unanchored

The synthesis output is attached to Ticket #046 behavioral evaluation reports and exposed through development commands:

```bash
pnpm equipment:behavioral-evaluation:synthesis
pnpm equipment:behavioral-evaluation:synthesis-validation
```

## Boundaries

This layer does not:

- create `EquipmentDNAAttributeEvaluation` rows
- write database records
- assign canonical ordinals
- assign 0-100 numeric references
- weaken recommendation-readiness rules
- activate live recommendation behavior
- change public APIs or web UI

## DeMarini / Omaha Interpretation

For DeMarini The Goods versus Omaha, synthesis may report directional consensus such as greater swing demand or less control support. Those conclusions remain comparative only. They are not absolute claims that DeMarini is `demanding`, `low_control_support`, or any other canonical ordinal.

## Consequences

Recommendation readiness remains conservative: directional physical evidence can reduce ambiguity for operators, but canonical behavioral attributes remain unresolved until an approved reference anchor or standalone absolute evidence policy supports canonical interpretation.
