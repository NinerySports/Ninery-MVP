# Structured Physical Bat Evaluation Protocol v1.0

Purpose: produce trustworthy equipment-side observations for unresolved behavioral Equipment DNA attributes. This protocol evaluates the bat, not a player, recommendation, transition outcome, or hitting result.

## What This Evaluates

- `swing_effort`: relative swing demand. Higher canonical values mean greater demand.
- `bat_control_support`: equipment-side controllability of barrel direction, path, and start/stop behavior.
- `forgiveness`: structured response to varied contact regions.
- `sweet_spot_support`: usable response region and barrel-response consistency.
- `balance_profile`: optional supporting observation only; preserve 0 = most balanced and 100 = most end-loaded if objective balance data exists later.

## What This Does Not Evaluate

Do not record player compatibility conclusions, player preference, batting average, exit velocity improvement, confidence change, Transition v1.1 prediction, or recommendation fit. Jackson Pilot Study observations must not be used as prospective Equipment DNA evidence.

## Evaluation Modes

Use `comparative` mode when a suitable verified physical reference bat is available. Comparative mode uses relative labels: `clearly_less`, `somewhat_less`, `similar`, `somewhat_more`, `clearly_more`, and `unable_to_assess`.

Comparative references may be `catalog_reference` or `verified_external_reference`. A catalog reference uses Ninery `equipmentId` and `equipmentVariantId`. A verified external reference is a physical evaluation instrument, not a catalog product, and must include manufacturer, model, year, certification, length, weight, drop, condition, verification source, verified timestamp, and verifier. Do not create placeholder catalog IDs.

Comparative evidence can be complete without an absolute canonical ordinal. If the reference bat has no approved canonical Equipment DNA baseline, the session uses `relative_only` interpretation: the evidence preserves the target, reference, trial counts, rubric dimensions, evaluator confidence, and limitations, while `canonicalInterpretation` remains deferred. This is valid directional evidence such as "the target requires somewhat more startup demand than the reference." It does not prove an absolute value such as `demanding`.

When an operator supplies a comparative `canonicalInterpretation`, it must validate against the attribute registry and is treated as operator interpretation inside the evidence payload. Ticket #050 does not introduce reference-anchored ordinal derivation. Future reference-anchored inference requires an approved baseline and deterministic policy.

Use `standalone` mode when the evaluator has the target bat but no suitable verified reference bat is physically available. Standalone mode must explicitly record `referenceAvailable: false` and a controlled reason such as `no_suitable_verified_reference_available`. Standalone mode uses absolute labels: `very_low`, `low`, `moderate`, `high`, `very_high`, and `unable_to_assess`.

Do not select `similar` when no comparison was performed. Missing comparison evidence lowers certainty; it does not invalidate all equipment-side observations.

## Required Materials

- Target bat with readable model/certification/variant markings.
- Catalog record and variant details.
- Verified reference bat where practical, ideally similar length, weight, drop, and certification. Not required in standalone mode.
- Safe evaluator identifier and evaluator category.
- Structured evaluation form using rubric labels only.

## Physical Verification

Before evaluation, verify manufacturer, model, model year, certification, length, weight, drop, barrel diameter when available, equipment ID, and variant ID. Stop if identity is uncertain or the variant cannot be matched.

Allowed identification sources are `physical_label`, `manufacturer_model_marking`, `certification_stamp`, `catalog_match`, and `combined`. Photographs are not required in v1.0.

## Condition Policy

Record `new_or_near_new`, `normal_used_condition`, `materially_worn`, `damaged`, or `unknown`. A damaged bat blocks behavioral evidence output. Material wear and unknown condition are warnings and must be documented.

## Evaluator Setup

Use one of: `internal_equipment_evaluator`, `coach_evaluator`, `experienced_player_evaluator`, `technical_evaluator`, or `other_qualified_evaluator`. No category automatically receives higher confidence. Evidence quality comes from completion, repeat trials, reference comparisons, consistency, and documentation.

## Procedure

1. Verify target bat identity and condition.
2. Select `comparative` or `standalone` mode.
3. In comparative mode, verify reference bat identity and perform reference alternation.
4. In standalone mode, record why no suitable verified reference bat is available.
5. Perform controlled dry swings. Standalone dry-swing attributes require at least 8 dry swings.
6. If safe and practical, perform tee/contact trials. Standalone forgiveness and sweet-spot support require at least 8 contact trials and should not be inferred from dry swings.
7. Record mode-appropriate rubric labels.
8. Preserve raw observations before canonical interpretation.
9. Add concise equipment-specific notes only.

