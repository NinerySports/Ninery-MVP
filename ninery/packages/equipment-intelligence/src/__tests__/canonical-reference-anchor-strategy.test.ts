import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_REFERENCE_ANCHOR_STRATEGY_VERSION,
  analyzeCanonicalReferenceAnchorStrategy,
  buildCanonicalReferenceAnchorInventory,
  reviewCanonicalProfileForReferenceAnchors,
  validateCanonicalReferenceAnchorPolicy,
  type BehavioralEvidenceRecord,
  type CanonicalEquipmentDNAProfile,
  type CanonicalReferenceAnchorAttributeReview,
  type ComparativeEvidenceSynthesisReport,
  type EquipmentJsonValue
} from "../index.js";

test("external unanchored reference blocks absolute inference while retaining strong comparative consensus", () => {
  const report = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture(),
    candidateAnchors: [],
    evidence: []
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(report.version, CANONICAL_REFERENCE_ANCHOR_STRATEGY_VERSION);
  assert.equal(swing?.comparativeConsensus, "clearly_more_demand");
  assert.equal(swing?.consensusStrength, "strong");
  assert.equal(swing?.referenceAnchored, false);
  assert.equal(swing?.canonicalInterpretationGateStatus, "blocked_no_anchor");
  assert.equal(swing?.preferredNextAction, "collect_standalone_evaluation");
  assert.equal(swing?.boundedCanonicalRange, undefined);
});

test("catalog canonical value does not automatically qualify as anchor when legacy-derived", () => {
  const review = reviewCanonicalProfileForReferenceAnchors({ profile: canonicalProfile("Rawlings ICON 2026", "legacy_derived") });
  const swing = review.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.anchorStatus, "provisional_anchor");
  assert.equal(swing?.approvedForInference, false);
  assert.equal(swing?.numericReferenceAvailable, true);
  assert.equal(swing?.limitations.some((item) => item.includes("legacy-derived")), true);
});

test("high-quality ordinal anchor can support bounded inference without fabricating a single ordinal", () => {
  const report = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture(),
    candidateAnchors: [anchor("swing_effort", "easy", "ordinal_anchor")],
    evidence: []
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.canonicalInterpretationGateStatus, "bounded_interpretation_available");
  assert.deepEqual(swing?.boundedCanonicalRange, ["moderate", "very_demanding"]);
  assert.equal(swing?.canonicalInterpretationStatus, "bounded");
  assert.equal(swing?.preferredNextAction, "canonical_interpretation_ready");
});

test("numeric anchor is distinguished from ordinal anchor", () => {
  const report = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture(),
    candidateAnchors: [anchor("swing_effort", "easy", "numeric_anchor", true)],
    evidence: []
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.anchorQuality, "numeric_anchor");
  assert.equal(swing?.canonicalInterpretationGateStatus, "numeric_reference_supported");
});

test("synthetic fixture cannot become validated anchor", () => {
  const review = reviewCanonicalProfileForReferenceAnchors({ profile: canonicalProfile("Synthetic ICON", "validated"), syntheticFixture: true });
  assert.equal(review.find((item) => item.attributeKey === "bat_control_support")?.anchorStatus, "not_anchor_eligible");
});

test("circular anchor lineage is rejected", () => {
  const profile = canonicalProfile("Circular Anchor", "structured", {
    rawValue: { canonicalAnchorSource: "relative_comparison", anchorLineage: ["swing_effort"] }
  });
  const review = reviewCanonicalProfileForReferenceAnchors({ profile });
  const swing = review.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.anchorStatus, "not_anchor_eligible");
  assert.equal(swing?.limitations.some((item) => item.includes("Circular")), true);
});

test("same-attribute and compatible version anchor are required", () => {
  const wrongAttribute = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture(),
    candidateAnchors: [anchor("forgiveness", "high", "ordinal_anchor")],
    evidence: []
  });
  assert.equal(wrongAttribute.attributes.find((item) => item.attributeKey === "swing_effort")?.availableAnchors.length, 0);

  const profile = canonicalProfile("Old Version", "structured", { definitionVersion: "0.9" });
  const old = reviewCanonicalProfileForReferenceAnchors({ profile });
  assert.equal(old.find((item) => item.attributeKey === "swing_effort")?.anchorStatus, "not_anchor_eligible");
});

test("standalone, objective, and combined evidence paths are recognized without persistence", () => {
  const oneStandalone = standaloneEvidence("s1", "eval-a");
  const report = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture(),
    candidateAnchors: [],
    evidence: [oneStandalone, objectiveEvidence("m1")]
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.absolutePathCandidates.find((item) => item.path === "independent_standalone_absolute_evaluation")?.status, "partial");
  assert.equal(swing?.absolutePathCandidates.find((item) => item.path === "objective_measurement")?.status, "partial");
  assert.equal(swing?.absolutePathCandidates.find((item) => item.path === "combined_evidence")?.status, "partial");
  assert.equal(swing?.canonicalInterpretationGateStatus, "blocked_no_anchor");
});

