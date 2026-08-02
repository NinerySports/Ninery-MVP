import type { EquipmentDNAProfile, EquipmentCertificationFilter, EquipmentCategoryFilter } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";

export const COMPATIBILITY_SCORING_CONFIG_VERSION = "compatibility-mvp-v1";

export type CompatibilityDimensionCode =
  | "BAT_CONTROL_FIT"
  | "SWING_FEEL_BALANCE_FIT"
  | "SWING_WEIGHT_FIT"
  | "BARREL_FORGIVENESS_FIT"
  | "SWEET_SPOT_FIT"
  | "POWER_POTENTIAL_FIT"
  | "CONFIDENCE_BUILDING_FIT"
  | "TRANSITION_READINESS_FIT"
  | "DEVELOPMENT_GOAL_FIT"
  | "GROWTH_USEFUL_LIFE_FIT"
  | "EQUIPMENT_PREFERENCE_FIT"
  | "BUDGET_FIT"
  | "EVIDENCE_QUALITY"
  | "PROFILE_COMPLETENESS";

export type CompatibilityBand =
  | "Exceptional Match"
  | "Excellent Match"
  | "Very Good Match"
  | "Good Match"
  | "Conditional Match"
  | "Not Recommended";

export type CompatibilityConfidenceBand = "low" | "medium" | "high" | "validated";

export type VariantPreferences = {
  length?: number;
  drop?: number;
};

export type BudgetPreferences = {
  minimum?: number;
  maximum?: number;
};

export type CompatibilityRequestContext = {
  playerId: string;
  playerDNAProfileId?: string;
  certification: EquipmentCertificationFilter;
  category: EquipmentCategoryFilter;
  variantPreferences?: VariantPreferences;
  budget?: BudgetPreferences;
  resultLimit?: number;
  scoringConfigVersion?: string;
  includeInternalDraftProfiles?: boolean;
  minimumMatchScore?: number;
  minimumEvidenceConfidence?: number;
  forceRegenerate?: boolean;
};

export type CompatibilityInput = {
  playerDNA: PlayerDNAProfileResult;
  equipment: EquipmentDNAProfile[];
  context: CompatibilityRequestContext;
};

export type HardFilterReason = {
  code: string;
  message: string;
  sourceCodes: string[];
};

export type EligibilityCheckResult = {
  equipmentId: string;
  eligible: boolean;
  reasons: HardFilterReason[];
};

export type DynamicWeightAdjustment = {
  goal: PrimaryHittingGoal;
  dimension: CompatibilityDimensionCode;
  delta: number;
  reason: string;
};

export type DimensionScore = {
  code: CompatibilityDimensionCode;
  playerTarget: string;
  equipmentCapability: string;
  rawScore: number;
  weight: number;
  weightedContribution: number;
  confidenceContribution: number;
  appliedRules: string[];
  sourceCodes: string[];
  reason: string;
  missingInformation: string[];
  tradeoff: boolean;
};

export type RecommendationConfidence = {
  score: number;
  band: CompatibilityConfidenceBand;
  reasons: string[];
  missingInformation: string[];
};

export type CompatibilityExplanation = {
  summary: string;
  topReasons: Array<{ dimension: CompatibilityDimensionCode; contribution: number; reason: string }>;
  tradeoffs: string[];
  uncertainties: string[];
  whatCouldChange: string[];
};

export type RecommendationTrace = {
  traceId: string;
  playerDNAProfileId: string;
  playerDNAProfileVersion: string;
  equipmentDNAProfileId: string;
  equipmentDNAProfileVersion: number;
  equipmentId: string;
  variantId?: string;
  scoringConfigVersion: string;
  eligibilityChecks: EligibilityCheckResult[];
  dimensions: DimensionScore[];
  initialWeights: Record<CompatibilityDimensionCode, number>;
  adjustedWeights: Record<CompatibilityDimensionCode, number>;
  dynamicWeightAdjustments: DynamicWeightAdjustment[];
  penalties: Array<{ code: string; amount: number; reason: string }>;
  bonuses: Array<{ code: string; amount: number; reason: string }>;
  finalScore: number;
  confidence: RecommendationConfidence;
  rank?: number;
  tieBreakRulesUsed: string[];
  generatedAt: string;
};

export type CompatibilityResultItem = {
  equipment: EquipmentDNAProfile;
  overallMatchScore: number;
  matchBand: CompatibilityBand;
  confidence: RecommendationConfidence;
  dimensions: DimensionScore[];
  explanation: CompatibilityExplanation;
  trace: RecommendationTrace;
  label?: string;
};

export type WhyNotComparison = {
  sourceEquipmentId: string;
  targetEquipmentId: string;
  sourceRank?: number;
  targetRank?: number;
  sourceAdvantages: string[];
  targetMayBePreferableWhen: string[];
  summary: string;
};

export type CompatibilityRunResult = {
  recommendationId?: string;
  playerId: string;
  playerDNAProfileId: string;
  scoringConfigVersion: string;
  primaryRecommendation?: CompatibilityResultItem;
  alternatives: CompatibilityResultItem[];
  filteredEquipment: EligibilityCheckResult[];
  nonRecommended: CompatibilityResultItem[];
  confidence: RecommendationConfidence;
  traceSummary: {
    inputHash: string;
    generatedAt: string;
    eligibleCount: number;
    filteredCount: number;
  };
  generatedAt: string;
};
