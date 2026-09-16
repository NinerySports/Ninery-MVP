import assert from "node:assert/strict";
import test from "node:test";
import type {
  CanonicalEquipmentDNAAdmissionDecision,
  CanonicalEquipmentDNAAttributeValue,
  CanonicalEquipmentDNAProfile,
  EquipmentDNANumericReference,
  EquipmentDNAProfile
} from "@ninery/equipment-intelligence";
import {
  adaptCanonicalEquipmentDNAUsingSelectedSources,
  calculateRankingDistance,
  canonicalAttributeSourceSelectionPolicy,
  bridgeCanonicalBalanceToRecommendationInput,
  CANONICAL_BALANCE_TO_RECOMMENDATION_INPUT_VERSION,
  meetsMinimumEquipmentAttributeConfidence,
  ordinalProjection,
  selectCanonicalCandidateAttributeSource,
  selectCanonicalCandidateAttributeSources,
  selectCanonicalCandidateAttributeSourcesWithBalance
} from "../index.js";
import type { CompatibilityRunResult } from "../compatibility.types.js";

const evaluatedAt = new Date("2026-07-22T00:00:00.000Z");

test("confidence ordering is explicit and fail-closed for invalid values", () => {
  assert.equal(meetsMinimumEquipmentAttributeConfidence("estimated", "moderate"), false);
  assert.equal(meetsMinimumEquipmentAttributeConfidence("moderate", "moderate"), true);
  assert.equal(meetsMinimumEquipmentAttributeConfidence("high", "moderate"), true);
  assert.equal(meetsMinimumEquipmentAttributeConfidence("validated", "high"), true);
  assert.equal(meetsMinimumEquipmentAttributeConfidence("unknown", "moderate"), false);
});

test("valid numeric reference is selected attribute-by-attribute", () => {
  const decision = selectCanonicalCandidateAttributeSource({
    canonicalAttribute: attribute("bat_control_support", "high"),
    numericReference: reference(74),
    admissionDecision: admission(),
    targetRecommendationField: "batControl",
    evaluatedAt
  });

  assert.equal(decision.outcome, "numeric_reference_selected");
  assert.equal(decision.selectedSource, "numeric_reference");
  assert.equal(decision.selectedNumericValue, 74);
  assert.equal(decision.ordinalProjectedValue, 70);
  assert.equal(decision.fallbackUsed, false);
});

test("missing, invalid, and insufficient references use explicit ordinal fallback when policy allows", () => {
  const missing = selectCanonicalCandidateAttributeSource({
    canonicalAttribute: attribute("forgiveness", "very_high"),
    admissionDecision: admission(),
    targetRecommendationField: "barrelForgiveness",
    evaluatedAt
  });
  assert.equal(missing.outcome, "ordinal_projection_selected");
  assert.equal(missing.selectedNumericValue, 90);
  assert.equal(missing.fallbackUsed, true);

  const inconsistent = selectCanonicalCandidateAttributeSource({
    canonicalAttribute: attribute("forgiveness", "high"),
    numericReference: reference(91),
    admissionDecision: admission(),
    targetRecommendationField: "barrelForgiveness",
    evaluatedAt
  });
  assert.equal(inconsistent.outcome, "ordinal_projection_selected");
  assert.equal(inconsistent.selectedNumericValue, 70);
  assert.equal(inconsistent.warnings.some((warning) => warning.code === "NUMERIC_REFERENCE_ORDINAL_INCONSISTENT"), true);

  const lowConfidence = selectCanonicalCandidateAttributeSource({
    canonicalAttribute: attribute("sweet_spot_support", "high"),
    numericReference: { ...reference(74), confidence: "estimated" },
    admissionDecision: admission(),
    targetRecommendationField: "sweetSpotSize",
    evaluatedAt
  });
  assert.equal(lowConfidence.outcome, "ordinal_projection_selected");
  assert.equal(lowConfidence.warnings.some((warning) => warning.code === "NUMERIC_REFERENCE_CONFIDENCE_INSUFFICIENT"), true);
});

test("unsupported version and unsupported attributes block safely", () => {
  const version = selectCanonicalCandidateAttributeSource({
    canonicalAttribute: attribute("power_potential", "high"),
    numericReference: { ...reference(74), mappingVersion: "9.9" },
    admissionDecision: admission(),
    targetRecommendationField: "powerPotential",
    evaluatedAt
  });
  assert.equal(version.outcome, "blocked_unsupported_version");
  assert.equal(version.candidateInputAllowed, false);

  const unsupported = selectCanonicalCandidateAttributeSource({
    canonicalAttribute: attribute("transition_difficulty", "moderate"),
    numericReference: reference(50),
    admissionDecision: admission(),
    targetRecommendationField: "transitionFriendliness",
    evaluatedAt
  });
  assert.equal(unsupported.outcome, "blocked_unsupported_attribute");
});

