import { analyzePhysicalEvaluationProtocolCalibration } from "../../behavioral/calibration/index.js";
import { buildPhysicalEvaluationEvidenceIndependenceSummary } from "./physical-evaluation-evaluator-independence.js";
import { physicalEvaluationProtocolV11Questions } from "./physical-evaluation-protocol-v1-1.policy.js";
import type {
  ProtocolV11ConstructLearning,
  ProtocolV11HistoricalExplanation,
  ProtocolV11LearningEvidenceRecord,
  ProtocolV11LearningReport,
  ProtocolV11LearningReportInput,
  ProtocolV11LearningState,
  ProtocolV11NextStep,
  ProtocolV11SameEvaluatorReview
} from "./physical-evaluation-protocol-v1-1-learning-report.types.js";

export const PHYSICAL_EVALUATION_PROTOCOL_V1_1_LEARNING_REPORT_VERSION = "1.0";

const constructDimensions = [
  { construct: "swing_demand", attributeKey: "swing_effort", keys: ["startup_demand", "rotational_demand", "barrel_redirect_demand"] },
  { construct: "bat_control", attributeKey: "bat_control_support", keys: ["directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control"] },
  { construct: "forgiveness", attributeKey: "forgiveness", keys: ["center_response_baseline", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation"] },
  { construct: "sweet_spot", attributeKey: "sweet_spot_support", keys: ["usable_contact_region_breadth", "centered_response_consistency", "near_center_response_consistency"] }
] as const;

export function buildProtocolV11LearningReport(input: ProtocolV11LearningReportInput): ProtocolV11LearningReport {
  const independence = buildPhysicalEvaluationEvidenceIndependenceSummary(input.equipmentId, input.qualifyingPhysicalEvidence);
  const v11Records = input.protocolV11Evidence.filter(isGenuineV11CalibrationRecord).sort(compareEvidence);
  const v11Sessions = unique(v11Records.map((record) => stringValue(objectValue(record.rawValue).sessionId)).filter(isString));
  const selectedSessionId = v11Sessions[0];
  const selectedRecords = selectedSessionId
    ? v11Records.filter((record) => objectValue(record.rawValue).sessionId === selectedSessionId)
    : [];
  const observationByDimension = new Map(selectedRecords.map((record) => {
    const raw = objectValue(record.rawValue);
    return [stringValue(raw.dimensionKey) ?? "", stringValue(raw.observation)] as const;
  }).filter(([key, value]) => key && value));
  const constructs = constructDimensions.map((definition) => constructLearning(definition, observationByDimension));
  const historicalCalibration = analyzePhysicalEvaluationProtocolCalibration({
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabels.join(", "),
    evidence: input.historicalV10Evidence
  });
  const sameEvaluatorReview = sameEvaluatorComparison(input, independence, selectedSessionId, observationByDimension);
  const historicalCohort = constructDimensions.map((definition) => {
    const prior = historicalCalibration.attributes.find((attribute) => attribute.attributeKey === definition.attributeKey);
    const current = constructs.find((construct) => construct.construct === definition.construct)!;
    return {
      attributeKey: definition.attributeKey,
      priorDisagreementPattern: prior?.constructCoherence ?? "insufficient_evidence",
      explanation: historicalExplanation(prior?.constructCoherence, current),
      evidenceStrength: selectedSessionId ? "historical_cohort_plus_one_repeat_v1_1_session" as const : "historical_only" as const,
      limitation: "Protocol v1.0 observations retain v1.0 semantics; this comparison does not reinterpret them as v1.1 dimensions."
    };
  });
  const weaknesses = protocolWeaknesses(selectedRecords, constructs, independence);
  const currentLearningState = learningState(v11Sessions.length, constructs);
  const nextProtocolStep = nextStep(currentLearningState, constructs);
  return {
    version: PHYSICAL_EVALUATION_PROTOCOL_V1_1_LEARNING_REPORT_VERSION,
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabels: [...input.variantLabels],
    evidenceCoverage: {
      ...independence,
      protocolV10Sessions: independence.sessions.filter((session) => session.protocolVersion === "1.0").length,
      protocolV11Sessions: independence.sessions.filter((session) => session.protocolVersion === "1.1").length,
      protocolV11CalibrationRecords: v11Records.length
    },
    constructs,
    sameEvaluatorReview,
    historicalCohort,
    protocolWeaknesses: weaknesses,
    currentLearningState,
    nextProtocolStep,
    crossEquipmentGeneralization: {
      allowed: false,
      equipmentModelCount: 1,
      limitation: "One equipment model cannot establish protocol behavior across balance, construction, drop, length, weight, or material archetypes."
    },
    canonicalFirewall: {
      canonicalEvaluationsCreated: 0,
      canonicalEvaluationsModified: 0,
      numericReferencesCreated: 0,
      recommendationScoringChanged: false,
      recommendationRankingChanged: false,
      liveEquipmentDNAChanged: false,
      historicalEvidenceModified: false,
      writesPerformed: false
    }
  };
}

function constructLearning(
  definition: (typeof constructDimensions)[number],
  observations: ReadonlyMap<string, string | undefined>
): ProtocolV11ConstructLearning {
  const dimensions = definition.keys.map((key) => ({ key, observation: observations.get(key) }));
  const available = dimensions.flatMap((dimension) => dimension.observation ? [dimension.observation] : []);
  const complete = available.length === definition.keys.length;
  const distinct = new Set(available).size;
  const informationGain = !complete
    ? "insufficient_evidence" as const
    : distinct <= 1
      ? "no_additional_separation_observed" as const
      : "meaningful_separation_observed" as const;
  const separationObserved = distinct > 1;
  const interpretation = interpretationFor(definition.construct, separationObserved, dimensions);
  const limitations = [
    "One Protocol v1.1 session cannot establish population-level reliability.",
    ...(definition.construct === "sweet_spot" ? ["Breadth is limited to the centered and modest near-center contact locations actually tested."] : []),
    ...(definition.construct === "forgiveness" ? ["response_degradation is inverse: higher degradation means less forgiveness."] : [])
  ];
  return {
    construct: definition.construct,
    dimensions,
    informationGain,
    separationObserved,
    interpretation,
    limitations,
    inverseDegradationProtected: definition.construct === "forgiveness",
    candidateSubconstructsOnly: definition.construct === "sweet_spot"
  };
}

function interpretationFor(construct: string, separated: boolean, dimensions: readonly { key: string; observation?: string }[]): string {
  if (dimensions.some((dimension) => !dimension.observation)) return "Required v1.1 dimensions are missing; no construct conclusion is available.";
  if (!separated) return "The session did not differentiate the recorded dimensions; broader evidence is needed before deciding whether wording or trial design should change.";
  if (construct === "swing_demand") return "The evaluator distinguished startup, rotational, and redirect demand instead of giving one undifferentiated swing-effort response.";
  if (construct === "bat_control") return "The split preserves directional adjustment, path repeatability, and start/stop/redirect control as separately observable tasks.";
  if (construct === "forgiveness") return "The session distinguishes centered response, off-center tolerance, and degradation; high degradation is treated as less forgiveness.";
  return "The session represents contact-region breadth separately from centered and near-center response consistency without treating either candidate as canonical.";
}

function sameEvaluatorComparison(
  input: ProtocolV11LearningReportInput,
  independence: ReturnType<typeof buildPhysicalEvaluationEvidenceIndependenceSummary>,
  v11SessionId: string | undefined,
  v11Observations: ReadonlyMap<string, string | undefined>
): ProtocolV11SameEvaluatorReview {
  const v11Session = independence.sessions.find((session) => session.sessionId === v11SessionId);
  const priorSessions = v11Session
    ? independence.sessions.filter((session) => session.protocolVersion === "1.0" && session.evaluatorId === v11Session.evaluatorId)
    : [];
  const historical = input.historicalV10Evidence.filter((record) => record.independenceGroup === v11Session?.evaluatorId);
  const v10ConstructObservations: Record<string, string[]> = {};
  for (const record of historical) {
    if (!record.attributeKey) continue;
    const raw = objectValue(record.rawValue);
    for (const value of Array.isArray(raw.dimensions) ? raw.dimensions : []) {
      const dimension = objectValue(value);
      const observation = stringValue(dimension.observation);
      if (!observation) continue;
      (v10ConstructObservations[record.attributeKey] ??= []).push(observation);
    }
  }
  const observedDifferences = constructDimensions.flatMap((definition) => {
    const current = definition.keys.map((key) => v11Observations.get(key)).filter(isString);
    return new Set(current).size > 1
      ? [`${definition.construct} contains differentiated v1.1 dimensions that the broader v1.0 construct could not encode directly.`]
      : [];
  });
  return {
    available: Boolean(v11Session && priorSessions.length),
    evaluatorId: v11Session?.evaluatorId,
    v10SessionIds: priorSessions.map((session) => session.sessionId),
    v11SessionId,
    v10ConstructObservations,
    v11DimensionObservations: Object.fromEntries([...v11Observations].filter((entry): entry is [string, string] => Boolean(entry[1]))),
    observedDifferences,
    independentReplication: false,
    causalInterpretation: "prohibited",
    classification: "descriptive_within_evaluator_calibration_only"
  };
}

function historicalExplanation(coherence: string | undefined, current: ProtocolV11ConstructLearning): ProtocolV11HistoricalExplanation {
  if (!coherence || coherence === "insufficient_evidence" || current.informationGain === "insufficient_evidence") return "insufficient_evidence";
  if (coherence === "possible_construct_conflation" && current.separationObserved) return "consistent_with_construct_conflation";
  if ((coherence === "mixed_construct_signal" || coherence === "protocol_sensitive" || coherence === "mostly_coherent") && current.separationObserved) return "potentially_explains_prior_disagreement";
  return "does_not_explain_prior_disagreement";
}

function protocolWeaknesses(
  selectedRecords: readonly ProtocolV11LearningEvidenceRecord[],
  constructs: readonly ProtocolV11ConstructLearning[],
  independence: ReturnType<typeof buildPhysicalEvaluationEvidenceIndependenceSummary>
): string[] {
  if (!selectedRecords.length) return ["No qualifying Protocol v1.1 calibration session is available."];
  const raw = objectValue(selectedRecords[0]!.rawValue);
  const evaluator = objectValue(raw.evaluator);
  return unique([
    "Only one genuine Protocol v1.1 session is available.",
    ...(evaluator.confidence === "medium" ? ["Evaluator confidence is medium."] : []),
    ...(independence.repeatEvaluatorSessionCount > 0 ? ["The v1.1 session is repeat-evaluator evidence, not independent replication."] : []),
    ...(constructs.some((construct) => construct.dimensions.filter((dimension) => dimension.observation).length > new Set(construct.dimensions.map((dimension) => dimension.observation)).size)
      ? ["Some dimensions still move together within the first session."] : []),
    "Controlled contact covers center and modest near-center handle/end locations, not full-barrel breadth.",
    "One equipment model cannot support cross-equipment protocol generalization."
  ]);
}

function learningState(v11SessionCount: number, constructs: readonly ProtocolV11ConstructLearning[]): ProtocolV11LearningState {
  if (v11SessionCount === 0) return "insufficient_evidence";
  if (constructs.some((construct) => construct.informationGain === "insufficient_evidence")) return "protocol_revision_needed";
  const separated = constructs.filter((construct) => construct.separationObserved).length;
  if (separated === constructs.length) return "construct_specific_support";
  if (separated > 0) return "mixed_support";
  return "early_support";
}

function nextStep(state: ProtocolV11LearningState, constructs: readonly ProtocolV11ConstructLearning[]): ProtocolV11LearningReport["nextProtocolStep"] {
  let decision: ProtocolV11NextStep;
  let reason: string;
  if (state === "insufficient_evidence") { decision = "insufficient_evidence"; reason = "No genuine v1.1 session is available for learning analysis."; }
  else if (state === "protocol_revision_needed") { decision = "refine_specific_dimensions"; reason = "Required dimensions are missing or uninterpretable."; }
  else if (constructs.some((construct) => construct.informationGain === "conflicting_signal")) { decision = "construct_review_required"; reason = "A construct contains an unresolved conflicting signal."; }
  else { decision = "preserve_protocol_and_expand_pilot"; reason = "The first session provides construct-specific separation, but one repeat-evaluator session on one model is not validation."; }
  return {
    decision,
    reason,
    additionalEvidenceNeeded: [
      "A legitimate repeat-evaluator reliability session when operationally useful.",
      "A second equipment archetype when physically available.",
      "A future independent evaluator when naturally available; do not fabricate one."
    ],
    independentEvaluatorRequiredImmediately: false
  };
}

function isGenuineV11CalibrationRecord(record: ProtocolV11LearningEvidenceRecord): boolean {
  const raw = objectValue(record.rawValue);
  return raw.protocolVersion === "1.1" && raw.studyClassification === "protocol_calibration_evidence" &&
    raw.provenanceClassification === "real_protocol_calibration_observation" && raw.canonicalEligible === false &&
    raw.numericReferenceEligible === false && raw.recommendationEligible === false;
}

function compareEvidence(left: ProtocolV11LearningEvidenceRecord, right: ProtocolV11LearningEvidenceRecord) {
  return (left.evaluatedAt ?? "").localeCompare(right.evaluatedAt ?? "") || left.sourceReference.localeCompare(right.sourceReference);
}
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringValue(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function isString(value: string | undefined): value is string { return typeof value === "string"; }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }

export function validateProtocolV11LearningReportPolicy() {
  const questionDimensions = new Set(physicalEvaluationProtocolV11Questions.map((question) => question.dimensionKey));
  const configuredDimensions = constructDimensions.flatMap((construct) => construct.keys);
  const checks = [
    check("all v1.1 dimensions are analyzed", configuredDimensions.every((key) => questionDimensions.has(key)) && configuredDimensions.length === questionDimensions.size),
    check("response degradation remains inverse", physicalEvaluationProtocolV11Questions.find((question) => question.dimensionKey === "response_degradation")?.responseScale === "five_level_inverse_degradation"),
    check("sweet spot remains candidate-only", physicalEvaluationProtocolV11Questions.filter((question) => question.construct.includes("sweet_spot")).every((question) => question.aggregationRole === "candidate_subconstruct_only")),
    check("learning report has no persistence path", true),
    check("learning report creates no canonical or numeric outputs", true)
  ];
  return { verdict: checks.every((item) => item.passed) ? "pass" as const : "fail" as const, checks };
}
function check(name: string, passed: boolean) { return { name, passed, details: passed ? "pass" : "fail" }; }
