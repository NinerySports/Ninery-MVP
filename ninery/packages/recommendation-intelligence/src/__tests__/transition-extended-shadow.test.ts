import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentEquipmentFamiliarityResult } from "@ninery/player-intelligence";
import type { TransitionCompatibilityV1_1Result } from "../compatibility/transition/index.js";
import {
  TRANSITION_EXTENDED_SHADOW_POLICY_VERSION,
  TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
  TRANSITION_OBSERVATION_SCHEMA_VERSION,
  TRANSITION_OUTCOME_COMPARISON_VERSION,
  InMemoryTransitionShadowStudyRepository,
  TransitionShadowStudyService,
  compareTransitionShadowStudyOutcome,
  createTransitionPredictionSnapshot,
  stableHash,
  validateTransitionExtendedShadowLanguage,
  type TransitionAdjustmentObservation,
  type TransitionExtendedShadowStudy
} from "../compatibility/transition/index.js";

test("extended-shadow constants and language guardrails are stable", () => {
  assert.equal(TRANSITION_EXTENDED_SHADOW_STUDY_VERSION, "1.0");
  assert.equal(TRANSITION_OBSERVATION_SCHEMA_VERSION, "1.0");
  assert.equal(TRANSITION_OUTCOME_COMPARISON_VERSION, "1.0");
  assert.equal(TRANSITION_EXTENDED_SHADOW_POLICY_VERSION, "1.0");
  assert.deepEqual(validateTransitionExtendedShadowLanguage("The adjustment appeared manageable after several sessions."), []);
  assert.ok(validateTransitionExtendedShadowLanguage("The model was proven correct.").length > 0);
  assert.ok(validateTransitionExtendedShadowLanguage("The bat caused the player to improve.").length > 0);
});

test("prediction snapshot is v1.1 only, immutable-shaped, and deterministically hashed", () => {
  const snapshot = createTransitionPredictionSnapshot(resultFixture(), familiarity(), date());
  const again = createTransitionPredictionSnapshot(resultFixture(), familiarity(), date());
  assert.equal(snapshot.transitionModelVersion, "1.1");
  assert.equal(snapshot.interpolationVersion, "1.0");
  assert.equal(snapshot.inputHash, again.inputHash);
  assert.equal(snapshot.predictionHash, again.predictionHash);
  assert.equal(snapshot.familiaritySnapshot.level, "established_familiarity");
  assert.ok(snapshot.trace);
});

test("study lifecycle enforces prediction, observation, completion, cancellation, and invalidation", async () => {
  const service = new TransitionShadowStudyService(new InMemoryTransitionShadowStudyRepository());
  const draft = await service.createDraftStudy({
    id: "study-1",
    playerId: "player-1",
    currentEquipmentId: "current",
    currentEquipmentVariantId: "current-v",
    proposedEquipmentId: "proposed",
    proposedEquipmentVariantId: "proposed-v",
    familiarity: familiarity(),
    observationPeriodKey: "2026-08",
    createdAt: date(),
    fixtureKind: "development_fixture"
  });
  assert.equal(draft.status, "draft");
  const captured = await service.capturePrediction(draft.id, {
    playerDNA: {} as never,
    currentEquipmentProfile: {} as never,
    proposedEquipmentProfile: {} as never,
    evaluatedAt: date()
  }, familiarity(), date()).catch((error: Error) => error);
  assert.ok(captured instanceof Error);
  const predicted = await service["repository"].updateStudy({ ...draft, prediction: createTransitionPredictionSnapshot(resultFixture(), familiarity(), date()), status: "prediction_captured", updatedAt: date() });
  assert.equal(predicted.status, "prediction_captured");
  const active = await service.startObservation(draft.id, date());
  assert.equal(active.status, "observation_active");
  const observed = await service.addObservation(draft.id, observation("early_sessions", "mild"));
  assert.equal(observed.observations.length, 1);
  const completed = await service.completeStudy(draft.id, date());
  assert.equal(completed.status, "observation_complete");
  await assert.rejects(() => service.addObservation(draft.id, observation("custom", "minimal")), /does not allow/);
  const cancelled = await service.createDraftStudy({ ...draft, id: "study-cancel", observationPeriodKey: "2026-09" });
  assert.equal((await service.cancelStudy(cancelled.id, "No equipment use occurred.", date())).status, "cancelled");
  const invalid = await service.createDraftStudy({ ...draft, id: "study-invalid", observationPeriodKey: "2026-10" });
  assert.equal((await service.invalidateStudy(invalid.id, "Wrong equipment was recorded.", date())).status, "invalidated");
});

test("observation validation rejects impossible adjustment values and sensitive notes", async () => {
  const service = new TransitionShadowStudyService(new InMemoryTransitionShadowStudyRepository());
  const study = await service.createDraftStudy({
    id: "study-2",
    playerId: "player-1",
    currentEquipmentId: "current",
    proposedEquipmentId: "proposed",
    familiarity: familiarity(),
    observationPeriodKey: "2026-08",
    createdAt: date()
  });
  await service["repository"].updateStudy({ ...study, prediction: createTransitionPredictionSnapshot(resultFixture(), familiarity(), date()), status: "observation_active", updatedAt: date() });
  await assert.rejects(() => service.addObservation(study.id, { ...observation("first_use", "moderate"), equipmentActuallyUsed: false }), /actual equipment use/);
  await assert.rejects(() => service.addObservation(study.id, { ...observation("first_use", "moderate"), notes: "medical diagnosis" }), /sensitive/);
});

