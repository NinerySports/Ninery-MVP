import { validateEquipmentDNAAttributeValue } from "../../attributes/index.js";
import type {
  BehavioralEquipmentDNAAttributeKey,
  BehavioralEvidenceRecord
} from "../real-world-behavioral-evaluation.types.js";
import type { ComparativeEvidenceAttributeSynthesis } from "../synthesis/index.js";
import {
  CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION,
  STANDALONE_ABSOLUTE_EVIDENCE_SYNTHESIS_VERSION,
  ordinalScaleFor,
  standaloneAbsoluteBehavioralAttributes,
  standaloneAbsolutePromotionPolicy
} from "./standalone-absolute-evidence.policy.js";
import type {
  CanonicalOrdinalPromotionPreview,
  CanonicalOrdinalPromotionPreviewAttribute,
  ComparativeCorroborationStatus,
  StandaloneAbsoluteAttributeSynthesis,
  StandaloneAbsoluteEvidenceExclusion,
  StandaloneAbsoluteEvidenceSynthesisReport,
  StandaloneAbsoluteSynthesisInput
} from "./standalone-absolute-evidence.types.js";

export function synthesizeStandaloneAbsoluteEvidence(
  input: StandaloneAbsoluteSynthesisInput
): StandaloneAbsoluteEvidenceSynthesisReport {
  const attributes = standaloneAbsoluteBehavioralAttributes.map((attributeKey) =>
    synthesizeAttribute(attributeKey, input.evidence, input.comparativeAttributes?.find((item) => item.attributeKey === attributeKey))
  );
  return {
    version: STANDALONE_ABSOLUTE_EVIDENCE_SYNTHESIS_VERSION,
    equipmentId: input.equipmentId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    attributes,
    promotionCandidates: attributes.filter((item) => item.synthesisStatus === "single_ordinal_supported"),
    boundedAttributes: attributes.filter((item) => item.synthesisStatus === "bounded_only"),
    blockedAttributes: attributes.filter((item) =>
      item.synthesisStatus === "promotion_blocked_conflict" ||
      item.synthesisStatus === "insufficient_independent_evidence"
    ),
    numericReferenceCreated: false,
    liveRecommendationActivationAllowed: false
  };
}

export function buildCanonicalOrdinalPromotionPreview(
  synthesis: StandaloneAbsoluteEvidenceSynthesisReport
): CanonicalOrdinalPromotionPreview {
  const attributes = synthesis.attributes.map(previewAttribute);
  return {
    version: CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION,
    equipmentId: synthesis.equipmentId,
    equipmentLabel: synthesis.equipmentLabel,
    variantLabel: synthesis.variantLabel,
    attributes,
    promotionPermitted: attributes.some((item) => item.gateStatus === "single_ordinal_ready"),
    promotedAttributeCount: attributes.filter((item) => item.gateStatus === "single_ordinal_ready").length,
    boundedAttributeCount: attributes.filter((item) => item.gateStatus === "bounded_only").length,
    blockedAttributeCount: attributes.filter((item) =>
      item.gateStatus === "promotion_blocked_conflict" || item.gateStatus === "not_ready"
    ).length,
    numericReferenceCreated: false,
    liveRecommendationActivationAllowed: false
  };
}

