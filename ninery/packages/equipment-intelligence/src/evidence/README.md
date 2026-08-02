# Equipment DNA Evidence and Evaluations

Ticket #020 adds provenance infrastructure for canonical Equipment DNA attributes. It is additive and does not change current 0-100 DNA scores, recommendation scoring, ranking, BatMatch behavior, API contracts, or web UI.

## Evidence vs Evaluation

Evidence records preserve source material:

- source type and source name
- raw and normalized values
- method used to collect or evaluate the value
- source date and retrieval date
- evaluator metadata
- active, superseded, disputed, or withdrawn status

Attribute evaluations are Ninery's current conclusion for one canonical attribute value. An active evaluation must have a valid registry key, valid value, correct equipment or variant level, active supporting evidence, and a non-empty rationale.

## Confidence Is Not Product Quality

`EquipmentAttributeConfidence` describes reliability of an attribute evaluation only:

- `validated`
- `high`
- `moderate`
- `estimated`

It does not describe product quality, recommendation strength, purchase satisfaction, or the probability that a player will improve.

Confidence model version: `1.0`

## Maturity vs Recommendation Readiness

Maturity describes the profile's evidence depth:

- `basic`
- `evaluated`
- `validated`
- `trusted`
- `living_intelligence`

Readiness describes whether required Ticket #019 attributes are valid, supported, current, conflict-free, and above the minimum confidence threshold.

Readiness model version: `1.0`

## Equipment Level vs Variant Level

Ticket #019 owns applicable level metadata. Ticket #020 validation rejects records attached to the wrong level:

- `length`, `weight`, and `drop` are variant-level
- `certification`, `barrel_diameter`, and evaluated behavior attributes are equipment-level

Records are never silently relocated from equipment to variant or variant to equipment.

## Lifecycle

The intended lifecycle is:

```text
draft evaluation
  -> registry/value/level validation
  -> evidence attached
  -> confidence assessed
  -> active evaluation
  -> superseded evaluation when a new version replaces it
```

Active and superseded evaluations are historical records and should not be physically deleted through normal service behavior.

## Conflict Handling

Conflict detection is deterministic. It detects disputed evidence, material enum differences, numeric differences outside tolerance, materially different ordinal values, and conflict with the current active evaluation. Material conflict prevents automatic activation and limits confidence to `estimated`.

## Recommendation Readiness

The readiness assessor uses `getRequiredEquipmentDNAAttributeDefinitions()` from Ticket #019.

Minimum confidence thresholds:

- objective physical specifications require at least `high`
- evaluated behavior attributes require at least `moderate`
- `estimated` required values do not pass readiness
- experimental relational attributes are ignored for readiness

This assessor does not block or alter the current recommendation engine in Ticket #020.

## Ticket #021 Handoff

Ticket #021 should create product-specific recommendation-ready profiles by recording real evidence and active evaluations for the required attributes. It should not infer `validated`, `trusted`, or `living_intelligence` maturity without evidence that qualifies under the confidence and maturity rules.
