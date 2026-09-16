import assert from "node:assert/strict";
import test from "node:test";
import {
  assessPilotCandidate,
  assessPilotContrast,
  assessProtocolV11Participation,
  buildCrossEquipmentCalibrationStatus,
  normalizeCalibrationConstruction,
  protocolV11CrossEquipmentComparisonContract,
  type CalibrationEquipmentArchetype,
  type CrossEquipmentQualifyingEvidence
} from "../physical-evaluation/index.js";

const demarini = archetype({ equipmentId: "equipment-a", equipmentVariantId: "variant-a", construction: "hybrid", material: "alloy_barrel_composite_handle", weightOunces: 20, dropWeight: -10 });
const omaha = archetype({ equipmentId: "equipment-b", equipmentVariantId: "variant-b", construction: "one_piece_alloy", material: "alloy", weightOunces: 19, dropWeight: -11 });

test("construction archetypes combine catalog construction and material without performance inference", () => {
  assert.equal(normalizeCalibrationConstruction("two-piece hybrid", "hybrid"), "hybrid");
  assert.equal(normalizeCalibrationConstruction("one-piece", "alloy"), "one_piece_alloy");
  assert.equal(normalizeCalibrationConstruction("two-piece", "composite"), "two_piece_composite");
  assert.equal(normalizeCalibrationConstruction(undefined, undefined), "unknown");
});

test("DeMarini-only genuine state is single-equipment and blocks comparison", () => {
  const status = buildCrossEquipmentCalibrationStatus({ catalog: [demarini, omaha], evidence: genuineEvidence("equipment-a", "variant-a", "session-a", "evaluator-07") });
  assert.equal(status.genuineEquipmentModelCount, 1);
  assert.equal(status.readiness, "single_equipment_only");
  assert.equal(status.readinessReason, "only_one_equipment_model_represented");
  assert.equal(status.crossEquipmentComparisonAvailable, false);
  assert.equal(status.protocolValidated, false);
});

test("catalog presence and historical v1.0 evidence do not create v1.1 coverage", () => {
  const historical = genuineEvidence("equipment-b", "variant-b", "historical", "evaluator-01").map((record) => ({ ...record, protocolVersion: "1.0" }));
  const status = buildCrossEquipmentCalibrationStatus({ catalog: [demarini, omaha], evidence: [...genuineEvidence("equipment-a", "variant-a", "session-a", "evaluator-07"), ...historical] });
  assert.equal(status.genuineEquipmentModelCount, 1);
  assert.equal(status.representedArchetypes.some((item) => item.equipmentId === "equipment-b"), false);
});

test("synthetic v1.1 evidence does not count", () => {
  const synthetic = genuineEvidence("equipment-b", "variant-b", "synthetic", "evaluator-02").map((record) => ({ ...record, synthetic: true }));
  assert.equal(buildCrossEquipmentCalibrationStatus({ catalog: [demarini, omaha], evidence: synthetic }).genuineEquipmentModelCount, 0);
});

test("same evaluator can be independent on Equipment B and repeat protocol participant", () => {
  const evidence = genuineEvidence("equipment-a", "variant-a", "session-a", "evaluator-07");
  const review = assessProtocolV11Participation({ equipmentId: "equipment-b", sessionId: "session-b", evaluatorId: "evaluator-07", evidence });
  assert.equal(review.equipmentEvidenceRelationship, "independent_evaluator");
  assert.equal(review.protocolParticipationRelationship, "repeat_protocol_participant");
  assert.equal(review.independentSourceContributionForEquipment, 1);
});

test("same evaluator repeating the same equipment remains repeat evaluator", () => {
  const review = assessProtocolV11Participation({ equipmentId: "equipment-a", sessionId: "session-b", evaluatorId: "evaluator-07", evidence: genuineEvidence("equipment-a", "variant-a", "session-a", "evaluator-07") });
  assert.equal(review.equipmentEvidenceRelationship, "repeat_evaluator");
  assert.equal(review.protocolParticipationRelationship, "repeat_protocol_participant");
  assert.equal(review.independentSourceContributionForEquipment, 0);
});

test("v1.0 history controls equipment independence while v1.1 controls protocol participation", () => {
  const historical = genuineEvidence("equipment-a", "variant-a", "v10-session", "evaluator-07").map((record) => ({ ...record, protocolVersion: "1.0", studyClassification: undefined, provenanceClassification: undefined }));
  const review = assessProtocolV11Participation({ equipmentId: "equipment-a", sessionId: "future-v11", evaluatorId: "evaluator-07", evidence: historical });
  assert.equal(review.equipmentEvidenceRelationship, "repeat_evaluator");
  assert.equal(review.protocolParticipationRelationship, "first_protocol_participation");
  assert.equal(review.independentSourceContributionForEquipment, 0);
});

