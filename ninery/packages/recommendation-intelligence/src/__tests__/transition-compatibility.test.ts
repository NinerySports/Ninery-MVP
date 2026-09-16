import assert from "node:assert/strict";
import test from "node:test";
import type {
  CanonicalEquipmentDNAAttributeValue,
  CanonicalEquipmentDNAProfile,
  EquipmentDNAAttributeDomain,
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  TRANSITION_CHANGE_PROFILE_VERSION,
  TRANSITION_COMPATIBILITY_EXCLUSIONS,
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_PARENT_DEFINITION,
  TRANSITION_COMPATIBILITY_POLICY_VERSION,
  TRANSITION_COMPATIBILITY_REASON_VERSION,
  TRANSITION_COMPATIBILITY_TECHNICAL_DEFINITION,
  compareTransitionCompatibilityWithLegacyDimension,
  demandFromThreshold,
  evaluateTransitionCompatibility,
  normalizeCurrentEquipmentTransitionContext,
  normalizePlayerTransitionReadiness,
  normalizeProposedEquipmentTransitionContext,
  transitionCompatibilityBandForScore,
  transitionCompatibilityPolicy,
  validateTransitionCompatibilityLanguage,
  validateTransitionCompatibilityPolicy
} from "../compatibility/transition/index.js";

test("concept definition is relational, versioned, and rejects universal transition claims", () => {
  assert.equal(TRANSITION_COMPATIBILITY_MODEL_VERSION, "1.0");
  assert.equal(TRANSITION_COMPATIBILITY_POLICY_VERSION, "1.0");
  assert.equal(TRANSITION_COMPATIBILITY_REASON_VERSION, "1.0");
  assert.equal(TRANSITION_CHANGE_PROFILE_VERSION, "1.0");
  assert.equal(transitionCompatibilityPolicy.ownership, "compatibility_intelligence");
  assert.equal(transitionCompatibilityPolicy.recommendationUsePolicy, "shadow_only");
  assert.equal(validateTransitionCompatibilityPolicy().length, 0);
  assert.match(TRANSITION_COMPATIBILITY_TECHNICAL_DEFINITION, /current bat and a proposed bat/i);
  assert.match(TRANSITION_COMPATIBILITY_PARENT_DEFINITION, /may be right now/i);
  assert.ok(TRANSITION_COMPATIBILITY_EXCLUSIONS.includes("universal product transition score"));
  assert.deepEqual(validateTransitionCompatibilityLanguage("This bat will be easy immediately."), [
    "Prohibited transition-compatibility language matched /will be easy immediately/i."
  ]);
  assert.deepEqual(validateTransitionCompatibilityLanguage("This move appears manageable and may require an adjustment period."), []);
});

test("player readiness profile uses actual Player DNA inputs without age-only inference", () => {
  const readiness = normalizePlayerTransitionReadiness(playerFixture("improve_bat_control"));
  assert.equal(readiness.version, "1.0");
  assert.equal(readiness.batControlReadiness, 90);
  assert.equal(readiness.physicalReadiness, 62);
  assert.equal(readiness.experienceReadiness, 70);
  assert.equal(readiness.developmentReadiness, 62);
  assert.equal(readiness.currentEquipmentFamiliarity, undefined);
  assert.ok(readiness.sourceSummary.missingInputs.includes("currentEquipmentFamiliarity"));
  assert.equal(readiness.sourceSummary.availableInputs.includes("player.dateOfBirth"), false);
});

test("equipment contexts load specifications, balance, and swing effort without legacy transition fallback", () => {
  const current = normalizeCurrentEquipmentTransitionContext(canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }));
  const proposed = normalizeProposedEquipmentTransitionContext(canonicalProfile("proposed", { length: 31, weight: 23, drop: -8, balance: 26, swingEffort: 56 }));
  assert.equal(current.length, 30);
  assert.equal(current.weight, 22);
  assert.equal(current.drop, -8);
  assert.equal(current.balanceProfile, 11);
  assert.equal(current.swingEffort, 42);
  assert.equal(proposed.balanceProfile, 26);
  assert.equal(proposed.sourceSummary.numericReferenceInputs.includes("transitionFriendliness"), false);
});

