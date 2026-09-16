# @ninery/recommendation-intelligence

Deterministic compatibility scoring for Ninery equipment recommendations.

This package compares a versioned Player DNA profile with normalized Equipment DNA profiles and returns ranked, explainable equipment matches. It does not use generative AI for scores, rankings, filters, or trace data.

## Architecture

- Hard filters run before weighted scoring.
- Weighted scoring evaluates 14 compatibility dimensions.
- Ranking uses deterministic tie-breakers.
- Recommendation confidence is calculated separately from match score.
- Recommendation Trace preserves the scoring configuration, weights, rule IDs, source codes, dimensions, final score, confidence, rank, and generated timestamp.

## Hard Filters

Equipment is excluded before scoring when certification, category, active status, public DNA readiness, requested variant, profile completeness, evidence confidence, or required characteristic coverage fails. Filtered equipment is returned with explicit reasons.

Draft profiles are excluded from public requests. `includeInternalDraftProfiles` is development-only and must be protected before production use.

## Scoring Dimensions

MVP dimensions:

- Bat Control Fit
- Swing Feel and Balance Fit
- Swing Weight Fit
- Barrel Forgiveness Fit
- Sweet Spot Fit
- Power Potential Fit
- Confidence-Building Fit
- Transition Readiness Fit
- Development Goal Fit
- Growth and Useful-Life Fit
- Equipment Preference Fit
- Budget Fit
- Evidence Quality
- Profile Completeness

The default configuration version is `compatibility-mvp-v1`. Default weights sum to `1.00`. Goal-based adjustments are configurable and traceable.

## Missing Data

Missing data reduces confidence and is recorded in dimension traces. Missing Equipment DNA scores are not converted into zero capability.

## Score Bands

- 98-100: Exceptional Match
- 92-97.99: Excellent Match
- 85-91.99: Very Good Match
- 75-84.99: Good Match
- 65-74.99: Conditional Match
- Below 65: Not Recommended

## Confidence

Recommendation confidence considers Player DNA confidence, Player DNA completeness, Equipment DNA completeness, evidence confidence, scored dimensions, missing data, model-level versus variant-specific intelligence, and scoring configuration maturity. MVP automated recommendations are capped below `validated`.

## Ranking

Ranking uses:

1. Match score
2. Recommendation confidence
3. Development goal fit
4. Evidence confidence
5. Profile completeness
6. Equipment ID

Brand popularity is not a tie-breaker and is not a scoring factor.

## Why-Not Comparisons

Why-not explanations compare player-specific trade-offs between ranked items. They should explain why one item ranked higher without claiming the alternative is bad.

## Persistence

Recommendation runs are historical. The repository stores:

- Recommendation-level input hash, trace summary, score breakdown, confidence, and full trace.
- RecommendationItem rank, variant, match score, confidence, match band, dimension breakdown, eligibility trace, and trade-offs.
- Timeline and platform events inside the same transaction.

Identical requests return the existing recommendation unless `forceRegenerate` is true. `forceRegenerate` creates a new historical recommendation.

## Demo Recommendation Workflow

Ticket #016 adds a development scenario for end-to-end validation:

- Player: Jackson Sanders, 11-year-old travel baseball player.
- Current bat: 2026 Rawlings ICON USA, 30 inch, drop 8.
- Feedback: likes light swing, good pop, and large sweet spot.
- Goal: improve bat control.
- Equipment set: Rawlings ICON, Easton Hype Fire, and Louisville Slugger Atlas, each with USA 29/-10, 30/-10, 30/-8, and 31/-8 variants.

Seed the demo data:

```powershell
pnpm seed
```

Generate the development recommendation:

```powershell
pnpm --filter @ninery/api dev
curl http://localhost:3001/dev/demo/recommendation
```

The endpoint is development-only and intentionally unauthenticated. It loads the seeded demo player, generates Player DNA through `@ninery/player-intelligence`, reads eligible Equipment DNA through `@ninery/equipment-intelligence`, scores through this package, persists the recommendation, and returns the trace summary.

Inspect the full Recommendation Trace in:

- `Recommendation.recommendationTrace`
- `RecommendationItem.recommendationTrace`
- `RecommendationItem.scoreBreakdown`
- `RecommendationItem.eligibilityStatus`

The endpoint also prints a console summary with Player DNA, top recommendations, trade-offs, and filtered equipment.

## Canonical Candidate Dual-Run

Ticket #024 adds an internal-only canonical candidate dual-run in `src/candidate`. The dual-run runs the same `CompatibilityScoringEngine` twice for the same player and request context:

- `legacy_authoritative`: current Equipment DNA inputs
- `canonical_candidate`: admitted canonical Equipment DNA inputs