## Stop Conditions

Stop if physical identity is uncertain, certification/model/variant is uncertain, the bat is damaged, reference identity is uncertain, testing conditions invalidate comparison, or the evaluator begins making player-specific outcome judgments.

External reference stop conditions include missing manufacturer/model/year, missing certification, missing length/weight/drop, damaged condition, missing verification source, missing verifier, or unverified identity.

## Evidence Submission

The workflow is:

physical evaluation -> evidence commit review -> Ticket #046 behavioral evaluation -> behavioral evaluation commit if appropriate -> Equipment DNA readiness/admission -> genuine-study readiness.

Ticket #047/#048 does not automatically activate canonical attributes, live recommendations, public APIs, or web UI changes.

Ticket #049 also does not onboard external reference bats or grant them recommendation/catalog authority.

Ticket #050 separates evidence completeness from canonical interpretation. A comparative session with complete required dimensions and no blockers can prepare relative-only evidence even when `canonicalInterpretation` is deferred. Ticket #046 can inventory that evidence and report that directional comparative evidence exists, while still returning `insufficient_evidence` for absolute canonical Equipment DNA if no valid ordinal is present.

Ticket #051 adds the controlled persistence stage:

1. Run `equipment:physical-evaluation:prepare -- --file=<session.json>` to review the physical session and prepared evidence payloads.
2. Run `equipment:physical-evaluation:commit -- --file=<session.json>` without `--confirm` to verify that writes remain blocked.
3. Run `equipment:physical-evaluation:commit -- --file=<session.json> --confirm` only when the operator intends to persist evidence.
4. Rerun `equipment:physical-evaluation:show` and Ticket #046 behavioral reports to inspect the persisted evidence inventory.

Confirmed commit is atomic and idempotent for the same logical session, target, variant, attribute, source reference, source type, method, and definition version. It persists evidence records only. It does not create `EquipmentDNAAttributeEvaluation` rows, canonical ordinals, numeric references, live recommendation inputs, or public UI/API changes.

For standalone absolute evidence, the review flow derives an ordinal from the raw standalone observations. Confirmed commits persist that evidence-row ordinal in `EquipmentDNAEvidenceRecord.normalizedValue` so downstream standalone synthesis can read the same value that prepare/review produced. This is not canonical evaluation promotion. Comparative `relative_only` evidence remains ordinal-free.

Ticket #052 adds the comparative synthesis inspection stage. Run:

```bash
pnpm equipment:behavioral-evaluation:synthesis
pnpm equipment:behavioral-evaluation:synthesis-validation
```

Synthesis summarizes persisted relative-only physical evidence across sessions and independent evaluators. It reports dimension-level agreement, minor or material conflicts, attribute-level comparative direction, consensus strength, and next evidence action.

Synthesis does not convert the DeMarini / Omaha comparison into an absolute Equipment DNA value. Omaha is a verified external reference only, so the canonical interpretation remains `deferred_reference_unanchored` unless a later ticket onboards and anchors the reference bat with approved canonical Equipment DNA.

Ticket #053 adds the anchor-readiness stage:

```bash
pnpm equipment:behavioral-evaluation:anchor-readiness
pnpm equipment:behavioral-evaluation:anchor-inventory
pnpm equipment:behavioral-evaluation:anchor-validation
```

Anchor readiness decides whether relative evidence has a legitimate absolute interpretation path. A reference anchor must have same-attribute canonical Equipment DNA with compatible version, trustworthy evidence, sufficient confidence, no unresolved material conflict, and non-circular lineage. A verified external reference such as Omaha does not become an anchor merely because it was used during a physical comparison.

For the current DeMarini evidence packet, the preferred next human action is to collect standalone absolute physical evaluation evidence. Do not assign DeMarini canonical ordinals or numeric references from the comparative Omaha sessions alone.

Ticket #055 adds the historical repair stage for standalone rows committed before evidence-row ordinal persistence existed:

```bash
pnpm equipment:physical-evaluation:standalone-ordinal-validation
pnpm equipment:physical-evaluation:standalone-ordinal-repair-preview
pnpm equipment:physical-evaluation:standalone-ordinal-repair -- --confirm
```

The repair re-derives ordinals only from preserved standalone raw observations using the same prepare/review helper, requires real evidence provenance, skips comparative `relative_only` rows, and writes no canonical evaluations or numeric references.
