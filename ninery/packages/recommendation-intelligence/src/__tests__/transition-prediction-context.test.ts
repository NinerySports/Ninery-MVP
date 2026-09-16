import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalEquipmentDNAAttributeValue, CanonicalEquipmentDNAProfile, EquipmentDNAAttributeDomain, EquipmentDNAAttributeKey, EquipmentDNAAttributeNormalizedValue } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  InMemoryTransitionShadowAdminRepository,
  TRANSITION_CONTEXT_LOADER_VERSION,
  TRANSITION_CONTEXT_PROVENANCE_VERSION,
  TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION,
  TRANSITION_PREDICTION_INPUT_REVIEW_VERSION,
  TransitionGenuineOperatorError,
  TransitionGenuineOperatorService,
  TransitionPredictionContextLoaderService,
  type GenuineTransitionOperatorIntakeInput,
  type TransitionPredictionContextLoaderRepository
} from "../index.js";

test("context loader assembles deterministic prediction input from genuine study context", async () => {
  const fixture = await fixtureService();
  const first = await fixture.contextLoader.assemblePredictionInput({ studyId: fixture.studyId, assembledAt: date(1) });
  const second = await fixture.contextLoader.assemblePredictionInput({ studyId: fixture.studyId, assembledAt: date(2) });
  assert.equal(first.version, TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION);
  assert.equal(first.loaderVersion, TRANSITION_CONTEXT_LOADER_VERSION);
  assert.equal(first.provenance?.version, TRANSITION_CONTEXT_PROVENANCE_VERSION);
  assert.equal(first.ready, true);
  assert.equal(first.input?.playerDNA.profileId, "player-dna-1");
  assert.equal(first.input?.currentEquipmentProfile?.equipmentVariantId, "current-v");
  assert.equal(first.input?.proposedEquipmentProfile.equipmentVariantId, "proposed-v");
  assert.equal(first.semanticInputHash, second.semanticInputHash);
  assert.equal(first.blockers.length, 0);
});

test("review reports missing Player DNA as an explicit blocker", async () => {
  const fixture = await fixtureService({ playerDNAProfiles: [] });
  const assembly = await fixture.contextLoader.assemblePredictionInput({ studyId: fixture.studyId });
  const review = fixture.contextLoader.reviewAssembly(assembly);
  assert.equal(review.version, TRANSITION_PREDICTION_INPUT_REVIEW_VERSION);
  assert.equal(review.ready, false);
  assert.equal(review.playerDNA, "blocked");
  assert.deepEqual(review.blockerCodes, ["MISSING_PLAYER_DNA"]);
});

test("loader blocks missing proposed specs without converting missing values to zero", async () => {
  const proposed = canonicalProfile("proposed", { length: 30, weight: undefined, drop: -8, balance: 20, swingEffort: 48 });
  const fixture = await fixtureService({ proposedProfile: proposed });
  const assembly = await fixture.contextLoader.assemblePredictionInput({ studyId: fixture.studyId });
  assert.equal(assembly.ready, false);
  assert.equal(assembly.blockers.some((item) => item.code === "MISSING_PROPOSED_SPEC" && item.message.includes("weight")), true);
});

test("operator capture uses assembled context by default and requires confirmation", async () => {
  const fixture = await fixtureService();
  await assert.rejects(() => fixture.service.capturePrediction({ studyId: fixture.studyId, actorId: "transition-operator", predictedAt: date(1) }, { environment: "development" }), (error: Error) => error instanceof TransitionGenuineOperatorError && error.code === "CONFIRMATION_REQUIRED");
  const captured = await fixture.service.capturePrediction({ studyId: fixture.studyId, actorId: "transition-operator", predictedAt: date(1), confirm: true }, { environment: "development" });
  assert.equal(captured.modelVersion, "1.1");
  assert.equal(captured.manualInputOverride, false);
  assert.equal(captured.inputReview?.ready, true);
  assert.equal(captured.inputAssembly?.semanticInputHash, captured.inputReview?.semanticInputHash);
});

test("context drift reports stable hash before capture and changed hash when profile context changes", async () => {
  const fixture = await fixtureService();
  const dryRun = await fixture.contextLoader.dryRunPrediction({ studyId: fixture.studyId, assembledAt: date(1) });
  assert.equal(dryRun.wouldPersist, false);
  assert.equal(dryRun.liveRecommendationUseAllowed, false);
  assert.equal(dryRun.prediction?.status, "completed");
  await fixture.service.capturePrediction({ studyId: fixture.studyId, actorId: "transition-operator", predictedAt: date(1), confirm: true }, { environment: "development" });
  const stable = await fixture.contextLoader.evaluateContextDrift(fixture.studyId, date(3));
  assert.equal(stable.driftDetected, false);
  fixture.mutateProposedProfileWeight(23);
  const drift = await fixture.contextLoader.evaluateContextDrift(fixture.studyId, date(4));
  assert.equal(drift.driftDetected, true);
  assert.deepEqual(drift.changedAreas, ["semantic_prediction_context"]);
});

