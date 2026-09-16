import type { EquipmentDNAAttributeNormalizedValue } from "../../attributes/index.js";
import type { EquipmentAttributeConfidence, EquipmentEvaluationMethod } from "../../evidence/index.js";
import type { CanonicalEquipmentDNAProfile } from "../../profiles/index.js";
import type { ComparativeAttributeDirection, ComparativeConsensusStrength, ComparativeEvidenceSynthesisReport } from "../synthesis/index.js";
import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../real-world-behavioral-evaluation.types.js";

export type CanonicalReferenceAnchorStatus =
  | "not_anchor_eligible"
  | "provisional_anchor"
  | "ordinal_anchor"
  | "numeric_anchor"
  | "validated_anchor";

export type CanonicalInterpretationGateStatus =
  | "blocked_no_anchor"
  | "blocked_insufficient_absolute_evidence"
  | "bounded_interpretation_available"
  | "single_ordinal_supported"
  | "numeric_reference_supported";

export type CanonicalAnchorNextEvidenceAction =
  | "use_existing_anchor"
  | "collect_standalone_evaluation"
  | "collect_second_standalone_evaluation"
  | "collect_objective_measurement"
  | "onboard_reference_equipment"
  | "evaluate_reference_equipment"
  | "collect_additional_comparative_evaluation"
  | "resolve_material_conflict"
  | "insufficient_policy_support"
  | "canonical_interpretation_ready";

export type CanonicalReferenceAnchorQuality = "synthetic_or_fixture" | "legacy_derived" | "single_source" | "structured" | "objective" | "validated";

export type CanonicalReferenceAnchorAttributeReview = {
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly variantLabel?: string;
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly canonicalOrdinal?: EquipmentDNAAttributeNormalizedValue;
  readonly numericReferenceAvailable: boolean;
  readonly confidence?: EquipmentAttributeConfidence;
  readonly evaluationMethod?: EquipmentEvaluationMethod;
  readonly anchorStatus: CanonicalReferenceAnchorStatus;
  readonly evidenceQuality: CanonicalReferenceAnchorQuality;
  readonly approvedForInference: boolean;
  readonly limitations: readonly string[];
  readonly lineage: {
    readonly canonicalAnchorSource: string;
    readonly anchorLineage: readonly string[];
    readonly anchorDepth: number;
    readonly circular: boolean;
  };
};

export type CanonicalReferenceAnchorInventory = {
  readonly version: "1.0";
  readonly generatedAt: Date;
  readonly reviews: readonly CanonicalReferenceAnchorAttributeReview[];
};

export type CanonicalPathCandidate = {
  readonly path:
    | "reference_anchored_comparison"
    | "independent_standalone_absolute_evaluation"
    | "objective_measurement"
    | "combined_evidence"
    | "anchor_reference_equipment";
  readonly available: boolean;
  readonly status: "available" | "partial" | "missing" | "blocked";
  readonly reasons: readonly string[];
};

export type CanonicalAnchorAttributePolicyResult = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly comparativeConsensus: ComparativeAttributeDirection;
  readonly consensusStrength: ComparativeConsensusStrength;
  readonly materialConflict: boolean;
  readonly currentReferenceLabel?: string;
  readonly currentReferenceType?: string;
  readonly referenceAnchored: boolean;
  readonly availableAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly rejectedAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly anchorQuality: CanonicalReferenceAnchorStatus | "none";
  readonly standaloneEvidenceCount: number;
  readonly standaloneIndependentSourceCount: number;
  readonly objectiveEvidenceCount: number;
  readonly absolutePathCandidates: readonly CanonicalPathCandidate[];
  readonly boundedCanonicalRange?: readonly [EquipmentDNAAttributeNormalizedValue, EquipmentDNAAttributeNormalizedValue];
  readonly canonicalInterpretationGateStatus: CanonicalInterpretationGateStatus;
  readonly preferredNextAction: CanonicalAnchorNextEvidenceAction;
  readonly canonicalInterpretationStatus: "deferred" | "bounded" | "single_ordinal_supported" | "numeric_supported";
  readonly reasons: readonly string[];
};

export type CanonicalReferenceAnchorStrategyReport = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly synthesisVersion: string;
  readonly physicalSessionCount: number;
  readonly independentEvaluatorCount: number;
  readonly evidenceCount: number;
  readonly attributes: readonly CanonicalAnchorAttributePolicyResult[];
  readonly omahaAnchorRequirements: {
    readonly catalogOnboardingNeeded: true;
    readonly behavioralEvaluationNeeded: true;
    readonly independentEvaluationsNeeded: number;
    readonly objectiveEvidenceNeeded: boolean;
    readonly canonicalOrdinalRequired: true;
    readonly numericReferenceRequired: false;
    readonly estimatedEvidenceGap: readonly string[];
  };
  readonly maturity: "behavioral_evidence_synthesized" | "anchor_path_identified" | "canonical_interpretation_ready";
  readonly canonicalProfileReady: false;
  readonly genuineStudyReady: false;
  readonly liveRecommendationActivationAllowed: false;
};

export type CanonicalReferenceAnchorStrategyInput = {
  readonly synthesis: ComparativeEvidenceSynthesisReport;
  readonly candidateAnchors: readonly CanonicalReferenceAnchorAttributeReview[];
  readonly evidence: readonly BehavioralEvidenceRecord[];
};

export type CanonicalReferenceAnchorValidationResult = {
  readonly verdict: "pass" | "fail";
  readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly details: string }[];
};

export type CanonicalReferenceAnchorProfileReviewInput = {
  readonly profile: CanonicalEquipmentDNAProfile;
  readonly syntheticFixture?: boolean;
};

