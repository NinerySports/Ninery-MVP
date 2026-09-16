export const PHYSICAL_EVALUATION_CONFLICT_ADJUDICATION_VERSION = "1.0";
export const PHYSICAL_EVALUATION_BLINDING_POLICY_VERSION = "1.0";

export const evaluatorBlindingPolicy = {
  priorEvaluatorCanonicalInterpretations: "hidden_before_evaluation",
  priorEvaluatorRawObservations: "hidden_before_evaluation",
  comparativeSynthesisResult: "hidden_before_evaluation",
  currentCanonicalCandidate: "hidden_before_evaluation",
  batIdentity: "may_be_known",
  referenceBatIdentity: "may_be_known_when_intentionally_part_of_protocol"
} as const;

export const standaloneAdjudicationMinimumTrials = {
  drySwingTrialCount: 12,
  contactTrialCount: 12,
  referenceAlternationCount: 0
} as const;

export const controlledContactAdjudicationMinimumTrials = {
  drySwingTrialCount: 4,
  contactTrialCount: 18,
  referenceAlternationCount: 0
} as const;

export const inverseStandaloneDimensions = {
  forgiveness: ["response_degradation"]
} as const;
