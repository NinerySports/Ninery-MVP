import type { EquipmentAttributeConfidence } from "../../evidence/index.js";
import type { ComparativeEvidenceAttributeSynthesis } from "../synthesis/index.js";
import type {
  BehavioralEquipmentDNAAttributeKey,
  BehavioralEvidenceRecord
} from "../real-world-behavioral-evaluation.types.js";

export type StandaloneAbsoluteAgreementClassification =
  | "exact_agreement"
  | "adjacent_agreement"
  | "material_disagreement"
  | "insufficient_independent_evidence";

export type StandaloneAbsoluteSynthesisStatus =
  | "single_ordinal_supported"
  | "bounded_only"
  | "promotion_blocked_conflict"
  | "insufficient_independent_evidence";

export type CanonicalOrdinalPromotionGateStatus =
  | "single_ordinal_ready"
  | "bounded_only"
  | "promotion_blocked_conflict"
  | "not_ready";

export type ComparativeCorroborationStatus =
  | "not_available"
  | "non_dispositive"
  | "supports_lower_bound"
  | "supports_upper_bound"
  | "directionally_consistent"
  | "directionally_inconsistent"
  | "material_conflict";

export type StandaloneAbsoluteEvidenceExclusion = {
  readonly evidenceRecordId: string;
  readonly attributeKey?: string;
  readonly reason: string;
};

export type StandaloneAbsoluteAttributeSynthesis = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly qualifyingEvidence: readonly BehavioralEvidenceRecord[];
  readonly excludedEvidence: readonly StandaloneAbsoluteEvidenceExclusion[];
  readonly evidenceCount: number;
  readonly independentSourceCount: number;
  readonly physicalSessionCount: number;
  readonly observedOrdinals: readonly string[];
  readonly ordinalSpread: number | undefined;
  readonly classification: StandaloneAbsoluteAgreementClassification;
  readonly synthesisStatus: StandaloneAbsoluteSynthesisStatus;
  readonly supportedCanonicalOrdinal?: string;
  readonly supportedOrdinalRange?: readonly [string, string];
  readonly confidence: EquipmentAttributeConfidence;
  readonly comparativeCorroboration: ComparativeCorroborationStatus;
  readonly comparativeSummary?: string;
  readonly materialConflict: boolean;
  readonly additionalEvaluationRequired: boolean;
  readonly sourceEvidenceIds: readonly string[];
  readonly sourceSessionIds: readonly string[];
  readonly limitations: readonly string[];
  readonly policyVersion: "1.0";
};

export type StandaloneAbsoluteEvidenceSynthesisReport = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly attributes: readonly StandaloneAbsoluteAttributeSynthesis[];
  readonly promotionCandidates: readonly StandaloneAbsoluteAttributeSynthesis[];
  readonly boundedAttributes: readonly StandaloneAbsoluteAttributeSynthesis[];
  readonly blockedAttributes: readonly StandaloneAbsoluteAttributeSynthesis[];
  readonly numericReferenceCreated: false;
  readonly liveRecommendationActivationAllowed: false;
};

export type CanonicalOrdinalPromotionPreviewAttribute = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly gateStatus: CanonicalOrdinalPromotionGateStatus;
  readonly proposedCanonicalOrdinal?: string;
  readonly supportedOrdinalRange?: readonly [string, string];
  readonly confidence: EquipmentAttributeConfidence;
  readonly evidenceRecordIds: readonly string[];
  readonly additionalEvaluationRequired: boolean;
  readonly rationale: string;
  readonly limitations: readonly string[];
};

export type CanonicalOrdinalPromotionPreview = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly attributes: readonly CanonicalOrdinalPromotionPreviewAttribute[];
  readonly promotionPermitted: boolean;
  readonly promotedAttributeCount: number;
  readonly boundedAttributeCount: number;
  readonly blockedAttributeCount: number;
  readonly numericReferenceCreated: false;
  readonly liveRecommendationActivationAllowed: false;
};

export type StandaloneAbsoluteSynthesisInput = {
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly evidence: readonly BehavioralEvidenceRecord[];
  readonly comparativeAttributes?: readonly ComparativeEvidenceAttributeSynthesis[];
};