The legacy result remains authoritative. Candidate output is diagnostic only, is not persisted, is not exposed through API responses, does not affect rankings, and always reports `candidateAffectsLiveResult: false`.

Canonical candidate inputs require Ticket #023 admission with `approved_for_internal_candidate`, matching equipment and variant IDs, supported admission policy version, and `liveRecommendationUseAllowed: false`. Missing, blocked, stale, mismatched, or shadow-only admission decisions block candidate execution without removing the legacy result.

Candidate mapping version `1.0` maps:

- `bat_control_support -> batControl`
- `swing_effort -> swingWeight`
- `forgiveness -> barrelForgiveness`
- `sweet_spot_support -> sweetSpotSize`
- `power_potential -> powerPotential`

`swing_effort` is mapped directly as demand because the live engine treats `swingWeight` as demand and applies `inverseScore(scores.swingWeight)` when scoring manageability. `balance_profile`, `confidence_building_potential`, and `transition_difficulty` remain unsupported/ambiguous candidate mappings and are reported as warnings instead of fabricated scores.

The comparison engine reports eligibility, ranking, overall scores, dimension scores, confidence scores, reason sets, tradeoffs, alternatives, trace comparability, and a deterministic classification: `candidate_failed`, `eligibility_changed`, `ranking_changed`, `material_variance`, `minor_variance`, or `equivalent`.

Development report:

```powershell
pnpm --filter @ninery/database recommendation:canonical:dual-run
```

The root alias is `pnpm recommendation:canonical:dual-run`, but use the package-scoped command if the local pnpm shim is unreliable.

## Canonical Candidate Variance Attribution

Ticket #025 adds an internal analytical framework in `src/analysis` that explains candidate-versus-legacy variance without changing either path. It consumes the Ticket #024 dual-run request and result, then attributes variance across:

- input values and canonical mapping metadata
- one-factor attribute reruns through the existing scoring engine
- dimension raw scores, weights, and weighted contribution deltas
- pairwise legacy-winner versus candidate-winner gap movement
- recommendation confidence deltas
- reason, tradeoff, alternative, trace, and tie-breaker changes
- five-level ordinal compression and boundary amplification
- missing unsupported attribute scenarios
- mapping calibration scenarios

Calibration is analysis-only. The production candidate adapter remains unchanged. Scenarios include current midpoint, lower bound, upper bound, interval center, legacy-preserving reference, supported-attributes-only symmetry, and optional legacy carryover estimate.

Development report:

```powershell
pnpm --filter @ninery/database recommendation:canonical:attribution
```

The report states legacy remains authoritative and candidate output does not affect live recommendations.

## Canonical Attribute-Source Selection

Ticket #027 adds `src/candidate-selection`, an internal-only source-selection layer for canonical candidate inputs. It does not change live scoring, weights, eligibility, ranking, confidence, API responses, routes, database schema, or web UI.

Policy version `1.0` chooses per attribute between:

- `numeric_reference`
- `ordinal_projection`
- `unavailable`

Supported attributes:

- `bat_control_support -> batControl`
- `swing_effort -> swingWeight`
- `forgiveness -> barrelForgiveness`
- `sweet_spot_support -> sweetSpotSize`
- `power_potential -> powerPotential`

Unsupported attributes:

- `balance_profile`
- `confidence_building_potential`
- `transition_difficulty`

Numeric references may be selected only when the profile has approved internal-candidate admission, the reference is valid, ordinal-consistent, version `1.0`, uses an approved method, and meets the per-attribute minimum confidence of `moderate`. Supported methods are `legacy_preserved`, `derived_from_evaluation`, and `structured_evaluation`.

Ordinal fallback is explicit. Policy v1.0 allows fallback for missing, invalid, or insufficient-confidence numeric references, but not unsupported numeric-reference versions. Missing values are never converted to zero, and legacy values are never carried into canonical candidate inputs.

Ticket #027 also adds a three-path diagnostic run:

- legacy authoritative
- ordinal-only canonical candidate
- numeric-reference-aware canonical candidate

The three-path result measures winner alignment, ranking distance, score variance, dimension variance, and reason alignment. Legacy remains the only live source and every result reports `candidateAffectsLiveResult: false`.

Development reports:

```powershell
pnpm --filter @ninery/database recommendation:canonical:source-selection
pnpm --filter @ninery/database recommendation:canonical:three-path
```

Run these reports sequentially against pooled local databases to avoid exhausting small connection limits.

## Canonical Residual Analysis

