import type { DecisionConversation } from "./decision-conversation-types";

export type BackendConfidence = {
  score?: number;
  band?: string;
  level?: string;
  reasons?: string[];
  missingInformation?: string[];
};

export type BackendEquipmentVariant = {
  id?: string;
  lengthInches?: number;
  weightOunces?: number;
  dropWeight?: number;
  sku?: string;
};

export type BackendEquipment = {
  equipmentId?: string;
  variantId?: string;
  manufacturer?: string;
  model?: string;
  modelYear?: number;
  certification?: string;
  category?: string;
  construction?: string;
  material?: string;
  selectedVariant?: BackendEquipmentVariant;
  availableVariants?: BackendEquipmentVariant[];
  primaryPersonality?: {
    personalityName?: string;
    rationale?: string;
  };
};

export type BackendRecommendationItem = {
  equipment?: BackendEquipment;
  overallMatchScore?: number;
  matchBand?: string;
  confidence?: BackendConfidence;
  explanation?: {
    summary?: string;
    topReasons?: Array<{
      dimension?: string;
      contribution?: number;
      reason?: string;
    }>;
    tradeoffs?: string[];
    uncertainties?: string[];
    whatCouldChange?: string[];
  };
  dimensions?: Array<{
    code?: string;
    reason?: string;
    missingInformation?: string[];
    tradeoff?: boolean;
  }>;
  trace?: {
    traceId?: string;
  };
  label?: string;
};

export type BackendPlayerDNA = {
  scores?: Record<string, number>;
  categories?: {
    preferredSwingFeel?: string;
    developmentStage?: string;
    primaryHittingGoal?: string;
    growthStatus?: string;
    profileConfidenceLevel?: string;
  };
  confidence?: BackendConfidence & {
    factors?: Record<string, number>;
  };
  explanations?: Array<{
    attribute?: string;
    score?: number;
    confidence?: string;
    summary?: string;
    reasons?: string[];
    sourceCodes?: string[];
    ruleIds?: string[];
    missingInformation?: string[];
  }>;
  missingInformation?: string[];
};

export type BackendDemoRecommendationResponse = {
  developmentOnly?: boolean;
  player?: {
    id?: string;
    name?: string;
    age?: number;
    competitionLevel?: string;
    currentBat?: string;
  };
  playerDNA?: BackendPlayerDNA;
  recommendations?: {
    primaryRecommendation?: BackendRecommendationItem;
    alternatives?: BackendRecommendationItem[];
    filteredEquipment?: unknown[];
  };
  traceSummary?: {
    inputHash?: string;
    generatedAt?: string;
    eligibleCount?: number;
    filteredCount?: number;
  };
};

export type MatchPresentation = {
  roundedScore: number;
  label: string;
};

export type RecommendationCardViewModel = {
  id: string;
  brand?: string;
  model: string;
  displayName: string;
  variant?: string;
  size?: string;
  certification?: string;
  leagueApprovalLabel?: string;
  matchScore?: number;
  matchPresentation?: MatchPresentation;
  matchContext?: string;
  heroRecommendationCopy?: string;
  matchBand?: string;
  confidenceLabel?: string;
  confidenceScore?: number;
  summary: string;
  whyChosenSummary?: string;
  reasons: string[];
  tradeoffs: string[];
  missingInformation: string[];
};

export type PlayerDNAAttributeViewModel = {
  key: string;
  label: string;
  score?: number;
  confidence?: string;
  summary?: string;
};

export type PlayerDNAGroupViewModel = {
  key: "strengths" | "developing" | "moreInformation";
  title: string;
  attributes: PlayerDNAAttributeViewModel[];
};

export type DecisionSnapshotRowViewModel = {
  label: string;
  value: string;
};

export type RecommendationResultsViewModel = {
  player: {
    id: string;
    name: string;
    firstName?: string;
    age?: number;
    competitionLevel?: string;
    displayContext: string;
    currentBat?: string;
    currentBatParts: string[];
  };
  primaryRecommendation?: RecommendationCardViewModel;
  alternatives: RecommendationCardViewModel[];
  reassurance: {
    lead: string;
    body: string;
  };
  decisionSnapshot: DecisionSnapshotRowViewModel[];
  decisionConversation: DecisionConversation;
  playerDNAGroups: PlayerDNAGroupViewModel[];
  playerDNA: PlayerDNAAttributeViewModel[];
  additionalPlayerDNA: PlayerDNAAttributeViewModel[];
  overallConfidence?: {
    label: string;
    score?: number;
    explanation?: string;
  };
  missingInformation: string[];
  traceSummary?: {
    generatedAt?: string;
    eligibleCount?: number;
    filteredCount?: number;
  };
};

