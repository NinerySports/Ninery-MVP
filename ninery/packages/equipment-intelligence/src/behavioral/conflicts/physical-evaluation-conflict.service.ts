import { requiredBehavioralEquipmentDNAAttributes } from "../real-world-behavioral-evaluation.policy.js";
import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../real-world-behavioral-evaluation.types.js";
import type { StandaloneAbsoluteAttributeSynthesis } from "../standalone/index.js";
import { ordinalScaleFor } from "../standalone/standalone-absolute-evidence.policy.js";
import type { ComparativeEvidenceAttributeSynthesis } from "../synthesis/index.js";
import {
  PHYSICAL_EVALUATION_BLINDING_POLICY_VERSION,
  PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION,
  controlledContactAdjudicationMinimumTrials,
  evaluatorBlindingPolicy,
  standaloneAdjudicationMinimumTrials
} from "./physical-evaluation-conflict.policy.js";
import type {
  PhysicalEvaluationAdjudicationPlan,
  PhysicalEvaluationAdjudicationStatus,
  PhysicalEvaluationConflictAnalysisInput,
  PhysicalEvaluationConflictAnalysisReport,
  PhysicalEvaluationConflictAttributeAnalysis,
  PhysicalEvaluationConflictClassification,
  PhysicalEvaluationConflictSeverity,
  PhysicalEvaluationDimensionConflictSummary,
  PhysicalEvaluationEvidenceSourceSummary,
  PhysicalEvaluationNextEvidencePrescription
} from "./physical-evaluation-conflict.types.js";

type ParsedStandaloneEvidence = {
  readonly record: BehavioralEvidenceRecord;
  readonly sessionId: string;
  readonly evaluatorId: string;
  readonly ordinalValue?: string;
  readonly evaluatorConfidence?: string;
  readonly limitations: readonly string[];
  readonly dimensions: readonly {
    readonly key: string;
    readonly observation: string;
  }[];
};

export function analyzePhysicalEvaluationConflicts(
  input: PhysicalEvaluationConflictAnalysisInput
): PhysicalEvaluationConflictAnalysisReport {
  const parsed = input.evidence.map(parseStandaloneEvidence).filter((item): item is ParsedStandaloneEvidence => Boolean(item));
  const attributes = requiredBehavioralEquipmentDNAAttributes.map((attributeKey) =>
    analyzeAttribute({
      attributeKey,
      records: parsed.filter((item) => item.record.attributeKey === attributeKey),
      synthesis: input.standaloneAttributes?.find((item) => item.attributeKey === attributeKey),
      comparative: input.comparativeAttributes?.find((item) => item.attributeKey === attributeKey)
    })
  );
  return {
    version: PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION,
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    policyVersion: PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION,
    blindingPolicy: buildBlindingPolicy(),
    qualifyingEvaluatorCount: new Set(parsed.map((item) => item.evaluatorId)).size,
    physicalSessionCount: new Set(parsed.map((item) => item.sessionId)).size,
    evidenceCount: parsed.length,
    attributes,
    canonicalEvaluationsCreated: 0,
    numericReferencesCreated: 0,
    liveRecommendationActivationAllowed: false,
    writesPerformed: false
  };
}

export function buildPhysicalEvaluationAdjudicationPlan(
  report: PhysicalEvaluationConflictAnalysisReport
): PhysicalEvaluationAdjudicationPlan {
  return {
    version: PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION,
    equipmentId: report.equipmentId,
    equipmentLabel: report.equipmentLabel,
    variantLabel: report.variantLabel,
    policyVersion: PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION,
    blindingPolicy: report.blindingPolicy,
    attributes: report.attributes.flatMap((attribute) => attribute.nextEvidence ? [attribute.nextEvidence] : []),
    evaluatorInstructions: [
      "Do not show the evaluator prior evaluator ordinals, raw observations, comparative synthesis, or current canonical candidates before submission.",
      "Use the prior evidence only to design the session and target dimensions.",
      "Record raw rubric dimensions before any summary judgment.",
      "Do not record player outcomes, confidence claims, transition scores, recommendation fit, or arbitrary 0-100 values.",
      "Canonical promotion remains a separate controlled workflow after adjudicating evidence is collected."
    ],
    canonicalPromotionAllowedAfterCollection: false,
    writesPerformed: false
  };
}