function synthesizeAttribute(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  evidence: readonly BehavioralEvidenceRecord[],
  comparative?: ComparativeEvidenceAttributeSynthesis
): StandaloneAbsoluteAttributeSynthesis {
  const relevant = evidence.filter((record) => record.attributeKey === attributeKey);
  const excluded: StandaloneAbsoluteEvidenceExclusion[] = [];
  const candidates = relevant.filter((record) => {
    const reason = exclusionReason(record, attributeKey);
    if (reason) excluded.push({ evidenceRecordId: record.id, attributeKey: String(record.attributeKey ?? ""), reason });
    return !reason;
  });
  const unique = uniqueStandaloneRecords(candidates);
  const independentSourceCount = new Set(unique.map((record) => record.independenceGroup)).size;
  const sourceSessionIds = [...new Set(unique.map(sessionIdFor).filter((value): value is string => Boolean(value)))].sort();
  const observedOrdinals = [...new Set(unique.map((record) => String(record.ordinalValue)))].sort((left, right) =>
    ordinalIndex(attributeKey, left) - ordinalIndex(attributeKey, right)
  );
  const indexes = observedOrdinals.map((ordinal) => ordinalIndex(attributeKey, ordinal)).filter((value) => value >= 0);
  const ordinalSpread = indexes.length > 0 ? Math.max(...indexes) - Math.min(...indexes) : undefined;
  const classification = classify({ independentSourceCount, ordinalSpread });
  const synthesisStatus = statusFor(classification);
  const supportedCanonicalOrdinal = classification === "exact_agreement" ? observedOrdinals[0] : undefined;
  const supportedOrdinalRange = classification === "adjacent_agreement" && observedOrdinals.length >= 2
    ? [observedOrdinals[0], observedOrdinals.at(-1)!] as const
    : undefined;
  const comparativeCorroboration = corroborationFor(attributeKey, classification, supportedOrdinalRange, comparative);
  const limitations = limitationsFor({
    classification,
    comparativeCorroboration,
    supportedCanonicalOrdinal,
    supportedOrdinalRange,
    independentSourceCount
  });
  return {
    attributeKey,
    qualifyingEvidence: unique,
    excludedEvidence: excluded,
    evidenceCount: unique.length,
    independentSourceCount,
    physicalSessionCount: sourceSessionIds.length,
    observedOrdinals,
    ordinalSpread,
    classification,
    synthesisStatus,
    supportedCanonicalOrdinal,
    supportedOrdinalRange,
    confidence: classification === "exact_agreement"
      ? standaloneAbsolutePromotionPolicy.confidenceForExactIndependentAgreement
      : standaloneAbsolutePromotionPolicy.confidenceForBoundedAdjacentAgreement,
    comparativeCorroboration,
    comparativeSummary: comparative
      ? `${comparative.comparativeDirection}; ${comparative.consensusStrength}; ${comparative.canonicalInterpretationStatus}`
      : undefined,
    materialConflict: classification === "material_disagreement",
    additionalEvaluationRequired: classification !== "exact_agreement",
    sourceEvidenceIds: unique.map((record) => record.id).sort(),
    sourceSessionIds,
    limitations,
    policyVersion: STANDALONE_ABSOLUTE_EVIDENCE_SYNTHESIS_VERSION
  };
}

function previewAttribute(attribute: StandaloneAbsoluteAttributeSynthesis): CanonicalOrdinalPromotionPreviewAttribute {
  const gateStatus = attribute.synthesisStatus === "single_ordinal_supported"
    ? "single_ordinal_ready"
    : attribute.synthesisStatus === "bounded_only"
      ? "bounded_only"
      : attribute.synthesisStatus === "promotion_blocked_conflict"
        ? "promotion_blocked_conflict"
        : "not_ready";
  return {
    attributeKey: attribute.attributeKey,
    gateStatus,
    proposedCanonicalOrdinal: attribute.supportedCanonicalOrdinal,
    supportedOrdinalRange: attribute.supportedOrdinalRange,
    confidence: attribute.confidence,
    evidenceRecordIds: attribute.sourceEvidenceIds,
    additionalEvaluationRequired: attribute.additionalEvaluationRequired,
    rationale: rationaleFor(attribute),
    limitations: attribute.limitations
  };
}

function exclusionReason(record: BehavioralEvidenceRecord, attributeKey: BehavioralEquipmentDNAAttributeKey): string | undefined {
  if (record.category !== "structured_internal_equipment_evaluation") return "not structured physical evaluation evidence";
  if (record.timing !== "prospective_equipment_evidence") return "retrospective evidence is excluded";
  if (record.playerSpecific) return "player-specific evidence is excluded";
  if (record.pilotStudyReference) return "pilot study evidence is excluded";
  if (!isStandaloneAbsolute(record)) return "not standalone absolute evidence";
  if (record.numericReference !== undefined) return "standalone synthesis does not consume numeric references";
  if (typeof record.ordinalValue !== "string") return "missing standalone ordinal value";
  if (!ordinalScaleFor(attributeKey).includes(record.ordinalValue)) return "ordinal is not in the attribute scale";
  if (!validateEquipmentDNAAttributeValue(attributeKey, record.ordinalValue).valid) return "ordinal fails canonical registry validation";
  return undefined;
}

function isStandaloneAbsolute(record: BehavioralEvidenceRecord): boolean {
  const raw = rawObject(record.rawValue);
  return raw.evaluationMode === "standalone" || raw.interpretationMode === "standalone_absolute";
}