Ticket #028 adds `src/analysis/canonical-residual-variance.*`, an analytical-only residual variance report that explains why the numeric-reference-aware canonical candidate can restore the legacy winner and ranking while still differing in scores, dimensions, reasons, tradeoffs, confidence, and trace provenance.

The live recommendation engine remains unchanged. Legacy Equipment DNA is still authoritative, no canonical data is passed into production recommendations, no API or web contracts change, and every residual analysis result reports `candidateAffectsLiveResult: false`.

The residual analyzer compares the legacy authoritative run against these deterministic scenarios:

- `legacy_full`
- `numeric_reference_current`
- `legacy_supported_only`
- `numeric_reference_supported_only`
- `numeric_reference_with_balance_carryover`
- `numeric_reference_with_confidence_building_carryover`
- `numeric_reference_with_transition_carryover`
- `numeric_reference_with_all_optional_carryover`
- `numeric_reference_without_completeness_penalty`
- `numeric_reference_legacy_confidence_reference`

Current missing optional legacy signals are inventoried with stable cause codes:

- `balance -> balance_profile`: affects `SWING_FEEL_BALANCE_FIT`; this is the nearest intrinsic optional signal that needs an explicit canonical policy.
- `confidenceBuilding -> confidence_building_potential`: affects `CONFIDENCE_BUILDING_FIT` and can affect `DEVELOPMENT_GOAL_FIT`; it remains relational/experimental.
- `transitionFriendliness -> transition_difficulty`: affects `TRANSITION_READINESS_FIT`; it remains relational/experimental.

Missing optional signals are not treated as zero. The existing scorer uses a neutral raw score of `50` for missing dimensions, keeps weights unchanged, and records missing-information penalties in recommendation confidence. In the current demo data, completeness and evidence-confidence isolation scenarios do not move match score or confidence, while all-optional carryover explains the remaining score residual.

Development report:

```powershell
pnpm --filter @ninery/database recommendation:canonical:residual-analysis
```

Run it sequentially with other database-backed reports. The report prints missing-signal inventory, scenario deltas, per-signal carryover attribution, normalization behavior, threshold crossings, ICON-versus-Atlas gap residuals, score decomposition, architecture recommendations, and activation-readiness guidance.

## Canonical Balance Comparison

Ticket #030 adds a fourth diagnostic candidate strategy, `numeric_reference_with_balance`. Ticket #031 persists the demo `balance_profile` evaluations needed for that strategy to run. It does not replace the existing ordinal-only or five-attribute numeric-reference paths.

The strategy may select `balance_profile -> balance` only when the legacy balance semantic audit approves conversion, the balance numeric reference is valid, ordinal-consistent, at least `moderate` confidence, admission is valid, and the canonical profile has an active `balance_profile` attribute.

The current demo legacy balance values convert inversely to canonical balance references. The adapter then bridges canonical `balance_profile` back into the current recommendation input direction with `CANONICAL_BALANCE_TO_RECOMMENDATION_INPUT_VERSION` `1.0`, so `11 -> 89`, `16 -> 84`, and `26 -> 74` before shadow scoring.

Development report:

```powershell
pnpm --filter @ninery/database recommendation:canonical:balance-comparison
```

The report compares legacy authoritative, ordinal-only candidate, five-attribute numeric-reference candidate, and the true six-attribute balance-aware candidate. It reports score variance, maximum score variance, dimension variance, balance-dimension variance, ICON-versus-Atlas gap, ranking distance, reason alignment, tradeoff alignment, confidence variance, residual reduction, and confirms `candidateAffectsLiveResult: false`.

## Predictability Diagnostic

Ticket #032 adds equipment-side `predictability_support` but keeps direct mapping to legacy `confidenceBuilding`
blocked. The bridge strategy is `profile_only` because predictability describes equipment response consistency while
legacy `CONFIDENCE_BUILDING_FIT` is player-relative and confidence-oriented.

The diagnostic report compares persisted predictability ordinals/numeric references against legacy
`confidenceBuilding` descriptively, but does not execute a seven-attribute recommendation candidate.

Development report:

```powershell
pnpm --filter @ninery/database recommendation:canonical:predictability-diagnostic
```

Live recommendation source remains `legacy`, and `candidateAffectsLiveResult` remains `false`.

## Confidence Compatibility Intelligence

Ticket #033 adds `confidence_compatibility` in `src/compatibility/confidence` as a relational, player-specific shadow model. It estimates how well a bat's predictable, manageable, and understandable behavior aligns with a specific player's current development-support needs.

The model uses Player DNA support-needs transforms and canonical Equipment DNA numeric references. It does not use legacy `confidenceBuilding` as equipment evidence or as a hidden fallback. It does not diagnose confidence, self-esteem, anxiety, or mental health, and it does not claim that equipment creates or guarantees confidence.