test("two independent standalone evidence sources can satisfy the standalone gate", () => {
  const report = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture(),
    candidateAnchors: [],
    evidence: [standaloneEvidence("s1", "eval-a"), standaloneEvidence("s2", "eval-b")]
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.canonicalInterpretationGateStatus, "single_ordinal_supported");
  assert.equal(swing?.preferredNextAction, "canonical_interpretation_ready");
});

test("material conflict selects conflict resolution before anchor work", () => {
  const report = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture({ materialConflict: true }),
    candidateAnchors: [anchor("swing_effort", "easy", "ordinal_anchor")],
    evidence: []
  });
  const swing = report.attributes.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.preferredNextAction, "resolve_material_conflict");
  assert.equal(swing?.canonicalInterpretationGateStatus, "blocked_insufficient_absolute_evidence");
});

test("DeMarini real-pattern policy stays unpromoted and reports Omaha requirements", () => {
  const report = analyzeCanonicalReferenceAnchorStrategy({
    synthesis: synthesisFixture(),
    candidateAnchors: [
      anchor("swing_effort", "easy", "provisional_anchor", true),
      anchor("bat_control_support", "high", "provisional_anchor", true)
    ],
    evidence: []
  });
  assert.equal(report.omahaAnchorRequirements.catalogOnboardingNeeded, true);
  assert.equal(report.omahaAnchorRequirements.numericReferenceRequired, false);
  assert.equal(report.canonicalProfileReady, false);
  assert.equal(report.liveRecommendationActivationAllowed, false);
  assert.equal(report.attributes.find((item) => item.attributeKey === "swing_effort")?.canonicalInterpretationGateStatus, "blocked_no_anchor");
});

test("demo bat anchor inventory reviews candidates honestly", () => {
  const inventory = buildCanonicalReferenceAnchorInventory({
    profiles: [
      { profile: canonicalProfile("Rawlings ICON 2026", "legacy_derived") },
      { profile: canonicalProfile("Louisville Slugger Atlas 2026", "legacy_derived") },
      { profile: canonicalProfile("Easton Hype Fire 2026", "legacy_derived") }
    ],
    generatedAt: new Date("2026-08-21T00:00:00.000Z")
  });
  assert.equal(inventory.reviews.length, 12);
  assert.equal(inventory.reviews.every((item) => item.anchorStatus === "provisional_anchor"), true);
  assert.equal(inventory.reviews.some((item) => item.equipmentName === "Easton Hype Fire 2026"), true);
});

test("anchor policy validation keeps live recommendation and Transition boundaries closed", () => {
  const validation = validateCanonicalReferenceAnchorPolicy();
  assert.equal(validation.verdict, "pass");
  assert.equal(validation.checks.some((item) => item.name === "live recommendation behavior remains unchanged" && item.passed), true);
});

function synthesisFixture(options: { materialConflict?: boolean } = {}): ComparativeEvidenceSynthesisReport {
  return {
    version: "1.0",
    equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c",
    equipmentLabel: "2023 DeMarini The Goods",
    variantLabel: "DEM-THE-GOODS-USA-30-20 30/20/-10",
    physicalSessionCount: 2,
    independentEvaluatorCount: 2,
    evidenceCount: 8,
    attributes: [
      attributeSynthesis("swing_effort", "clearly_more_demand", options.materialConflict),
      attributeSynthesis("forgiveness", "less_support"),
      attributeSynthesis("sweet_spot_support", "less_support"),
      attributeSynthesis("bat_control_support", "clearly_less_support")
    ],
    canonicalProfileReady: false,
    genuineStudyReady: false,
    liveRecommendationActivationAllowed: false
  };
}

function attributeSynthesis(
  attributeKey: ComparativeEvidenceSynthesisReport["attributes"][number]["attributeKey"],
  comparativeDirection: ComparativeEvidenceSynthesisReport["attributes"][number]["comparativeDirection"],
  materialConflict = false
): ComparativeEvidenceSynthesisReport["attributes"][number] {
  return {
    attributeKey,
    evidenceCount: 2,
    sessionCount: 2,
    independentSourceCount: 2,
    dimensionResults: [],
    comparativeDirection,
    consensusStrength: "strong",
    materialConflict,
    conflictingDimensions: materialConflict ? ["test_dimension"] : [],
    supportingDimensions: ["test_dimension"],
    referenceContext: {
      referenceType: "verified_external_reference",
      referenceLabel: "2023 Louisville Slugger Omaha USA 30/19/-11",
      referenceAnchored: false,
      limitations: ["Reference has no canonical Equipment DNA anchor."]
    },
    confidence: "moderate",
    canonicalInterpretationStatus: "deferred_reference_unanchored",
    limitations: ["No absolute ordinal."],
    nextEvidenceAction: "onboard_and_anchor_reference_equipment",
    synthesisVersion: "1.0",
    consensusPolicyVersion: "1.0",
    canonicalGateVersion: "1.0"
  };
}

