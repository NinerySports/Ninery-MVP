import assert from "node:assert/strict";
import test from "node:test";
import type { CanonicalEquipmentDNAAdmissionDecision, CanonicalEquipmentDNAProfile } from "@ninery/equipment-intelligence";
import { equipmentDNAAttributes, type EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION,
  CANONICAL_CANDIDATE_DUAL_RUN_VERSION,
  CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION,
  CanonicalCandidateAdmissionError,
  CanonicalCandidateMappingError,
  adaptCanonicalEquipmentDNAForRecommendation,
  compareCanonicalCandidateRecommendationRuns,
  runCanonicalCandidateRecommendationDualRun
} from "../index.js";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import type { CompatibilityRequestContext } from "../compatibility.types.js";

const equipmentId = "equipment-1";
const variantId = "variant-1";
const evaluatedAt = new Date("2026-07-22T00:00:00.000Z");

test("canonical candidate adapter maps admitted profile into Recommendation Intelligence input", () => {
  const adapted = adaptCanonicalEquipmentDNAForRecommendation({
    canonicalProfile: canonicalProfile(),
    admissionDecision: admissionDecision(),
    legacyBaseline: equipmentFixture()
  });

  assert.equal(CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION, "1.0");
  assert.equal(adapted.equipment.equipmentId, equipmentId);
  assert.equal(adapted.equipment.variantId, variantId);
  assert.equal(adapted.equipment.selectedVariant?.dropWeight, -8);
  assert.equal(adapted.equipment.scores.batControl, 70);
  assert.equal(adapted.equipment.scores.swingWeight, 50);
  assert.equal(adapted.equipment.scores.barrelForgiveness, 70);
  assert.equal(adapted.equipment.scores.sweetSpotSize, 70);
  assert.equal(adapted.equipment.scores.powerPotential, 70);
  assert.equal(adapted.equipment.scores.balance, undefined);
  assert.equal(adapted.equipment.scores.confidenceBuilding, undefined);
  assert.equal(adapted.equipment.scores.transitionFriendliness, undefined);
  assert.equal(adapted.equipment.missingCharacteristics.length, 0);
  assert.equal(adapted.mappedAttributes.length, 5);
  assert.ok(adapted.equipment.sourceProfileId.startsWith("canonical-candidate:"));
});

test("candidate adapter rejects blocked, shadow-only, stale, or mismatched admission", () => {
  assert.throws(
    () => adaptCanonicalEquipmentDNAForRecommendation({
      canonicalProfile: canonicalProfile(),
      admissionDecision: { ...admissionDecision(), outcome: "approved_for_shadow", eligibleForInternalCandidate: false },
      legacyBaseline: equipmentFixture()
    }),
    CanonicalCandidateAdmissionError
  );
  assert.throws(
    () => adaptCanonicalEquipmentDNAForRecommendation({
      canonicalProfile: canonicalProfile(),
      admissionDecision: { ...admissionDecision(), equipmentVariantId: "other-variant" },
      legacyBaseline: equipmentFixture()
    }),
    CanonicalCandidateAdmissionError
  );
  assert.throws(
    () => adaptCanonicalEquipmentDNAForRecommendation({
      canonicalProfile: canonicalProfile(),
      admissionDecision: {
        ...admissionDecision(),
        versionAssessment: {
          ...admissionDecision().versionAssessment,
          actual: { ...admissionDecision().versionAssessment.actual, canonicalProfileVersion: "0.9" }
        }
      },
      legacyBaseline: equipmentFixture()
    }),
    CanonicalCandidateAdmissionError
  );
});

test("candidate adapter blocks missing required mappings and invalid ordinal values", () => {
  assert.throws(
    () => adaptCanonicalEquipmentDNAForRecommendation({
      canonicalProfile: { ...canonicalProfile(), attributes: canonicalProfile().attributes.filter((attribute) => attribute.key !== "power_potential") },
      admissionDecision: admissionDecision(),
      legacyBaseline: equipmentFixture()
    }),
    CanonicalCandidateMappingError
  );
  assert.throws(
    () => adaptCanonicalEquipmentDNAForRecommendation({
      canonicalProfile: {
        ...canonicalProfile(),
        attributes: canonicalProfile().attributes.map((attribute) =>
          attribute.key === "swing_effort" ? { ...attribute, value: "high" } : attribute
        )
      },
      admissionDecision: admissionDecision(),
      legacyBaseline: equipmentFixture()
    }),
    CanonicalCandidateMappingError
  );
});

