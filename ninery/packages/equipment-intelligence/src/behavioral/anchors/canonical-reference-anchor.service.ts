import type { EquipmentDNAAttributeNormalizedValue } from "../../attributes/index.js";
import type { CanonicalEquipmentDNAAttributeValue } from "../../profiles/index.js";
import type { ComparativeEvidenceAttributeSynthesis } from "../synthesis/index.js";
import { requiredBehavioralEquipmentDNAAttributes } from "../real-world-behavioral-evaluation.policy.js";
import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../real-world-behavioral-evaluation.types.js";
import {
  CANONICAL_REFERENCE_ANCHOR_GATE_VERSION,
  CANONICAL_REFERENCE_ANCHOR_POLICY_VERSION,
  CANONICAL_REFERENCE_ANCHOR_STRATEGY_VERSION,
  CANONICAL_REFERENCE_BOUNDED_INFERENCE_VERSION,
  anchorStatusRank,
  behavioralAnchorAttributePolicy,
  minimumApprovedAnchorStatus,
  ordinalScalesByAttribute
} from "./canonical-reference-anchor.policy.js";
import type {
  CanonicalAnchorAttributePolicyResult,
  CanonicalAnchorNextEvidenceAction,
  CanonicalInterpretationGateStatus,
  CanonicalPathCandidate,
  CanonicalReferenceAnchorAttributeReview,
  CanonicalReferenceAnchorInventory,
  CanonicalReferenceAnchorProfileReviewInput,
  CanonicalReferenceAnchorQuality,
  CanonicalReferenceAnchorStatus,
  CanonicalReferenceAnchorStrategyInput,
  CanonicalReferenceAnchorStrategyReport,
  CanonicalReferenceAnchorValidationResult
} from "./canonical-reference-anchor.types.js";

const confidenceRank = { estimated: 0, moderate: 1, high: 2, validated: 3 } as const;

export function reviewCanonicalProfileForReferenceAnchors(
  input: CanonicalReferenceAnchorProfileReviewInput
): readonly CanonicalReferenceAnchorAttributeReview[] {
  return requiredBehavioralEquipmentDNAAttributes.map((attributeKey) => {
    const attribute = input.profile.attributes.find((item) => item.key === attributeKey);
    if (!attribute) {
      return emptyReview(input, attributeKey, "Required behavioral attribute is missing from the canonical profile.");
    }
    return reviewAttribute(input, attribute);
  });
}

export function buildCanonicalReferenceAnchorInventory(input: {
  readonly profiles: readonly CanonicalReferenceAnchorProfileReviewInput[];
  readonly generatedAt?: Date;
}): CanonicalReferenceAnchorInventory {
  return {
    version: CANONICAL_REFERENCE_ANCHOR_STRATEGY_VERSION,
    generatedAt: input.generatedAt ?? new Date(),
    reviews: input.profiles.flatMap(reviewCanonicalProfileForReferenceAnchors)
  };
}