function anchor(
  attributeKey: CanonicalReferenceAnchorAttributeReview["attributeKey"],
  canonicalOrdinal: CanonicalReferenceAnchorAttributeReview["canonicalOrdinal"],
  anchorStatus: CanonicalReferenceAnchorAttributeReview["anchorStatus"],
  numericReferenceAvailable = false
): CanonicalReferenceAnchorAttributeReview {
  return {
    equipmentId: `anchor-${attributeKey}`,
    equipmentName: "Anchor Bat",
    variantLabel: "ANCHOR-30-20",
    attributeKey,
    canonicalOrdinal,
    numericReferenceAvailable,
    confidence: "high",
    evaluationMethod: "standardized_rubric",
    anchorStatus,
    evidenceQuality: anchorStatus === "provisional_anchor" ? "legacy_derived" : "structured",
    approvedForInference: anchorStatus === "ordinal_anchor" || anchorStatus === "numeric_anchor" || anchorStatus === "validated_anchor",
    limitations: anchorStatus === "provisional_anchor" ? ["Legacy-derived provisional value."] : [],
    lineage: { canonicalAnchorSource: "direct_evidence", anchorLineage: [], anchorDepth: 0, circular: false }
  };
}

function canonicalProfile(
  equipmentName: string,
  quality: "legacy_derived" | "structured" | "validated",
  options: { rawValue?: EquipmentJsonValue; definitionVersion?: string } = {}
): CanonicalEquipmentDNAProfile {
  return {
    version: "1.0",
    equipmentId: equipmentName.toLowerCase().replaceAll(" ", "-"),
    equipmentName,
    variantLabel: "DEMO-30-22",
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
    maturity: quality === "validated" ? "validated" : "evaluated",
    attributes: [
      canonicalAttribute("swing_effort", "easy", quality, options),
      canonicalAttribute("forgiveness", "high", quality, options),
      canonicalAttribute("sweet_spot_support", "high", quality, options),
      canonicalAttribute("bat_control_support", "high", quality, options)
    ],
    missingAttributes: [],
    invalidAttributes: [],
    conflicts: [],
    generatedAt: new Date("2026-08-21T00:00:00.000Z")
  };
}

function canonicalAttribute(
  key: "swing_effort" | "forgiveness" | "sweet_spot_support" | "bat_control_support",
  value: string,
  quality: "legacy_derived" | "structured" | "validated",
  options: { rawValue?: EquipmentJsonValue; definitionVersion?: string }
): CanonicalEquipmentDNAProfile["attributes"][number] {
  return {
    key,
    definitionVersion: options.definitionVersion ?? "1.0",
    domain: key === "swing_effort" ? "physical" : "performance",
    targetLevel: "equipment",
    value,
    confidence: quality === "validated" ? "validated" : "high",
    evaluationMethod: quality === "legacy_derived" ? "derived_mapping" : "standardized_rubric",
    evaluationVersion: 1,
    rationale: "test canonical attribute",
    evaluatedAt: new Date("2026-08-21T00:00:00.000Z"),
    evidence: [
      {
        evidenceRecordId: `${key}-evidence`,
        sourceType: quality === "legacy_derived" ? "internal_derived" : "structured_expert_evaluation",
        sourceName: "test evidence",
        method: quality === "legacy_derived" ? "derived_mapping" : "standardized_rubric",
        status: "active",
        sourceReference: `${key}-source`,
        rawValue: options.rawValue ?? { sourceScore: 72, normalizedScore: 72 }
      }
    ],
    status: "active"
  };
}

function standaloneEvidence(id: string, evaluator: string): BehavioralEvidenceRecord {
  return {
    id,
    attributeKey: "swing_effort",
    category: "structured_internal_equipment_evaluation",
    timing: "prospective_equipment_evidence",
    sourceName: "Standalone Physical Evaluation",
    sourceReference: id,
    independenceGroup: evaluator,
    rawValue: { evaluationMode: "standalone" },
    ordinalValue: "demanding",
    notes: "test"
  };
}

function objectiveEvidence(id: string): BehavioralEvidenceRecord {
  return {
    id,
    attributeKey: "swing_effort",
    category: "objective_measured",
    timing: "prospective_equipment_evidence",
    sourceName: "Objective Measurement",
    sourceReference: id,
    independenceGroup: id,
    rawValue: { measurement: "swing_weight" },
    numericReference: 72,
    notes: "test"
  };
}
