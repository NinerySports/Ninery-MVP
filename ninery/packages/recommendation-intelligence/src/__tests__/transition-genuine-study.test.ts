import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentEquipmentFamiliarityResult } from "@ninery/player-intelligence";
import {
  InMemoryTransitionShadowAdminRepository,
  TRANSITION_EVIDENCE_QUALITY_VERSION,
  TRANSITION_FIELD_OBSERVATION_PROTOCOL_VERSION,
  TRANSITION_GENUINE_EVIDENCE_POLICY_VERSION,
  TRANSITION_GENUINE_STUDY_INTAKE_VERSION,
  TRANSITION_PARTICIPATION_ACKNOWLEDGEMENT_VERSION,
  TransitionGenuineStudyIntakeService,
  createTransitionPredictionSnapshot,
  evaluateFieldObservationReadiness,
  evaluateObservationEvidenceQuality,
  fieldObservationProtocol,
  genuineStudyReadinessReport,
  registryEntryForStudy,
  summarizeGenuineEvidenceRegistry,
  validateGenuineEvidenceRegistry,
  validateTransitionGenuineStudyLanguage,
  type TransitionAdjustmentObservation,
  type TransitionCompatibilityV1_1Result,
  type TransitionGenuineStudyCreateInput,
  type TransitionShadowInternalActor
} from "../index.js";

test("genuine study version constants and protocol language are explicit", () => {
  assert.equal(TRANSITION_GENUINE_STUDY_INTAKE_VERSION, "1.0");
  assert.equal(TRANSITION_FIELD_OBSERVATION_PROTOCOL_VERSION, "1.0");
  assert.equal(TRANSITION_GENUINE_EVIDENCE_POLICY_VERSION, "1.0");
  assert.equal(TRANSITION_PARTICIPATION_ACKNOWLEDGEMENT_VERSION, "1.0");
  assert.equal(TRANSITION_EVIDENCE_QUALITY_VERSION, "1.0");
  assert.match(fieldObservationProtocol.checkpoints.first_use, /meaningful use/i);
  assert.equal(genuineStudyReadinessReport().deliveryMode, "service_and_cli_only");
  assert.equal(genuineStudyReadinessReport().livePromotionAutomaticallyRecommended, false);
});

test("acknowledgement is required and is not represented as legal consent", async () => {
  const service = new TransitionGenuineStudyIntakeService(repositoryFixture());
  const missing = await service.evaluateGenuineStudyEligibility({ ...input(), participationAcknowledgement: { ...ack(), purposeAcknowledged: false } }, operator());
  assert.equal(missing.eligible, false);
  assert.ok(missing.checks.some((check) => check.code === "participation_acknowledgement_captured" && !check.passed));
  const valid = await service.evaluateGenuineStudyEligibility(input(), operator());
  assert.equal(valid.eligible, true);
  assert.equal(input().participationAcknowledgement.acknowledgementType, "internal_operational_authorization");
});

test("genuine eligibility blocks fixture players, synthetic classification, missing equipment context, and retrospective outcomes", async () => {
  const service = new TransitionGenuineStudyIntakeService(repositoryFixture({ syntheticPlayer: true }));
  const fixturePlayer = await service.evaluateGenuineStudyEligibility(input(), operator());
  assert.equal(fixturePlayer.eligible, false);
  assert.ok(fixturePlayer.blockers.some((blocker) => /Synthetic/i.test(blocker) || /synthetic/i.test(blocker)));

  const normal = new TransitionGenuineStudyIntakeService(repositoryFixture());
  const missingCurrent = await normal.evaluateGenuineStudyEligibility({ ...input(), currentEquipmentVerification: { ...input().currentEquipmentVerification, equipmentVariantId: undefined } }, operator());
  assert.equal(missingCurrent.eligible, false);
  assert.ok(missingCurrent.checks.some((check) => check.code === "current_variant_identified" && !check.passed));

  const recommendationAlone = await normal.evaluateGenuineStudyEligibility({ ...input(), currentEquipmentVerification: { ...input().currentEquipmentVerification, verifiedAsActualCurrentPrimary: false } }, operator());
  assert.equal(recommendationAlone.eligible, false);
  assert.ok(recommendationAlone.checks.some((check) => check.code === "current_equipment_actual_primary" && !check.passed));

  const retrospective = await normal.evaluateGenuineStudyEligibility({ ...input(), outcomeAlreadyKnownBeforePrediction: true }, operator());
  assert.equal(retrospective.eligible, false);
  assert.ok(retrospective.blockers.includes("OUTCOME_ALREADY_KNOWN_BEFORE_PREDICTION"));
});

