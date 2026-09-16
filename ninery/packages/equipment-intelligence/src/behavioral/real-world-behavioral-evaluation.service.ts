import {
  getEquipmentDNAAttributeDefinition,
  validateEquipmentDNAAttributeValue
} from "../attributes/index.js";
import type { EquipmentAttributeConfidence } from "../evidence/index.js";
import {
  REAL_WORLD_BEHAVIORAL_EVALUATION_VERSION,
  behavioralEvidenceGapRecommendations,
  requiredBehavioralEquipmentDNAAttributes
} from "./real-world-behavioral-evaluation.policy.js";
import { synthesizeStandaloneAbsoluteEvidence } from "./standalone/index.js";
import { synthesizeComparativeBehavioralEvidence } from "./synthesis/index.js";
import type {
  BehavioralAttributeEvaluationResult,
  BehavioralEquipmentDNAAttributeKey,
  BehavioralEvaluationReadiness,
  BehavioralEvidenceCategory,
  BehavioralEvidenceRecord,
  RealWorldBehavioralEvaluationReport
} from "./real-world-behavioral-evaluation.types.js";

const confidenceRank: Record<EquipmentAttributeConfidence, number> = {
  estimated: 0,
  moderate: 1,
  high: 2,
  validated: 3
};

export function evaluateRealWorldBehavioralEquipmentDNA(input: {
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly evidence: readonly BehavioralEvidenceRecord[];
  readonly identityReady?: boolean;
  readonly specificationReady?: boolean;
}): RealWorldBehavioralEvaluationReport {
  const attributes = requiredBehavioralEquipmentDNAAttributes.map((attributeKey) =>
    evaluateBehavioralAttribute(attributeKey, input.evidence)
  );
  const synthesis = synthesizeComparativeBehavioralEvidence({
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    evidence: input.evidence
  });
  const standaloneSynthesis = synthesizeStandaloneAbsoluteEvidence({
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    evidence: input.evidence,
    comparativeAttributes: synthesis.attributes
  });
  const synthesizedAttributes = attributes.map((attribute) => {
    const comparativeSynthesis = synthesis.attributes.find((item) => item.attributeKey === attribute.attributeKey);
    const standaloneAttribute = standaloneSynthesis.attributes.find((item) => item.attributeKey === attribute.attributeKey);
    const withComparative = comparativeSynthesis && comparativeSynthesis.evidenceCount > 0
      ? { ...attribute, comparativeSynthesis, missingEvidence: missingEvidenceWithSynthesis(attribute.missingEvidence, comparativeSynthesis) }
      : attribute;
    return standaloneAttribute ? applyStandaloneSynthesis(withComparative, standaloneAttribute) : withComparative;
  });
  const gaps = synthesizedAttributes
    .filter((attribute) => attribute.evaluationStatus === "insufficient_evidence")
    .map((attribute) => behavioralEvidenceGapRecommendations[attribute.attributeKey]);
  const readiness = assessBehavioralReadiness({
    attributes: synthesizedAttributes,
    identityReady: input.identityReady ?? true,
    specificationReady: input.specificationReady ?? true
  });
  const validation = validateBehavioralEvaluationReport({ attributes: synthesizedAttributes, evidence: input.evidence, readiness });
  return {
    version: REAL_WORLD_BEHAVIORAL_EVALUATION_VERSION,
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    evidenceInventory: input.evidence,
    attributes: synthesizedAttributes,
    evidenceQuality: countEvidenceByCategory(input.evidence),
    gaps,
    readiness,
    validation
  };
}

function applyStandaloneSynthesis(
  attribute: BehavioralAttributeEvaluationResult,
  standaloneSynthesis: NonNullable<BehavioralAttributeEvaluationResult["standaloneSynthesis"]>
): BehavioralAttributeEvaluationResult {
  if (standaloneSynthesis.synthesisStatus !== "single_ordinal_supported" || !standaloneSynthesis.supportedCanonicalOrdinal) {
    return {
      ...attribute,
      standaloneSynthesis,
      missingEvidence: missingEvidenceWithStandalone(attribute.missingEvidence, standaloneSynthesis)
    };
  }
  return {
    ...attribute,
    evaluationStatus: "resolved_ordinal",
    ordinalValue: standaloneSynthesis.supportedCanonicalOrdinal,
    numericReference: undefined,
    confidence: standaloneSynthesis.confidence,
    evidenceCount: standaloneSynthesis.evidenceCount,
    evidenceTypes: [...new Set(standaloneSynthesis.qualifyingEvidence.map((record) => record.category))],
    supportingEvidence: standaloneSynthesis.qualifyingEvidence,
    conflictingEvidence: [],
    missingEvidence: [],
    standaloneSynthesis,
    rationale: `${attribute.attributeKey} is resolved from exact agreement across independent standalone absolute physical evaluations. No numeric reference was created.`,
    limitations: standaloneSynthesis.limitations,
    provenance: provenanceFor(standaloneSynthesis.qualifyingEvidence)
  };
}

