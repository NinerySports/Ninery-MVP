# Equipment DNA Multi-Source Evidence Strategy

## Status

Accepted for Ticket #063 as a read-only strategy foundation.

## Decision

Ninery will select the strongest appropriate evidence for each claim instead of treating structured physical evaluators as the sole production source. Verified catalog facts, direct measurements, controlled mechanical tests, human observations, field observations, and modeled estimates answer different questions and remain distinguishable.

Objective measurement does not automatically replace perception. Human observation does not automatically establish physical fact. Field experience remains player-specific. Modeled estimates remain explicitly labeled inference and preserve model identity, version, input evidence, uncertainty, training scope, and distribution warnings.

Raw physical measurements and raw units are always retained, including individual trials. A normalized unit may be stored alongside them using a versioned deterministic conversion. Measured specimen reality never overwrites nominal manufacturer specifications.

Measurement repetition is described by operator and instrument relationships. It does not reuse human evaluator-independence terminology. A trained repeat operator can improve procedural consistency and cross-equipment comparability, while reports must still disclose operator bias, learning, fatigue, and lack of population representation.

Evidence synthesis reports corroboration and conflict without blindly averaging or discarding a source. Directional correlation does not establish causation. Controlled exit response does not automatically equal forgiveness or sweet spot, and mass, balance point, or construction do not directly assign behavioral Equipment DNA.

Constructs serve the intelligence system. Lifecycle states allow future support, redefinition, redundancy review, or retirement when evidence warrants it; no construct is retired by this decision.

## Current Data Model

`EquipmentDNAEvidenceRecord` already supports the strategy without migration:

- `manufacturer_specification` represents verified catalog facts.
- `objective_measurement` plus `instrument_measurement` can represent direct measurement and controlled mechanical test records.
- `structured_expert_evaluation` represents structured human evaluation.
- `field_observation` and feedback source types represent structured field observations.
- `internal_derived` plus `derived_mapping` represents modeled estimates.
- `rawValue` preserves method-specific provenance, trials, instruments, uncertainty, model lineage, and context.

Future persistence code must validate those metadata contracts before activation. Ticket #063 adds no records, schema, or migration.

## Consequences

The strategy reduces dependence on recruiting many evaluators without pretending every construct is directly measurable. It enables low-cost physical measurement planning while retaining human evaluation where experienced behavior matters. Production promotion, predictive models, mechanical protocols, and consumer UI remain future work.