test("equipment-level independent counts are equipment scoped and differ from participants", () => {
  const evidence = [...genuineEvidence("equipment-a", "variant-a", "session-a", "evaluator-07"), ...genuineEvidence("equipment-b", "variant-b", "session-b", "evaluator-07")];
  const status = buildCrossEquipmentCalibrationStatus({ catalog: [demarini, omaha], evidence });
  assert.equal(status.uniqueProtocolEvaluatorCount, 1);
  assert.equal(status.equipmentLevelIndependentSourceCount, 2);
  assert.equal(status.repeatProtocolParticipantCount, 1);
  assert.equal(status.repeatEvaluatorSessionCount, 0);
  assert.equal(status.readiness, "cross_equipment_started");
  assert.notEqual(status.readiness, "cross_equipment_support");
});

test("contrast uses catalog facts without scores, DNA, or performance inference", () => {
  const contrast = assessPilotContrast(demarini, omaha);
  const candidate = assessPilotCandidate(demarini, omaha);
  assert.equal(contrast.classification, "high_contrast");
  assert.ok(contrast.reasons.some((reason) => reason.includes("construction differs")));
  assert.equal(candidate.eligibility, "eligible");
  assert.equal(candidate.numericContrastScore, undefined);
  assert.equal(candidate.performanceInferenceMade, false);
  assert.equal("recommendationScore" in candidate, false);
  assert.equal("canonicalEquipmentDNA" in candidate, false);
});

test("construction never infers behavioral performance", () => {
  const result = assessPilotCandidate(demarini, omaha);
  assert.equal("swingEffort" in result.candidate, false);
  assert.equal("forgiveness" in result.candidate, false);
  assert.equal("sweetSpot" in result.candidate, false);
});

test("missing variant and missing catalog facts block conservatively", () => {
  assert.equal(assessPilotCandidate(demarini, archetype({ equipmentId: "missing-variant", equipmentVariantId: undefined })).eligibility, "blocked_missing_variant");
  assert.equal(assessPilotCandidate(demarini, archetype({ equipmentId: "missing-facts", equipmentVariantId: "variant", construction: "unknown", weightOunces: undefined })).eligibility, "blocked_insufficient_catalog_data");
});

test("historical Omaha comparative evidence is not converted into v1.1 evidence", () => {
  const comparative = genuineEvidence("equipment-b", "variant-b", "omaha-comparison", "evaluator-01").map((record) => ({ ...record, studyClassification: "structured_physical_comparison", protocolVersion: "1.0" }));
  const status = buildCrossEquipmentCalibrationStatus({ catalog: [demarini, omaha], evidence: comparative });
  assert.equal(status.genuineEquipmentModelCount, 0);
  assert.equal(status.genuineSessionCount, 0);
});

test("future comparison contract is protocol learning only and preserves semantics", () => {
  assert.equal(protocolV11CrossEquipmentComparisonContract.performanceRankingAllowed, false);
  assert.equal(protocolV11CrossEquipmentComparisonContract.canonicalPromotionAllowed, false);
  assert.ok(protocolV11CrossEquipmentComparisonContract.dimensions.includes("response_inversion_handling"));
  assert.ok(protocolV11CrossEquipmentComparisonContract.dimensions.includes("sweet_spot_candidate_separation"));
});

test("status is deterministic, immutable-shaped, and closes every firewall", () => {
  const evidence = genuineEvidence("equipment-a", "variant-a", "session-a", "evaluator-07");
  const first = buildCrossEquipmentCalibrationStatus({ catalog: [demarini], evidence });
  assert.deepEqual(first, buildCrossEquipmentCalibrationStatus({ catalog: [demarini], evidence }));
  assert.deepEqual(first.canonicalFirewall, { canonicalEvaluationsCreated: 0, canonicalEvaluationsModified: 0, numericReferencesCreated: 0, recommendationScoringChanged: false, recommendationRankingChanged: false, liveEquipmentDNAChanged: false, historicalEvidenceModified: false, writesPerformed: false });
  assert.ok(first.safeguards.some((item) => item.includes("Sweet-spot")));
  assert.ok(first.safeguards.some((item) => item.includes("inverse")));
});

function archetype(overrides: Partial<CalibrationEquipmentArchetype>): CalibrationEquipmentArchetype {
  return { equipmentId: "equipment", equipmentVariantId: "variant", label: "Catalog bat", sku: "SKU", construction: "one_piece_alloy", certification: "USA", material: "alloy", lengthInches: 30, weightOunces: 20, dropWeight: -10, barrelDiameter: 2.625, physicalIdentityReady: true, protocolCompatible: true, requiredTrialBlocksCapable: true, synthetic: false, ...overrides };
}
function genuineEvidence(equipmentId: string, equipmentVariantId: string, sessionId: string, evaluatorId: string): CrossEquipmentQualifyingEvidence[] {
  return ["startup_demand", "response_degradation", "usable_contact_region_breadth"].map((dimensionKey, index) => ({ evidenceRecordId: `${sessionId}-${index}`, equipmentId, equipmentVariantId, evaluatorId, sessionId, protocolVersion: "1.1", sourceReference: `physical-bat-evaluation:1.1:${sessionId}:${dimensionKey}`, evaluatedAt: `2026-08-2${index}`, studyClassification: "protocol_calibration_evidence", provenanceClassification: "real_protocol_calibration_observation", dimensionKey }));
}