test("dual-run keeps legacy authoritative and candidate cannot affect live result", async () => {
  const result = await runCanonicalCandidateRecommendationDualRun(requestFixture());

  assert.equal(CANONICAL_CANDIDATE_DUAL_RUN_VERSION, "1.0");
  assert.equal(result.comparisonVersion, CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION);
  assert.equal(result.candidateExecutionStatus, "completed");
  assert.equal(result.liveRecommendationSource, "legacy");
  assert.equal(result.candidateAffectsLiveResult, false);
  assert.ok(result.legacyAuthoritative.primaryRecommendation);
  assert.ok(result.canonicalCandidate?.primaryRecommendation);
  assert.equal(result.legacyAuthoritative.primaryRecommendation.equipment.equipmentId, equipmentId);
  assert.equal(result.variance.eligibility.every((item) => !item.changed), true);
});

test("dual-run returns structured admission failure while preserving legacy result", async () => {
  const result = await runCanonicalCandidateRecommendationDualRun({
    ...requestFixture(),
    admissionDecisions: [{ ...admissionDecision(), outcome: "blocked_not_ready", eligibleForInternalCandidate: false }]
  });

  assert.equal(result.candidateExecutionStatus, "blocked_by_admission");
  assert.equal(result.variance.classification, "candidate_failed");
  assert.ok(result.legacyAuthoritative.primaryRecommendation);
  assert.equal(result.canonicalCandidate, undefined);
  assert.equal(result.liveRecommendationSource, "legacy");
});

test("dual-run is deterministic for identical inputs", async () => {
  const first = await runCanonicalCandidateRecommendationDualRun(requestFixture());
  const second = await runCanonicalCandidateRecommendationDualRun(requestFixture());

  assert.deepEqual(first, second);
});

test("comparison classifies eligibility, ranking, material, minor, and equivalent variance by priority", () => {
  const legacy = new CompatibilityScoringEngine().score({
    playerDNA: playerFixture("improve_bat_control"),
    equipment: [equipmentFixture(), equipmentFixture({ equipmentId: "equipment-2", model: "Atlas", scores: { batControl: 65 } })],
    context: contextFixture()
  });
  const equivalent = compareCanonicalCandidateRecommendationRuns({ legacy, candidate: legacy });
  assert.equal(equivalent.classification, "equivalent");

  const minorCandidate = {
    ...legacy,
    primaryRecommendation: legacy.primaryRecommendation && {
      ...legacy.primaryRecommendation,
      overallMatchScore: legacy.primaryRecommendation.overallMatchScore + 3
    }
  };
  assert.equal(compareCanonicalCandidateRecommendationRuns({ legacy, candidate: minorCandidate }).classification, "minor_variance");

  const rankingCandidate = {
    ...legacy,
    primaryRecommendation: legacy.alternatives[0],
    alternatives: legacy.primaryRecommendation ? [legacy.primaryRecommendation] : []
  };
  assert.equal(compareCanonicalCandidateRecommendationRuns({ legacy, candidate: rankingCandidate }).classification, "ranking_changed");

  const eligibilityCandidate = { ...legacy, filteredEquipment: [{ equipmentId, eligible: false, reasons: [{ code: "TEST", message: "test", sourceCodes: [] }] }], primaryRecommendation: undefined, alternatives: [] };
  assert.equal(compareCanonicalCandidateRecommendationRuns({ legacy, candidate: eligibilityCandidate }).classification, "eligibility_changed");
});

function requestFixture() {
  return {
    playerInput: playerFixture("improve_bat_control"),
    requestContext: contextFixture(),
    legacyEquipmentInputs: [equipmentFixture()],
    canonicalProfiles: [canonicalProfile()],
    admissionDecisions: [admissionDecision()],
    evaluatedAt
  };
}

function contextFixture(): CompatibilityRequestContext {
  return {
    playerId: "player-1",
    certification: "USA",
    category: "bat",
    variantPreferences: { length: 30, drop: -8 },
    budget: { maximum: 400 },
    resultLimit: 3
  };
}

function playerFixture(goal: PrimaryHittingGoal): PlayerDNAProfileResult {
  return {
    profileId: "player-dna-1",
    playerId: "player-1",
    version: "player-dna-mvp-v1",
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
    inputSnapshot: { player: { id: "player-1" } },
    scoreBreakdown: {},
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function canonicalProfile(): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId,
    equipmentVariantId: variantId,
    equipmentName: "Rawlings ICON 2026",
    variantLabel: "RAW-ICON-USA-30-22",
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: ["Ready."] },
    maturity: "evaluated",
    attributes: [
      attribute("length", 30, "physical", "variant", "high"),
      attribute("weight", 22, "physical", "variant", "high"),
      attribute("drop", -8, "physical", "variant", "high"),
      attribute("certification", "USA", "physical", "equipment", "high"),
      attribute("barrel_diameter", 2.625, "physical", "equipment", "high"),
      attribute("swing_effort", "moderate", "performance", "equipment", "moderate"),
      attribute("forgiveness", "high", "performance", "equipment", "moderate"),
      attribute("sweet_spot_support", "high", "performance", "equipment", "moderate"),
      attribute("bat_control_support", "high", "development", "equipment", "moderate"),
      attribute("power_potential", "high", "performance", "equipment", "moderate"),
      attribute("balance_profile", "balanced", "performance", "equipment", "moderate"),
      attribute("confidence_building_potential", "high", "compatibility", "equipment", "moderate"),
      attribute("transition_difficulty", "moderate", "compatibility", "equipment", "moderate")
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: evaluatedAt
  };
}