test("genuine intake uses admin workflow and dry run does not create fake genuine evidence", async () => {
  const repository = repositoryFixture();
  const service = new TransitionGenuineStudyIntakeService(repository);
  const dryRunA = await service.genuineIntakeDryRun(input(), operator());
  const dryRunB = await service.genuineIntakeDryRun(input(), operator());
  assert.equal(dryRunA.fixtureClassification, "development_fixture");
  assert.equal(dryRunA.wouldCreateGenuineEvidence, false);
  assert.deepEqual(dryRunA, dryRunB);
  assert.equal((await repository.listStudies({ includeSynthetic: true })).length, 0);

  const created = await service.createGenuineTransitionShadowStudy(input(), operator());
  const study = await repository.getStudy(created.studyId);
  assert.equal(study?.fixtureKind, "real_observation");
  assert.equal(study?.status, "draft");
  assert.equal(created.intakeSnapshot.evidenceClassification, "genuine_internal_observation");
  assert.equal((await repository.listAuditEvents(created.studyId)).some((event) => event.action === "study_eligibility_reviewed"), true);
});

test("pre-observation readiness requires prospective v1.1 prediction and acknowledgement", () => {
  const base = studyFixture({ status: "prediction_captured", prediction: prediction() });
  const ready = evaluateFieldObservationReadiness(base, true, true, date(2));
  assert.equal(ready.ready, true);
  const missingAck = evaluateFieldObservationReadiness(base, false, true, date(2));
  assert.equal(missingAck.ready, false);
  assert.ok(missingAck.blockers.some((blocker) => /acknowledgement/i.test(blocker)));
  const fixture = evaluateFieldObservationReadiness({ ...base, fixtureKind: "development_fixture" }, true, true, date(2));
  assert.equal(fixture.ready, false);
});

test("evidence quality evaluates direct witness, checkpoint coverage, conflicts, and disagreement without false validation", () => {
  const limited = evaluateObservationEvidenceQuality(studyFixture({ observations: [observation("first_use", "substantial", true, "moderate")] }), date(10));
  assert.equal(limited.quality, "limited");
  const usableDisagreement = evaluateObservationEvidenceQuality(studyFixture({ observations: [observation("first_use", "substantial", true, "moderate"), observation("early_sessions", "substantial", true, "moderate")] }), date(10));
  assert.equal(usableDisagreement.quality, "usable");
  const strong = evaluateObservationEvidenceQuality(studyFixture({ observations: [observation("first_use", "minimal", true, "high"), observation("early_sessions", "mild", true, "high"), observation("acclimation_period", "mild", false, "moderate")] }), date(35));
  assert.equal(strong.quality, "strong");
  const conflict = evaluateObservationEvidenceQuality(studyFixture({ observations: [observation("first_use", "minimal", true, "high"), { ...observation("early_sessions", "substantial", true, "high"), conflictsWithAnotherSource: true }, observation("acclimation_period", "moderate", true, "high")] }), date(35));
  assert.equal(conflict.quality, "usable");
  assert.ok(conflict.warnings.some((warning) => /conflict/i.test(warning)));
});

test("registry includes genuine completed disagreement but excludes fixtures, cancelled, and invalidated studies", () => {
  const genuine = studyFixture({ status: "observation_complete", observations: [observation("first_use", "substantial", true, "moderate"), observation("early_sessions", "substantial", true, "moderate")] });
  const fixture = { ...genuine, id: "fixture", studyKey: "ticket-040-admin-workflow", fixtureKind: "development_fixture" };
  const cancelled = { ...genuine, id: "cancelled", status: "cancelled" };
  const invalidated = { ...genuine, id: "invalidated", status: "invalidated" };
  const entry = registryEntryForStudy(genuine, date(35));
  assert.equal(entry?.comparisonStatus, "materially_different");
  const summary = summarizeGenuineEvidenceRegistry([genuine, fixture, cancelled, invalidated], date(35));
  assert.equal(summary.genuineCompletedStudies, 1);
  assert.equal(summary.registryEligible, 1);
  assert.equal(summary.cancelled, 1);
  assert.equal(summary.invalidated, 1);
  const validation = validateGenuineEvidenceRegistry([genuine, fixture, cancelled, invalidated], (studyId) => studyId === "study-1", date(35));
  assert.equal(validation.verdict, "pass");
});

