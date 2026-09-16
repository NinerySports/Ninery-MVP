import type {
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";
import type { EquipmentAttributeConfidence } from "../evidence/index.js";
import type { StandaloneAbsoluteAttributeSynthesis } from "./standalone/index.js";
import type { ComparativeEvidenceAttributeSynthesis } from "./synthesis/index.js";

export type RealWorldBehavioralEvaluationVersion = "1.0";

export type BehavioralEquipmentDNAAttributeKey =
  | "swing_effort"
  | "forgiveness"
  | "sweet_spot_support"
  | "bat_control_support";

export type BehavioralEvidenceCategory =
  | "objective_measured"
  | "manufacturer_technical"
  | "independent_expert"
  | "structured_internal_equipment_evaluation"
  | "anecdotal_player_specific"
  | "marketing_claim"
  | "unknown";

export type BehavioralEvidenceTiming = "prospective_equipment_evidence" | "retrospective_validation_evidence";

export type BehavioralEvaluationStatus =
  | "resolved_ordinal"
  | "resolved_numeric"
  | "insufficient_evidence"
  | "blocked_conflict"
  | "rejected_contaminated";

export type BehavioralEvidenceRecord = {
  readonly id: string;
  readonly attributeKey?: EquipmentDNAAttributeKey | string;
  readonly category: BehavioralEvidenceCategory;
  readonly timing: BehavioralEvidenceTiming;
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly independenceGroup: string;
  readonly rawValue: unknown;
  readonly ordinalValue?: EquipmentDNAAttributeNormalizedValue;
  readonly numericReference?: number;
  readonly confidence?: EquipmentAttributeConfidence;
  readonly notes: string;
  readonly playerSpecific?: boolean;
  readonly pilotStudyReference?: string;
};

export type BehavioralEvidenceGap = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly needed: readonly string[];
};

export type BehavioralAttributeEvaluationResult = {
  readonly attributeKey: BehavioralEquipmentDNAAttributeKey;
  readonly evaluationStatus: BehavioralEvaluationStatus;
  readonly ordinalValue?: EquipmentDNAAttributeNormalizedValue;
  readonly numericReference?: number;
  readonly confidence: EquipmentAttributeConfidence;
  readonly evidenceCount: number;
  readonly evidenceTypes: readonly BehavioralEvidenceCategory[];
  readonly supportingEvidence: readonly BehavioralEvidenceRecord[];
  readonly conflictingEvidence: readonly BehavioralEvidenceRecord[];
  readonly missingEvidence: readonly string[];
  readonly comparativeSynthesis?: ComparativeEvidenceAttributeSynthesis;
  readonly standaloneSynthesis?: StandaloneAbsoluteAttributeSynthesis;
  readonly rationale: string;
  readonly limitations: readonly string[];
  readonly provenance: {
    readonly prospectiveEquipmentEvidenceOnly: boolean;
    readonly pilotStudyEvidenceUsed: boolean;
    readonly playerSpecificEvidenceUsed: boolean;
    readonly retrospectiveValidationEvidenceUsed: boolean;
  };
  readonly evaluationVersion: RealWorldBehavioralEvaluationVersion;
};

export type BehavioralEvaluationReadiness = {
  readonly identityReady: boolean;
  readonly specificationReady: boolean;
  readonly behavioralEvidencePartial: boolean;
  readonly behavioralEvidenceReady: boolean;
  readonly canonicalProfileReady: boolean;
  readonly genuineStudyReady: boolean;
  readonly liveActivationAllowed: false;
  readonly requiredBehavioralAttributesResolved: readonly BehavioralEquipmentDNAAttributeKey[];
  readonly requiredBehavioralAttributesUnresolved: readonly BehavioralEquipmentDNAAttributeKey[];
  readonly confidenceThresholdsSatisfied: boolean;
  readonly materialConflicts: readonly BehavioralEquipmentDNAAttributeKey[];
};

export type RealWorldBehavioralEvaluationReport = {
  readonly version: RealWorldBehavioralEvaluationVersion;
  readonly equipmentId: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly evidenceInventory: readonly BehavioralEvidenceRecord[];
  readonly attributes: readonly BehavioralAttributeEvaluationResult[];
  readonly evidenceQuality: Record<BehavioralEvidenceCategory, number>;
  readonly gaps: readonly BehavioralEvidenceGap[];
  readonly readiness: BehavioralEvaluationReadiness;
  readonly validation: {
    readonly verdict: "pass" | "fail";
    readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly details: string }[];
  };
};