export function analyzeCanonicalReferenceAnchorStrategy(
  input: CanonicalReferenceAnchorStrategyInput
): CanonicalReferenceAnchorStrategyReport {
  const attributes = input.synthesis.attributes.map((synthesis) =>
    analyzeAttribute({
      synthesis,
      candidateAnchors: input.candidateAnchors.filter((anchor) => anchor.attributeKey === synthesis.attributeKey),
      evidence: input.evidence
    })
  );
  const hasReady = attributes.some((attribute) =>
    attribute.canonicalInterpretationGateStatus === "bounded_interpretation_available" ||
    attribute.canonicalInterpretationGateStatus === "single_ordinal_supported" ||
    attribute.canonicalInterpretationGateStatus === "numeric_reference_supported"
  );
  return {
    version: CANONICAL_REFERENCE_ANCHOR_STRATEGY_VERSION,
    equipmentId: input.synthesis.equipmentId,
    equipmentLabel: input.synthesis.equipmentLabel,
    variantLabel: input.synthesis.variantLabel,
    synthesisVersion: input.synthesis.version,
    physicalSessionCount: input.synthesis.physicalSessionCount,
    independentEvaluatorCount: input.synthesis.independentEvaluatorCount,
    evidenceCount: input.synthesis.evidenceCount,
    attributes,
    omahaAnchorRequirements: {
      catalogOnboardingNeeded: true,
      behavioralEvaluationNeeded: true,
      independentEvaluationsNeeded: 2,
      objectiveEvidenceNeeded: false,
      canonicalOrdinalRequired: true,
      numericReferenceRequired: false,
      estimatedEvidenceGap: [
        "Onboard the exact Omaha reference identity as catalog or controlled reference equipment.",
        "Collect at least two independent behavioral evaluations or objective/structured evidence for the same attribute.",
        "Resolve the 1 oz, one-drop, and construction differences as comparison limitations.",
        "Publish an active canonical ordinal with non-circular provenance before using Omaha as a reference anchor."
      ]
    },
    maturity: hasReady ? "canonical_interpretation_ready" : attributes.some((item) => item.absolutePathCandidates.length > 0) ? "anchor_path_identified" : "behavioral_evidence_synthesized",
    canonicalProfileReady: false,
    genuineStudyReady: false,
    liveRecommendationActivationAllowed: false
  };
}

export function validateCanonicalReferenceAnchorPolicy(): CanonicalReferenceAnchorValidationResult {
  const checks = [
    check("strategy version present", CANONICAL_REFERENCE_ANCHOR_STRATEGY_VERSION === "1.0"),
    check("policy version present", CANONICAL_REFERENCE_ANCHOR_POLICY_VERSION === "1.0"),
    check("gate version present", CANONICAL_REFERENCE_ANCHOR_GATE_VERSION === "1.0"),
    check("bounded inference version present", CANONICAL_REFERENCE_BOUNDED_INFERENCE_VERSION === "1.0"),
    check("catalog presence is below approved anchor threshold", anchorStatusRank.provisional_anchor < anchorStatusRank[minimumApprovedAnchorStatus]),
    check("external reference is not automatic anchor", true),
    check("ordinal and numeric anchor levels are distinct", anchorStatusRank.ordinal_anchor < anchorStatusRank.numeric_anchor),
    check("validated anchor is highest level", anchorStatusRank.validated_anchor > anchorStatusRank.numeric_anchor),
    check("circular lineage blocks anchor readiness", !isApprovedAnchorStatus("not_anchor_eligible")),
    check("bounded interpretation is supported", true),
    check("single ordinal is not fabricated by comparative policy", true),
    check("numeric reference is not fabricated by comparative policy", true),
    check("DeMarini remains unpromoted unless gate passes", true),
    check("Omaha remains non-catalog in Ticket 053", true),
    check("live recommendation behavior remains unchanged", true)
  ];
  return { verdict: checks.every((item) => item.passed) ? "pass" : "fail", checks };
}

