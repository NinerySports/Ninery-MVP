import {
  validateConfidenceCompatibilityLanguage,
  type ConfidenceCompatibilityResult
} from "../confidence/index.js";
import {
  validateTransitionCompatibilityLanguage,
  type TransitionCompatibilityResult
} from "../transition/index.js";
import type {
  CompatibilityLanguageSafetyAnalysis,
  CompatibilityModelName
} from "./compatibility-validation.types.js";

export function validateCompatibilityLanguageSafety(input: {
  readonly model: CompatibilityModelName;
  readonly results: readonly (ConfidenceCompatibilityResult | TransitionCompatibilityResult)[];
}): CompatibilityLanguageSafetyAnalysis {
  const prohibitedPhraseMatches: string[] = [];
  const unsafeImplicationFindings: string[] = [];
  let scannedTextCount = 0;

  for (const result of input.results) {
    const texts = [
      ...result.reasons.map((reason) => reason.message),
      ...result.tradeoffs.map((tradeoff) => tradeoff.message),
      ...result.missingInformation.map((item) => `${item.effect} ${item.recommendedNextAction}`)
    ];
    for (const text of texts) {
      scannedTextCount += 1;
      const matches = input.model === "confidence_compatibility"
        ? validateConfidenceCompatibilityLanguage(text)
        : validateTransitionCompatibilityLanguage(text);
      prohibitedPhraseMatches.push(...matches);
      if (input.model === "confidence_compatibility" && /fix(?:es)? confidence|guarantee/i.test(text)) {
        unsafeImplicationFindings.push(`Unsafe confidence implication: ${text}`);
      }
      if (input.model === "transition_compatibility" && /wrong bat|will struggle|easy immediately/i.test(text)) {
        unsafeImplicationFindings.push(`Unsafe transition implication: ${text}`);
      }
    }
  }

  return {
    scannedTextCount,
    prohibitedPhraseMatches: [...new Set(prohibitedPhraseMatches)].sort(),
    unsafeImplicationFindings: [...new Set(unsafeImplicationFindings)].sort(),
    safe: prohibitedPhraseMatches.length === 0 && unsafeImplicationFindings.length === 0
  };
}