export function validatePhysicalEvaluationConflictAdjudicationPolicy(): {
  readonly verdict: "pass" | "fail";
  readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly details: string }[];
} {
  const checks = [
    check("conflict policy version present", PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION === "1.0"),
    check("blinding policy version present", PHYSICAL_EVALUATION_BLINDING_POLICY_VERSION === "1.0"),
    check("prior ordinals hidden", evaluatorBlindingPolicy.priorEvaluatorCanonicalInterpretations === "hidden_before_evaluation"),
    check("prior raw observations hidden", evaluatorBlindingPolicy.priorEvaluatorRawObservations === "hidden_before_evaluation"),
    check("comparative evidence remains non-dispositive", true),
    check("majority vote is not a promotion rule", true),
    check("response degradation is inverse semantics", normalizedRankFor("forgiveness", "response_degradation", "high") === 1),
    check("canonical evaluations are not created by conflict analysis", true),
    check("numeric references are not created by conflict analysis", true),
    check("live recommendations remain disabled", true)
  ];
  return {
    verdict: checks.every((item) => item.passed) ? "pass" : "fail",
    checks
  };
}

function analyzeAttribute(input: {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly records: readonly ParsedStandaloneEvidence[];
  readonly synthesis?: StandaloneAbsoluteAttributeSynthesis;
  readonly comparative?: ComparativeEvidenceAttributeSynthesis;
}): PhysicalEvaluationConflictAttributeAnalysis {
  const observedOrdinals = [...new Set(input.records.map((record) => record.ordinalValue).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => ordinalIndex(input.attributeKey, left) - ordinalIndex(input.attributeKey, right));
  const ordinalSpread = spreadFor(observedOrdinals.map((ordinal) => ordinalIndex(input.attributeKey, ordinal)));
  const ordinalSeverity = severityForSpread(ordinalSpread);
  const dimensionAnalysis = dimensionAnalysisFor(input.attributeKey, input.records);
  const dimensionSeverity = maxSeverity(dimensionAnalysis.map((dimension) => dimension.conflictSeverity));
  const conflictSeverity = maxSeverity([ordinalSeverity, dimensionSeverity]);
  const classifications = classificationsFor({
    attributeKey: input.attributeKey,
    records: input.records,
    observedOrdinals,
    ordinalSpread,
    conflictSeverity,
    dimensionAnalysis,
    comparative: input.comparative
  });
  const adjudicationStatus = adjudicationStatusFor(input.attributeKey, conflictSeverity, classifications, input.records.length);
  const targetDimensions = targetDimensionsFor(input.attributeKey, dimensionAnalysis, classifications, conflictSeverity);
  const stableDimensions = dimensionAnalysis.filter((dimension) => dimension.stable).map((dimension) => dimension.dimensionKey);
  const nextEvidence = adjudicationStatus === "no_adjudication_required" || adjudicationStatus === "resolved"
    ? undefined
    : prescriptionFor({
        attributeKey: input.attributeKey,
        conflictSeverity,
        classifications,
        targetDimensions,
        stableDimensions,
        comparative: input.comparative
      });
  return {
    attributeKey: input.attributeKey,
    evidenceSources: input.records.map(evidenceSummary),
    currentSynthesis: input.synthesis ? {
      classification: input.synthesis.classification,
      synthesisStatus: input.synthesis.synthesisStatus,
      observedOrdinals: input.synthesis.observedOrdinals,
      supportedCanonicalOrdinal: input.synthesis.supportedCanonicalOrdinal,
      supportedOrdinalRange: input.synthesis.supportedOrdinalRange,
      materialConflict: input.synthesis.materialConflict
    } : undefined,
    observedOrdinals,
    ordinalSpread,
    conflictSeverity,
    conflictClassifications: classifications,
    dimensionAnalysis,
    comparativeCorroboration: input.comparative ? {
      comparativeDirection: input.comparative.comparativeDirection,
      consensusStrength: input.comparative.consensusStrength,
      canonicalInterpretationStatus: input.comparative.canonicalInterpretationStatus,
      nonDispositive: true,
      summary: `${input.comparative.comparativeDirection}; ${input.comparative.consensusStrength}; ${input.comparative.canonicalInterpretationStatus}`
    } : undefined,
    adjudicationStatus,
    targetDimensions,
    stableDimensions,
    nextEvidence,
    resolutionCandidate: input.synthesis?.supportedCanonicalOrdinal,
    canonicalPromotionStatus: input.synthesis?.supportedCanonicalOrdinal
      ? "controlled_workflow_required"
      : adjudicationStatus === "no_adjudication_required"
        ? "no_promotion_needed"
        : "not_allowed_by_conflict_analysis"
  };
}

function dimensionAnalysisFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  records: readonly ParsedStandaloneEvidence[]
): PhysicalEvaluationDimensionConflictSummary[] {
  const keys = [...new Set(records.flatMap((record) => record.dimensions.map((dimension) => dimension.key)))].sort();
  return keys.map((dimensionKey) => {
    const observations = records.flatMap((record) =>
      record.dimensions
        .filter((dimension) => dimension.key === dimensionKey)
        .map((dimension) => ({
          evidenceId: record.record.id,
          sessionId: record.sessionId,
          evaluatorId: record.evaluatorId,
          rawObservation: dimension.observation,
          normalizedConstructValue: normalizedValueFor(attributeKey, dimensionKey, dimension.observation),
          normalizedRank: normalizedRankFor(attributeKey, dimensionKey, dimension.observation),
          inverseSemanticsApplied: isInverseDimension(attributeKey, dimensionKey)
        }))
    );
    const spread = spreadFor(observations.map((observation) => observation.normalizedRank));
    const conflictSeverity = severityForSpread(spread);
    return {
      dimensionKey,
      observationCount: observations.length,
      independentSourceCount: new Set(observations.map((observation) => observation.evaluatorId)).size,
      observations,
      normalizedValues: [...new Set(observations.map((observation) => observation.normalizedConstructValue))],
      spread,
      conflictSeverity,
      stable: conflictSeverity === "none"
    };
  });
}

