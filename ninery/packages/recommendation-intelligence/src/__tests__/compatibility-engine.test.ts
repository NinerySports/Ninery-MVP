import assert from "node:assert/strict";
import test from "node:test";
import { equipmentDNAAttributes, type EquipmentDNAAttribute, type EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import { evaluateHardFilters } from "../eligibility/hard-filter-engine.js";
import { getScoringConfig } from "../scoring/scoring-config.registry.js";
import { adjustedWeightsForGoal } from "../scoring/weighted-score.js";
import { buildWhyNotComparison } from "../explainability/why-not-builder.js";
import { formatDemoRecommendationConsole } from "../demo-console-output.js";

test("certification mismatch causes ineligibility and preserves reasons", () => {
  const result = evaluateHardFilters({
    equipment: equipmentFixture({ certification: "USSSA" }),
    context: contextFixture(),
    config: getScoringConfig()
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reasons[0]?.code, "CERTIFICATION_MISMATCH");
});

test("inactive equipment and public draft DNA are filtered out", () => {
  const run = engineRun({
    equipment: [
      equipmentFixture({ equipmentId: "inactive", status: "archived" }),
      equipmentFixture({ equipmentId: "draft", eligibility: { eligible: false, reasons: ["draft"] }, publishedAt: undefined })
    ]
  });
  assert.equal(run.filteredEquipment.length, 2);
  assert.ok(run.filteredEquipment.some((item) => item.reasons.some((reason) => reason.code === "EQUIPMENT_NOT_ACTIVE")));
  assert.ok(run.filteredEquipment.some((item) => item.reasons.some((reason) => reason.code === "DNA_PROFILE_NOT_PUBLIC")));
});

test("missing Equipment DNA score does not become zero and lowers confidence", () => {
  const complete = engineRun({ equipment: [equipmentFixture({ equipmentId: "complete" })] }).primaryRecommendation;
  const missing = engineRun({
    equipment: [equipmentFixture({ equipmentId: "missing", scores: { batControl: undefined } })],
    context: { minimumEvidenceConfidence: 0 }
  }).primaryRecommendation;
  assert.ok(complete);
  assert.ok(missing);
  const missingDimension = missing.dimensions.find((dimension) => dimension.code === "BAT_CONTROL_FIT");
  assert.equal(missingDimension?.rawScore, 50);
  assert.ok(missing.confidence.score < complete.confidence.score);
});

test("bat-control-focused player favors stronger control compatibility", () => {
  const run = engineRun({
    playerDNA: playerFixture("improve_bat_control"),
    equipment: [
      equipmentFixture({ equipmentId: "control", model: "Control", scores: { batControl: 94, powerPotential: 60 } }),
      equipmentFixture({ equipmentId: "power", model: "Power", scores: { batControl: 60, powerPotential: 96 } })
    ]
  });
  assert.equal(run.primaryRecommendation?.equipment.equipmentId, "control");
});

test("goal-based dynamic weights normalize to 1.00", () => {
  for (const goal of ["improve_power", "build_confidence", "prepare_for_transition"] as PrimaryHittingGoal[]) {
    const { weights, adjustments } = adjustedWeightsForGoal(getScoringConfig(), goal);
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    assert.equal(Math.round(total * 100), 100);
    assert.ok(adjustments.length > 0);
  }
});

test("dimension and overall scores stay between 0 and 100", () => {
  const item = engineRun().primaryRecommendation;
  assert.ok(item);
  assert.ok(item.overallMatchScore >= 0 && item.overallMatchScore <= 100);
  for (const dimension of item.dimensions) {
    assert.ok(dimension.rawScore >= 0 && dimension.rawScore <= 100);
  }
});

test("recommendation confidence is separate from match score", () => {
  const item = engineRun().primaryRecommendation;
  assert.ok(item);
  assert.notEqual(item.overallMatchScore, item.confidence.score);
});

test("same inputs and config produce identical deterministic results", () => {
  const first = engineRun();
  const second = engineRun();
  assert.deepEqual(first, second);
});

test("ranking and tie-breaker are deterministic without brand popularity", () => {
  const run = engineRun({
    equipment: [
      equipmentFixture({ equipmentId: "b", manufacturer: "Popular", model: "B" }),
      equipmentFixture({ equipmentId: "a", manufacturer: "Quiet", model: "A" })
    ]
  });
  assert.equal(run.primaryRecommendation?.equipment.equipmentId, "a");
  assert.ok(run.primaryRecommendation?.trace.tieBreakRulesUsed.includes("equipmentId"));
});

test("why-not explanation compares player-specific trade-offs", () => {
  const run = engineRun({
    equipment: [
      equipmentFixture({ equipmentId: "rawlings-icon", model: "ICON", scores: { batControl: 92, confidenceBuilding: 90 } }),
      equipmentFixture({ equipmentId: "easton-hype", model: "Hype Fire", scores: { batControl: 70, powerPotential: 96 } })
    ]
  });
  assert.ok(run.primaryRecommendation);
  assert.ok(run.alternatives[0]);
  const whyNot = buildWhyNotComparison(run.primaryRecommendation, run.alternatives[0]);
  assert.equal(whyNot.sourceEquipmentId, "rawlings-icon");
  assert.ok(whyNot.summary.includes("ranked ahead"));
});

test("Rawlings ICON demo scenario generates an explainable result without forcing first place", () => {
  const run = engineRun({
    playerDNA: playerFixture("maintain_current_fit"),
    equipment: [
      equipmentFixture({ equipmentId: "rawlings-icon", manufacturer: "Rawlings", model: "ICON", scores: { batControl: 88, balance: 86, powerPotential: 85 } }),
      equipmentFixture({ equipmentId: "hype-fire", manufacturer: "Easton", model: "Hype Fire", scores: { batControl: 78, balance: 72, powerPotential: 96 } }),
      equipmentFixture({ equipmentId: "atlas", manufacturer: "Louisville Slugger", model: "Atlas", scores: { batControl: 84, balance: 82, powerPotential: 82 } })
    ]
  });
  assert.ok(run.primaryRecommendation);
  assert.ok(run.primaryRecommendation.explanation.topReasons.length > 0);
  assert.equal(run.traceSummary.eligibleCount, 3);
});

test("demo recommendation output includes trace, reasons, tradeoffs, and separate confidence", () => {
  const playerDNA = playerFixture("improve_bat_control");
  const run = engineRun({
    playerDNA,
    equipment: [
      equipmentFixture({ equipmentId: "rawlings-icon", manufacturer: "Rawlings", model: "ICON" }),
      equipmentFixture({ equipmentId: "atlas", manufacturer: "Louisville Slugger", model: "Atlas", scores: { transitionFriendliness: 90 } }),
      equipmentFixture({ equipmentId: "hype-fire", manufacturer: "Easton", model: "Hype Fire", scores: { powerPotential: 96 } })
    ]
  });
  const output = formatDemoRecommendationConsole({
    player: { firstName: "Jackson", lastName: "Sanders" },
    playerDNA,
    recommendations: run
  });

  assert.ok(run.primaryRecommendation?.trace.traceId);
  assert.ok(run.primaryRecommendation.explanation.topReasons.length > 0);
  assert.ok(run.primaryRecommendation.explanation.tradeoffs.length > 0);
  assert.notEqual(run.primaryRecommendation.overallMatchScore, run.primaryRecommendation.confidence.score);
  assert.match(output, /PLAYER DNA SUMMARY/);
  assert.match(output, /TOP RECOMMENDATIONS/);
});

function engineRun(overrides: {
  playerDNA?: PlayerDNAProfileResult;
  equipment?: EquipmentDNAProfile[];
  context?: Partial<Parameters<CompatibilityScoringEngine["score"]>[0]["context"]>;
} = {}) {
  return new CompatibilityScoringEngine().score({
    playerDNA: overrides.playerDNA ?? playerFixture("improve_bat_control"),
    equipment: overrides.equipment ?? [equipmentFixture({ equipmentId: "rawlings-icon" })],
    context: { ...contextFixture(), ...overrides.context }
  });
}

function contextFixture() {
  return {
    playerId: "player-1",
    certification: "USA" as const,
    category: "bat" as const,
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

function equipmentFixture(overrides: Partial<EquipmentDNAProfile> & { scores?: Partial<EquipmentDNAProfile["scores"]> } = {}): EquipmentDNAProfile {
  const scores = {
    batControl: 90,
    balance: 88,
    swingWeight: 42,
    barrelForgiveness: 86,
    sweetSpotSize: 88,
    powerPotential: 84,
    confidenceBuilding: 90,
    transitionFriendliness: 82,
    ...overrides.scores
  };
  return {
    equipmentId: overrides.equipmentId ?? "equipment-1",
    sourceLevel: "model",
    manufacturer: overrides.manufacturer ?? "Rawlings",
    model: overrides.model ?? "ICON",
    modelYear: 2026,
    certification: overrides.certification ?? "USA",
    category: overrides.category ?? "bat",
    status: overrides.status ?? "active",
    profileVersion: 1,
    evidenceConfidence: overrides.evidenceConfidence ?? { score: 78, band: "high" },
    certificationLevel: "gold",
    secondaryPersonalities: [],
    fitProfiles: [],
    specifications: [],
    availableVariants: overrides.availableVariants ?? [{ id: "variant-1", lengthInches: 30, dropWeight: -8, weightOunces: 22, msrp: 349 }],
    sourceProfileId: `${overrides.equipmentId ?? "equipment-1"}-dna`,
    profileCompleteness: overrides.profileCompleteness ?? 90,
    publishedAt: Object.hasOwn(overrides, "publishedAt") ? overrides.publishedAt : "2026-01-01T00:00:00.000Z",
    scores,
    missingCharacteristics: equipmentDNAAttributes.filter((attribute: EquipmentDNAAttribute) => scores[attribute] === undefined),
    explanations: [],
    eligibility: overrides.eligibility ?? { eligible: true, reasons: [] }
  };
}
