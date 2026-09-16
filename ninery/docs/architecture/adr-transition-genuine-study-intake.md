# Transition Genuine Study Intake and Field Observation Protocol

Ticket #041 adds the internal operational path for collecting genuine Transition Compatibility extended-shadow evidence.

## Delivery Mode

The delivery mode remains `service_and_cli_only`. Ninery does not yet have a verified authenticated internal administration UI, so this ticket does not add public forms, parent portals, coach portals, public APIs, or web UI.

## Prisma Decision

No Prisma schema change is required. Existing `TransitionExtendedShadowStudy`, `CurrentEquipmentFamiliarityRecord`, `TransitionExtendedShadowObservation`, prediction snapshot JSON, and `PlatformEvent` audit payloads can represent the required intake snapshot, acknowledgement metadata, equipment verification metadata, observation records, and evidence registry derivation.

## Genuine Study Definition

A genuine transition study is a real equipment transition involving an actual player, actual current equipment, actual proposed equipment, an immutable Transition Compatibility v1.1 prediction captured before observation, and observations based on actual equipment use.

Synthetic fixtures, hypothetical recommendations, manually fabricated tests, simulated observations, and retrospective reconstructions are not genuine evidence.

## Acknowledgement Protocol

The acknowledgement is an internal operational acknowledgement. It is not represented as formal legal consent, clinical research consent, or statistical validation. It confirms that feedback is observational, used internally, does not change the stored prediction, and does not affect the current recommendation.

If the platform cannot reliably determine legal authority from family/guardian records, acknowledgement is classified as `internal_operational_authorization`.

## Eligibility Policy

Genuine intake requires:

- authorized internal operator
- genuine non-fixture player/equipment context
- verified current equipment and variant
- verified proposed equipment and variant
- proposed equipment expected and available for actual use
- current-equipment familiarity before prediction
- Player DNA sufficient for Transition v1.1
- participation acknowledgement
- no conflicting active study
- no known outcome before prediction
- evidence classification `genuine_internal_observation`

## Equipment Verification

Current equipment must be explicitly verified as the player's actual primary equipment. A prior recommendation alone is insufficient.

Proposed equipment must be verified as available, expected to be used, and size/specification matched.

## Observation Protocol

Checkpoints:

- `first_use`: after the first meaningful use
- `early_sessions`: after approximately 3-5 meaningful sessions
- `acclimation_period`: after approximately 2-4 weeks when actual use supports that timeframe

Observers report what occurred. They do not answer whether the model was right.

## Evidence Quality

Evidence quality is classified as `insufficient`, `limited`, `usable`, or `strong` using direct-witness status, meaningful use, checkpoint coverage, observer confidence, source consistency, conflicts, and completeness.

Evidence quality is not statistical validation. A materially different observed outcome can remain registry-eligible when evidence quality is otherwise sufficient.

## Registry

The genuine evidence registry is a read model derived from persisted studies. It excludes synthetic fixtures, Ticket #038 fixtures, Ticket #040 workflow fixtures, cancelled studies, and invalidated studies.

Registry reports use descriptive counts only. They do not calculate model accuracy percentages.

## Guardrails

No genuine study:

- changes the immutable prediction
- changes live recommendation scoring
- recalibrates Transition v1.1
- promotes Transition v1.1
- creates an automatic promotion threshold

## Commands

- `pnpm transition:genuine-study:readiness`
- `pnpm transition:genuine-study:protocol`
- `pnpm transition:genuine-study:registry`
- `pnpm transition:genuine-study:validation`

## Ticket #042 Boundary

Future work may add authenticated internal operator tooling, safer write-oriented intake commands, reminder workflows, or aggregate validation policy. Model promotion, calibration, and accuracy claims remain out of scope until a later formal validation ticket.
