import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalEquipmentDNAProfile, EquipmentDNAAttributeDomain, EquipmentDNAAttributeKey, EquipmentDNAAttributeNormalizedValue, CanonicalEquipmentDNAAttributeValue } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import {
  FirstGenuineStudyReadinessService,
  InMemoryTransitionShadowAdminRepository,
  TransitionShadowAdminService,
  resolveTransitionGenuineOperatorActor,
  type FirstGenuineStudyReadinessRepository,
  type TransitionShadowInternalActor
} from "../index.js";

test("prospective readiness reports ready_to_prepare with acknowledgement as next action", async () => {
  const service = new FirstGenuineStudyReadinessService(repo());
  const result = await service.preflight(request());
  assert.equal(result.status, "ready_to_prepare");
  assert.equal(result.nextAction.code, "CAPTURE_ACKNOWLEDGEMENT");
  assert.equal(result.model.version, "1.1");
  assert.equal(result.model.liveUseAllowed, false);
  assert.equal(result.blockers.length, 0);
  assert.equal(result.checks.some((check) => check.code === "acknowledgement_readiness" && check.status === "required_action"), true);
});

test("authorization and missing Player DNA block with deterministic recovery domains", async () => {
  const repository = repo({ playerDNA: [] });
  const service = new FirstGenuineStudyReadinessService(repository);
  const result = await service.preflight({ ...request(), actor: undefined });
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some((blocker) => blocker.code === "UNAUTHORIZED_OPERATOR" && blocker.recoveryDomain === "authorization"), true);
  assert.equal(result.blockers.some((blocker) => blocker.code === "MISSING_PLAYER_DNA" && blocker.recoveryDomain === "player_dna"), true);
});

test("proposed Equipment DNA not ready blocks without legacy fallback", async () => {
  const repository = repo({ proposedProfile: canonicalProfile("proposed", false) });
  const service = new FirstGenuineStudyReadinessService(repository);
  const result = await service.preflight(request());
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some((blocker) => blocker.code === "MISSING_PROPOSED_EQUIPMENT_DNA"), true);
  assert.equal(result.checks.some((check) => check.code === "proposed_equipment_dna" && check.status === "blocked"), true);
});

test("duplicate active study and existing lifecycle mode are read-only", async () => {
  const repository = repo();
  const admin = new TransitionShadowAdminService(repository.admin);
  const actor = resolveTransitionGenuineOperatorActor("transition-operator")!;
  const created = await admin.createTransitionShadowStudyDraft({
    id: "study-existing",
    playerId: "player-1",
    currentEquipmentId: "current",
    currentEquipmentVariantId: "current-v",
    proposedEquipmentId: "proposed",
    proposedEquipmentVariantId: "proposed-v",
    observationPeriodKey: "period-1",
    evidenceClassification: "genuine_internal_observation",
    studyPurpose: "fixture",
    captureOrigin: "internal_guided_entry",
    familiarityInput: { playerId: "player-1", equipmentId: "current", equipmentVariantId: "current-v", estimatedSessionsUsed: 24, estimatedWeeksUsed: 10, regularUseFrequency: "multiple_times_weekly", usageContexts: ["practice"], currentlyPrimaryEquipment: true, directlyReportedFamiliarity: "familiar", source: "combined", capturedAt: date() },
    createdAt: date()
  }, actor);
  const service = new FirstGenuineStudyReadinessService(repository);
  const duplicate = await service.preflight(request());
  assert.equal(duplicate.status, "study_already_exists");
  const existing = await service.preflight({ actor, studyId: created.study.id }, date(1));
  assert.equal(existing.status, "study_already_exists");
  assert.equal(existing.nextAction.code, "CAPTURE_PREDICTION");
  assert.equal((await repository.admin.listStudies({ includeSynthetic: true })).length, 1);
});