Version constants:

- `CONFIDENCE_COMPATIBILITY_MODEL_VERSION = "1.0"`
- `CONFIDENCE_COMPATIBILITY_POLICY_VERSION = "1.0"`
- `CONFIDENCE_COMPATIBILITY_REASON_VERSION = "1.0"`

v1.0 dimensions:

- `predictability_alignment`: 30%
- `forgiveness_alignment`: 20%
- `bat_control_alignment`: 20%
- `manageable_effort_alignment`: 15%
- `contact_support_alignment`: 15%

Player support needs use a documented `0 = low support need`, `100 = high support need` direction. Capability inputs such as bat control, contact consistency, and swing speed are inverted only where the source direction is explicit. Equipment support uses canonical numeric references; canonical `swing_effort` is demand, so manageable-effort support is `100 - swing_effort`.

The alignment function is asymmetric: support below need is penalized more strongly than modest support above need. Missing values are reported and never converted to zero. Current equipment familiarity is currently missing in the demo context and lowers confidence.

The model remains `shadow_only`; it does not change live recommendation scoring, ranking, eligibility, confidence, APIs, routes, database schema, or web UI.

Development report:

```powershell
pnpm --filter @ninery/database recommendation:confidence-compatibility
```

The report evaluates the demo player against Rawlings ICON, Louisville Slugger Atlas, and Easton Hype Fire, compares shadow scores to legacy `CONFIDENCE_BUILDING_FIT` and `DEVELOPMENT_GOAL_FIT`, and confirms the legacy recommendation remains authoritative.

## Transition Compatibility Intelligence

Ticket #034 adds `transition_compatibility` in `src/compatibility/transition` as a relational, player-specific shadow model. It estimates the expected equipment-adjustment demand when a player moves from their current bat to a proposed bat.

The model uses Player DNA, the current canonical Equipment DNA profile, and the proposed canonical Equipment DNA profile. It does not copy, invert, or use legacy `transitionFriendliness` as evidence or fallback. Legacy transition data appears only in comparison reporting.

Version constants:

- `TRANSITION_COMPATIBILITY_MODEL_VERSION = "1.0"`
- `TRANSITION_COMPATIBILITY_POLICY_VERSION = "1.0"`
- `TRANSITION_COMPATIBILITY_REASON_VERSION = "1.0"`
- `TRANSITION_CHANGE_PROFILE_VERSION = "1.0"`

v1.0 component weights:

- `size_change_demand`: 15%
- `mass_change_demand`: 20%
- `drop_change_demand`: 15%
- `balance_change_demand`: 15%
- `swing_effort_change_demand`: 20%
- `experience_adjustment_demand`: 15%

Demand direction is `0 = no meaningful adjustment demand`, `100 = very high adjustment demand`. Final compatibility is `100 - adjustment demand`, with readiness modifiers bounded so player readiness can reduce but not erase physical equipment differences.

Required current and proposed equipment inputs are length, weight, and drop. Balance and swing effort are used when canonical numeric references are available. Current equipment familiarity is currently missing in the demo and limits confidence.

The model remains `shadow_only`; it does not change live recommendation scoring, ranking, eligibility, confidence, APIs, routes, database schema, or web UI.

Development report:

```powershell
pnpm --filter @ninery/database recommendation:transition-compatibility
```

The report evaluates the demo player's current Rawlings ICON 30/-8 setup against Rawlings ICON, Louisville Slugger Atlas, and Easton Hype Fire selected variants, compares shadow scores to legacy `transitionFriendliness` and `TRANSITION_READINESS_FIT`, and confirms the legacy recommendation remains authoritative.

## Compatibility Validation And Promotion Readiness

Ticket #035 adds `src/compatibility/validation` as an internal-only validation framework for `confidence_compatibility` and `transition_compatibility`. It consumes the existing model APIs and does not change formulas, weights, rankings, eligibility, confidence calculations, API contracts, database schema, database values, BatMatch demo output, or web UI.

Version constants:

- `COMPATIBILITY_VALIDATION_MODEL_VERSION = "1.0"`
- `COMPATIBILITY_VALIDATION_POLICY_VERSION = "1.0"`
- `COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION = "1.0"`
- `COMPATIBILITY_PROMOTION_DECISION_VERSION = "1.0"`
- `COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION = "1.0"`

The synthetic matrix uses six deterministic in-memory player profiles: Developing Support-Needs Player, Experienced Contact-Oriented Player, Physically Ready Power-Focused Player, Recent-Growth Player, Incomplete-Context Player, and Advanced Direct-Feedback Player. No synthetic profiles, validation results, promotion decisions, matrices, or sensitivity scenarios are persisted.

