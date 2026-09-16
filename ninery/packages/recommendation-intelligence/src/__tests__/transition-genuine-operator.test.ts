import assert from "node:assert/strict";
import test from "node:test";
import type {
  CanonicalEquipmentDNAAttributeValue,
  CanonicalEquipmentDNAProfile,
  EquipmentDNAAttributeDomain,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "@ninery/equipment-intelligence";
import type { CurrentEquipmentFamiliarityResult, PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  InMemoryTransitionShadowAdminRepository,
  TRANSITION_GENUINE_OBSERVATION_ENTRY_VERSION,
  TRANSITION_GENUINE_OPERATOR_CLI_VERSION,
  TRANSITION_GENUINE_OPERATOR_REVIEW_VERSION,
  TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION,
  TransitionGenuineOperatorError,
  TransitionGenuineOperatorService,
  createTransitionPredictionSnapshot,
  evaluateTransitionGenuineOperatorEnvironment,
  resolveTransitionGenuineOperatorActor,
  transitionGenuineOperatorHelpText,
  transitionGenuineOperatorReadinessReport,
  transitionGenuineOperatorValidationReport,
  type GenuineTransitionOperatorIntakeInput,
  type TransitionAdjustmentObservation,
  type TransitionCompatibilityV1_1Result
} from "../index.js";

test("operator constants, fixed actors, help, and environment guard are stable", () => {
  assert.equal(TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION, "1.0");
  assert.equal(TRANSITION_GENUINE_OPERATOR_REVIEW_VERSION, "1.0");
  assert.equal(TRANSITION_GENUINE_OPERATOR_CLI_VERSION, "1.0");
  assert.equal(TRANSITION_GENUINE_OBSERVATION_ENTRY_VERSION, "1.0");
  assert.equal(resolveTransitionGenuineOperatorActor("transition-operator")?.roleCodes[0], "transition_shadow_operator");
  assert.equal(resolveTransitionGenuineOperatorActor("missing"), undefined);
  assert.equal(evaluateTransitionGenuineOperatorEnvironment("development").allowed, true);
  assert.equal(evaluateTransitionGenuineOperatorEnvironment("production").allowed, false);
  assert.match(transitionGenuineOperatorHelpText(), /INTERNAL EXTENDED-SHADOW TOOLING/);
});

test("prepare requires actor, fails closed, and does not persist", async () => {
  const repository = repositoryFixture();
  const service = new TransitionGenuineOperatorService(repository);
  await assert.rejects(() => service.prepareIntake(input(), {}), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "UNAUTHORIZED");
  await assert.rejects(() => service.prepareIntake(input(), { actorId: "transition-operator", environment: "unsupported" }), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "UNSUPPORTED_ENVIRONMENT");
  const prepared = await service.prepareIntake(input(), { actorId: "transition-operator", environment: "development" });
  assert.equal(prepared.wouldPersist, false);
  assert.equal(prepared.review.readyToCommit, true);
  assert.equal((await repository.listStudies({ includeSynthetic: true })).length, 0);
});

test("create requires confirmation, supports dry-run, creates genuine draft through admin workflow, and blocks duplicates", async () => {
  const repository = repositoryFixture();
  const service = new TransitionGenuineOperatorService(repository);
  const dryRun = await service.createGenuineStudyFromOperatorIntake(input(), { actorId: "transition-operator", environment: "development", dryRun: true });
  assert.equal(dryRun.persisted, false);
  assert.equal((await repository.listStudies({ includeSynthetic: true })).length, 0);
  await assert.rejects(() => service.createGenuineStudyFromOperatorIntake(input(), { actorId: "transition-operator", environment: "development" }), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "CONFIRMATION_REQUIRED");
  const created = await service.createGenuineStudyFromOperatorIntake(input(), { actorId: "transition-operator", environment: "development", confirmGenuineStudy: true });
  assert.equal(created.persisted, true);
  const study = await repository.getStudy(created.studyId!);
  assert.equal(study?.fixtureKind, "real_observation");
  assert.equal((await repository.listAuditEvents(created.studyId)).length >= 2, true);
  await assert.rejects(() => service.createGenuineStudyFromOperatorIntake({ ...input(), id: "study-duplicate" }, { actorId: "transition-operator", environment: "development", confirmGenuineStudy: true }), /active study/i);
});

test("prediction capture is v1.1, prospective, immutable, and observation start requires confirmation", async () => {
  const { repository, service, studyId } = await createdService();
  const result = await service.capturePrediction({ studyId, actorId: "transition-operator", compatibilityInput: compatibilityInput(), predictedAt: date(1), manualInputOverride: true }, { environment: "development" });
  assert.equal(result.modelVersion, "1.1");
  assert.equal(result.score > 0, true);
  await assert.rejects(() => service.capturePrediction({ studyId, actorId: "transition-operator", compatibilityInput: compatibilityInput(), predictedAt: date(2), manualInputOverride: true }, { environment: "development" }), /draft/i);
  await assert.rejects(() => service.startObservation(studyId, "transition-operator", { startedAt: date(2) }, { environment: "development" }), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "CONFIRMATION_REQUIRED");
  const active = await service.startObservation(studyId, "transition-operator", { startedAt: date(2), confirm: true }, { environment: "development" });
  assert.equal(active.status, "observation_active");
  assert.equal((await repository.listAuditEvents(studyId)).some((event) => event.action === "observation_started"), true);
});

test("observation entry supports checkpoints, blocks before start, and correction is append-only with reason", async () => {
  const { service, studyId } = await predictedService();
  await assert.rejects(() => service.addObservation({ studyId, actorId: "transition-operator", observation: observation("first_use", date(3)) }, { environment: "development" }), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "OBSERVATION_NOT_READY");
  await service.startObservation(studyId, "transition-operator", { startedAt: date(2), confirm: true }, { environment: "development" });
  const first = await service.addObservation({ studyId, actorId: "transition-operator", observation: observation("first_use", date(3)) }, { environment: "development" });
  assert.equal(first.checkpoint, "first_use");
  const early = await service.addObservation({ studyId, actorId: "transition-operator", observation: observation("early_sessions", date(8)) }, { environment: "development" });
  assert.equal(early.observationCount, 2);
  await assert.rejects(() => service.correctObservation({ studyId, actorId: "transition-operator", observation: observation("acclimation_period", date(28)) }, { environment: "development" }), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "CORRECTION_REASON_REQUIRED");
  const corrected = await service.correctObservation({ studyId, actorId: "transition-operator", correctionReason: "Adjust equipment-specific observation label.", observation: { ...observation("acclimation_period", date(28)), sourceReference: "original" } }, { environment: "development" });
  assert.equal(corrected.appendOnly, true);
  assert.equal(corrected.observationCount, 3);
});

test("completion, cancellation, invalidation, show/list/audit, and validation reports preserve guardrails", async () => {
  const { service, studyId } = await activeObservedService();
  const review = await service.completionReview(studyId, "transition-operator");
  assert.equal(review.evidenceQuality.quality, "usable");
  await assert.rejects(() => service.completeStudy(studyId, { actorId: "transition-operator", completedAt: date(20) }, { environment: "development" }), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "CONFIRMATION_REQUIRED");
  const completed = await service.completeStudy(studyId, { actorId: "transition-operator", completedAt: date(20), confirm: true }, { environment: "development" });
  assert.equal(completed.completed, true);
  const shown = await service.showStudy(studyId);
  assert.equal(shown.acknowledgementPresent, true);
  assert.equal((await service.listStudies()).length, 1);
  assert.equal((await service.audit(studyId)).length > 0, true);

  const cancel = await createdService("cancel-study", "cancel-period");
  assert.equal((await cancel.service.cancelStudy({ studyId: cancel.studyId, actorId: "transition-admin", reason: "No observation will occur.", cancelledAt: date(2) }, { environment: "development" })).status, "cancelled");
  await assert.rejects(() => cancel.service.completeStudy(cancel.studyId, { actorId: "transition-operator", completedAt: date(3), confirm: true, overrideReason: "Should not complete." }, { environment: "development" }), /observation_active/);
  const invalid = await createdService("invalid-study", "invalid-period");
  await assert.rejects(() => invalid.service.invalidateStudy({ studyId: invalid.studyId, actorId: "transition-operator", reasonCode: "incorrect_proposed_equipment", reason: "Wrong variant.", invalidatedAt: date(2) }, { environment: "development" }), /Capability/);
  assert.equal((await invalid.service.invalidateStudy({ studyId: invalid.studyId, actorId: "transition-admin", reasonCode: "incorrect_proposed_equipment", reason: "Wrong variant.", invalidatedAt: date(2) }, { environment: "development" })).status, "invalidated");
  assert.equal(transitionGenuineOperatorReadinessReport().operatorReadinessVerdict, "pass");
  assert.equal(transitionGenuineOperatorValidationReport().verdict, "pass");
});

async function createdService(id = "study-1", period = "period-1") {
  const repository = repositoryFixture();
  const service = new TransitionGenuineOperatorService(repository);
  const created = await service.createGenuineStudyFromOperatorIntake(input({ id, observationPeriodKey: period }), { actorId: "transition-operator", environment: "development", confirmGenuineStudy: true });
  return { repository, service, studyId: created.studyId! };
}

async function predictedService() {
  const fixture = await createdService();
  await fixture.service.capturePrediction({ studyId: fixture.studyId, actorId: "transition-operator", compatibilityInput: compatibilityInput(), predictedAt: date(1), manualInputOverride: true }, { environment: "development" });
  return fixture;
}

async function activeObservedService() {
  const fixture = await predictedService();
  await fixture.service.startObservation(fixture.studyId, "transition-operator", { startedAt: date(2), confirm: true }, { environment: "development" });
  await fixture.service.addObservation({ studyId: fixture.studyId, actorId: "transition-operator", observation: observation("first_use", date(3)) }, { environment: "development" });
  await fixture.service.addObservation({ studyId: fixture.studyId, actorId: "transition-operator", observation: observation("early_sessions", date(8)) }, { environment: "development" });
  return fixture;
}

function repositoryFixture() {
  const repository = new InMemoryTransitionShadowAdminRepository();
  repository.players.set("player-1", { id: "player-1", status: "active", label: "Jackson Sanders" });
  repository.playerDNA.add("player-1");
  repository.equipment.set("current", { id: "current", label: "Rawlings ICON 2026" });
  repository.equipment.set("proposed", { id: "proposed", label: "Louisville Slugger Atlas 2026" });
  repository.variants.set("current-v", { id: "current-v", equipmentId: "current", label: "RAW-ICON-USA-30-22" });
  repository.variants.set("proposed-v", { id: "proposed-v", equipmentId: "proposed", label: "LS-ATLAS-USA-30-22" });
  return repository;
}

function input(overrides: Partial<GenuineTransitionOperatorIntakeInput> = {}): GenuineTransitionOperatorIntakeInput {
  return {
    id: "study-1",
    actorId: "transition-operator",
    playerId: "player-1",
    observationPeriodKey: "period-1",
    studyPurpose: "extended_shadow_validation",
    currentEquipmentVerification: { equipmentId: "current", equipmentVariantId: "current-v", lengthInches: 30, weightOunces: 22, dropWeight: -8, certification: "USA", verifiedAsActualCurrentPrimary: true, source: "combined", verifiedAt: date() },
    proposedEquipmentVerification: { equipmentId: "proposed", equipmentVariantId: "proposed-v", lengthInches: 30, weightOunces: 22, dropWeight: -8, certification: "USA", expectedToBeUsed: true, availableForUse: true, sizeSpecificationMatched: true, source: "combined", verifiedAt: date() },
    familiarityInput: { playerId: "player-1", equipmentId: "current", equipmentVariantId: "current-v", estimatedSessionsUsed: 24, estimatedWeeksUsed: 10, regularUseFrequency: "multiple_times_weekly", usageContexts: ["practice", "games"], currentlyPrimaryEquipment: true, directlyReportedFamiliarity: "familiar", source: "combined", capturedAt: date() },
    participationAcknowledgement: { version: "1.0", playerId: "player-1", acknowledgementType: "internal_operational_authorization", acknowledgedByRole: "internal_staff", acknowledgedAt: date(), purposeAcknowledged: true, observationalNatureAcknowledged: true, noRecommendationImpactAcknowledged: true, voluntaryFeedbackAcknowledged: true, capturedByActorId: "transition-operator" },
    playerDNAProfileId: "player-dna-1",
    playerDNAVersion: "1.0.0",
    captureOrigin: "internal_guided_entry",
    createdAt: date(),
    ...overrides
  };
}

function observation(checkpoint: TransitionAdjustmentObservation["checkpoint"], observedAt: Date): TransitionAdjustmentObservation {
  return { version: "1.0", checkpoint, observedAt, equipmentActuallyUsed: true, meaningfulUseOccurred: true, observedAdjustmentDemand: "mild", observationConfidence: "moderate", source: "parent_or_guardian", directlyWitnessed: true, notes: "The player used the bat during cage sessions." };
}

function compatibilityInput() {
  return {
    playerDNA: playerFixture("improve_contact"),
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 39 }),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 30, weight: 22, drop: -8, balance: 20, swingEffort: 48 }),
    evaluatedAt: date(1)
  };
}

