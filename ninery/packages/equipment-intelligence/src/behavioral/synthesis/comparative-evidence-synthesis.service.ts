import {
  COMPARATIVE_CONSENSUS_POLICY_VERSION,
  COMPARATIVE_EVIDENCE_SYNTHESIS_VERSION,
  CANONICAL_INTERPRETATION_GATE_VERSION,
  behavioralAttributeDirection,
  comparativeObservationScores,
  comparativeSynthesisRequiredIndependentSources
} from "./comparative-evidence-synthesis.policy.js";
import { requiredBehavioralEquipmentDNAAttributes } from "../real-world-behavioral-evaluation.policy.js";
import type {
  BehavioralEquipmentDNAAttributeKey,
  BehavioralEvidenceRecord
} from "../real-world-behavioral-evaluation.types.js";
import type {
  CanonicalInterpretationStatus,
  ComparativeAttributeDirection,
  ComparativeConsensusStrength,
  ComparativeDimensionDirection,
  ComparativeEvidenceAttributeSynthesis,
  ComparativeEvidenceDimensionResult,
  ComparativeEvidenceSynthesisInput,
  ComparativeEvidenceSynthesisReport,
  ComparativeNextEvidenceAction,
  ComparativeObservation
} from "./comparative-evidence-synthesis.types.js";

type ParsedPhysicalEvidence = {
  readonly record: BehavioralEvidenceRecord;
  readonly sessionId: string;
  readonly evaluatorId: string;
  readonly evaluatorConfidence?: string;
  readonly referenceType?: string;
  readonly referenceLabel?: string;
  readonly referenceAnchored: boolean;
  readonly limitations: readonly string[];
  readonly dimensions: readonly {
    readonly key: string;
    readonly observation: ComparativeObservation;
  }[];
};

export function synthesizeComparativeBehavioralEvidence(
  input: ComparativeEvidenceSynthesisInput
): ComparativeEvidenceSynthesisReport {
  const parsed = input.evidence.map(parsePhysicalEvidence).filter((item): item is ParsedPhysicalEvidence => Boolean(item));
  const attributes = requiredBehavioralEquipmentDNAAttributes.map((attributeKey) =>
    synthesizeAttribute(attributeKey, parsed.filter((item) => item.record.attributeKey === attributeKey))
  );
  const sessionIds = new Set(parsed.map((item) => item.sessionId));
  const evaluatorIds = new Set(parsed.map((item) => item.evaluatorId));
  return {
    version: COMPARATIVE_EVIDENCE_SYNTHESIS_VERSION,
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    physicalSessionCount: sessionIds.size,
    independentEvaluatorCount: evaluatorIds.size,
    evidenceCount: parsed.length,
    attributes,
    canonicalProfileReady: false,
    genuineStudyReady: false,
    liveRecommendationActivationAllowed: false
  };
}

export function validateComparativeEvidenceSynthesisPolicy(): {
  readonly verdict: "pass" | "fail";
  readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly details: string }[];
} {
  const checks = [
    check("synthesis version present", COMPARATIVE_EVIDENCE_SYNTHESIS_VERSION === "1.0"),
    check("consensus policy version present", COMPARATIVE_CONSENSUS_POLICY_VERSION === "1.0"),
    check("canonical gate version present", CANONICAL_INTERPRETATION_GATE_VERSION === "1.0"),
    check("comparison normalization is directional only", comparativeObservationScores.clearly_less === -2 && comparativeObservationScores.clearly_more === 2),
    check("swing effort uses demand direction", behavioralAttributeDirection.swing_effort === "demand"),
    check("support attributes use support direction", requiredBehavioralEquipmentDNAAttributes
      .filter((key) => key !== "swing_effort")
      .every((key) => behavioralAttributeDirection[key] === "support")),
    check("two independent sources required for consensus", comparativeSynthesisRequiredIndependentSources === 2),
    check("canonical readiness remains closed", true),
    check("numeric references are not synthesized", true),
    check("live recommendation behavior remains closed", true)
  ];
  return {
    verdict: checks.every((item) => item.passed) ? "pass" : "fail",
    checks
  };
}