Validation includes score separation, player differentiation, equipment differentiation, minor-input stability, meaningful-input sensitivity, monotonicity, missing-input behavior, confidence calibration, legacy comparison, reason/tradeoff quality, language safety, and double-counting risk.

Promotion outcomes always keep `liveRankingUseAllowed: false`, `liveExplanationUseAllowed: false`, and `liveRecommendationUseAllowed: false`. Promotion is diagnostic only in this ticket.

Current computed demo validation:

- `confidence_compatibility`: validated in shadow, promotion outcome `blocked_unstable_behavior`; average per-player equipment range `1.10`, high double-counting risk, and low score separation.
- `transition_compatibility`: validated in shadow, promotion outcome `blocked_unstable_behavior`; average per-player equipment range `13.48`, moderate double-counting risk, but stability review blocks promotion.

Development reports:

```powershell
pnpm --filter @ninery/database recommendation:compatibility:matrix
pnpm --filter @ninery/database recommendation:compatibility:validation
```

Run these reports sequentially with other database-backed diagnostics. The matrix report prints synthetic player rows by equipment for both compatibility models. The validation report prints separate model sections with blockers, warnings, promotion outcomes, and next actions.

## Compatibility Stability Diagnostics And Calibration

Ticket #036 adds `src/compatibility/validation/stability` as an analytical diagnostics layer over the Ticket #035 validation result. It reruns the same synthetic matrix and perturbation scenarios, inventories reproduced failures, separates score movement from band/reason/ranking movement, analyzes threshold proximity and near ties, and proposes non-executable calibration packages.

Version constants:

- `COMPATIBILITY_STABILITY_DIAGNOSTIC_VERSION = "1.0"`
- `COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION = "1.0"`
- `CONFIDENCE_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION = "1.0"`
- `TRANSITION_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION = "1.0"`
- `COMPATIBILITY_THRESHOLD_PROXIMITY_VERSION = "1.0"`
- `COMPATIBILITY_TIE_SENSITIVITY_VERSION = "1.0"`

Current computed findings:

- `confidence_compatibility`: one reproduced stability failure from `equipment.forgiveness 80 -> 82`, score `86.58 -> 69.38`, band/reason flip, low equipment separation, six near-tie scenarios, high component overlap, and high double-counting risk. Stability conclusion: `explanation_only_recommended`. Recommended analytical package: `explanation_only`.
- `transition_compatibility`: one reproduced stability failure from `equipment.swing_effort 48 -> 50`, score `95.97 -> 78.41`, band/reason flip, piecewise threshold discontinuity, moderate physical overlap, and three correctly blocked incomplete-context evaluations. Stability conclusion: `stable_after_threshold_calibration`. Recommended analytical package: `linear_interpolation`.

Calibration scenarios are analytical only. They do not mutate production constants, formulas, weights, thresholds, bands, normalization, reasons, tradeoffs, live scoring, rankings, APIs, routes, database schema, BatMatch demo output, or web UI. Original Ticket #035 outcomes remain `blocked_unstable_behavior`.

Development reports:

```powershell
pnpm --filter @ninery/database recommendation:compatibility:stability-diagnostics
pnpm --filter @ninery/database recommendation:compatibility:calibration
```

Run these reports sequentially with other database-backed diagnostics. The stability report lists reproduced failures, causes, threshold/tie findings, missing-context classifications, and model conclusions. The calibration report lists analytical scenarios, recommended packages, projected outcomes, regressions, and confirms production models remain unchanged.

## Transition Compatibility v1.1 Linear Interpolation Candidate

Ticket #037 adds `src/compatibility/transition/v1_1` as a separate shadow-only candidate. Transition Compatibility v1.0 remains unchanged and existing callers still use v1.0 unless they explicitly call the v1.1 APIs.

Version constants:

- `TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1 = "1.1"`
- `TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1 = "1.1"`
- `TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION = "1.0"`
- `TRANSITION_COMPATIBILITY_V1_1_VALIDATION_VERSION = "1.0"`
- `TRANSITION_COMPATIBILITY_V1_0_V1_1_COMPARISON_VERSION = "1.0"`

The v1.1 candidate replaces v1.0's abrupt step demand thresholds with deterministic piecewise-linear interpolation for length, weight, drop, balance, and swing-effort changes. It preserves the v1.0 component weights, band ranges, required current-equipment safeguards, missing-input behavior, and reason thresholds. Ticket #036 found moderate physical overlap across length, weight, and drop, but did not approve a concrete replacement weight package, so v1.1 intentionally keeps the v1.0 weights and limits this change to interpolation plus explicit readiness bounds.