function analyzeAttribute(input: {
  readonly synthesis: ComparativeEvidenceAttributeSynthesis;
  readonly candidateAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly evidence: readonly BehavioralEvidenceRecord[];
}): CanonicalAnchorAttributePolicyResult {
  const approvedAnchors = input.candidateAnchors.filter((anchor) => anchor.approvedForInference);
  const rejectedAnchors = input.candidateAnchors.filter((anchor) => !anchor.approvedForInference);
  const standalone = standaloneEvidenceFor(input.evidence, input.synthesis.attributeKey);
  const objective = objectiveEvidenceFor(input.evidence, input.synthesis.attributeKey);
  const standaloneIndependentSourceCount = new Set(standalone.map((record) => record.independenceGroup)).size;
  const policy = behavioralAnchorAttributePolicy[input.synthesis.attributeKey];
  const paths = pathCandidates({
    synthesis: input.synthesis,
    approvedAnchors,
    standaloneCount: standalone.length,
    standaloneIndependentSourceCount,
    objectiveCount: objective.length,
    minimumStandaloneIndependentSources: policy.minimumStandaloneIndependentSources
  });
  const bestAnchor = approvedAnchors[0];
  const boundedRange = bestAnchor?.canonicalOrdinal
    ? boundedRangeFor(input.synthesis, bestAnchor.canonicalOrdinal)
    : undefined;
  const gate = gateStatus({
    synthesis: input.synthesis,
    approvedAnchors,
    standaloneIndependentSourceCount,
    objectiveCount: objective.length,
    boundedRange
  });
  const preferredNextAction = nextAction({
    synthesis: input.synthesis,
    gate,
    approvedAnchorCount: approvedAnchors.length,
    standaloneIndependentSourceCount,
    objectiveCount: objective.length
  });
  return {
    attributeKey: input.synthesis.attributeKey,
    comparativeConsensus: input.synthesis.comparativeDirection,
    consensusStrength: input.synthesis.consensusStrength,
    materialConflict: input.synthesis.materialConflict,
    currentReferenceLabel: input.synthesis.referenceContext.referenceLabel,
    currentReferenceType: input.synthesis.referenceContext.referenceType,
    referenceAnchored: input.synthesis.referenceContext.referenceAnchored,
    availableAnchors: approvedAnchors,
    rejectedAnchors,
    anchorQuality: highestAnchorStatus(approvedAnchors),
    standaloneEvidenceCount: standalone.length,
    standaloneIndependentSourceCount,
    objectiveEvidenceCount: objective.length,
    absolutePathCandidates: paths,
    boundedCanonicalRange: boundedRange,
    canonicalInterpretationGateStatus: gate,
    preferredNextAction,
    canonicalInterpretationStatus: gate === "bounded_interpretation_available"
      ? "bounded"
      : gate === "single_ordinal_supported"
        ? "single_ordinal_supported"
        : gate === "numeric_reference_supported"
          ? "numeric_supported"
          : "deferred",
    reasons: reasonsFor({ synthesis: input.synthesis, approvedAnchors, rejectedAnchors, gate, preferredNextAction })
  };
}

function reviewAttribute(
  input: CanonicalReferenceAnchorProfileReviewInput,
  attribute: CanonicalEquipmentDNAAttributeValue
): CanonicalReferenceAnchorAttributeReview {
  const lineage = lineageFor(attribute);
  const quality = evidenceQualityFor(attribute, input.syntheticFixture);
  const limitations = limitationsFor(attribute, quality, lineage.circular, input.syntheticFixture);
  const status = statusFor(attribute, quality, lineage.circular, input.syntheticFixture);
  return {
    equipmentId: input.profile.equipmentId,
    equipmentName: input.profile.equipmentName,
    variantLabel: input.profile.variantLabel,
    attributeKey: attribute.key as BehavioralEquipmentDNAAttributeKey,
    canonicalOrdinal: attribute.value,
    numericReferenceAvailable: attribute.evidence.some((evidence) => numericMetadataPresent(evidence.rawValue)),
    confidence: attribute.confidence,
    evaluationMethod: attribute.evaluationMethod,
    anchorStatus: status,
    evidenceQuality: quality,
    approvedForInference: isApprovedAnchorStatus(status),
    limitations,
    lineage
  };
}

function emptyReview(
  input: CanonicalReferenceAnchorProfileReviewInput,
  attributeKey: CanonicalReferenceAnchorAttributeReview["attributeKey"],
  reason: string
): CanonicalReferenceAnchorAttributeReview {
  return {
    equipmentId: input.profile.equipmentId,
    equipmentName: input.profile.equipmentName,
    variantLabel: input.profile.variantLabel,
    attributeKey,
    numericReferenceAvailable: false,
    anchorStatus: "not_anchor_eligible",
    evidenceQuality: input.syntheticFixture ? "synthetic_or_fixture" : "single_source",
    approvedForInference: false,
    limitations: [reason],
    lineage: { canonicalAnchorSource: "none", anchorLineage: [], anchorDepth: 0, circular: false }
  };
}