test("selection collection counts selected sources and blocks admission mismatch", () => {
  const selected = selectCanonicalCandidateAttributeSources({
    canonicalProfile: profile(),
    admissionDecision: admission(),
    numericReferences: [
      reference(91, "fixture:BAT_CONTROL"),
      reference(42, "fixture:SWING_WEIGHT"),
      reference(86, "fixture:BARREL_FORGIVENESS"),
      reference(88, "fixture:SWEET_SPOT_SIZE"),
      reference(84, "fixture:POWER_POTENTIAL")
    ],
    evaluatedAt
  });
  assert.equal(selected.selectedNumericReferenceCount, 5);
  assert.equal(selected.selectedOrdinalProjectionCount, 0);
  assert.equal(selected.candidateInputAllowed, true);

  const mismatch = selectCanonicalCandidateAttributeSources({
    canonicalProfile: profile(),
    admissionDecision: { ...admission(), equipmentId: "other" },
    numericReferences: [],
    evaluatedAt
  });
  assert.equal(mismatch.candidateInputAllowed, false);
  assert.equal(mismatch.blockedRequiredAttributes.length, 5);
});

test("numeric-reference adapter maps selected values and never carries unsupported legacy fields", () => {
  const selection = selectCanonicalCandidateAttributeSources({
    canonicalProfile: profile(),
    admissionDecision: admission(),
    numericReferences: [
      reference(91, "fixture:BAT_CONTROL"),
      reference(42, "fixture:SWING_WEIGHT"),
      reference(86, "fixture:BARREL_FORGIVENESS"),
      reference(88, "fixture:SWEET_SPOT_SIZE"),
      reference(84, "fixture:POWER_POTENTIAL")
    ],
    evaluatedAt
  });
  const adapted = adaptCanonicalEquipmentDNAUsingSelectedSources({
    canonicalProfile: profile(),
    sourceSelection: selection,
    legacyBaseline: legacyEquipment()
  });

  assert.equal(adapted.equipment.scores.batControl, 91);
  assert.equal(adapted.equipment.scores.swingWeight, 42);
  assert.equal(adapted.equipment.scores.balance, undefined);
  assert.equal(adapted.equipment.scores.confidenceBuilding, undefined);
  assert.equal(adapted.equipment.scores.transitionFriendliness, undefined);
  assert.equal(adapted.selectedSources.length, 5);
});

test("balance-aware source selection adds only validated balance reference", () => {
  const selection = selectCanonicalCandidateAttributeSourcesWithBalance({
    canonicalProfile: profileWithBalance(),
    admissionDecision: admission(),
    numericReferences: [
      reference(91, "fixture:BAT_CONTROL"),
      reference(42, "fixture:SWING_WEIGHT"),
      reference(86, "fixture:BARREL_FORGIVENESS"),
      reference(88, "fixture:SWEET_SPOT_SIZE"),
      reference(84, "fixture:POWER_POTENTIAL"),
      { ...reference(11, "legacy:SWING_BALANCE"), confidence: "moderate" }
    ],
    evaluatedAt
  });
  const adapted = adaptCanonicalEquipmentDNAUsingSelectedSources({
    canonicalProfile: profileWithBalance(),
    sourceSelection: selection,
    legacyBaseline: legacyEquipment()
  });

  assert.equal(selection.candidateInputAllowed, true);
  assert.equal(selection.selectedNumericReferenceCount, 6);
  assert.equal(adapted.equipment.scores.balance, 89);
  const balanceTrace = adapted.selectedSources.find((source) => source.canonicalKey === "balance_profile");
  assert.equal(balanceTrace?.canonicalValueBeforeRecommendationBridge, 11);
  assert.equal(balanceTrace?.recommendationBridgeValue, 89);
  assert.equal(balanceTrace?.recommendationBridgeStrategy, "inverse_to_balance_support");
  assert.equal(adapted.equipment.missingCharacteristics.includes("balance"), false);
  assert.equal(adapted.equipment.missingCharacteristics.includes("confidenceBuilding"), true);
  assert.equal(adapted.equipment.missingCharacteristics.includes("transitionFriendliness"), true);
});