Interpolation curves:

- Length inches: `0 -> 0`, `0.5 -> 20`, `1 -> 45`, `1.5 -> 70`, `2 -> 90`
- Heavier weight ounces: `0 -> 0`, `1 -> 23`, `2 -> 51`, `3 -> 79`, `4 -> 100`
- Lighter weight ounces: `0 -> 0`, `1 -> 22`, `2 -> 49`, `3 -> 76`, `4 -> 98`
- Drop magnitude: `0 -> 0`, `1 -> 20`, `2 -> 45`, `3 -> 70`, `4 -> 90`
- Balance delta: `0 -> 0`, `10 -> 20`, `20 -> 45`, `35 -> 70`, `50 -> 90`, `65 -> 100`
- More swing effort: `0 -> 0`, `10 -> 22.5`, `20 -> 50`, `35 -> 78.75`, `50 -> 100`
- Less swing effort: `0 -> 0`, `10 -> 21.5`, `20 -> 48`, `35 -> 75.25`, `50 -> 97.5`

Readiness bounds:

- minimum multiplier: `0.35`
- maximum multiplier: `1.2`
- maximum absolute demand reduction: `20`
- maximum absolute demand increase: `12`
- neutral readiness: `60`

The original Ticket #036 swing-effort instability is reproduced against v1.0 and materially reduced by v1.1. v1.1 reports interpolation traces and readiness modifier traces, but does not persist results. The v1.1 analytical validation outcome is `approved_for_extended_shadow`; internal candidate and live use remain disabled.

Development reports:

```powershell
pnpm --filter @ninery/database recommendation:transition-compatibility:v1-1
pnpm --filter @ninery/database recommendation:transition-compatibility:version-comparison
pnpm --filter @ninery/database recommendation:transition-compatibility:v1-1-validation
```

Run these reports sequentially with other database-backed diagnostics. Every report confirms v1.0 remains the production version and v1.1 live use is `no`.

## Transition Extended Shadow Data Capture

Ticket #038 adds a persistent extended-shadow study layer for observing Transition Compatibility v1.1 after prediction capture. It does not change production scoring, Transition v1.0, Transition v1.1 calibration, recommendation rankings, APIs, routes, the BatMatch demo, or the web UI.

Version constants:

- `TRANSITION_EXTENDED_SHADOW_STUDY_VERSION = "1.0"`
- `TRANSITION_OBSERVATION_SCHEMA_VERSION = "1.0"`
- `TRANSITION_OUTCOME_COMPARISON_VERSION = "1.0"`
- `TRANSITION_EXTENDED_SHADOW_POLICY_VERSION = "1.0"`

Study lifecycle:

`draft -> prediction_captured -> observation_active -> observation_complete`

Studies can also be `cancelled` or `invalidated`. Prediction snapshots are immutable-shaped records that preserve the Transition v1.1 score, band, trace, input hash, prediction hash, familiarity snapshot, and provenance versions. Observations are structured checkpoints and are descriptive only; they must not be written as causation or proof that a model is correct.

Outcome comparisons may report `broadly_aligned`, `partially_aligned`, `materially_different`, `insufficient_observation`, `conflicting_observations`, or `study_invalidated`. Every comparison keeps `modelChangeRecommended: false` and `livePromotionRecommended: false`.

Development fixture workflow:

```powershell
pnpm transition:extended-shadow:seed
pnpm transition:extended-shadow:report
pnpm transition:extended-shadow:validation
```

The seed creates five deterministic fixture studies labeled `development_fixture`, `synthetic_observation`, and `not_real_world_evidence`: broadly aligned, materially different, conflicting observation, insufficient observation, and invalidated. These fixtures support validation of capture and reporting only; they are not real-world evidence and do not promote v1.1 to live use.

## Transition Extended-Shadow Administration

Ticket #039 adds internal operations for the extended-shadow program. Delivery mode is `service_and_cli_only` because the repository does not yet have authenticated internal web routes or a protected admin API pattern. No public route, unsecured admin route, parent form, coach form, or public UI was added.

Version constants:

- `TRANSITION_SHADOW_ADMIN_POLICY_VERSION = "1.0"`
- `TRANSITION_SHADOW_ADMIN_WORKFLOW_VERSION = "1.0"`
- `TRANSITION_SHADOW_AUDIT_EVENT_VERSION = "1.0"`
- `TRANSITION_SHADOW_ELIGIBILITY_VERSION = "1.0"`
- `TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION = "1.0"`