async function fixtureService(overrides: {
  readonly playerDNAProfiles?: readonly PlayerDNAProfileResult[];
  readonly currentProfile?: CanonicalEquipmentDNAProfile;
  readonly proposedProfile?: CanonicalEquipmentDNAProfile;
} = {}) {
  const repository = repositoryFixture();
  let currentProfile = overrides.currentProfile ?? canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 39 });
  let proposedProfile = overrides.proposedProfile ?? canonicalProfile("proposed", { length: 30, weight: 22, drop: -8, balance: 20, swingEffort: 48 });
  const contextRepository: TransitionPredictionContextLoaderRepository = {
    getStudy: (studyId) => repository.getStudy(studyId),
    getPlayer: (playerId) => repository.getPlayer(playerId),
    getEquipment: (equipmentId) => repository.getEquipment(equipmentId),
    getEquipmentVariant: (variantId) => repository.getEquipmentVariant(variantId),
    listAuditEvents: (studyId) => repository.listAuditEvents(studyId),
    listPlayerDNAProfiles: async () => overrides.playerDNAProfiles ?? [playerFixture("improve_contact")],
    loadCanonicalEquipmentDNAProfile: async (input) => input.equipmentId === "current" ? currentProfile : proposedProfile
  };
  const contextLoader = new TransitionPredictionContextLoaderService(contextRepository);
  const service = new TransitionGenuineOperatorService(repository, { contextLoader });
  const created = await service.createGenuineStudyFromOperatorIntake(input(), { actorId: "transition-operator", environment: "development", confirmGenuineStudy: true });
  return {
    repository,
    service,
    contextLoader,
    studyId: created.studyId!,
    mutateProposedProfileWeight(value: number) {
      proposedProfile = { ...proposedProfile, attributes: proposedProfile.attributes.map((attribute) => attribute.key === "weight" ? { ...attribute, value } : attribute) };
    }
  };
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

function input(): GenuineTransitionOperatorIntakeInput {
  return {
    id: "study-context-1",
    actorId: "transition-operator",
    playerId: "player-1",
    observationPeriodKey: "period-context-1",
    studyPurpose: "extended_shadow_validation",
    currentEquipmentVerification: { equipmentId: "current", equipmentVariantId: "current-v", lengthInches: 30, weightOunces: 22, dropWeight: -8, certification: "USA", verifiedAsActualCurrentPrimary: true, source: "combined", verifiedAt: date() },
    proposedEquipmentVerification: { equipmentId: "proposed", equipmentVariantId: "proposed-v", lengthInches: 30, weightOunces: 22, dropWeight: -8, certification: "USA", expectedToBeUsed: true, availableForUse: true, sizeSpecificationMatched: true, source: "combined", verifiedAt: date() },
    familiarityInput: { playerId: "player-1", equipmentId: "current", equipmentVariantId: "current-v", estimatedSessionsUsed: 24, estimatedWeeksUsed: 10, regularUseFrequency: "multiple_times_weekly", usageContexts: ["practice", "games"], currentlyPrimaryEquipment: true, directlyReportedFamiliarity: "familiar", source: "combined", capturedAt: date() },
    participationAcknowledgement: { version: "1.0", playerId: "player-1", acknowledgementType: "internal_operational_authorization", acknowledgedByRole: "internal_staff", acknowledgedAt: date(), purposeAcknowledged: true, observationalNatureAcknowledged: true, noRecommendationImpactAcknowledged: true, voluntaryFeedbackAcknowledged: true, capturedByActorId: "transition-operator" },
    captureOrigin: "internal_guided_entry",
    playerDNAProfileId: "player-dna-1",
    playerDNAVersion: "1.0.0",
    createdAt: date()
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
    scores: { batControl: 90, swingSpeed: 72, powerPotential: 76, contactConsistency: 68, physicalStrength: 62, confidence: 70, transitionReadiness: 74, growthStability: 66, equipmentAwareness: 78, profileCompleteness: 92 },
    categories: { preferredSwingFeel: "light", developmentStage: "competitive", primaryHittingGoal: goal, currentEquipmentAssessment: "likes light swing", growthStatus: "moderate_growth", profileConfidenceLevel: "high" },
    confidence: { score: 84, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-1" }, playerProfile: { experienceYears: 5 } },
    scoreBreakdown: {},
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function canonicalProfile(id: "current" | "proposed", values: { length: number; weight?: number; drop: number; balance: number; swingEffort: number }): CanonicalEquipmentDNAProfile {
  const attributes: CanonicalEquipmentDNAAttributeValue[] = [
    attr("length", values.length, "physical", values.length),
    ...(values.weight === undefined ? [] : [attr("weight", values.weight, "physical", values.weight)]),
    attr("drop", values.drop, "physical", values.drop),
    attr("balance_profile", values.balance <= 19 ? "very_balanced" : "balanced", "performance", values.balance),
    attr("swing_effort", values.swingEffort <= 39 ? "easy" : "moderate", "performance", values.swingEffort),
    attr("construction", "two_piece_composite", "physical"),
    attr("material", "composite", "physical")
  ];
  return {
    version: "1.0",
    equipmentId: id,
    equipmentVariantId: `${id}-v`,
    equipmentName: id,
    variantLabel: `${id}-sku`,
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: values.weight !== undefined, missingRequiredAttributes: values.weight === undefined ? ["weight"] : [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes,
    missingAttributes: values.weight === undefined ? ["weight"] : [],
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
    evidence: numericValue === undefined ? [] : [{ evidenceRecordId: `${key}-evidence`, sourceType: "internal_derived", sourceName: "test fixture", method: "derived_mapping", status: "active", rawValue: { normalizedScore: numericValue }, evaluatorType: "system" }],
    status: "active"
  };
}

function date(days = 0): Date {
  return new Date(Date.UTC(2026, 7, 9 + days));
}