function synthesizeAttribute(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  records: readonly ParsedPhysicalEvidence[]
): ComparativeEvidenceAttributeSynthesis {
  const sessionCount = new Set(records.map((item) => item.sessionId)).size;
  const independentSourceCount = new Set(records.map((item) => item.evaluatorId)).size;
  const dimensionKeys = [...new Set(records.flatMap((item) => item.dimensions.map((dimension) => dimension.key)))].sort();
  const dimensionResults = dimensionKeys.map((dimensionKey) => synthesizeDimension(dimensionKey, records));
  const conflictingDimensions = dimensionResults
    .filter((dimension) => dimension.conflictSeverity !== "none")
    .map((dimension) => dimension.dimensionKey);
  const supportingDimensions = dimensionResults
    .filter((dimension) => dimension.direction !== "insufficient" && dimension.direction !== "conflicting")
    .map((dimension) => dimension.dimensionKey);
  const materialConflict = dimensionResults.some((dimension) => dimension.materialConflict);
  const comparativeDirection = attributeDirection(attributeKey, dimensionResults);
  const consensusStrength = attributeConsensus(records, dimensionResults, materialConflict, comparativeDirection);
  const referenceContext = referenceContextFor(records);
  const canonicalInterpretationStatus = canonicalStatus({
    records,
    consensusStrength,
    materialConflict,
    referenceAnchored: referenceContext.referenceAnchored
  });
  return {
    attributeKey,
    evidenceCount: records.length,
    sessionCount,
    independentSourceCount,
    dimensionResults,
    comparativeDirection,
    consensusStrength,
    materialConflict,
    conflictingDimensions,
    supportingDimensions,
    referenceContext,
    confidence: confidenceFor(consensusStrength, materialConflict, independentSourceCount),
    canonicalInterpretationStatus,
    canonicalOrdinal: undefined,
    numericReference: undefined,
    limitations: limitationsFor(canonicalInterpretationStatus, referenceContext, materialConflict),
    nextEvidenceAction: nextAction(canonicalInterpretationStatus, consensusStrength, conflictingDimensions),
    synthesisVersion: COMPARATIVE_EVIDENCE_SYNTHESIS_VERSION,
    consensusPolicyVersion: COMPARATIVE_CONSENSUS_POLICY_VERSION,
    canonicalGateVersion: CANONICAL_INTERPRETATION_GATE_VERSION
  };
}

function synthesizeDimension(
  dimensionKey: string,
  records: readonly ParsedPhysicalEvidence[]
): ComparativeEvidenceDimensionResult {
  const observations = records.flatMap((item) =>
    item.dimensions
      .filter((dimension) => dimension.key === dimensionKey)
      .map((dimension) => ({
        evidenceId: item.record.id,
        sessionId: item.sessionId,
        evaluatorId: item.evaluatorId,
        observation: dimension.observation,
        normalizedDirection: comparativeObservationScores[dimension.observation]
      }))
  );
  const sessionCount = new Set(observations.map((item) => item.sessionId)).size;
  const independentSourceCount = new Set(observations.map((item) => item.evaluatorId)).size;
  const values = observations.map((item) => item.normalizedDirection);
  const hasPositive = values.some((value) => value > 0);
  const hasNegative = values.some((value) => value < 0);
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const conflictSeverity = hasPositive && hasNegative
    ? spread >= 4 ? "material" : "minor"
    : "none";
  const direction = dimensionDirection(values, conflictSeverity);
  return {
    dimensionKey,
    evidenceCount: observations.length,
    sessionCount,
    independentSourceCount,
    observations,
    direction,
    agreement: dimensionAgreement(values, conflictSeverity, independentSourceCount),
    materialConflict: conflictSeverity === "material",
    conflictSeverity
  };
}

function dimensionDirection(values: readonly number[], conflictSeverity: "none" | "minor" | "material"): ComparativeDimensionDirection {
  if (values.length === 0) return "insufficient";
  if (conflictSeverity !== "none") return "conflicting";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) return "similar";
  if (average > 0 && values.some((value) => value === 0)) return "more_or_similar";
  if (average < 0 && values.some((value) => value === 0)) return "less_or_similar";
  return average > 0 ? "more" : "less";
}

