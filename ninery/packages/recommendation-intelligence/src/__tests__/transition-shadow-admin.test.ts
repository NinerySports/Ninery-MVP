import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentEquipmentFamiliarityResult } from "@ninery/player-intelligence";
import {
  InMemoryTransitionShadowAdminRepository,
  TRANSITION_SHADOW_ADMIN_DELIVERY_MODE,
  TRANSITION_SHADOW_ADMIN_POLICY_VERSION,
  TRANSITION_SHADOW_ADMIN_WORKFLOW_VERSION,
  TRANSITION_SHADOW_AUDIT_EVENT_VERSION,
  TRANSITION_SHADOW_ELIGIBILITY_VERSION,
  TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION,
  TransitionShadowAdminError,
  TransitionShadowAdminService,
  checkpointStatusesForStudy,
  createTransitionPredictionSnapshot,
  evaluateTransitionShadowAuthorization,
  observationCorrectionPolicy,
  validateTransitionShadowAdminNote,
  type TransitionAdjustmentObservation,
  type TransitionCompatibilityV1_1Result,
  type TransitionExtendedShadowStudy,
  type TransitionShadowCreateDraftInput,
  type TransitionShadowInternalActor
} from "../index.js";

test("delivery mode is service and CLI only with stable version constants", () => {
  assert.equal(TRANSITION_SHADOW_ADMIN_DELIVERY_MODE, "service_and_cli_only");
  assert.equal(TRANSITION_SHADOW_ADMIN_POLICY_VERSION, "1.0");
  assert.equal(TRANSITION_SHADOW_ADMIN_WORKFLOW_VERSION, "1.0");
  assert.equal(TRANSITION_SHADOW_AUDIT_EVENT_VERSION, "1.0");
  assert.equal(TRANSITION_SHADOW_ELIGIBILITY_VERSION, "1.0");
  assert.equal(TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION, "1.0");
});

test("authorization fails closed and separates fixture access and invalidation authority", () => {
  assert.equal(evaluateTransitionShadowAuthorization({ capability: "transition_shadow_study_view" }).allowed, false);
  assert.equal(evaluateTransitionShadowAuthorization({ actor: { ...operator(), active: false }, capability: "transition_shadow_study_view" }).allowed, false);
  assert.equal(evaluateTransitionShadowAuthorization({ actor: { ...operator(), roleCodes: ["unknown"] }, capability: "transition_shadow_study_view" }).allowed, false);
  assert.equal(evaluateTransitionShadowAuthorization({ actor: operator(), capability: "transition_shadow_observation_add" }).allowed, true);
  assert.equal(evaluateTransitionShadowAuthorization({ actor: operator(), capability: "transition_shadow_study_invalidate" }).allowed, false);
  assert.equal(evaluateTransitionShadowAuthorization({ actor: admin(), capability: "transition_shadow_study_invalidate" }).allowed, true);
  assert.equal(evaluateTransitionShadowAuthorization({ actor: operator(), capability: "transition_shadow_study_view", requiresFixtureAccess: true }).allowed, false);
});

test("eligibility blocks missing records and synthetic/genuine mismatch", async () => {
  const service = new TransitionShadowAdminService(repositoryFixture({ syntheticPlayer: true }));
  const result = await service.evaluateEligibility(input({ evidenceClassification: "genuine_internal_observation", captureOrigin: "internal_guided_entry" }), operator(), date());
  assert.equal(result.eligible, false);
  assert.ok(result.blockers.some((blocker) => /synthetic/i.test(blocker)));
  assert.equal(result.version, "1.0");
});

test("study creation preserves classification, prevents duplicates, and writes audit", async () => {
  const repository = repositoryFixture();
  const service = new TransitionShadowAdminService(repository);
  const created = await service.createTransitionShadowStudyDraft(input(), operator());
  assert.equal(created.study.status, "draft");
  assert.equal(created.study.fixtureKind, "real_observation");
  assert.equal(created.study.familiarity.level, "established_familiarity");
  assert.equal((await repository.listAuditEvents(created.study.id)).length, 1);
  await assert.rejects(() => service.createTransitionShadowStudyDraft(input({ id: "study-duplicate" }), operator()), (error: Error) => error instanceof TransitionShadowAdminError && error.code === "ACTIVE_STUDY_EXISTS");
});

test("synthetic fixtures are excluded from lists by default", async () => {
  const repository = repositoryFixture();
  const service = new TransitionShadowAdminService(repository);
  await service.createTransitionShadowStudyDraft(input(), operator());
  await service.createTransitionShadowStudyDraft(input({ id: "fixture", observationPeriodKey: "fixture", evidenceClassification: "development_fixture" }), admin());
  assert.equal((await service.listStudies()).length, 1);
  assert.equal((await service.listStudies({ includeSynthetic: true })).length, 2);
});