The administration layer exposes stable capabilities instead of hard-coding role names in workflows. Development roles are explicit: `transition_shadow_viewer`, `transition_shadow_operator`, `transition_shadow_reviewer`, and `transition_shadow_administrator`. Authorization fails closed for missing actors, inactive actors, unknown roles, missing capabilities, fixture access, and invalidation authority.

Supported internal workflows:

- eligibility review
- draft study creation
- current-equipment familiarity capture
- Transition Compatibility v1.1 prediction capture
- observation-period start
- structured observation entry
- checkpoint-status review
- completion review
- completion with explicit override reason when evidence is insufficient
- cancellation with reason
- invalidation with reason code and detail
- minimized study admin view
- operational summary

Audit persistence decision: no Ticket #039 Prisma migration was added. The existing `PlatformEvent` table is sufficient for persisted admin audit events by storing `entityType = "TransitionShadowAdminAudit"` and a minimized payload. The pure service records audit events through a repository abstraction; database-backed write commands can persist those events without adding a second audit table.

Observation correction policy: append-only. Corrections must be captured as additional observations with audit context and a required correction reason. Existing observation content should not be silently overwritten.

Development reports:

```powershell
pnpm transition:shadow-admin:operations
pnpm transition:shadow-admin:audit-report
pnpm transition:shadow-admin:validation
pnpm transition:shadow-admin:workflow-exercise
pnpm transition:shadow-admin:audit-verification
pnpm transition:shadow-admin:workflow-validation
```

Synthetic fixtures are excluded from genuine operational lists by default. Reports must not calculate model accuracy percentages and must always state that no model change or live promotion is automatically recommended.

Ticket #040 adds deterministic admin workflow fixtures labeled `development_fixture`, `admin_workflow_fixture`, and `not_real_world_evidence`. The exercise uses the Ticket #039 service layer for lifecycle mutations and verifies PlatformEvent audit reconstruction. It resets only prior Ticket #040 fixture studies and audit events before rerun, preserving genuine data and Ticket #038 fixtures.

## Genuine Transition Study Intake

Ticket #041 adds the controlled internal intake and field-observation protocol for future genuine Transition Compatibility extended-shadow evidence. Delivery remains `service_and_cli_only`; no public API, public UI, parent portal, coach portal, model promotion, scoring change, or accuracy metric was added.

Version constants:

- `TRANSITION_GENUINE_STUDY_INTAKE_VERSION = "1.0"`
- `TRANSITION_FIELD_OBSERVATION_PROTOCOL_VERSION = "1.0"`
- `TRANSITION_GENUINE_EVIDENCE_POLICY_VERSION = "1.0"`
- `TRANSITION_PARTICIPATION_ACKNOWLEDGEMENT_VERSION = "1.0"`
- `TRANSITION_EVIDENCE_QUALITY_VERSION = "1.0"`

A genuine study requires a real player/equipment transition, explicit participation acknowledgement, verified current equipment, verified proposed equipment, current-equipment familiarity before prediction, Player DNA sufficient for Transition v1.1, no known outcome before prediction, and `genuine_internal_observation` classification. The acknowledgement is an internal operational acknowledgement, not a formal legal or clinical research-consent system.

Field observations use `first_use`, `early_sessions`, and `acclimation_period` checkpoints. Evidence quality is descriptive: `insufficient`, `limited`, `usable`, or `strong`. Material model disagreement remains valid evidence when the observation quality is otherwise sufficient. Cancelled and invalidated studies are preserved operational records but excluded from the genuine evidence registry.

Development reports:

```powershell
pnpm transition:genuine-study:readiness
pnpm transition:genuine-study:protocol
pnpm transition:genuine-study:registry
pnpm transition:genuine-study:validation
```

The readiness command performs a deterministic dry run classified as `development_fixture` and `not_real_world_evidence`; it does not seed fake genuine evidence. The registry is a read model derived from existing shadow-study records and PlatformEvent audit metadata, so Ticket #041 does not require a Prisma schema migration.

## Genuine Transition Study Operator Intake

Ticket #042 adds guarded internal operator tooling for genuine transition studies. Delivery remains `service_and_cli_only`. Every write command requires `--actor`, fixed internal actor resolution, permitted environment checks, and explicit confirmation where a lifecycle write occurs.

Version constants:

- `TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION = "1.0"`
- `TRANSITION_GENUINE_OPERATOR_REVIEW_VERSION = "1.0"`
- `TRANSITION_GENUINE_OPERATOR_CLI_VERSION = "1.0"`
- `TRANSITION_GENUINE_OBSERVATION_ENTRY_VERSION = "1.0"`

Operator workflow:

```powershell
pnpm transition:genuine-study:help
pnpm transition:genuine-study:players -- --query="Jackson"
pnpm transition:genuine-study:equipment -- --query="Rawlings ICON"
pnpm transition:genuine-study:prepare -- --file=path/to/intake.json --actor=transition-operator
pnpm transition:genuine-study:create -- --file=path/to/intake.json --actor=transition-operator --confirm-genuine-study
pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --file=path/to/prediction-input.json
pnpm transition:genuine-study:observation-readiness -- --study=<study-id>
pnpm transition:genuine-study:start-observation -- --study=<study-id> --actor=transition-operator --confirm
pnpm transition:genuine-study:add-observation -- --study=<study-id> --actor=transition-operator --file=path/to/observation.json
pnpm transition:genuine-study:completion-review -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:complete -- --study=<study-id> --actor=transition-operator --confirm
```

Additional commands include `checkpoints`, `show`, `list`, `audit`, `cancel`, `invalidate`, `operator-readiness`, and `operator-validation`. Genuine creation uses a two-step prepare/commit model, and `--dry-run` performs validation without persistence. Ticket #042 does not seed genuine evidence, does not add public routes or UI, and does not change live recommendation behavior.

## Genuine Study Context Loader

Ticket #043 removes the normal need for a manually authored Transition Compatibility input file. The context loader assembles the v1.1 prediction input from the persisted genuine study, real player identity, latest non-archived Player DNA, current/proposed equipment variants, canonical Equipment DNA active evaluations, and current-equipment familiarity.

Version constants:

- `TRANSITION_CONTEXT_LOADER_VERSION = "1.0"`
- `TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION = "1.0"`
- `TRANSITION_PREDICTION_INPUT_REVIEW_VERSION = "1.0"`
- `TRANSITION_CONTEXT_PROVENANCE_VERSION = "1.0"`

Operator commands:

```powershell
pnpm transition:genuine-study:prediction-input -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:prediction-provenance -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:prediction-dry-run -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:context-diagnostics -- --study=<study-id>
pnpm transition:genuine-study:context-drift -- --study=<study-id>
pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --confirm
```

Manual JSON input remains available only as an explicit development override with `--file` and `--manual-input-override`. Ticket #043 adds no Prisma migration, no public API, no web UI, no model calibration, and no live recommendation behavior change. Context drift compares against the existing captured v1.1 snapshot hash so older captured studies can be checked without rewriting prediction snapshots, while previews also report a richer semantic assembly hash.

## First Genuine Study Readiness

Ticket #044 adds a read-only operational preflight for the first genuine Transition Compatibility v1.1 extended-shadow study. It answers whether an authorized operator can safely begin or continue a genuine study for a specific player, current bat, and proposed bat.

Version constants:

- `FIRST_GENUINE_STUDY_READINESS_VERSION = "1.0"`
- `FIRST_GENUINE_STUDY_PREFLIGHT_POLICY_VERSION = "1.0"`
- `FIRST_GENUINE_STUDY_NEXT_ACTION_VERSION = "1.0"`
- `TRANSITION_STUDY_OBSERVER_PLAN_VERSION = "1.0"`
- `TRANSITION_STUDY_RUNBOOK_VERSION = "1.0"`

Readiness is state-based, not score-based. The result reports `ready`, `required_action`, `warning`, `blocked`, `not_applicable`, and lifecycle states such as `complete` or `not_ready`. It returns one deterministic next action and never asks operators to manually enter normalized model values.

Commands:

```powershell
pnpm transition:genuine-study:first-study-readiness -- --player=<player-id> --current-variant=<variant-id> --proposed-variant=<variant-id> --actor=transition-operator
pnpm transition:genuine-study:first-study-readiness -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:first-study-readiness-report
pnpm transition:genuine-study:first-study-validation
```

The preflight reuses operator authorization, duplicate active-study protection, Player DNA resolution, canonical Equipment DNA loading, context assembly, observer checkpoint policy, and existing lifecycle concepts. It adds no Prisma migration, no public API, no UI, no scoring formula change, no calibration, no model promotion, and no live recommendation behavior change.

## Warnings

1. A match score represents compatibility based on available information. It is not a guarantee of player performance.
2. Recommendation scores should be calibrated as Ninery gathers verified outcome data.
3. Popularity, sponsorship, and manufacturer marketing must not influence scoring unless explicitly represented as transparent user preferences.

## MVP Limitations

- Variant-specific DNA adjustments are not implemented yet.
- Outcome-calibrated weights are future work.
- Development authorization is not production family/player access control.
- Raw scoring explanations are structured for correctness; later AI may rewrite tone but must not invent reasoning.