test("canonical balance recommendation bridge preserves current engine direction", () => {
  assert.equal(CANONICAL_BALANCE_TO_RECOMMENDATION_INPUT_VERSION, "1.0");
  assert.equal(bridgeCanonicalBalanceToRecommendationInput(11).recommendationInputValue, 89);
  assert.equal(bridgeCanonicalBalanceToRecommendationInput(16).recommendationInputValue, 84);
  assert.equal(bridgeCanonicalBalanceToRecommendationInput(26).recommendationInputValue, 74);
  assert.equal(bridgeCanonicalBalanceToRecommendationInput(0).recommendationInputValue, 100);
  assert.equal(bridgeCanonicalBalanceToRecommendationInput(100).recommendationInputValue, 0);
  assert.throws(() => bridgeCanonicalBalanceToRecommendationInput(-1));
  assert.throws(() => bridgeCanonicalBalanceToRecommendationInput(101));
  const trace = bridgeCanonicalBalanceToRecommendationInput(11);
  assert.equal(trace.strategy, "inverse_to_balance_support");
  assert.match(trace.explanation, /current recommendation balance field expects higher values/);
});

test("ranking distance handles identical, swapped, reversed, and missing rankings", () => {
  assert.equal(calculateRankingDistance(run(["a", "b", "c"]), run(["a", "b", "c"])), 0);
  assert.equal(calculateRankingDistance(run(["a", "b", "c"]), run(["b", "a", "c"])), 2);
  assert.equal(calculateRankingDistance(run(["a", "b", "c"]), run(["c", "b", "a"])), 4);
  assert.equal(calculateRankingDistance(run(["a", "b", "c"]), run(["a", "b"])), 3);
});

test("ordinal projection keeps swing effort demand direction explicit", () => {
  assert.equal(ordinalProjection("swing_effort", "very_easy"), 10);
  assert.equal(ordinalProjection("swing_effort", "moderate"), 50);
  assert.equal(ordinalProjection("swing_effort", "very_demanding"), 90);
  assert.equal(ordinalProjection("bat_control_support", "high"), 70);
  assert.equal(ordinalProjection("balance_profile", "very_balanced"), 10);
  assert.equal(ordinalProjection("balance_profile", "very_end_loaded"), 90);
});

function reference(numericValue: number, sourceReference = "fixture:BAT_CONTROL"): EquipmentDNANumericReference {
  return {
    numericValue,
    scale: "0_100",
    referenceMethod: "legacy_preserved",
    confidence: "high",
    evaluatorType: "internal",
    mappingVersion: "1.0",
    generatedAt: evaluatedAt,
    sourceReference
  };
}

function profileWithBalance(): CanonicalEquipmentDNAProfile {
  return {
    ...profile(),
    attributes: [
      ...profile().attributes,
      { ...attribute("balance_profile", "very_balanced"), confidence: "moderate" }
    ]
  };
}

function attribute(key: CanonicalEquipmentDNAAttributeValue["key"], value: CanonicalEquipmentDNAAttributeValue["value"]): CanonicalEquipmentDNAAttributeValue {
  return {
    key,
    definitionVersion: "1.0",
    domain: key === "bat_control_support" ? "development" : "performance",
    targetLevel: "equipment",
    value,
    confidence: "high",
    evaluationMethod: "derived_mapping",
    evaluationVersion: 1,
    rationale: "test",
    evaluatedAt,
    evidence: [],
    status: "active"
  };
}

function profile(): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId: "equipment-1",
    equipmentVariantId: "variant-1",
    equipmentName: "Rawlings ICON 2026",
    variantLabel: "RAW-ICON-USA-30-22",
    registryVersion: "1.0",
    confidenceModelVersion: "1.0",
    readinessModelVersion: "1.0",
    scoreMappingVersion: "1.0",
    readiness: { ready: true, missingRequiredAttributes: [], insufficientConfidenceAttributes: [], invalidAttributes: [], experimentalAttributesIgnored: [], reasons: [] },
    maturity: "evaluated",
    attributes: [
      attribute("length", 30),
      attribute("weight", 22),
      attribute("drop", -8),
      attribute("bat_control_support", "very_high"),
      attribute("swing_effort", "moderate"),
      attribute("forgiveness", "very_high"),
      attribute("sweet_spot_support", "very_high"),
      attribute("power_potential", "very_high")
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: evaluatedAt
  };
}