test("change normalization boundaries are deterministic", () => {
  assert.equal(demandFromThreshold(0, [0, 0.5, 1, 1.5, 2]), 0);
  assert.equal(demandFromThreshold(0.5, [0, 0.5, 1, 1.5, 2]), 20);
  assert.equal(demandFromThreshold(1, [0, 0.5, 1, 1.5, 2]), 45);
  assert.equal(demandFromThreshold(1.5, [0, 0.5, 1, 1.5, 2]), 70);
  assert.equal(demandFromThreshold(2, [0, 0.5, 1, 1.5, 2]), 90);
  assert.equal(demandFromThreshold(-1, [0, 0.5, 1, 1.5, 2]), undefined);
});

test("same-equipment transition has minimal demand but is not forced to 100", () => {
  const current = canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 });
  const result = evaluateTransitionCompatibility({
    playerDNA: playerFixture("improve_bat_control"),
    currentEquipmentProfile: current,
    proposedEquipmentProfile: current,
    evaluatedAt: new Date("2026-08-02T00:00:00.000Z")
  });
  assert.equal(result.status, "completed");
  assert.ok((result.score ?? 0) >= 95);
  assert.notEqual(result.score, 100);
  assert.equal(transitionCompatibilityBandForScore(result.score ?? 0), result.band);
  assert.ok(result.reasons.some((reason) => reason.code === "CURRENT_EQUIPMENT_IS_SIMILAR"));
  assert.ok(result.missingInformation.some((item) => item.key === "currentEquipmentFamiliarity" && !item.required));
});

test("larger changes produce lower compatibility and supported tradeoffs", () => {
  const result = evaluateTransitionCompatibility({
    playerDNA: playerFixture("improve_bat_control"),
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 31, weight: 24, drop: -7, balance: 50, swingEffort: 74 }),
    evaluatedAt: new Date("2026-08-02T00:00:00.000Z")
  });
  assert.equal(result.status, "completed");
  assert.ok((result.score ?? 100) < 85);
  assert.ok(result.tradeoffs.some((tradeoff) => tradeoff.code === "HEAVIER_SETUP_MAY_REQUIRE_ACCLIMATION"));
  assert.ok(result.tradeoffs.some((tradeoff) => tradeoff.code === "END_LOAD_CHANGE_MAY_ALTER_BARREL_FEEL"));
  assert.ok(result.dimensions.some((dimension) => dimension.dimension === "swing_effort_change_demand" && (dimension.baseAdjustmentDemand ?? 0) > 0));
});

test("missing required current equipment specifications block without hidden zeroes", () => {
  const result = evaluateTransitionCompatibility({
    playerDNA: playerFixture("improve_bat_control"),
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }, ["weight"]),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 31, weight: 23, drop: -8, balance: 26, swingEffort: 56 }),
    evaluatedAt: new Date("2026-08-02T00:00:00.000Z")
  });
  assert.equal(result.status, "blocked_missing_current_equipment");
  assert.ok(result.missingInformation.some((item) => item.key === "weight" && item.required));
  assert.equal(result.dimensions.find((dimension) => dimension.dimension === "mass_change_demand")?.compatibilityScore, undefined);
});

test("high readiness reduces but does not erase demand", () => {
  const high = evaluateTransitionCompatibility({
    playerDNA: playerFixture("prepare_for_transition", { transitionReadiness: 92, batControl: 94, physicalStrength: 90 }),
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 31, weight: 24, drop: -7, balance: 50, swingEffort: 74 })
  });
  const low = evaluateTransitionCompatibility({
    playerDNA: playerFixture("maintain_current_fit", { transitionReadiness: 45, batControl: 55, physicalStrength: 45 }),
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 31, weight: 24, drop: -7, balance: 50, swingEffort: 74 })
  });
  assert.ok((high.score ?? 0) > (low.score ?? 0));
  const highMass = high.dimensions.find((dimension) => dimension.dimension === "mass_change_demand");
  assert.ok((highMass?.finalAdjustmentDemand ?? 0) > 0);
});

test("unsupported versions block and v1.0 confidence is never validated", () => {
  const result = evaluateTransitionCompatibility({
    playerDNA: { ...playerFixture("improve_bat_control"), version: "future" },
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 31, weight: 23, drop: -8, balance: 26, swingEffort: 56 })
  });
  assert.equal(result.status, "blocked_unsupported_version");
  assert.notEqual(result.confidence, "validated");
});