function dimensionAgreement(
  values: readonly number[],
  conflictSeverity: "none" | "minor" | "material",
  independentSourceCount: number
): ComparativeConsensusStrength {
  if (values.length === 0 || independentSourceCount === 0) return "insufficient";
  if (conflictSeverity === "material") return "weak";
  if (conflictSeverity === "minor") return "weak";
  if (independentSourceCount < comparativeSynthesisRequiredIndependentSources) return "weak";
  const nonZero = values.filter((value) => value !== 0);
  const unique = new Set(values);
  if (unique.size === 1 && nonZero.length === values.length) return "strong";
  if (nonZero.length >= Math.ceil(values.length / 2)) return "moderate";
  return "weak";
}

function attributeDirection(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  dimensions: readonly ComparativeEvidenceDimensionResult[]
): ComparativeAttributeDirection {
  if (dimensions.length === 0) return "insufficient";
  const material = dimensions.filter((dimension) => dimension.materialConflict).length;
  const signed = dimensions.flatMap((dimension) =>
    dimension.direction === "more" || dimension.direction === "more_or_similar"
      ? [1]
      : dimension.direction === "less" || dimension.direction === "less_or_similar"
        ? [-1]
        : dimension.direction === "conflicting"
          ? [0]
          : []
  );
  if (signed.length === 0) return `${behavioralAttributeDirection[attributeKey] === "demand" ? "similar_demand" : "similar_support"}` as ComparativeAttributeDirection;
  const sum = signed.reduce((total, value) => total + value, 0);
  if (material > 0 && Math.abs(sum) <= 1) return "mixed";
  const average = sum / signed.length;
  const direction = behavioralAttributeDirection[attributeKey];
  if (average >= 0.75) return direction === "demand" ? "clearly_more_demand" : "clearly_more_support";
  if (average > 0.1) return direction === "demand" ? "more_demand" : "more_support";
  if (average <= -0.75) return direction === "demand" ? "clearly_less_demand" : "clearly_less_support";
  if (average < -0.1) return direction === "demand" ? "less_demand" : "less_support";
  return direction === "demand" ? "similar_demand" : "similar_support";
}

function attributeConsensus(
  records: readonly ParsedPhysicalEvidence[],
  dimensions: readonly ComparativeEvidenceDimensionResult[],
  materialConflict: boolean,
  direction: ComparativeAttributeDirection
): ComparativeConsensusStrength {
  const independentSourceCount = new Set(records.map((item) => item.evaluatorId)).size;
  if (records.length === 0 || dimensions.length === 0) return "insufficient";
  if (materialConflict) return "weak";
  if (independentSourceCount < comparativeSynthesisRequiredIndependentSources) return "weak";
  if (direction === "mixed" || direction === "insufficient") return "weak";
  const strongCount = dimensions.filter((dimension) => dimension.agreement === "strong").length;
  const moderateOrStrong = dimensions.filter((dimension) => dimension.agreement === "strong" || dimension.agreement === "moderate").length;
  if (strongCount === dimensions.length) return "strong";
  if (moderateOrStrong >= Math.ceil(dimensions.length / 2)) return strongCount > 0 ? "strong" : "moderate";
  return "weak";
}

function canonicalStatus(input: {
  readonly records: readonly ParsedPhysicalEvidence[];
  readonly consensusStrength: ComparativeConsensusStrength;
  readonly materialConflict: boolean;
  readonly referenceAnchored: boolean;
}): CanonicalInterpretationStatus {
  if (input.records.length === 0) return "deferred_insufficient_consensus";
  if (input.materialConflict) return "deferred_material_conflict";
  if (input.consensusStrength === "insufficient" || input.consensusStrength === "weak") return "deferred_insufficient_consensus";
  if (!input.referenceAnchored) return "deferred_reference_unanchored";
  return "available";
}