function missingEvidenceWithStandalone(
  missingEvidence: readonly string[],
  synthesis: NonNullable<BehavioralAttributeEvaluationResult["standaloneSynthesis"]>
): readonly string[] {
  if (synthesis.synthesisStatus === "single_ordinal_supported") return missingEvidence;
  return [
    `Standalone synthesis: ${synthesis.classification}.`,
    `Observed ordinals: ${synthesis.observedOrdinals.join(", ") || "none"}.`,
    `Promotion status: ${synthesis.synthesisStatus}.`,
    ...(synthesis.supportedOrdinalRange ? [`Bounded range: ${synthesis.supportedOrdinalRange.join(" to ")}.`] : []),
    ...missingEvidence
  ];
}

function missingEvidenceWithSynthesis(
  missingEvidence: readonly string[],
  synthesis: NonNullable<BehavioralAttributeEvaluationResult["comparativeSynthesis"]>
): readonly string[] {
  if (synthesis.canonicalInterpretationStatus === "available") return missingEvidence;
  return [
    `Comparative consensus: ${synthesis.comparativeDirection}.`,
    `Consensus strength: ${synthesis.consensusStrength}. Independent sources: ${synthesis.independentSourceCount}.`,
    `Canonical interpretation: ${synthesis.canonicalInterpretationStatus}.`,
    `Next evidence action: ${synthesis.nextEvidenceAction}.`,
    ...missingEvidence
  ];
}

export function evaluateBehavioralAttribute(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  evidence: readonly BehavioralEvidenceRecord[]
): BehavioralAttributeEvaluationResult {
  const relevant = evidence.filter((record) => record.attributeKey === attributeKey);
  const contaminated = relevant.filter(isContaminatedEvidence);
  const clean = relevant.filter((record) => !isContaminatedEvidence(record));
  const conflicts = conflictingEvidence(clean);
  const supporting = clean.filter(isSupportiveEvidence);
  const evidenceTypes = [...new Set(clean.map((record) => record.category))];
  const independenceGroups = new Set(supporting.map((record) => record.independenceGroup));
  const definition = getEquipmentDNAAttributeDefinition(attributeKey);
  const validatedOrdinals = supporting.filter((record) => {
    if (record.ordinalValue === undefined || !definition) return false;
    return validateEquipmentDNAAttributeValue(attributeKey, record.ordinalValue).valid;
  });
  const numericCandidates = supporting.filter((record) => typeof record.numericReference === "number");

  if (contaminated.length > 0) {
    return result(attributeKey, "rejected_contaminated", supporting, contaminated, [
      "Retrospective, Pilot Study, or player-specific evidence cannot define prospective intrinsic Equipment DNA."
    ]);
  }
  if (conflicts.length > 0) {
    return result(attributeKey, "blocked_conflict", supporting, conflicts, ["Conflicting behavioral evidence must be reviewed."]);
  }
  if (validatedOrdinals.length === 0) {
    const relativeOnly = supporting.filter(isRelativeOnlyStructuredEvidence);
    return result(attributeKey, "insufficient_evidence", supporting, [], [
      ...(relativeOnly.length > 0
        ? ["Directional comparative physical evidence exists, but absolute canonical ordinal interpretation is unresolved."]
        : []),
      ...behavioralEvidenceGapRecommendations[attributeKey].needed
    ]);
  }

  const strongest = validatedOrdinals[0];
  const hasIndependentSupport = independenceGroups.size >= 2;
  const hasMeasuredOrStructured = supporting.some((record) =>
    record.category === "objective_measured" || record.category === "structured_internal_equipment_evaluation"
  );
  const marketingOnly = supporting.every((record) => record.category === "marketing_claim" || record.category === "manufacturer_technical");
  const numericReference = numericCandidates.length > 0 && hasMeasuredOrStructured ? numericCandidates[0].numericReference : undefined;
  const status = numericReference === undefined ? "resolved_ordinal" : "resolved_numeric";
  const confidence = confidenceFor({
    requested: strongest.confidence,
    hasIndependentSupport,
    hasMeasuredOrStructured,
    marketingOnly
  });

  return {
    attributeKey,
    evaluationStatus: status,
    ordinalValue: strongest.ordinalValue,
    numericReference,
    confidence,
    evidenceCount: supporting.length,
    evidenceTypes,
    supportingEvidence: supporting,
    conflictingEvidence: [],
    missingEvidence: numericReference === undefined ? ["numeric reference requires measured or structured evidence"] : [],
    rationale: rationaleFor(attributeKey, status, marketingOnly),
    limitations: limitationsFor(marketingOnly, numericReference),
    provenance: provenanceFor(relevant),
    evaluationVersion: REAL_WORLD_BEHAVIORAL_EVALUATION_VERSION
  };
}

