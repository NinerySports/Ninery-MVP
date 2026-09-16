export const LEGACY_BALANCE_SEMANTIC_AUDIT_VERSION = "1.0";
export const BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION = "1.0";
export const BALANCE_PROFILE_NUMERIC_DIRECTION = "balanced_to_end_loaded";
export const LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION = "1.0";

export type LegacyBalanceSemanticMeaning =
  | "balanced_tendency"
  | "end_loaded_tendency"
  | "balance_support"
  | "player_manageability"
  | "mixed_or_ambiguous";

export type LegacyBalanceConversionStrategy = "direct" | "inverse" | "unsupported";

export type BalanceNumericReferenceFindingCode =
  | "LEGACY_BALANCE_SEMANTICS_CONFIRMED"
  | "LEGACY_BALANCE_SEMANTICS_AMBIGUOUS"
  | "DIRECT_CONVERSION_APPROVED"
  | "INVERSE_CONVERSION_APPROVED"
  | "LEGACY_CONVERSION_BLOCKED"
  | "CANONICAL_DIRECTION_CONFIRMED"
  | "NUMERIC_REFERENCE_VALID"
  | "NUMERIC_REFERENCE_INVALID"
  | "ORDINAL_CONSISTENT"
  | "ORDINAL_INCONSISTENT"
  | "CONFIDENCE_SUFFICIENT"
  | "CONFIDENCE_INSUFFICIENT"
  | "SOURCE_SELECTION_ALLOWED"
  | "SOURCE_SELECTION_BLOCKED"
  | "BALANCE_REDUCED_RESIDUAL"
  | "BALANCE_DID_NOT_REDUCE_RESIDUAL"
  | "OBJECTIVE_MEASUREMENT_STILL_REQUIRED";

export type LegacyBalanceSemanticAudit = {
  readonly version: typeof LEGACY_BALANCE_SEMANTIC_AUDIT_VERSION;
  readonly legacyField: "balance";
  readonly characteristicCode?: string;
  readonly scale: "0_100";
  readonly semanticMeaning: LegacyBalanceSemanticMeaning;
  readonly lowValueMeaning: string;
  readonly highValueMeaning: string;
  readonly canonicalDirection: LegacyBalanceConversionStrategy;
  readonly intrinsicEnoughForMigration: boolean;
  readonly engineUsage: {
    readonly scoringDimensions: readonly string[];
    readonly directScoring: boolean;
    readonly inverseScoring: boolean;
    readonly confidenceUse: boolean;
    readonly reasonUse: boolean;
    readonly tradeoffUse: boolean;
    readonly rankingUse: boolean;
  };
  readonly evidence: readonly string[];
  readonly cautions: readonly string[];
  readonly conclusion: string;
};

export type BalanceProfileOrdinal =
  | "very_balanced"
  | "balanced"
  | "slightly_end_loaded"
  | "end_loaded"
  | "very_end_loaded";

export type LegacyBalanceConversionResult = {
  readonly sourceValue: number;
  readonly canonicalValue?: number;
  readonly strategy: LegacyBalanceConversionStrategy;
  readonly mappingVersion: typeof LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION;
  readonly explanation: string;
};

export type BalanceNumericReferenceValidationResult = {
  readonly valid: boolean;
  readonly findings: readonly BalanceNumericReferenceFindingCode[];
  readonly errors: readonly string[];
};

export type BalanceProfileNumericReference = {
  readonly attributeKey: "balance_profile";
  readonly sourceValue: number;
  readonly canonicalValue: number;
  readonly ordinal: BalanceProfileOrdinal;
  readonly scale: "0_100";
  readonly direction: typeof BALANCE_PROFILE_NUMERIC_DIRECTION;
  readonly conversionStrategy: LegacyBalanceConversionStrategy;
  readonly mappingVersion: typeof LEGACY_BALANCE_TO_CANONICAL_MAPPING_VERSION;
  readonly referenceVersion: typeof BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION;
  readonly sourceField: "balance";
  readonly sourceCharacteristicCode: "SWING_BALANCE";
  readonly sourceReference: string;
  readonly method: "legacy_preserved";
  readonly confidence: "moderate";
  readonly evidenceRecordId?: string;
  readonly rationale: string;
};
