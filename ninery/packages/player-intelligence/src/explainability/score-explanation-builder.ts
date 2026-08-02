import type { PlayerDNAAttribute, PlayerDNAExplanation, ProfileConfidenceLevel } from "../player-dna.types.js";
import type { ScoreBreakdown } from "../scoring/scoring-engine.js";
import { confidenceBand } from "../scoring/confidence-calculator.js";

export function buildAttributeExplanation(
  attribute: PlayerDNAAttribute,
  score: number,
  breakdown: ScoreBreakdown[PlayerDNAAttribute],
  missingInformation: string[]
): PlayerDNAExplanation {
  const confidenceContribution = Math.min(100, breakdown.confidenceContribution * 8);
  const confidence = confidenceBand(confidenceContribution) as ProfileConfidenceLevel;
  const reasons = breakdown.appliedRules.map((rule) => rule.rationale);

  return {
    attribute,
    score,
    confidence,
    summary: summarizeAttribute(attribute, score),
    reasons: reasons.length > 0 ? reasons : ["No specific signals were available, so the neutral baseline was retained."],
    sourceCodes: [...new Set(breakdown.appliedRules.map((rule) => rule.sourceCode))],
    ruleIds: breakdown.appliedRules.map((rule) => rule.ruleId),
    positiveAdjustments: breakdown.positiveAdjustments,
    negativeAdjustments: breakdown.negativeAdjustments,
    finalNormalizedScore: breakdown.finalNormalizedScore,
    confidenceContribution: breakdown.confidenceContribution,
    missingInformation
  };
}

function summarizeAttribute(attribute: PlayerDNAAttribute, score: number): string {
  const label = attribute.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);

  if (score >= 75) {
    return `${label} is a strong current signal in the Player DNA profile.`;
  }

  if (score >= 50) {
    return `${label} is present but should be interpreted with context.`;
  }

  return `${label} may need support or more information before recommendation matching.`;
}