function assessBehavioralReadiness(input: {
  readonly attributes: readonly BehavioralAttributeEvaluationResult[];
  readonly identityReady: boolean;
  readonly specificationReady: boolean;
}): BehavioralEvaluationReadiness {
  const resolved = input.attributes
    .filter((attribute) => attribute.evaluationStatus === "resolved_ordinal" || attribute.evaluationStatus === "resolved_numeric")
    .map((attribute) => attribute.attributeKey);
  const unresolved = requiredBehavioralEquipmentDNAAttributes.filter((key) => !resolved.includes(key));
  const materialConflicts = input.attributes
    .filter((attribute) => attribute.evaluationStatus === "blocked_conflict")
    .map((attribute) => attribute.attributeKey);
  const confidenceThresholdsSatisfied = input.attributes
    .filter((attribute) => resolved.includes(attribute.attributeKey))
    .every((attribute) => confidenceRank[attribute.confidence] >= confidenceRank.moderate);
  const behavioralEvidenceReady = unresolved.length === 0 && materialConflicts.length === 0 && confidenceThresholdsSatisfied;
  return {
    identityReady: input.identityReady,
    specificationReady: input.specificationReady,
    behavioralEvidencePartial: resolved.length > 0 && !behavioralEvidenceReady,
    behavioralEvidenceReady,
    canonicalProfileReady: input.identityReady && input.specificationReady && behavioralEvidenceReady,
    genuineStudyReady: false,
    liveActivationAllowed: false,
    requiredBehavioralAttributesResolved: resolved,
    requiredBehavioralAttributesUnresolved: unresolved,
    confidenceThresholdsSatisfied,
    materialConflicts
  };
}

function validateBehavioralEvaluationReport(input: {
  readonly attributes: readonly BehavioralAttributeEvaluationResult[];
  readonly evidence: readonly BehavioralEvidenceRecord[];
  readonly readiness: BehavioralEvaluationReadiness;
}) {
  const checks = [
    check("evidence provenance present", input.evidence.every((record) => Boolean(record.sourceReference))),
    check("marketing claims not directly converted into numeric references", input.attributes.every((attribute) =>
      !attribute.supportingEvidence.some((record) => record.category === "marketing_claim") || attribute.numericReference === undefined
    )),
    check("missing values not converted to zero", input.attributes.every((attribute) => attribute.numericReference !== 0)),
    check("missing values not converted to 50", input.attributes.every((attribute) => attribute.numericReference !== 50)),
    check("player-specific observations excluded from intrinsic evaluation", input.attributes.every((attribute) => !attribute.provenance.playerSpecificEvidenceUsed)),
    check("Pilot Study #1 data excluded", input.attributes.every((attribute) => !attribute.provenance.pilotStudyEvidenceUsed)),
    check("retrospective validation evidence excluded", input.attributes.every((attribute) => !attribute.provenance.retrospectiveValidationEvidenceUsed)),
    check("no transitionFriendliness fallback", input.evidence.every((record) => !String(record.sourceReference).includes("transitionFriendliness"))),
    check("no confidenceBuilding fallback", input.evidence.every((record) => !String(record.sourceReference).includes("confidenceBuilding"))),
    check("canonical readiness policy unchanged", !input.readiness.liveActivationAllowed),
    check("live recommendation activation still blocked", input.readiness.liveActivationAllowed === false)
  ];
  return {
    verdict: checks.every((item) => item.passed) ? "pass" as const : "fail" as const,
    checks
  };
}

function isSupportiveEvidence(record: BehavioralEvidenceRecord): boolean {
  if (record.category === "anecdotal_player_specific" || record.category === "unknown") return false;
  if (record.category === "marketing_claim" && record.numericReference !== undefined) return false;
  if (isRelativeOnlyStructuredEvidence(record)) return true;
  return record.ordinalValue !== undefined || record.numericReference !== undefined;
}

