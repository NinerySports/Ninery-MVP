import type { EquipmentAttributeConfidence } from "../../evidence/index.js";
import type { BehavioralEquipmentDNAAttributeKey, BehavioralEvidenceRecord } from "../real-world-behavioral-evaluation.types.js";

export type ComparativeObservation = "clearly_less" | "somewhat_less" | "similar" | "somewhat_more" | "clearly_more";

export type ComparativeDimensionDirection =
  | "less"
  | "less_or_similar"
  | "similar"
  | "more_or_similar"
  | "more"
  | "conflicting"
  | "insufficient";

export type ComparativeAttributeDirection =
  | "clearly_less_demand"
  | "less_demand"
  | "similar_demand"
  | "more_demand"
  | "clearly_more_demand"
  | "clearly_less_support"
  | "less_support"
  | "similar_support"
  | "more_support"
  | "clearly_more_support"
  | "mixed"
  | "insufficient";

export type ComparativeConsensusStrength = "insufficient" | "weak" | "moderate" | "strong";

export type CanonicalInterpretationStatus =
  | "available"
  | "deferred_reference_unanchored"
  | "deferred_insufficient_consensus"
  | "deferred_material_conflict"
  | "deferred_unsupported_evidence";

export type ComparativeNextEvidenceAction =
  | "collect_third_independent_comparative_evaluation"
  | "collect_standalone_absolute_evaluation"
  | "obtain_objective_measurement"
  | "onboard_and_anchor_reference_equipment"
  | "resolve_conflicting_dimension"
  | "sufficient_for_canonical_interpretation"
  | "insufficient_evidence";

export type ComparativeEvidenceDimensionResult = {
  readonly dimensionKey: string;
  readonly evidenceCount: number;
  readonly sessionCount: number;
  readonly independentSourceCount: number;
  readonly observations: readonly {
    readonly evidenceId: string;
    readonly sessionId: string;
    readonly evaluatorId: string;
    readonly observation: ComparativeObservation;
    readonly normalizedDirection: number;
  }[];
  readonly direction: ComparativeDimensionDirection;
  readonly agreement: ComparativeConsensusStrength;
  readonly materialConflict: boolean;
  readonly conflictSeverity: "none" | "minor" | "material";
};

export type ComparativeEvidenceAttributeSynthesis = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly evidenceCount: number;
  readonly sessionCount: number;
  readonly independentSourceCount: number;
  readonly dimensionResults: readonly ComparativeEvidenceDimensionResult[];
  readonly comparativeDirection: ComparativeAttributeDirection;
  readonly consensusStrength: ComparativeConsensusStrength;
  readonly materialConflict: boolean;
  readonly conflictingDimensions: readonly string[];
  readonly supportingDimensions: readonly string[];
  readonly referenceContext: {
    readonly referenceType?: string;
    readonly referenceLabel?: string;
    readonly referenceAnchored: boolean;
    readonly limitations: readonly string[];
  };
  readonly confidence: EquipmentAttributeConfidence;
  readonly canonicalInterpretationStatus: CanonicalInterpretationStatus;
  readonly canonicalOrdinal?: string;
  readonly numericReference?: number;
  readonly limitations: readonly string[];
  readonly nextEvidenceAction: ComparativeNextEvidenceAction;
  readonly synthesisVersion: "1.0";
  readonly consensusPolicyVersion: "1.0";
  readonly canonicalGateVersion: "1.0";
};

export type ComparativeEvidenceSynthesisReport = {
  readonly version: "1.0";
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly physicalSessionCount: number;
  readonly independentEvaluatorCount: number;
  readonly evidenceCount: number;
  readonly attributes: readonly ComparativeEvidenceAttributeSynthesis[];
  readonly canonicalProfileReady: false;
  readonly genuineStudyReady: false;
  readonly liveRecommendationActivationAllowed: false;
};

export type ComparativeEvidenceSynthesisInput = {
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly evidence: readonly BehavioralEvidenceRecord[];
};