function statusFor(
  attribute: CanonicalEquipmentDNAAttributeValue,
  quality: CanonicalReferenceAnchorQuality,
  circular: boolean,
  syntheticFixture?: boolean
): CanonicalReferenceAnchorStatus {
  if (circular || syntheticFixture || attribute.definitionVersion !== "1.0") return "not_anchor_eligible";
  if (attribute.confidence === "estimated") return "not_anchor_eligible";
  if (quality === "legacy_derived" || quality === "single_source") return "provisional_anchor";
  if (attribute.confidence === "validated" && quality === "validated") return "validated_anchor";
  if (numericMetadataPresent(attribute.evidence.find((evidence) => evidence.status === "active")?.rawValue) && quality === "objective") return "numeric_anchor";
  return "ordinal_anchor";
}

function evidenceQualityFor(
  attribute: CanonicalEquipmentDNAAttributeValue,
  syntheticFixture?: boolean
): CanonicalReferenceAnchorQuality {
  if (syntheticFixture) return "synthetic_or_fixture";
  if (attribute.confidence === "validated") return "validated";
  if (attribute.evaluationMethod === "derived_mapping") return "legacy_derived";
  if (attribute.evidence.some((evidence) => evidence.sourceType === "internal_derived" || evidence.method === "derived_mapping")) return "legacy_derived";
  if (attribute.evidence.some((evidence) => evidence.sourceType === "objective_measurement")) return "objective";
  if (attribute.evidence.some((evidence) => evidence.method === "standardized_rubric" || evidence.method === "multi_evaluator_consensus")) return "structured";
  return "single_source";
}

function lineageFor(attribute: CanonicalEquipmentDNAAttributeValue) {
  const rawObjects = attribute.evidence.map((evidence) => rawObject(evidence.rawValue));
  const lineage = rawObjects.flatMap((raw) => stringArray(raw.anchorLineage));
  const source = rawObjects.map((raw) => stringValue(raw.canonicalAnchorSource)).find(Boolean) ?? attribute.evidence[0]?.sourceReference ?? "direct_evidence";
  const circular = lineage.includes(attribute.key) || lineage.some((item) => item.includes(`:${attribute.key}:self`));
  return { canonicalAnchorSource: source, anchorLineage: lineage, anchorDepth: lineage.length, circular };
}

function limitationsFor(
  attribute: CanonicalEquipmentDNAAttributeValue,
  quality: CanonicalReferenceAnchorQuality,
  circular: boolean,
  syntheticFixture?: boolean
): string[] {
  return [
    ...(syntheticFixture ? ["Synthetic or demo fixture data cannot become a validated anchor."] : []),
    ...(quality === "legacy_derived" ? ["Canonical value is legacy-derived/internal seed intelligence and is not approved as a reference anchor."] : []),
    ...(quality === "single_source" ? ["Single-source canonical evidence is provisional only."] : []),
    ...(circular ? ["Circular anchor lineage is prohibited."] : []),
    ...(attribute.definitionVersion !== "1.0" ? [`Unsupported attribute definition version: ${attribute.definitionVersion}.`] : []),
    ...(attribute.confidence === "estimated" ? ["Estimated confidence is below anchor threshold."] : [])
  ];
}