function classificationsFor(input: {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly records: readonly ParsedStandaloneEvidence[];
  readonly observedOrdinals: readonly string[];
  readonly ordinalSpread?: number;
  readonly conflictSeverity: PhysicalEvaluationConflictSeverity;
  readonly dimensionAnalysis: readonly PhysicalEvaluationDimensionConflictSummary[];
  readonly comparative?: ComparativeEvidenceAttributeSynthesis;
}): PhysicalEvaluationConflictClassification[] {
  const result: PhysicalEvaluationConflictClassification[] = [];
  if (input.records.length < 2) result.push("insufficient_evidence");
  if ((input.ordinalSpread ?? 0) > 0) result.push("ordinal_disagreement");
  if (input.dimensionAnalysis.some((dimension) => dimension.conflictSeverity !== "none")) result.push("dimension_disagreement");
  if (hasMajorityOutlier(input.attributeKey, input.records)) result.push("possible_evaluator_outlier");
  if (input.conflictSeverity === "material" || input.conflictSeverity === "severe") result.push("possible_protocol_sensitivity");
  if (input.attributeKey === "sweet_spot_support" && hasSweetSpotConstructConflation(input.records)) {
    result.push("possible_construct_conflation");
  }
  if (
    input.comparative &&
    input.comparative.consensusStrength === "strong" &&
    input.comparative.canonicalInterpretationStatus === "deferred_reference_unanchored" &&
    ((input.ordinalSpread ?? 0) > 0 || input.conflictSeverity !== "none")
  ) {
    result.push("directional_disagreement");
  }
  if (result.length === 0) result.push("resolved");
  return unique(result);
}