function repo(overrides: { readonly playerDNA?: readonly PlayerDNAProfileResult[]; readonly proposedProfile?: CanonicalEquipmentDNAProfile } = {}) {
  const admin = new InMemoryTransitionShadowAdminRepository();
  admin.players.set("player-1", { id: "player-1", status: "active", label: "Jackson Sanders" });
  admin.playerDNA.add("player-1");
  admin.equipment.set("current", { id: "current", label: "Rawlings ICON" });
  admin.equipment.set("proposed", { id: "proposed", label: "Louisville Slugger Atlas" });
  admin.variants.set("current-v", { id: "current-v", equipmentId: "current", label: "RAW-ICON-USA-30-22" });
  admin.variants.set("proposed-v", { id: "proposed-v", equipmentId: "proposed", label: "LS-ATLAS-USA-30-22" });
  const repository: FirstGenuineStudyReadinessRepository & { admin: InMemoryTransitionShadowAdminRepository } = {
    admin,
    getStudy: (studyId) => admin.getStudy(studyId),
    getPlayer: (playerId) => admin.getPlayer(playerId),
    getEquipment: (equipmentId) => admin.getEquipment(equipmentId),
    getEquipmentVariant: (variantId) => admin.getEquipmentVariant(variantId),
    listAuditEvents: (studyId) => admin.listAuditEvents(studyId),
    listPlayerDNAProfiles: async () => overrides.playerDNA ?? [playerDNA()],
    loadCanonicalEquipmentDNAProfile: async (input) => input.equipmentId === "current" ? canonicalProfile("current", true) : overrides.proposedProfile ?? canonicalProfile("proposed", true),
    hasActiveStudyForTransition: async () => (await admin.listStudies({ includeSynthetic: true })).some((study) => ["draft", "prediction_captured", "observation_active"].includes(study.status)),
    getVariantSpecification: async (variantId) => ({ id: variantId, equipmentId: variantId === "current-v" ? "current" : "proposed", length: 30, weight: 22, drop: -8 }),
    hasAcknowledgement: async () => false
  };
  return repository;
}

function request(actor: TransitionShadowInternalActor | undefined = resolveTransitionGenuineOperatorActor("transition-operator")) {
  return { actor, playerId: "player-1", currentEquipmentId: "current", currentVariantId: "current-v", proposedEquipmentId: "proposed", proposedVariantId: "proposed-v" };
}

function playerDNA(): PlayerDNAProfileResult {
  return {
    profileId: "player-dna-1",
    playerId: "player-1",
    version: "1.0.0",
    status: "generated",
    scoringRuleVersion: "player-dna-mvp-v1",
    inputHash: "hash",
    scores: { batControl: 90, swingSpeed: 70, powerPotential: 70, contactConsistency: 70, physicalStrength: 70, confidence: 70, transitionReadiness: 70, growthStability: 70, equipmentAwareness: 70, profileCompleteness: 90 },
    categories: { preferredSwingFeel: "balanced", developmentStage: "competitive", primaryHittingGoal: "improve_contact", growthStatus: "stable", profileConfidenceLevel: "high" },
    confidence: { score: 80, level: "high", factors: {}, missingInformation: [] },
    explanations: [],
    missingInformation: [],
    inputSnapshot: { player: { id: "player-1" }, playerProfile: { experienceYears: 5 } },
    scoreBreakdown: {},
    generatedAt: "2026-08-01T00:00:00.000Z"
  };
}

function canonicalProfile(id: "current" | "proposed", ready: boolean): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId: id,
    equipmentVariantId: `${id}-v`,
    equipmentName: id,
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready, missingRequiredAttributes: ready ? [] : ["weight"], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes: ready ? [attr("length", 30), attr("weight", 22), attr("drop", -8), attr("balance_profile", "balanced"), attr("swing_effort", "moderate")] : [],
    missingAttributes: ready ? [] : ["weight"],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: date()
  };
}

function attr(key: EquipmentDNAAttributeKey, value: EquipmentDNAAttributeNormalizedValue): CanonicalEquipmentDNAAttributeValue {
  return { key, definitionVersion: "1.0", domain: "physical" as EquipmentDNAAttributeDomain, targetLevel: key === "length" || key === "weight" || key === "drop" ? "variant" : "equipment", value, confidence: "high", evaluationMethod: "derived_mapping", evaluationVersion: 1, rationale: "fixture", evaluatedAt: date(), evidence: [{ evidenceRecordId: `${key}-evidence`, sourceType: "internal_derived", sourceName: "fixture", method: "derived_mapping", status: "active" }], status: "active" };
}

function date(days = 0) {
  return new Date(Date.UTC(2026, 7, 11 + days));
}