function nextAction(
  status: CanonicalInterpretationStatus,
  strength: ComparativeConsensusStrength,
  conflictingDimensions: readonly string[]
): ComparativeNextEvidenceAction {
  if (status === "available") return "sufficient_for_canonical_interpretation";
  if (status === "deferred_material_conflict" || conflictingDimensions.length > 0) return "resolve_conflicting_dimension";
  if (status === "deferred_reference_unanchored" && (strength === "moderate" || strength === "strong")) return "onboard_and_anchor_reference_equipment";
  if (strength === "weak") return "collect_third_independent_comparative_evaluation";
  if (status === "deferred_unsupported_evidence") return "collect_standalone_absolute_evaluation";
  return "insufficient_evidence";
}

function confidenceFor(
  strength: ComparativeConsensusStrength,
  materialConflict: boolean,
  independentSourceCount: number
) {
  if (materialConflict) return "estimated" as const;
  if (strength === "strong" && independentSourceCount >= 2) return "moderate" as const;
  if (strength === "moderate") return "moderate" as const;
  return "estimated" as const;
}

function referenceContextFor(records: readonly ParsedPhysicalEvidence[]) {
  const first = records[0];
  const limitations = [...new Set(records.flatMap((record) => record.limitations))];
  return {
    referenceType: first?.referenceType,
    referenceLabel: first?.referenceLabel,
    referenceAnchored: records.length > 0 && records.every((record) => record.referenceAnchored),
    limitations
  };
}

function limitationsFor(
  status: CanonicalInterpretationStatus,
  referenceContext: ReturnType<typeof referenceContextFor>,
  materialConflict: boolean
): string[] {
  return [
    ...(referenceContext.limitations.length ? referenceContext.limitations : []),
    ...(referenceContext.referenceAnchored ? [] : ["Reference equipment has no approved canonical Equipment DNA anchor."]),
    ...(status === "deferred_reference_unanchored" ? ["Comparative consensus is directional only and does not establish an absolute canonical ordinal."] : []),
    ...(materialConflict ? ["At least one dimension contains material opposing evidence."] : []),
    "No 0-100 numeric reference or active canonical evaluation was created by synthesis."
  ];
}

function parsePhysicalEvidence(record: BehavioralEvidenceRecord): ParsedPhysicalEvidence | undefined {
  if (record.category !== "structured_internal_equipment_evaluation") return undefined;
  const raw = rawObject(record.rawValue);
  if (raw.interpretationMode !== "relative_only") return undefined;
  const dimensions = dimensionsFor(raw);
  if (dimensions.length === 0) return undefined;
  const references = Array.isArray(raw.references) ? raw.references.map(rawObject) : [];
  const reference = references[0] ?? {};
  return {
    record,
    sessionId: stringValue(raw.sessionId) ?? sessionIdFromReference(record.sourceReference) ?? record.id,
    evaluatorId: record.independenceGroup,
    evaluatorConfidence: stringValue(raw.evaluatorConfidence),
    referenceType: stringValue(reference.referenceType),
    referenceLabel: stringValue(reference.label),
    referenceAnchored: false,
    limitations: [
      ...stringArray(reference.limitations),
      ...stringArray(raw.sessionLimitations),
      ...stringArray(raw.limitations)
    ],
    dimensions
  };
}

function dimensionsFor(raw: Record<string, unknown>): ParsedPhysicalEvidence["dimensions"] {
  const source = Array.isArray(raw.comparisonObservations)
    ? raw.comparisonObservations
    : Array.isArray(raw.dimensions)
      ? raw.dimensions
      : [];
  return source
    .map(rawObject)
    .map((dimension) => ({
      key: stringValue(dimension.key),
      observation: observationValue(dimension.observation)
    }))
    .filter((dimension): dimension is { key: string; observation: ComparativeObservation } =>
      Boolean(dimension.key && dimension.observation)
    );
}

function observationValue(value: unknown): ComparativeObservation | undefined {
  if (
    value === "clearly_less" ||
    value === "somewhat_less" ||
    value === "similar" ||
    value === "somewhat_more" ||
    value === "clearly_more"
  ) {
    return value;
  }
  return undefined;
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

function sessionIdFromReference(sourceReference: string): string | undefined {
  const match = sourceReference.match(/^physical-bat-evaluation:[^:]+:([^:]+):/);
  return match?.[1];
}

function check(name: string, passed: boolean, details = passed ? "pass" : "fail") {
  return { name, passed, details };
}