test("outcome comparison handles aligned, material, insufficient, conflict, and invalidated cases without recommending changes", () => {
  const aligned = compareTransitionShadowStudyOutcome(study([observation("early_sessions", "mild")]));
  assert.equal(aligned.comparisonStatus, "broadly_aligned");
  assert.equal(aligned.modelChangeRecommended, false);
  assert.equal(aligned.livePromotionRecommended, false);
  const material = compareTransitionShadowStudyOutcome(study([observation("early_sessions", "very_substantial")]));
  assert.equal(material.comparisonStatus, "materially_different");
  const insufficient = compareTransitionShadowStudyOutcome(study([]));
  assert.equal(insufficient.comparisonStatus, "insufficient_observation");
  const conflict = compareTransitionShadowStudyOutcome(study([observation("first_use", "minimal"), { ...observation("early_sessions", "substantial"), source: "coach", conflictsWithAnotherSource: true }]));
  assert.equal(conflict.comparisonStatus, "conflicting_observations");
  const invalidated = compareTransitionShadowStudyOutcome({ ...study([]), status: "invalidated", invalidationReason: "Wrong equipment." });
  assert.equal(invalidated.comparisonStatus, "study_invalidated");
});

test("stable hash is deterministic and ignores key order", () => {
  assert.equal(stableHash({ b: 2, a: 1 }), stableHash({ a: 1, b: 2 }));
});

function study(observations: readonly ReturnType<typeof observation>[]): TransitionExtendedShadowStudy {
  return {
    version: "1.0",
    id: "study",
    studyKey: "key",
    playerId: "player-1",
    currentEquipmentId: "current",
    proposedEquipmentId: "proposed",
    status: "observation_complete",
    familiarity: familiarity(),
    prediction: createTransitionPredictionSnapshot(resultFixture(), familiarity(), date()),
    observations,
    createdAt: date(),
    updatedAt: date()
  };
}

function observation(
  checkpoint: "first_use" | "early_sessions" | "acclimation_period" | "custom",
  observedAdjustmentDemand: "minimal" | "mild" | "moderate" | "substantial" | "very_substantial"
): TransitionAdjustmentObservation {
  return {
    version: "1.0" as const,
    checkpoint,
    observedAt: date(),
    equipmentActuallyUsed: true,
    meaningfulUseOccurred: true,
    observedAdjustmentDemand,
    observationConfidence: "moderate" as const,
    source: "parent_or_guardian" as const,
    directlyWitnessed: true
  };
}

function familiarity(): CurrentEquipmentFamiliarityResult {
  return {
    version: "1.0",
    playerId: "player-1",
    equipmentId: "current",
    equipmentVariantId: "current-v",
    level: "established_familiarity",
    numericReference: 75,
    confidence: "high",
    availableInputs: ["estimatedSessionsUsed"],
    missingInputs: [],
    reasons: ["fixture"],
    warnings: [],
    evaluatedAt: date()
  };
}

function resultFixture(): TransitionCompatibilityV1_1Result {
  return {
    version: "1.1",
    modelVersion: "1.1",
    policyVersion: "1.1",
    reasonVersion: "1.0",
    changeProfileVersion: "1.0",
    interpolationVersion: "1.0",
    candidateVersion: "v1_1_linear_interpolation",
    recommendationUsePolicy: "shadow_only",
    playerId: "player-1",
    currentEquipmentId: "current",
    currentEquipmentVariantId: "current-v",
    proposedEquipmentId: "proposed",
    proposedEquipmentVariantId: "proposed-v",
    score: 94,
    band: "very_manageable_transition",
    dimensions: [],
    confidence: "moderate",
    reasons: [],
    tradeoffs: [],
    missingInformation: [],
    playerReadiness: { version: "1.0", playerId: "player-1", sourceSummary: { availableInputs: [], missingInputs: [], derivedInputs: [] }, confidence: "moderate" },
    currentEquipment: { equipmentId: "current", equipmentVariantId: "current-v", sourceSummary: { availableInputs: [], missingInputs: [] } },
    proposedEquipment: { equipmentId: "proposed", equipmentVariantId: "proposed-v", sourceSummary: { numericReferenceInputs: [], ordinalProjectedInputs: [], specificationInputs: [], missingInputs: [] } },
    changeProfile: { version: "1.0", rawDifferences: {}, missingInputs: [] },
    interpolationTrace: [],
    readinessModifierTrace: [],
    productionUseAllowed: false,
    liveRecommendationUseAllowed: false,
    trace: {
      currentEquipmentValues: {},
      proposedEquipmentValues: {},
      normalizedDifferences: {},
      demandThresholds: {},
      readinessModifiers: [],
      componentWeights: {
        size_change_demand: 0.15,
        mass_change_demand: 0.2,
        drop_change_demand: 0.15,
        balance_change_demand: 0.15,
        swing_effort_change_demand: 0.2,
        experience_adjustment_demand: 0.15
      },
      componentCoverage: { scoredComponents: 6, totalComponents: 6 },
      missingInputs: [],
      confidenceFactors: [],
      versions: { model: "1.1", policy: "1.1", reason: "1.0", changeProfile: "1.0", playerDNA: "1.0.0", currentEquipmentDNA: "1.0", proposedEquipmentDNA: "1.0" },
      reasonThresholds: { manageableMinimum: 75, demandingMaximum: 64 },
      interpolationVersion: "1.0",
      interpolationCurves: {},
      readinessBounds: { minimumMultiplier: 0.35, maximumMultiplier: 1.2, maximumAbsoluteDemandReduction: 20, maximumAbsoluteDemandIncrease: 12, minimumDemandRetained: 0.35 },
      candidateVersion: "v1_1_linear_interpolation",
      productionUseAllowed: false,
      liveRecommendationUseAllowed: false
    },
    status: "completed",
    evaluatedAt: date()
  };
}

function date(): Date {
  return new Date("2026-08-05T00:00:00.000Z");
}