function admission(): CanonicalEquipmentDNAAdmissionDecision {
  return {
    version: "1.0",
    policyVersion: "1.0",
    equipmentId: "equipment-1",
    equipmentVariantId: "variant-1",
    equipmentName: "Rawlings ICON 2026",
    evaluatedAt,
    outcome: "approved_for_internal_candidate",
    eligibleForShadow: true,
    eligibleForInternalCandidate: true,
    liveRecommendationUseAllowed: false,
    blockers: [],
    warnings: [],
    criteria: [],
    mappingCoverage: { requiredComparableKeys: [], successfullyComparedKeys: [], missingCanonicalKeys: [], missingLegacyKeys: [], incomparableRequiredKeys: [], optionalIncomparableKeys: [], coverageRatio: 1, requiredCoverageSatisfied: true },
    versionAssessment: {
      supported: true,
      actual: { admissionPolicyVersion: "1.0", canonicalProfileVersion: "1.0", registryVersion: "1.0", confidenceModelVersion: "1.0", readinessModelVersion: "1.0", scoreMappingVersion: "1.0", shadowComparisonVersion: "1.0", ordinalComparisonVersion: "1.0" },
      unsupported: []
    },
    sourceSummary: { ready: true, maturity: "evaluated", shadowStatus: "aligned", specificationMatchCount: 5, specificationProblemCount: 0, alignedBehaviorCount: 5, minorBehaviorDifferenceCount: 0, materialBehaviorDifferenceCount: 0, incomparableBehaviorCount: 0 },
    nextActions: []
  };
}

function legacyEquipment(): EquipmentDNAProfile {
  return {
    equipmentId: "equipment-1",
    variantId: "variant-1",
    manufacturer: "Rawlings",
    model: "ICON",
    modelYear: 2026,
    category: "bat",
    certification: "USA",
    status: "active",
    sourceLevel: "model",
    sourceProfileId: "legacy-profile",
    profileVersion: 1,
    certificationLevel: "gold",
    profileCompleteness: 100,
    evidenceConfidence: { score: 80, band: "high" },
    scores: { batControl: 1, swingWeight: 2, barrelForgiveness: 3, sweetSpotSize: 4, powerPotential: 5, balance: 6, confidenceBuilding: 7, transitionFriendliness: 8 },
    missingCharacteristics: [],
    explanations: [],
    eligibility: { eligible: true, reasons: [] },
    secondaryPersonalities: [],
    fitProfiles: [],
    specifications: [],
    availableVariants: [{ id: "variant-1", lengthInches: 30, weightOunces: 22, dropWeight: -8 }],
    selectedVariant: { id: "variant-1", lengthInches: 30, weightOunces: 22, dropWeight: -8 }
  };
}

function run(order: readonly string[]): CompatibilityRunResult {
  const items = order.map((id, index) => ({
    equipment: { ...legacyEquipment(), equipmentId: id, model: id },
    overallMatchScore: 100 - index,
    matchBand: "Excellent Match" as const,
    confidence: { score: 90, band: "high" as const, reasons: [], missingInformation: [] },
    dimensions: [],
    explanation: { summary: "", topReasons: [], tradeoffs: [], uncertainties: [], whatCouldChange: [] },
    trace: {
      traceId: id,
      playerDNAProfileId: "player-dna",
      playerDNAProfileVersion: "1",
      equipmentDNAProfileId: id,
      equipmentDNAProfileVersion: 1,
      equipmentId: id,
      scoringConfigVersion: "test",
      eligibilityChecks: [],
      dimensions: [],
      initialWeights: {} as CompatibilityRunResult["primaryRecommendation"] extends infer _ ? never : never,
      adjustedWeights: {} as never,
      dynamicWeightAdjustments: [],
      penalties: [],
      bonuses: [],
      finalScore: 100 - index,
      confidence: { score: 90, band: "high" as const, reasons: [], missingInformation: [] },
      tieBreakRulesUsed: [],
      generatedAt: evaluatedAt.toISOString()
    }
  }));
  return {
    playerId: "player",
    playerDNAProfileId: "player-dna",
    scoringConfigVersion: "test",
    primaryRecommendation: items[0],
    alternatives: items.slice(1),
    filteredEquipment: [],
    nonRecommended: [],
    confidence: { score: 90, band: "high", reasons: [], missingInformation: [] },
    traceSummary: { inputHash: "hash", generatedAt: evaluatedAt.toISOString(), eligibleCount: items.length, filteredCount: 0 },
    generatedAt: evaluatedAt.toISOString()
  };
}

assert.equal(canonicalAttributeSourceSelectionPolicy.version, "1.0");