function prescriptionFor(input: {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly conflictSeverity: PhysicalEvaluationConflictSeverity;
  readonly classifications: readonly PhysicalEvaluationConflictClassification[];
  readonly targetDimensions: readonly string[];
  readonly stableDimensions: readonly string[];
  readonly comparative?: ComparativeEvidenceAttributeSynthesis;
}): PhysicalEvaluationNextEvidencePrescription {
  const contactAttribute = input.attributeKey === "forgiveness" || input.attributeKey === "sweet_spot_support";
  const constructReview = input.classifications.includes("possible_construct_conflation");
  const minimumTrials = contactAttribute ? controlledContactAdjudicationMinimumTrials : standaloneAdjudicationMinimumTrials;
  return {
    attributeKey: input.attributeKey,
    reason: reasonFor(input.attributeKey, input.conflictSeverity, input.classifications),
    conflictSeverity: input.conflictSeverity,
    conflictClassifications: input.classifications,
    targetDimensions: input.targetDimensions,
    stableDimensions: input.stableDimensions,
    recommendedEvaluationMode: contactAttribute ? "controlled_contact_targeted" : "standalone_absolute_targeted",
    minimumTrials,
    referenceUse: input.comparative ? "contextual_only_non_anchoring" : "none_required",
    controls: [
      "Use the same target bat configuration and normal used condition notes.",
      "Use consistent warm-up before recorded trials.",
      "Record each target dimension before writing any attribute summary.",
      ...(contactAttribute ? ["Use repeatable contact-location categories: centered, modest handle-side miss, and modest end-side miss."] : []),
      ...(constructReview ? ["Separate breadth of usable contact region from response quality inside that region in notes."] : []),
      "Do not use player performance outcomes or transition predictions."
    ],
    instructions: instructionsFor(input.attributeKey, input.targetDimensions, constructReview),
    successCriteria: [
      "Every targeted dimension has complete raw observations.",
      "Evaluator confidence and limitations are recorded.",
      "Evidence remains standalone absolute unless a separate approved reference protocol is intentionally used.",
      "The result can explain whether disagreement is dimension-specific, construct-level, or protocol-sensitive."
    ],
    canonicalPromotionAllowedAfterCollection: false
  };
}

function adjudicationStatusFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  severity: PhysicalEvaluationConflictSeverity,
  classifications: readonly PhysicalEvaluationConflictClassification[],
  evidenceCount: number
): PhysicalEvaluationAdjudicationStatus {
  if (evidenceCount < 2) return "additional_independent_evidence_required";
  if (classifications.includes("possible_construct_conflation")) return "construct_review_required";
  if (severity === "none") return "no_adjudication_required";
  if (severity === "adjacent") return "targeted_retest_required";
  if (severity === "material" || severity === "severe") return attributeKey === "forgiveness" ? "targeted_retest_required" : "protocol_review_required";
  return "targeted_retest_required";
}

function targetDimensionsFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  dimensions: readonly PhysicalEvaluationDimensionConflictSummary[],
  classifications: readonly PhysicalEvaluationConflictClassification[],
  severity: PhysicalEvaluationConflictSeverity
): string[] {
  if (classifications.includes("possible_construct_conflation")) return dimensions.map((dimension) => dimension.dimensionKey);
  const conflicted = dimensions.filter((dimension) => dimension.conflictSeverity !== "none").map((dimension) => dimension.dimensionKey);
  if (conflicted.length > 0) return conflicted;
  if (dimensions.length === 0) return defaultDimensions(attributeKey);
  if (severity !== "none") return dimensions.map((dimension) => dimension.dimensionKey);
  return defaultDimensions(attributeKey);
}