test("observation workflow requires prediction, source metadata, and blocks post-completion writes", async () => {
  const repository = repositoryFixture();
  const service = new TransitionShadowAdminService(repository);
  const { study } = await service.createTransitionShadowStudyDraft(input(), operator());
  await assert.rejects(() => service.startTransitionShadowObservation(study.id, { startedAt: date(1) }, operator()), /prediction/i);
  const predicted = await repository.updateStudy({ ...study, status: "prediction_captured", prediction: prediction(), updatedAt: date(1) });
  const active = await service.startTransitionShadowObservation(predicted.id, { startedAt: date(2) }, operator());
  const observed = await service.addTransitionShadowObservation(active.id, observation("early_sessions", "mild"), operator());
  assert.equal(observed.observations.length, 1);
  await assert.rejects(() => service.addTransitionShadowObservation(observed.id, { ...observation("first_use", "moderate"), equipmentActuallyUsed: false }, operator()), /actual equipment use/i);
  const completed = await service.completeTransitionShadowStudy(observed.id, { completedAt: date(20) }, operator());
  assert.equal(completed.status, "observation_complete");
  await assert.rejects(() => service.addTransitionShadowObservation(completed.id, observation("acclimation_period", "minimal"), operator()), (error: Error) => error instanceof TransitionShadowAdminError && error.code === "OBSERVATION_WINDOW_NOT_ACTIVE");
});

test("completion review, cancellation, invalidation, admin view, and operational summary are deterministic", async () => {
  const repository = repositoryFixture();
  const service = new TransitionShadowAdminService(repository);
  const { study } = await service.createTransitionShadowStudyDraft(input(), operator());
  const predicted = await repository.updateStudy({ ...study, status: "prediction_captured", prediction: prediction(), updatedAt: date(1) });
  const active = await service.startTransitionShadowObservation(predicted.id, { startedAt: date(2) }, operator());
  const observed = await service.addTransitionShadowObservation(active.id, { ...observation("early_sessions", "substantial"), conflictsWithAnotherSource: true }, operator());
  const review = await service.reviewTransitionShadowStudyForCompletion(observed.id, operator(), date(20));
  assert.equal(review.completionEligible, false);
  assert.equal(review.overrideReasonRequired, true);
  await assert.rejects(() => service.completeTransitionShadowStudy(observed.id, { completedAt: date(20) }, operator()), /override/i);
  const completed = await service.completeTransitionShadowStudy(observed.id, { completedAt: date(20), overrideReason: "Complete with retained source conflict for review." }, operator());
  const view = await service.getStudyAdminView(completed.id, operator(), date(21));
  assert.equal(view.observationSummary.conflictsDetected, true);
  assert.equal(view.playerSummary.displayLabel, "Jackson Sanders");
  assert.ok(view.lifecycleActions.some((action) => action.action === "invalidate" && !action.allowed));
  const cancelled = await service.createTransitionShadowStudyDraft(input({ id: "cancel", observationPeriodKey: "cancel" }), operator());
  await assert.rejects(() => service.cancelTransitionShadowStudy(cancelled.study.id, "", admin(), date(2)), /reason/i);
  assert.equal((await service.cancelTransitionShadowStudy(cancelled.study.id, "No field observation will occur.", admin(), date(2))).status, "cancelled");
  const invalid = await service.createTransitionShadowStudyDraft(input({ id: "invalid", observationPeriodKey: "invalid" }), operator());
  await assert.rejects(() => service.invalidateTransitionShadowStudy(invalid.study.id, { reasonCode: "incorrect_proposed_equipment", detail: "Wrong variant.", invalidatedAt: date(3) }, operator()), /Capability/);
  assert.equal((await service.invalidateTransitionShadowStudy(invalid.study.id, { reasonCode: "incorrect_proposed_equipment", detail: "Wrong variant.", invalidatedAt: date(3) }, admin())).status, "invalidated");
  await assert.rejects(
    () => service.completeTransitionShadowStudy(invalid.study.id, { completedAt: date(4), overrideReason: "Terminal status must still block completion." }, admin()),
    (error: Error) => error instanceof TransitionShadowAdminError && error.code === "INVALID_STATUS_TRANSITION"
  );
  const summary = await service.operationalSummary(date(25));
  assert.equal(summary.studyCounts.genuine, 3);
  assert.equal(summary.studyCounts.observationComplete, 1);
  assert.equal(summary.studyCounts.cancelled, 1);
  assert.equal(summary.studyCounts.invalidated, 1);
  assert.equal(summary.modelVersions["1.1"], 1);
});