function admissionDecision(): CanonicalEquipmentDNAAdmissionDecision {
  return {
    version: "1.0",
    policyVersion: "1.0",
    equipmentId,
    equipmentVariantId: variantId,
    equipmentName: "Rawlings ICON 2026",
    evaluatedAt,
    outcome: "approved_for_internal_candidate",
    eligibleForShadow: true,
    eligibleForInternalCandidate: true,
    liveRecommendationUseAllowed: false,
    blockers: [],
    warnings: [],
    criteria: [],
    mappingCoverage: {
      requiredComparableKeys: ["bat_control_support", "swing_effort", "forgiveness", "sweet_spot_support"],
      successfullyComparedKeys: ["bat_control_support", "swing_effort", "forgiveness", "sweet_spot_support"],
      missingCanonicalKeys: [],
      missingLegacyKeys: [],
      incomparableRequiredKeys: [],
      optionalIncomparableKeys: [],
      coverageRatio: 1,
      requiredCoverageSatisfied: true
    },
    versionAssessment: {
      supported: true,
      actual: {
        admissionPolicyVersion: "1.0",
        canonicalProfileVersion: "1.0",
        registryVersion: "1.0",
        confidenceModelVersion: "1.0",
        readinessModelVersion: "1.0",
        scoreMappingVersion: "1.0",
        shadowComparisonVersion: "1.0",
        ordinalComparisonVersion: "1.0"
      },
      unsupported: []
    },
    sourceSummary: {
      ready: true,
      maturity: "evaluated",
      shadowStatus: "aligned",
      specificationMatchCount: 5,
      specificationProblemCount: 0,
      alignedBehaviorCount: 5,
      minorBehaviorDifferenceCount: 0,
      materialBehaviorDifferenceCount: 0,
      incomparableBehaviorCount: 3
    },
    nextActions: []
  };
}

function attribute(
  key: CanonicalEquipmentDNAProfile["attributes"][number]["key"],
  value: CanonicalEquipmentDNAProfile["attributes"][number]["value"],
  domain: CanonicalEquipmentDNAProfile["attributes"][number]["domain"],
  targetLevel: CanonicalEquipmentDNAProfile["attributes"][number]["targetLevel"],
  confidence: CanonicalEquipmentDNAProfile["attributes"][number]["confidence"]
): CanonicalEquipmentDNAProfile["attributes"][number] {
  return {
    key,
    definitionVersion: "1.0",
    domain,
    targetLevel,
    value,
    confidence,
    evaluationMethod: targetLevel === "variant" ? "direct_specification" : "derived_mapping",
    evaluationVersion: 1,
    rationale: `${key} rationale`,
    evaluatedAt,
    evidence: [{ evidenceRecordId: `evidence-${key}`, sourceType: "other", sourceName: "Fixture", method: "manual_review", status: "active" }],
    status: "active"
  };
}

function equipmentFixture(overrides: Partial<EquipmentDNAProfile> & { scores?: Partial<EquipmentDNAProfile["scores"]> } = {}): EquipmentDNAProfile {
  const scores = {
    batControl: 70,
    balance: 70,
    swingWeight: 50,
    barrelForgiveness: 70,
    sweetSpotSize: 70,
    powerPotential: 70,
    confidenceBuilding: 70,
    transitionFriendliness: 70,
    ...overrides.scores
  };
  return {
    equipmentId: overrides.equipmentId ?? equipmentId,
    variantId,
    sourceLevel: "model",
    manufacturer: "Rawlings",
    model: overrides.model ?? "ICON",
    modelYear: 2026,
    certification: "USA",
    category: "bat",
    barrelDiameter: 2.625,
    status: "active",
    profileVersion: 1,
    evidenceConfidence: { score: 78, band: "high" },
    certificationLevel: "gold",
    secondaryPersonalities: [],
    fitProfiles: [],
    specifications: [],
    availableVariants: [{ id: variantId, lengthInches: 30, weightOunces: 22, dropWeight: -8, msrp: 349, sku: "RAW-ICON-USA-30-22" }],
    selectedVariant: { id: variantId, lengthInches: 30, weightOunces: 22, dropWeight: -8, msrp: 349, sku: "RAW-ICON-USA-30-22" },
    sourceProfileId: `${overrides.equipmentId ?? equipmentId}-dna`,
    profileCompleteness: 100,
    publishedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
    scores,
    missingCharacteristics: equipmentDNAAttributes.filter((item) => scores[item] === undefined),
    explanations: [],
    eligibility: overrides.eligibility ?? { eligible: true, reasons: [] }
  };
}