function parseStandaloneEvidence(record: BehavioralEvidenceRecord): ParsedStandaloneEvidence | undefined {
  if (record.category !== "structured_internal_equipment_evaluation") return undefined;
  if (record.timing !== "prospective_equipment_evidence") return undefined;
  if (record.playerSpecific || record.pilotStudyReference || record.numericReference !== undefined) return undefined;
  const raw = rawObject(record.rawValue);
  if (raw.evaluationMode !== "standalone" && raw.interpretationMode !== "standalone_absolute") return undefined;
  const dimensions = dimensionsFor(raw);
  if (dimensions.length === 0) return undefined;
  return {
    record,
    sessionId: stringValue(raw.sessionId) ?? sessionIdFromReference(record.sourceReference) ?? record.id,
    evaluatorId: record.independenceGroup,
    ordinalValue: typeof record.ordinalValue === "string" ? record.ordinalValue : undefined,
    evaluatorConfidence: stringValue(raw.evaluatorConfidence),
    limitations: [
      ...stringArray(raw.limitations),
      ...stringArray(raw.sessionLimitations)
    ],
    dimensions
  };
}

function dimensionsFor(raw: Record<string, unknown>): ParsedStandaloneEvidence["dimensions"] {
  const source = Array.isArray(raw.dimensions) ? raw.dimensions : [];
  return source
    .map(rawObject)
    .map((dimension) => ({
      key: stringValue(dimension.key),
      observation: stringValue(dimension.observation)
    }))
    .filter((dimension): dimension is { key: string; observation: string } =>
      Boolean(dimension.key && dimension.observation && dimension.observation !== "unable_to_assess")
    );
}

function normalizedRankFor(attributeKey: BehavioralEquipmentDNAAttributeKey, dimensionKey: string, observation: string): number {
  const rank = standaloneRank(observation);
  if (rank === undefined) return 2;
  if (isInverseDimension(attributeKey, dimensionKey)) return 4 - rank;
  return rank;
}

function normalizedValueFor(attributeKey: BehavioralEquipmentDNAAttributeKey, dimensionKey: string, observation: string): string {
  const rank = normalizedRankFor(attributeKey, dimensionKey, observation);
  if (attributeKey === "swing_effort") return ["very_easy", "easy", "moderate", "demanding", "very_demanding"][rank] ?? "moderate";
  return ["very_low", "low", "moderate", "high", "very_high"][rank] ?? "moderate";
}

function standaloneRank(value: string): number | undefined {
  return {
    very_low: 0,
    low: 1,
    moderate: 2,
    high: 3,
    very_high: 4
  }[value];
}

function isInverseDimension(attributeKey: BehavioralEquipmentDNAAttributeKey, dimensionKey: string): boolean {
  return attributeKey === "forgiveness" && dimensionKey === "response_degradation";
}

function severityForSpread(spread: number | undefined): PhysicalEvaluationConflictSeverity {
  if (spread === undefined) return "minor";
  if (spread <= 0) return "none";
  if (spread === 1) return "adjacent";
  if (spread === 2) return "material";
  return "severe";
}

function spreadFor(values: readonly number[]): number | undefined {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (valid.length === 0) return undefined;
  return Math.max(...valid) - Math.min(...valid);
}

function maxSeverity(values: readonly PhysicalEvaluationConflictSeverity[]): PhysicalEvaluationConflictSeverity {
  const rank: Record<PhysicalEvaluationConflictSeverity, number> = {
    none: 0,
    minor: 1,
    adjacent: 2,
    material: 3,
    severe: 4
  };
  return [...values].sort((left, right) => rank[right] - rank[left])[0] ?? "none";
}

function hasMajorityOutlier(attributeKey: BehavioralEquipmentDNAAttributeKey, records: readonly ParsedStandaloneEvidence[]): boolean {
  const ordinals = records.map((record) => record.ordinalValue).filter((value): value is string => Boolean(value));
  const counts = new Map<string, number>();
  for (const ordinal of ordinals) counts.set(ordinal, (counts.get(ordinal) ?? 0) + 1);
  const majority = [...counts.entries()].find(([, count]) => count >= 2)?.[0];
  if (!majority) return false;
  return ordinals.some((ordinal) => Math.abs(ordinalIndex(attributeKey, ordinal) - ordinalIndex(attributeKey, majority)) >= 2);
}