function playerFixture(goal: PrimaryHittingGoal): PlayerDNAProfileResult {
  return {
    profileId: "player-dna-1",
    playerId: "player-1",
    version: "1.0.0",
    status: "generated",
    scoringRuleVersion: "player-dna-mvp-v1",
    inputHash: "player-input",
    scores: {
      batControl: 90,
      swingSpeed: 72,
      powerPotential: 76,
      contactConsistency: 68,
      physicalStrength: 62,
      confidence: 70,
      transitionReadiness: 74,
      growthStability: 66,
      equipmentAwareness: 78,
      profileCompleteness: 92
    },
    categories: {
      preferredSwingFeel: "light",
      developmentStage: "competitive",
      primaryHittingGoal: goal,
      currentEquipmentAssessment: "likes light swing, good pop, large sweet spot",
      growthStatus: "moderate_growth",
      profileConfidenceLevel: "high"
    },
    confidence: { score: 84, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-1" }, playerProfile: { experienceYears: 5 } },
    scoreBreakdown: {},
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function canonicalProfile(id: string, values: { length: number; weight: number; drop: number; balance: number; swingEffort: number }): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId: id === "current" ? "current" : "proposed",
    equipmentVariantId: id === "current" ? "current-v" : "proposed-v",
    equipmentName: id,
    variantLabel: `${id}-sku`,
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes: [
      attr("length", values.length, "physical", values.length),
      attr("weight", values.weight, "physical", values.weight),
      attr("drop", values.drop, "physical", values.drop),
      attr("balance_profile", values.balance <= 19 ? "very_balanced" : "balanced", "performance", values.balance),
      attr("swing_effort", values.swingEffort <= 39 ? "easy" : "moderate", "performance", values.swingEffort),
      attr("construction", "two_piece_composite", "physical"),
      attr("material", "composite", "physical")
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: date()
  };
}

function attr(key: EquipmentDNAAttributeKey, value: EquipmentDNAAttributeNormalizedValue, domain: EquipmentDNAAttributeDomain, numericValue?: number): CanonicalEquipmentDNAAttributeValue {
  return {
    key,
    definitionVersion: "1.0",
    domain,
    targetLevel: key === "length" || key === "weight" || key === "drop" ? "variant" : "equipment",
    value,
    confidence: "high",
    evaluationMethod: "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} fixture`,
    evaluatedAt: date(),
    evidence: numericValue === undefined ? [] : [{
      evidenceRecordId: `${key}-evidence`,
      sourceType: "internal_derived",
      sourceName: "test fixture",
      method: "derived_mapping",
      status: "active",
      rawValue: { normalizedScore: numericValue, sourceScore: numericValue, referenceMethod: "legacy_preserved" },
      evaluatorType: "system"
    }],
    status: "active"
  };
}

function familiarity(): CurrentEquipmentFamiliarityResult {
  return { version: "1.0", playerId: "player-1", equipmentId: "current", equipmentVariantId: "current-v", level: "established_familiarity", numericReference: 75, confidence: "high", availableInputs: ["estimatedSessionsUsed"], missingInputs: [], reasons: ["fixture"], warnings: [], evaluatedAt: date() };
}

function prediction() {
  return createTransitionPredictionSnapshot(resultFixture(), familiarity(), date(1));
}

function resultFixture(): TransitionCompatibilityV1_1Result {
  return {
    version: "1.1", modelVersion: "1.1", policyVersion: "1.1", reasonVersion: "1.0", changeProfileVersion: "1.0", interpolationVersion: "1.0", candidateVersion: "v1_1_linear_interpolation", recommendationUsePolicy: "shadow_only",
    playerId: "player-1", currentEquipmentId: "current", currentEquipmentVariantId: "current-v", proposedEquipmentId: "proposed", proposedEquipmentVariantId: "proposed-v", score: 94, band: "very_manageable_transition", dimensions: [], confidence: "moderate", reasons: [], tradeoffs: [], missingInformation: [],
    playerReadiness: { version: "1.0", playerId: "player-1", sourceSummary: { availableInputs: [], missingInputs: [], derivedInputs: [] }, confidence: "moderate" },
    currentEquipment: { equipmentId: "current", equipmentVariantId: "current-v", sourceSummary: { availableInputs: [], missingInputs: [] } },
    proposedEquipment: { equipmentId: "proposed", equipmentVariantId: "proposed-v", sourceSummary: { numericReferenceInputs: [], ordinalProjectedInputs: [], specificationInputs: [], missingInputs: [] } },
    changeProfile: { version: "1.0", rawDifferences: {}, missingInputs: [] }, interpolationTrace: [], readinessModifierTrace: [], productionUseAllowed: false, liveRecommendationUseAllowed: false,
    trace: { currentEquipmentValues: {}, proposedEquipmentValues: {}, normalizedDifferences: {}, demandThresholds: {}, readinessModifiers: [], componentWeights: { size_change_demand: 0.15, mass_change_demand: 0.2, drop_change_demand: 0.15, balance_change_demand: 0.15, swing_effort_change_demand: 0.2, experience_adjustment_demand: 0.15 }, componentCoverage: { scoredComponents: 6, totalComponents: 6 }, missingInputs: [], confidenceFactors: [], versions: { model: "1.1", policy: "1.1", reason: "1.0", changeProfile: "1.0", playerDNA: "1.0.0", currentEquipmentDNA: "1.0", proposedEquipmentDNA: "1.0" }, reasonThresholds: { manageableMinimum: 75, demandingMaximum: 64 }, interpolationVersion: "1.0", interpolationCurves: {}, readinessBounds: { minimumMultiplier: 0.35, maximumMultiplier: 1.2, maximumAbsoluteDemandReduction: 20, maximumAbsoluteDemandIncrease: 12, minimumDemandRetained: 0.35 }, candidateVersion: "v1_1_linear_interpolation", productionUseAllowed: false, liveRecommendationUseAllowed: false },
    status: "completed", evaluatedAt: date()
  };
}

function date(days = 0): Date {
  return new Date(Date.UTC(2026, 7, 9 + days));
}