test("checkpoint status, observation correction, and note language policies are explicit", () => {
  const draft: TransitionExtendedShadowStudy = {
    version: "1.0",
    id: "study",
    studyKey: "key",
    playerId: "player-1",
    currentEquipmentId: "current",
    proposedEquipmentId: "proposed",
    status: "observation_active",
    familiarity: familiarity(),
    prediction: prediction(),
    observationWindowStartedAt: date(0),
    observations: [observation("first_use", "minimal"), { ...observation("early_sessions", "mild"), observationConfidence: "low" }],
    createdAt: date(0),
    updatedAt: date(8)
  };
  const statuses = checkpointStatusesForStudy(draft, date(30));
  assert.equal(statuses.find((item) => item.checkpoint === "first_use")?.status, "completed");
  assert.equal(statuses.find((item) => item.checkpoint === "early_sessions")?.status, "completed_low_confidence");
  assert.equal(statuses.find((item) => item.checkpoint === "acclimation_period")?.status, "due");
  assert.equal(observationCorrectionPolicy().policy, "append_only");
  assert.deepEqual(validateTransitionShadowAdminNote("The proposed bat was used during practice."), []);
  assert.ok(validateTransitionShadowAdminNote("The player failed the transition.").length > 0);
  assert.ok(validateTransitionShadowAdminNote("The bat caused improvement.").length > 0);
});

function repositoryFixture(options: { readonly syntheticPlayer?: boolean } = {}) {
  const repository = new InMemoryTransitionShadowAdminRepository();
  repository.players.set("player-1", { id: "player-1", status: "active", label: "Jackson Sanders", synthetic: options.syntheticPlayer });
  repository.playerDNA.add("player-1");
  repository.equipment.set("current", { id: "current", label: "Rawlings ICON 2026" });
  repository.equipment.set("proposed", { id: "proposed", label: "Louisville Slugger Atlas 2026" });
  repository.variants.set("current-v", { id: "current-v", equipmentId: "current", label: "RAW-ICON-USA-30-22" });
  repository.variants.set("proposed-v", { id: "proposed-v", equipmentId: "proposed", label: "LS-ATLAS-USA-30-22" });
  return repository;
}

function input(overrides: Partial<TransitionShadowCreateDraftInput> = {}): TransitionShadowCreateDraftInput {
  return {
    id: "study-1",
    playerId: "player-1",
    currentEquipmentId: "current",
    currentEquipmentVariantId: "current-v",
    proposedEquipmentId: "proposed",
    proposedEquipmentVariantId: "proposed-v",
    observationPeriodKey: "2026-08",
    evidenceClassification: "genuine_internal_observation",
    studyPurpose: "Internal extended-shadow validation.",
    captureOrigin: "internal_guided_entry",
    familiarityInput: {
      playerId: "player-1",
      equipmentId: "current",
      equipmentVariantId: "current-v",
      estimatedSessionsUsed: 24,
      estimatedWeeksUsed: 10,
      regularUseFrequency: "multiple_times_weekly",
      usageContexts: ["practice", "games"],
      currentlyPrimaryEquipment: true,
      directlyReportedFamiliarity: "familiar",
      source: "combined",
      capturedAt: date()
    },
    createdAt: date(),
    ...overrides
  };
}

function operator(): TransitionShadowInternalActor {
  return { actorId: "dev-operator", roleCodes: ["transition_shadow_operator"], capabilityCodes: [], active: true };
}

function admin(): TransitionShadowInternalActor {
  return { actorId: "dev-admin", roleCodes: ["transition_shadow_administrator"], capabilityCodes: [], active: true };
}

function observation(checkpoint: TransitionAdjustmentObservation["checkpoint"], observedAdjustmentDemand: TransitionAdjustmentObservation["observedAdjustmentDemand"]): TransitionAdjustmentObservation {
  return {
    version: "1.0",
    checkpoint,
    observedAt: date(3),
    equipmentActuallyUsed: true,
    meaningfulUseOccurred: true,
    observedAdjustmentDemand,
    observationConfidence: "moderate",
    source: "parent_or_guardian",
    directlyWitnessed: true,
    notes: "The proposed bat was used during practice."
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

function prediction() {
  return createTransitionPredictionSnapshot(resultFixture(), familiarity(), date(1));
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

function date(days = 0): Date {
  return new Date(Date.UTC(2026, 7, 8 + days));
}
