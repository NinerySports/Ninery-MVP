import type { TransitionAdjustmentDemandLabel } from "./transition-shadow-study.types.js";

export const transitionExtendedShadowPolicy = {
  version: "1.0",
  ordinaryCompletionRequiresMeaningfulUse: true,
  ordinaryCompletionPrefersBeyondFirstUse: true,
  modelChangeAutomaticallyRecommended: false,
  livePromotionAutomaticallyRecommended: false,
  observationalEvidenceWarning: "Observations are not proof of causation and may be influenced by coaching, fatigue, growth, practice context, or reporting subjectivity.",
  privacyGuardrails: [
    "Do not store diagnosis, medical information, mental-health information, precise location, school information, or unnecessary observer identity.",
    "Free-form notes should be limited, equipment-specific, non-clinical, and free of secrets."
  ],
  prohibitedLanguage: [
    /model was proven correct/i,
    /bat caused/i,
    /player failed the transition/i,
    /low confidence/i
  ]
} as const;

export const transitionAdjustmentOrdering: Record<Exclude<TransitionAdjustmentDemandLabel, "unknown">, number> = {
  minimal: 1,
  mild: 2,
  moderate: 3,
  substantial: 4,
  very_substantial: 5
};

export function predictedAdjustmentCategory(score: number): Exclude<TransitionAdjustmentDemandLabel, "unknown"> {
  if (score >= 90) return "minimal";
  if (score >= 80) return "mild";
  if (score >= 65) return "moderate";
  if (score >= 45) return "substantial";
  return "very_substantial";
}

export function validateTransitionExtendedShadowLanguage(text: string): readonly string[] {
  return transitionExtendedShadowPolicy.prohibitedLanguage
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `Prohibited extended-shadow language matched ${pattern}.`);
}