function isRelativeOnlyStructuredEvidence(record: BehavioralEvidenceRecord): boolean {
  if (record.category !== "structured_internal_equipment_evaluation") return false;
  if (record.ordinalValue !== undefined || record.numericReference !== undefined) return false;
  const raw = record.rawValue as { interpretationMode?: unknown; canonicalInterpretationStatus?: unknown } | undefined;
  return raw?.interpretationMode === "relative_only" && raw.canonicalInterpretationStatus === "deferred";
}

function isContaminatedEvidence(record: BehavioralEvidenceRecord): boolean {
  return record.timing === "retrospective_validation_evidence" || Boolean(record.playerSpecific) || Boolean(record.pilotStudyReference);
}

function conflictingEvidence(records: readonly BehavioralEvidenceRecord[]): BehavioralEvidenceRecord[] {
  const values = new Map<string, BehavioralEvidenceRecord[]>();
  for (const record of records) {
    if (record.ordinalValue === undefined) continue;
    const key = String(record.ordinalValue);
    values.set(key, [...(values.get(key) ?? []), record]);
  }
  return values.size > 1 ? [...values.values()].flat() : [];
}

function result(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  evaluationStatus: BehavioralAttributeEvaluationResult["evaluationStatus"],
  supportingEvidence: readonly BehavioralEvidenceRecord[],
  conflictingEvidence: readonly BehavioralEvidenceRecord[],
  missingEvidence: readonly string[]
): BehavioralAttributeEvaluationResult {
  return {
    attributeKey,
    evaluationStatus,
    confidence: "estimated",
    evidenceCount: supportingEvidence.length,
    evidenceTypes: [...new Set(supportingEvidence.map((record) => record.category))],
    supportingEvidence,
    conflictingEvidence,
    missingEvidence,
    rationale: `${attributeKey} cannot be resolved from the current evidence packet without fabricating equipment behavior.`,
    limitations: ["No hidden zero, neutral 50, copied demo-bat value, or player outcome fallback was used."],
    provenance: provenanceFor([...supportingEvidence, ...conflictingEvidence]),
    evaluationVersion: REAL_WORLD_BEHAVIORAL_EVALUATION_VERSION
  };
}

function confidenceFor(input: {
  readonly requested?: EquipmentAttributeConfidence;
  readonly hasIndependentSupport: boolean;
  readonly hasMeasuredOrStructured: boolean;
  readonly marketingOnly: boolean;
}): EquipmentAttributeConfidence {
  if (input.marketingOnly) return "estimated";
  if (input.hasMeasuredOrStructured && input.hasIndependentSupport) return input.requested === "validated" ? "high" : "high";
  if (input.hasMeasuredOrStructured || input.hasIndependentSupport) return "moderate";
  return "estimated";
}

function rationaleFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  status: BehavioralAttributeEvaluationResult["evaluationStatus"],
  marketingOnly: boolean
): string {
  if (marketingOnly) {
    return `${attributeKey} has only manufacturer or marketing-style behavioral support; ordinal review is retained with estimated confidence and no numeric precision.`;
  }
  return `${attributeKey} is ${status === "resolved_numeric" ? "resolved with measured or structured support" : "resolved as ordinal-only"} using prospective equipment evidence.`;
}

function limitationsFor(marketingOnly: boolean, numericReference?: number): string[] {
  return [
    ...(marketingOnly ? ["Marketing or manufacturer claims alone do not create high confidence."] : []),
    ...(numericReference === undefined ? ["No numeric reference was created because evidence did not justify exact precision."] : []),
    "Jackson-specific or retrospective transition evidence was excluded."
  ];
}

function provenanceFor(records: readonly BehavioralEvidenceRecord[]) {
  return {
    prospectiveEquipmentEvidenceOnly: records.every((record) => record.timing === "prospective_equipment_evidence" && !record.playerSpecific && !record.pilotStudyReference),
    pilotStudyEvidenceUsed: records.some((record) => Boolean(record.pilotStudyReference)),
    playerSpecificEvidenceUsed: records.some((record) => Boolean(record.playerSpecific)),
    retrospectiveValidationEvidenceUsed: records.some((record) => record.timing === "retrospective_validation_evidence")
  };
}

function countEvidenceByCategory(records: readonly BehavioralEvidenceRecord[]): Record<BehavioralEvidenceCategory, number> {
  const result = {
    objective_measured: 0,
    manufacturer_technical: 0,
    independent_expert: 0,
    structured_internal_equipment_evaluation: 0,
    anecdotal_player_specific: 0,
    marketing_claim: 0,
    unknown: 0
  };
  for (const record of records) result[record.category] += 1;
  return result;
}

function check(name: string, passed: boolean, details = passed ? "pass" : "fail") {
  return { name, passed, details };
}
