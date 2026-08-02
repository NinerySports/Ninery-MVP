export type DecisionConversation = {
  version: "1.0";
  recommendationSummary: RecommendationSummary;
  playerFit: PlayerFitNarrative;
  tradeoffSummary: TradeoffSummary;
  alternativeExplanations: AlternativeExplanation[];
  confidenceExplanation: ConfidenceExplanation;
  futureGuidance: FutureGuidance;
  uncertaintyDisclosure?: UncertaintyDisclosure;
};

export type RecommendationSummary = {
  heading: string;
  equipmentName: string;
  summary: string;
  primaryReason: string;
  supportingReasons: string[];
};

export type PlayerFitNarrative = {
  heading: string;
  summary: string;
  strengthsUsed: EvidencePoint[];
  developingAreasSupported: EvidencePoint[];
};

export type TradeoffSummary = {
  heading: string;
  summary: string;
  expectedBenefits: string[];
  compromises: string[];
  unknowns?: string[];
};

export type AlternativeExplanation = {
  equipmentId: string;
  equipmentName: string;
  matchLabel: string;
  summary: string;
  whyItIsStrong: string;
  whyItWasNotSelected: string;
  bestFor?: string;
  reconsiderWhen?: string;
};

export type ConfidenceExplanation = {
  heading: string;
  level: "high" | "moderate" | "low";
  label: string;
  summary: string;
  supportingEvidence: EvidencePoint[];
  limitingFactors: EvidencePoint[];
};

export type FutureGuidance = {
  heading: string;
  summary: string;
  keepDoing: GuidanceItem[];
  watchFor: GuidanceItem[];
  reassessWhen: ReassessmentTrigger[];
  longTermOutlook?: string;
};

export type UncertaintyDisclosure = {
  heading: string;
  summary: string;
  missingInformation: string[];
  closeDecision?: boolean;
  closeDecisionExplanation?: string;
};

export type EvidencePoint = {
  label: string;
  explanation: string;
};

export type GuidanceItem = {
  label: string;
  explanation: string;
};

export type ReassessmentTrigger = {
  type: "time" | "growth" | "strength" | "skill" | "league" | "equipment" | "comfort";
  label: string;
  explanation: string;
};