function uniqueStandaloneRecords(records: readonly BehavioralEvidenceRecord[]): BehavioralEvidenceRecord[] {
  const seen = new Set<string>();
  const result: BehavioralEvidenceRecord[] = [];
  for (const record of records) {
    const key = `${sessionIdFor(record) ?? record.sourceReference}:${record.independenceGroup}:${record.attributeKey}:${record.ordinalValue}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }
  return result.sort((left, right) => left.sourceReference.localeCompare(right.sourceReference));
}

function classify(input: { readonly independentSourceCount: number; readonly ordinalSpread?: number }) {
  if (input.independentSourceCount < standaloneAbsolutePromotionPolicy.minimumIndependentStandaloneSources) {
    return "insufficient_independent_evidence" as const;
  }
  if (input.ordinalSpread === 0) return "exact_agreement" as const;
  if (input.ordinalSpread === 1) return "adjacent_agreement" as const;
  return "material_disagreement" as const;
}

function statusFor(classification: ReturnType<typeof classify>) {
  if (classification === "exact_agreement") return "single_ordinal_supported" as const;
  if (classification === "adjacent_agreement") return "bounded_only" as const;
  if (classification === "material_disagreement") return "promotion_blocked_conflict" as const;
  return "insufficient_independent_evidence" as const;
}

function corroborationFor(
  attributeKey: BehavioralEquipmentDNAAttributeKey,
  classification: ReturnType<typeof classify>,
  range: readonly [string, string] | undefined,
  comparative?: ComparativeEvidenceAttributeSynthesis
): ComparativeCorroborationStatus {
  if (!comparative || comparative.evidenceCount === 0) return "not_available";
  if (comparative.materialConflict) return "material_conflict";
  if (classification === "exact_agreement") return "directionally_consistent";
  if (classification !== "adjacent_agreement" || !range) return "non_dispositive";
  const direction = comparative.comparativeDirection;
  if (attributeKey === "swing_effort") {
    if (direction.includes("more_demand")) return "supports_upper_bound";
    if (direction.includes("less_demand")) return "supports_lower_bound";
  } else {
    if (direction.includes("more_support")) return "supports_upper_bound";
    if (direction.includes("less_support")) return "supports_lower_bound";
  }
  return "non_dispositive";
}

function limitationsFor(input: {
  readonly classification: ReturnType<typeof classify>;
  readonly comparativeCorroboration: ComparativeCorroborationStatus;
  readonly supportedCanonicalOrdinal?: string;
  readonly supportedOrdinalRange?: readonly [string, string];
  readonly independentSourceCount: number;
}): string[] {
  const limitations = [
    "No 0-100 numeric reference was created.",
    "Live recommendation scoring and ranking are unchanged.",
    "Omaha comparative evidence is treated as directional only because it has no approved canonical anchor."
  ];
  if (input.classification === "exact_agreement") {
    limitations.push(`Two independent standalone absolute sources agree on ${input.supportedCanonicalOrdinal}.`);
  }
  if (input.classification === "adjacent_agreement") {
    limitations.push(`Independent standalone sources are adjacent only (${input.supportedOrdinalRange?.join(" to ")}); a third evaluator is required before a single ordinal can be promoted.`);
    limitations.push(`Comparative corroboration is ${input.comparativeCorroboration} and cannot create an absolute ordinal by itself.`);
  }
  if (input.classification === "material_disagreement") {
    limitations.push("Material standalone disagreement blocks promotion until reviewed with additional evidence.");
  }
  if (input.classification === "insufficient_independent_evidence") {
    limitations.push(`${input.independentSourceCount}/${standaloneAbsolutePromotionPolicy.minimumIndependentStandaloneSources} independent standalone absolute sources are available.`);
  }
  return limitations;
}

function rationaleFor(attribute: StandaloneAbsoluteAttributeSynthesis): string {
  if (attribute.supportedCanonicalOrdinal) {
    return `${attribute.attributeKey} may be promoted to ${attribute.supportedCanonicalOrdinal} because two independent standalone absolute physical evaluations exactly agree under policy ${CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION}.`;
  }
  if (attribute.supportedOrdinalRange) {
    return `${attribute.attributeKey} is bounded from ${attribute.supportedOrdinalRange.join(" to ")}. Comparative evidence is recorded as ${attribute.comparativeCorroboration}, but it is not an approved absolute anchor.`;
  }
  if (attribute.materialConflict) {
    return `${attribute.attributeKey} has material standalone disagreement and cannot be promoted.`;
  }
  return `${attribute.attributeKey} does not have enough independent standalone absolute evidence for canonical promotion.`;
}

function ordinalIndex(attributeKey: BehavioralEquipmentDNAAttributeKey, ordinal: string): number {
  return ordinalScaleFor(attributeKey).indexOf(ordinal);
}

function sessionIdFor(record: BehavioralEvidenceRecord): string | undefined {
  const raw = rawObject(record.rawValue);
  if (typeof raw.sessionId === "string") return raw.sessionId;
  const match = record.sourceReference.match(/^physical-bat-evaluation:[^:]+:([^:]+):/);
  return match?.[1];
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
