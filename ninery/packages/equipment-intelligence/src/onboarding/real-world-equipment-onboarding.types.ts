import type {
  EquipmentDNAAttributeKey,
  EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";

export type RealWorldEquipmentOnboardingVersion = "1.0";

export type RealWorldEquipmentEvidenceClassification =
  | "manufacturer_specification"
  | "retailer_product_specification"
  | "structured_internal_evaluation"
  | "physical_equipment_verification"
  | "observational_evidence"
  | "derived_internal_reference"
  | "unknown_unverified";

export type RealWorldEquipmentEvidenceNature = "objective" | "claimed" | "derived" | "observed" | "unknown";

export type RealWorldEquipmentOnboardingStatus =
  | "identity_ready"
  | "specification_ready"
  | "evidence_incomplete"
  | "canonical_profile_partial"
  | "canonical_profile_ready"
  | "genuine_study_ready"
  | "recommendation_activation_blocked";

export type RealWorldEquipmentVariantPacket = {
  readonly sku: string;
  readonly lengthInches: number;
  readonly weightOunces: number;
  readonly dropWeight: number;
  readonly modelIdentifier?: string;
};

export type RealWorldEquipmentEvidencePacket = {
  readonly evidenceKey: string;
  readonly classification: RealWorldEquipmentEvidenceClassification;
  readonly nature: RealWorldEquipmentEvidenceNature;
  readonly sourceName: string;
  readonly sourceReference: string;
  readonly method: "direct_specification" | "manual_review" | "standardized_rubric" | "instrument_measurement";
  readonly attributeKey?: EquipmentDNAAttributeKey;
  readonly targetLevel?: "equipment" | "variant";
  readonly variantSku?: string;
  readonly rawValue: unknown;
  readonly normalizedValue?: EquipmentDNAAttributeNormalizedValue;
  readonly unit?: string;
  readonly confidence?: "validated" | "high" | "moderate" | "estimated";
  readonly notes: string;
};

export type RealWorldEquipmentOnboardingPacket = {
  readonly version: RealWorldEquipmentOnboardingVersion;
  readonly productKey: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly displayName: string;
  readonly modelYear: number;
  readonly category: "bat";
  readonly certification: "USA" | "USSSA" | "BBCOR" | "none" | "unknown";
  readonly status: "coming_soon" | "active" | "legacy" | "archived";
  readonly barrelDiameter: number;
  readonly construction: string;
  readonly material: string;
  readonly productIdentifier: string;
  readonly constructionFamily?: string;
  readonly barrel?: string;
  readonly handle?: string;
  readonly connection?: string;
  readonly endCap?: string;
  readonly variants: readonly RealWorldEquipmentVariantPacket[];
  readonly evidence: readonly RealWorldEquipmentEvidencePacket[];
};

export type RealWorldEquipmentPhysicalVerificationInput = {
  readonly manufacturer: string;
  readonly model: string;
  readonly modelYear: number;
  readonly certification: string;
  readonly lengthInches: number;
  readonly weightOunces: number;
  readonly dropWeight: number;
  readonly productIdentifier?: string;
};

export type RealWorldEquipmentPhysicalVerificationResult = {
  readonly verified: boolean;
  readonly matched: readonly string[];
  readonly mismatched: readonly string[];
  readonly unresolved: readonly string[];
  readonly reasons: readonly string[];
};

export type RealWorldEquipmentAttributeCoverage = {
  readonly key: EquipmentDNAAttributeKey;
  readonly state: "evaluation_supported" | "claim_only" | "unresolved";
  readonly ordinalEvaluationAllowed: boolean;
  readonly numericReferenceAllowed: boolean;
  readonly evidenceKeys: readonly string[];
  readonly reason: string;
};

export type RealWorldEquipmentOnboardingReview = {
  readonly version: RealWorldEquipmentOnboardingVersion;
  readonly productKey: string;
  readonly productLabel: string;
  readonly variantSkus: readonly string[];
  readonly statuses: readonly RealWorldEquipmentOnboardingStatus[];
  readonly identityReady: boolean;
  readonly specificationReady: boolean;
  readonly canonicalProfileReady: boolean;
  readonly genuineStudyReady: boolean;
  readonly liveRecommendationActivationAllowed: false;
  readonly requiredCoverage: readonly RealWorldEquipmentAttributeCoverage[];
  readonly optionalCoverage: readonly RealWorldEquipmentAttributeCoverage[];
  readonly unresolvedAttributes: readonly EquipmentDNAAttributeKey[];
  readonly conflictingEvidence: readonly string[];
  readonly numericReferencesCreated: readonly EquipmentDNAAttributeKey[];
  readonly evidenceInventory: readonly RealWorldEquipmentEvidencePacket[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
};

export class RealWorldEquipmentOnboardingError extends Error {}
export class RealWorldEquipmentOnboardingValidationError extends RealWorldEquipmentOnboardingError {}
export class UnsupportedNumericPrecisionError extends RealWorldEquipmentOnboardingError {}
