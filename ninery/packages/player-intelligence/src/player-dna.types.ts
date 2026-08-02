export const playerDNAAttributes = [
  "batControl",
  "swingSpeed",
  "powerPotential",
  "contactConsistency",
  "physicalStrength",
  "confidence",
  "transitionReadiness",
  "growthStability",
  "equipmentAwareness",
  "profileCompleteness"
] as const;

export type PlayerDNAAttribute = (typeof playerDNAAttributes)[number];

export type PreferredSwingFeel = "light" | "balanced" | "slightly_end_loaded" | "end_loaded" | "unknown";
export type DevelopmentStage = "foundation" | "developing" | "competitive" | "performance" | "advanced";
export type PrimaryHittingGoal =
  | "improve_contact"
  | "improve_power"
  | "improve_bat_control"
  | "increase_swing_speed"
  | "build_confidence"
  | "prepare_for_transition"
  | "maintain_current_fit"
  | "unknown";
export type GrowthStatus = "stable" | "moderate_growth" | "rapid_growth" | "insufficient_data";
export type ProfileConfidenceLevel = "low" | "medium" | "high" | "validated";

export type PlayerDNAScores = Record<PlayerDNAAttribute, number>;

export type PlayerDNACategories = {
  preferredSwingFeel: PreferredSwingFeel;
  developmentStage: DevelopmentStage;
  primaryHittingGoal: PrimaryHittingGoal;
  currentEquipmentAssessment?: string;
  growthStatus: GrowthStatus;
  profileConfidenceLevel: ProfileConfidenceLevel;
};

export type PlayerDNAExplanation = {
  attribute: PlayerDNAAttribute;
  score: number;
  confidence: ProfileConfidenceLevel;
  summary: string;
  reasons: string[];
  sourceCodes: string[];
  ruleIds: string[];
  positiveAdjustments: number;
  negativeAdjustments: number;
  finalNormalizedScore: number;
  confidenceContribution: number;
  missingInformation: string[];
};

export type PlayerDNAProfileResult = {
  profileId: string;
  playerId: string;
  batMatchSessionId?: string;
  version: string;
  status?: "generated" | "archived";
  scoringRuleVersion: string;
  inputHash: string;
  regenerationReason?: string;
  scores: PlayerDNAScores;
  categories: PlayerDNACategories;
  confidence: {
    score: number;
    level: ProfileConfidenceLevel;
    factors: Record<string, number>;
    missingInformation: string[];
  };
  explanations: PlayerDNAExplanation[];
  missingInformation: string[];
  inputSnapshot: PlayerDNAInput;
  scoreBreakdown: unknown;
  generatedAt: string;
};

export type PlayerDNAInput = {
  player: {
    id: string;
    dateOfBirth?: string;
    sport?: string;
    status?: string;
  };
  playerProfile?: {
    bats?: string;
    throws?: string;
    throwingHand?: string;
    battingSide?: string;
    primaryPosition?: string;
    secondaryPosition?: string;
    competitionLevel?: string;
    practiceFrequency?: string;
    experienceYears?: number;
  };
  growthMeasurements?: Array<{
    heightCm?: number;
    weightKg?: number;
    measuredAt: string;
    source?: string;
    confidence?: number;
  }>;
  batMatchSession?: {
    id: string;
    status?: string;
    type?: string;
    version?: number;
    confidenceScore?: number;
    completedAt?: string;
  };
  answers?: Array<{
    questionCode: string;
    answer: unknown;
  }>;
  decisionSignals?: Array<{
    signalCode: string;
    signalName: string;
    confidence: number;
  }>;
};

export type GeneratePlayerDNAOptions = {
  profileId?: string;
  generatedAt?: string;
  scoringRuleVersion?: string;
  forceRegenerate?: boolean;
  regenerationReason?: string;
  batMatchSessionId?: string;
};

export type GeneratePlayerDNAFromDatabaseOptions = {
  batMatchSessionId?: string;
  forceRegenerate?: boolean;
  regenerationReason?: string;
  scoringRuleVersion?: string;
};