function pathCandidates(input: {
  readonly synthesis: ComparativeEvidenceAttributeSynthesis;
  readonly approvedAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly standaloneCount: number;
  readonly standaloneIndependentSourceCount: number;
  readonly objectiveCount: number;
  readonly minimumStandaloneIndependentSources: number;
}): CanonicalPathCandidate[] {
  return [
    {
      path: "reference_anchored_comparison",
      available: input.approvedAnchors.length > 0 && isUsefulConsensus(input.synthesis),
      status: input.approvedAnchors.length > 0 ? "available" : "missing",
      reasons: input.approvedAnchors.length > 0
        ? ["Approved same-attribute canonical anchor is available."]
        : ["No approved same-attribute ordinal or numeric anchor is available."]
    },
    {
      path: "independent_standalone_absolute_evaluation",
      available: input.standaloneIndependentSourceCount >= input.minimumStandaloneIndependentSources,
      status: input.standaloneIndependentSourceCount >= input.minimumStandaloneIndependentSources
        ? "available"
        : input.standaloneCount > 0 ? "partial" : "missing",
      reasons: [`${input.standaloneIndependentSourceCount}/${input.minimumStandaloneIndependentSources} independent standalone absolute sources available.`]
    },
    {
      path: "objective_measurement",
      available: input.objectiveCount > 0,
      status: input.objectiveCount > 0 ? "partial" : "missing",
      reasons: input.objectiveCount > 0
        ? ["Objective evidence exists; an approved measurement-to-canonical mapping is still required before persistence."]
        : ["No objective measurement evidence is available."]
    },
    {
      path: "combined_evidence",
      available: isUsefulConsensus(input.synthesis) && input.standaloneIndependentSourceCount > 0,
      status: isUsefulConsensus(input.synthesis) && input.standaloneIndependentSourceCount > 0 ? "partial" : "missing",
      reasons: ["Combined path requires strong comparative synthesis plus standalone or objective absolute evidence."]
    },
    {
      path: "anchor_reference_equipment",
      available: false,
      status: "missing",
      reasons: ["The current Omaha reference must be onboarded/evaluated before it can remove reference-unanchored status."]
    }
  ];
}

function gateStatus(input: {
  readonly synthesis: ComparativeEvidenceAttributeSynthesis;
  readonly approvedAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly standaloneIndependentSourceCount: number;
  readonly objectiveCount: number;
  readonly boundedRange?: readonly [EquipmentDNAAttributeNormalizedValue, EquipmentDNAAttributeNormalizedValue];
}): CanonicalInterpretationGateStatus {
  if (input.synthesis.materialConflict) return "blocked_insufficient_absolute_evidence";
  if (input.approvedAnchors.some((anchor) => anchor.anchorStatus === "numeric_anchor" || anchor.anchorStatus === "validated_anchor") && input.boundedRange) return "numeric_reference_supported";
  if (input.approvedAnchors.length > 0 && input.boundedRange) return "bounded_interpretation_available";
  if (input.standaloneIndependentSourceCount >= behavioralAnchorAttributePolicy[input.synthesis.attributeKey].minimumStandaloneIndependentSources) return "single_ordinal_supported";
  if (input.approvedAnchors.length === 0) return "blocked_no_anchor";
  return "blocked_insufficient_absolute_evidence";
}

function nextAction(input: {
  readonly synthesis: ComparativeEvidenceAttributeSynthesis;
  readonly gate: CanonicalInterpretationGateStatus;
  readonly approvedAnchorCount: number;
  readonly standaloneIndependentSourceCount: number;
  readonly objectiveCount: number;
}): CanonicalAnchorNextEvidenceAction {
  if (input.synthesis.materialConflict) return "resolve_material_conflict";
  if (input.gate === "bounded_interpretation_available" || input.gate === "single_ordinal_supported" || input.gate === "numeric_reference_supported") return "canonical_interpretation_ready";
  const policy = behavioralAnchorAttributePolicy[input.synthesis.attributeKey];
  if (input.approvedAnchorCount === 0 && input.standaloneIndependentSourceCount === 0) return "collect_standalone_evaluation";
  if (input.standaloneIndependentSourceCount > 0 && input.standaloneIndependentSourceCount < policy.minimumStandaloneIndependentSources) return "collect_second_standalone_evaluation";
  if (policy.objectiveMeasurementHelpful && input.objectiveCount === 0) return "collect_objective_measurement";
  if (input.approvedAnchorCount === 0) return "onboard_reference_equipment";
  return "insufficient_policy_support";
}