test("legacy comparison is comparison-only and distinguishes friendliness from fit", () => {
  const result = evaluateTransitionCompatibility({
    playerDNA: playerFixture("improve_bat_control"),
    currentEquipmentProfile: canonicalProfile("current", { length: 30, weight: 22, drop: -8, balance: 11, swingEffort: 42 }),
    proposedEquipmentProfile: canonicalProfile("proposed", { length: 31, weight: 23, drop: -8, balance: 26, swingEffort: 56 })
  });
  const comparison = compareTransitionCompatibilityWithLegacyDimension({
    result,
    legacy: {
      equipmentId: result.proposedEquipmentId,
      equipmentVariantId: result.proposedEquipmentVariantId,
      legacyTransitionFriendliness: 82,
      dimensions: [{ code: "TRANSITION_READINESS_FIT", rawScore: 74 }],
      reasonCodes: ["TRANSITION_READINESS_FIT"],
      tradeoffCodes: []
    }
  });
  assert.equal(comparison.legacyTransitionFriendliness, 82);
  assert.equal(comparison.legacyTransitionFit, 74);
  assert.ok(["aligned", "minor_difference", "material_difference"].includes(comparison.status));
  assert.match(comparison.explanation, /legacy|concepts/i);
});

function playerFixture(
  goal: PrimaryHittingGoal,
  scoreOverrides: Partial<PlayerDNAProfileResult["scores"]> = {}
): PlayerDNAProfileResult {
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
      profileCompleteness: 92,
      ...scoreOverrides
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

function canonicalProfile(
  id: string,
  values: { length: number; weight: number; drop: number; balance: number; swingEffort: number },
  omit: readonly EquipmentDNAAttributeKey[] = []
): CanonicalEquipmentDNAProfile {
  const attrs = [
    attr("length", values.length, "physical", values.length),
    attr("weight", values.weight, "physical", values.weight),
    attr("drop", values.drop, "physical", values.drop),
    attr("balance_profile", balanceOrdinal(values.balance), "performance", values.balance),
    attr("swing_effort", swingEffortOrdinal(values.swingEffort), "performance", values.swingEffort),
    attr("construction", "two_piece_composite", "physical"),
    attr("material", "composite", "physical")
  ].filter((attribute) => !omit.includes(attribute.key));
  return {
    version: "1.0",
    equipmentId: `${id}-equipment`,
    equipmentVariantId: `${id}-variant`,
    equipmentName: id,
    variantLabel: `${id}-sku`,
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: {
      ready: true,
      missingRequiredAttributes: [],
      insufficientConfidenceAttributes: [],
      invalidAttributes: [],
      experimentalAttributesIgnored: [],
      reasons: []
    },
    maturity: "evaluated",
    attributes: attrs,
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: new Date("2026-08-02T00:00:00.000Z")
  };
}

function balanceOrdinal(value: number): EquipmentDNAAttributeNormalizedValue {
  if (value <= 19) return "very_balanced";
  if (value <= 39) return "balanced";
  if (value <= 59) return "slightly_end_loaded";
  if (value <= 79) return "end_loaded";
  return "very_end_loaded";
}

function swingEffortOrdinal(value: number): EquipmentDNAAttributeNormalizedValue {
  if (value <= 19) return "very_easy";
  if (value <= 39) return "easy";
  if (value <= 59) return "moderate";
  if (value <= 79) return "demanding";
  return "very_demanding";
}

function attr(
  key: EquipmentDNAAttributeKey,
  value: EquipmentDNAAttributeNormalizedValue,
  domain: EquipmentDNAAttributeDomain,
  numericValue?: number
): CanonicalEquipmentDNAAttributeValue {
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
    evaluatedAt: new Date("2026-08-02T00:00:00.000Z"),
    evidence: numericValue === undefined
      ? []
      : [{
          evidenceRecordId: `${key}-evidence`,
          sourceType: "internal_derived",
          sourceName: "test fixture",
          method: "derived_mapping",
          status: "active",
          rawValue: {
            normalizedScore: numericValue,
            sourceScore: numericValue,
            referenceMethod: key === "balance_profile" ? "legacy_preserved" : "legacy_preserved"
          },
          evaluatorType: "system"
        }],
    status: "active"
  };
}