test("language safety rejects prohibited causal, clinical, and sensitive language", () => {
  assert.deepEqual(validateTransitionGenuineStudyLanguage("The player used the bat during four cage sessions."), []);
  assert.ok(validateTransitionGenuineStudyLanguage("The bat fixed his confidence.").length > 0);
  assert.ok(validateTransitionGenuineStudyLanguage("The coach thinks the child has ADHD.").length > 0);
  assert.ok(validateTransitionGenuineStudyLanguage("The model was right.").length > 0);
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

function input(overrides: Partial<TransitionGenuineStudyCreateInput> = {}): TransitionGenuineStudyCreateInput {
  return {
    id: "study-1",
    playerId: "player-1",
    observationPeriodKey: "2026-08-genuine",
    currentEquipmentVerification: {
      equipmentId: "current",
      equipmentVariantId: "current-v",
      lengthInches: 30,
      weightOunces: 22,
      dropWeight: -8,
      certification: "USA",
      verifiedAsActualCurrentPrimary: true,
      source: "combined",
      verifiedAt: date()
    },
    proposedEquipmentVerification: {
      equipmentId: "proposed",
      equipmentVariantId: "proposed-v",
      lengthInches: 30,
      weightOunces: 22,
      dropWeight: -8,
      certification: "USA",
      expectedToBeUsed: true,
      availableForUse: true,
      sizeSpecificationMatched: true,
      source: "combined",
      verifiedAt: date()
    },
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
    participationAcknowledgement: ack(),
    playerDNAProfileId: "player-dna-1",
    playerDNAVersion: "1.0.0",
    captureOrigin: "internal_guided_entry",
    internalNote: "The proposed bat will be observed during equipment-specific follow-up.",
    createdAt: date(),
    ...overrides
  };
}

function ack() {
  return {
    version: "1.0" as const,
    playerId: "player-1",
    acknowledgementType: "internal_operational_authorization" as const,
    acknowledgedByRole: "internal_staff" as const,
    acknowledgedAt: date(),
    purposeAcknowledged: true,
    observationalNatureAcknowledged: true,
    noRecommendationImpactAcknowledged: true,
    voluntaryFeedbackAcknowledged: true,
    sourceReference: "internal-ticket-041-reference",
    capturedByActorId: "dev-operator"
  };
}

function operator(): TransitionShadowInternalActor {
  return { actorId: "dev-operator", roleCodes: ["transition_shadow_operator"], capabilityCodes: [], active: true };
}

function studyFixture(overrides: Partial<ReturnType<typeof baseStudy>> = {}) {
  return { ...baseStudy(), ...overrides };
}

function baseStudy() {
  return {
    id: "study-1",
    studyKey: "genuine-study",
    playerId: "player-1",
    currentEquipmentId: "current",
    currentEquipmentVariantId: "current-v",
    proposedEquipmentId: "proposed",
    proposedEquipmentVariantId: "proposed-v",
    status: "observation_complete",
    fixtureKind: "real_observation",
    prediction: prediction(),
    observations: [observation("first_use", "minimal", true, "moderate"), observation("early_sessions", "mild", true, "moderate")],
    familiarity: familiarity(),
    observationWindowCompletedAt: date(20)
  };
}

function observation(checkpoint: TransitionAdjustmentObservation["checkpoint"], observedAdjustmentDemand: TransitionAdjustmentObservation["observedAdjustmentDemand"], directlyWitnessed: boolean, observationConfidence: TransitionAdjustmentObservation["observationConfidence"]): TransitionAdjustmentObservation {
  return {
    version: "1.0",
    checkpoint,
    observedAt: checkpoint === "first_use" ? date(3) : checkpoint === "early_sessions" ? date(8) : date(28),
    equipmentActuallyUsed: true,
    meaningfulUseOccurred: true,
    observedAdjustmentDemand,
    swingEffortAdjustment: observedAdjustmentDemand === "very_substantial" ? "substantial" : observedAdjustmentDemand,
    timingAdjustment: observedAdjustmentDemand === "very_substantial" ? "substantial" : observedAdjustmentDemand,
    barrelControlAdjustment: observedAdjustmentDemand === "very_substantial" ? "substantial" : observedAdjustmentDemand,
    balanceFeelAdjustment: observedAdjustmentDemand === "very_substantial" ? "substantial" : observedAdjustmentDemand,
    continuedUsingProposedEquipment: "yes",
    observationConfidence,
    source: "parent_or_guardian",
    directlyWitnessed,
    sessionContext: { context: "batting_cage", approximateSwingCount: "26_to_50" },
    notes: "The player used the bat during cage sessions."
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
      componentWeights: { size_change_demand: 0.15, mass_change_demand: 0.2, drop_change_demand: 0.15, balance_change_demand: 0.15, swing_effort_change_demand: 0.2, experience_adjustment_demand: 0.15 },
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
  return new Date(Date.UTC(2026, 7, 9 + days));
}