function hasSweetSpotConstructConflation(records: readonly ParsedStandaloneEvidence[]): boolean {
  return records.some((record) => {
    const usable = record.dimensions.find((dimension) => dimension.key === "usable_contact_region");
    const consistency = record.dimensions.filter((dimension) =>
      dimension.key === "centered_response_consistency" || dimension.key === "near_center_response_consistency"
    );
    if (!usable || consistency.length === 0) return false;
    const usableRank = normalizedRankFor("sweet_spot_support", usable.key, usable.observation);
    return consistency.some((dimension) =>
      Math.abs(normalizedRankFor("sweet_spot_support", dimension.key, dimension.observation) - usableRank) >= 2
    );
  });
}

function ordinalIndex(attributeKey: BehavioralEquipmentDNAAttributeKey, ordinal: string): number {
  return ordinalScaleFor(attributeKey).indexOf(ordinal);
}

function evidenceSummary(record: ParsedStandaloneEvidence): PhysicalEvaluationEvidenceSourceSummary {
  return {
    evidenceId: record.record.id,
    sessionId: record.sessionId,
    evaluatorId: record.evaluatorId,
    ordinalValue: record.ordinalValue,
    evaluatorConfidence: record.evaluatorConfidence,
    limitations: record.limitations
  };
}

function reasonFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  severity: PhysicalEvaluationConflictSeverity,
  classifications: readonly PhysicalEvaluationConflictClassification[]
): string {
  if (classifications.includes("possible_construct_conflation")) {
    return `${attributeKey} has internal dimension divergence that may reflect construct conflation rather than simple evaluator disagreement.`;
  }
  if (severity === "adjacent") return `${attributeKey} is bounded by adjacent standalone ordinals and needs targeted confirmation.`;
  if (severity === "material" || severity === "severe") return `${attributeKey} has ${severity} standalone disagreement and cannot be resolved analytically.`;
  return `${attributeKey} needs additional adjudicating evidence.`;
}

function instructionsFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  targetDimensions: readonly string[],
  constructReview: boolean
): string[] {
  return [
    `Retest ${attributeKey} using the targeted dimensions: ${targetDimensions.join(", ") || defaultDimensions(attributeKey).join(", ")}.`,
    ...(attributeKey === "swing_effort" ? ["Separate startup demand, rotational demand, and barrel redirect demand across multiple dry-swing blocks."] : []),
    ...(attributeKey === "bat_control_support" ? ["Focus on directional controllability, barrel-path manageability, and start/stop controllability."] : []),
    ...(attributeKey === "forgiveness" ? ["For response_degradation, remember higher raw degradation means lower normalized forgiveness support."] : []),
    ...(attributeKey === "sweet_spot_support" ? ["Record usable contact region separately from centered and near-centered response consistency."] : []),
    ...(constructReview ? ["Add notes explaining whether breadth and response quality appeared to be distinct constructs."] : [])
  ];
}

function defaultDimensions(attributeKey: BehavioralEquipmentDNAAttributeKey): string[] {
  return {
    swing_effort: ["startup_demand", "rotational_demand", "barrel_redirect_demand"],
    bat_control_support: ["directional_controllability", "barrel_path_manageability", "start_stop_controllability"],
    forgiveness: ["off_center_response_consistency", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation"],
    sweet_spot_support: ["usable_contact_region", "centered_response_consistency", "near_center_response_consistency"]
  }[attributeKey];
}

function buildBlindingPolicy() {
  return {
    version: PHYSICAL_EVALUATION_BLINDING_POLICY_VERSION,
    ...evaluatorBlindingPolicy,
    rationale: [
      "Prior evidence may design the adjudication session but should not coach the evaluator.",
      "Bat identity may be known because physical equipment must be verified.",
      "Prior ordinals, raw observations, comparative synthesis, and candidates are hidden before submission to preserve independence."
    ]
  } as const;
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

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function check(name: string, passed: boolean, details = passed ? "pass" : "fail") {
  return { name, passed, details };
}