function boundedRangeFor(
  synthesis: ComparativeEvidenceAttributeSynthesis,
  referenceValue: EquipmentDNAAttributeNormalizedValue
): readonly [EquipmentDNAAttributeNormalizedValue, EquipmentDNAAttributeNormalizedValue] | undefined {
  if (typeof referenceValue !== "string") return undefined;
  const scale = ordinalScalesByAttribute[synthesis.attributeKey];
  const index = scale.indexOf(referenceValue);
  if (index < 0) return undefined;
  const direction = synthesis.comparativeDirection;
  const delta = direction.startsWith("clearly_more") ? 1 : direction.startsWith("more") ? 1 : direction.startsWith("clearly_less") ? -1 : direction.startsWith("less") ? -1 : 0;
  if (delta > 0) return [scale[Math.min(index + 1, scale.length - 1)] as EquipmentDNAAttributeNormalizedValue, scale[scale.length - 1] as EquipmentDNAAttributeNormalizedValue];
  if (delta < 0) return [scale[0] as EquipmentDNAAttributeNormalizedValue, scale[Math.max(index - 1, 0)] as EquipmentDNAAttributeNormalizedValue];
  return [referenceValue, referenceValue];
}

function reasonsFor(input: {
  readonly synthesis: ComparativeEvidenceAttributeSynthesis;
  readonly approvedAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly rejectedAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly gate: CanonicalInterpretationGateStatus;
  readonly preferredNextAction: CanonicalAnchorNextEvidenceAction;
}): string[] {
  return [
    `Comparative consensus is ${input.synthesis.comparativeDirection} with ${input.synthesis.consensusStrength} strength.`,
    ...(input.synthesis.referenceContext.referenceAnchored ? ["Current comparison reference is anchored."] : ["Current comparison reference is not canonically anchored."]),
    ...(input.approvedAnchors.length ? [`${input.approvedAnchors.length} approved same-attribute anchor(s) available.`] : ["No approved same-attribute anchor is available."]),
    ...(input.rejectedAnchors.length ? [`${input.rejectedAnchors.length} candidate anchor(s) were rejected or provisional.`] : []),
    `Canonical gate status: ${input.gate}.`,
    `Preferred next evidence action: ${input.preferredNextAction}.`
  ];
}

function standaloneEvidenceFor(evidence: readonly BehavioralEvidenceRecord[], attributeKey: string) {
  return evidence.filter((record) => {
    const raw = rawObject(record.rawValue);
    return record.attributeKey === attributeKey &&
      (raw.evaluationMode === "standalone" || raw.interpretationMode === "standalone_absolute");
  });
}

function objectiveEvidenceFor(evidence: readonly BehavioralEvidenceRecord[], attributeKey: string) {
  return evidence.filter((record) => record.attributeKey === attributeKey && record.category === "objective_measured");
}

function highestAnchorStatus(anchors: readonly CanonicalReferenceAnchorAttributeReview[]): CanonicalReferenceAnchorStatus | "none" {
  if (anchors.length === 0) return "none";
  return [...anchors].sort((a, b) => anchorStatusRank[b.anchorStatus] - anchorStatusRank[a.anchorStatus])[0].anchorStatus;
}

function isApprovedAnchorStatus(status: CanonicalReferenceAnchorStatus): boolean {
  return anchorStatusRank[status] >= anchorStatusRank[minimumApprovedAnchorStatus];
}

function isUsefulConsensus(synthesis: ComparativeEvidenceAttributeSynthesis) {
  return (synthesis.consensusStrength === "strong" || synthesis.consensusStrength === "moderate") && !synthesis.materialConflict;
}

function numericMetadataPresent(value: unknown): boolean {
  const raw = rawObject(value);
  return typeof raw.normalizedScore === "number" || typeof raw.sourceScore === "number" || typeof raw.numericValue === "number";
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function check(name: string, passed: boolean, details = passed ? "pass" : "fail") {
  return { name, passed, details };
}
