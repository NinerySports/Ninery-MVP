import type {
  AlternativeExplanation,
  ConfidenceExplanation,
  DecisionConversation,
  EvidencePoint,
  FutureGuidance,
  PlayerFitNarrative,
  RecommendationSummary,
  TradeoffSummary,
  UncertaintyDisclosure
} from "./decision-conversation-types";
import type { PlayerDNAAttributeViewModel, PlayerDNAGroupViewModel, RecommendationCardViewModel } from "./recommendation-types";

export type DecisionConversationInput = {
  player: {
    firstName?: string;
    name: string;
    currentBatParts: string[];
  };
  primaryRecommendation?: RecommendationCardViewModel;
  alternatives: RecommendationCardViewModel[];
  playerDNAGroups: PlayerDNAGroupViewModel[];
  overallConfidence?: {
    label: string;
    score?: number;
    explanation?: string;
  };
  missingInformation: string[];
};

const fallbackRecommendationName = "the recommended bat";
const internalCodePattern = /\b(?:PDNA|EDNA|BATMATCH|REC)-[A-Z0-9_-]+\b|\b[A-Z]{2,}_[A-Z0-9_]+\b/g;

export function buildDecisionConversation(input: DecisionConversationInput): DecisionConversation {
  const recommendation = input.primaryRecommendation;
  const equipmentName = recommendation?.displayName ?? recommendation?.model ?? fallbackRecommendationName;
  const playerName = input.player.firstName ?? "this player";

  return {
    version: "1.0",
    recommendationSummary: buildRecommendationSummary(input, equipmentName, playerName),
    playerFit: buildPlayerFit(input.playerDNAGroups, playerName),
    tradeoffSummary: buildTradeoffSummary(input, equipmentName, playerName),
    alternativeExplanations: buildAlternativeExplanations(input.alternatives, recommendation, playerName),
    confidenceExplanation: buildConfidenceExplanation(input, recommendation),
    futureGuidance: buildFutureGuidance(input, equipmentName, playerName),
    uncertaintyDisclosure: buildUncertaintyDisclosure(input)
  };
}

function buildRecommendationSummary(
  input: DecisionConversationInput,
  equipmentName: string,
  playerName: string
): RecommendationSummary {
  const recommendation = input.primaryRecommendation;
  const reasons = uniqueClean(recommendation?.reasons ?? []);
  const matchLabel = recommendation?.matchPresentation?.label;
  const primaryReason =
    reasons[0] ?? `${equipmentName} is the strongest overall match based on the player and equipment information currently available.`;
  const supportingReasons = reasons.filter((reason) => reason !== primaryReason).slice(0, 3);
  const matchPhrase = matchLabel ? ` as a ${matchLabel.toLowerCase()}` : "";

  return {
    heading: "Why Ninery Chose This Bat",
    equipmentName,
    summary:
      recommendation?.whyChosenSummary ??
      `${equipmentName} stands out${matchPhrase} for ${playerName}'s current profile and development needs.`,
    primaryReason,
    supportingReasons
  };
}

function buildPlayerFit(groups: PlayerDNAGroupViewModel[], playerName: string): PlayerFitNarrative {
  const strengths = attributesForGroup(groups, "strengths").map(attributeToEvidencePoint);
  const developing = attributesForGroup(groups, "developing").map((attribute) => ({
    label: attribute.label,
    explanation: cleanText(attribute.summary) ?? `${attribute.label} is still developing and is considered in the fit.`
  }));

  return {
    heading: playerName === "this player" ? "Why It Fits This Player" : `Why It Fits ${playerName}`,
    summary:
      strengths.length > 0 || developing.length > 0
        ? `Ninery uses ${playerName}'s player profile to explain why this recommendation fits right now, not just which bat scored highest.`
        : "Ninery has enough general profile information to explain the fit, and more Player DNA details would make the explanation more precise.",
    strengthsUsed: strengths,
    developingAreasSupported: developing
  };
}

function buildTradeoffSummary(input: DecisionConversationInput, equipmentName: string, playerName: string): TradeoffSummary {
  const recommendation = input.primaryRecommendation;
  const expectedBenefits = uniqueClean(recommendation?.reasons ?? [])
    .filter((reason) => /control|feel|confidence|contact|forgiveness|development|transition/i.test(reason))
    .slice(0, 3);
  const compromises = uniqueClean(recommendation?.tradeoffs ?? []).slice(0, 2);
  const unknowns = uniqueClean([...(recommendation?.missingInformation ?? []), ...input.missingInformation]).slice(0, 2);

  return {
    heading: "What This Recommendation Prioritizes",
    summary:
      compromises.length > 0
        ? `This recommendation prioritizes the best supported fit for ${playerName} while making the tradeoffs clear.`
        : `No major tradeoff was identified for ${equipmentName} from the information currently available, although real-world comfort and feel should still be considered.`,
    expectedBenefits: expectedBenefits.length > 0 ? expectedBenefits : [`A clearer equipment fit for ${playerName}'s current stage.`],
    compromises,
    unknowns: unknowns.length > 0 ? unknowns : undefined
  };
}

function buildAlternativeExplanations(
  alternatives: RecommendationCardViewModel[],
  selected: RecommendationCardViewModel | undefined,
  playerName: string
): AlternativeExplanation[] {
  return alternatives.slice(0, 3).map((alternative, index) => {
    const strongReason = uniqueClean(alternative.reasons)[0] ?? "This bat remains a credible alternative for the current player profile.";
    const selectedName = selected?.displayName ?? fallbackRecommendationName;
    const notSelected = selected
      ? `${selectedName} ranked higher because it produced a stronger overall fit with ${playerName}'s current needs and the information currently available.`
      : "It was not selected as the top recommendation because another bat produced a stronger overall fit with the information currently available.";

    return {
      equipmentId: alternative.id,
      equipmentName: alternative.displayName,
      matchLabel: alternative.matchPresentation?.label ?? alternative.matchBand ?? "Alternative match",
      summary:
        cleanText(alternative.summary) ??
        "This bat remains a credible alternative, but the recommended bat produced a stronger overall fit with the information currently available.",
      whyItIsStrong: strongReason,
      whyItWasNotSelected: notSelected,
      bestFor: index === 0 ? "Families who want to compare one other strong fit before making a final decision." : undefined,
      reconsiderWhen: "Reconsider this option if real-world comfort, swing feel, or league requirements favor it during final validation."
    };
  });
}

function buildConfidenceExplanation(
  input: DecisionConversationInput,
  recommendation: RecommendationCardViewModel | undefined
): ConfidenceExplanation {
  const score = input.overallConfidence?.score ?? recommendation?.confidenceScore;
  const label = input.overallConfidence?.label ?? recommendation?.confidenceLabel ?? "Confidence unavailable";
  const level = confidenceLevel(label, score);
  const supportingEvidence: EvidencePoint[] = [
    { label: "Player Profile", explanation: "The recommendation uses the player information currently available." },
    { label: "Equipment Fit", explanation: "Eligible equipment is compared against the player's current fit needs." }
  ];

  if (recommendation?.leagueApprovalLabel) {
    supportingEvidence.push({
      label: "League Eligibility",
      explanation: `${recommendation.leagueApprovalLabel} is reflected before performance fit is considered.`
    });
  }

  const limitingFactors = uniqueClean([...(recommendation?.missingInformation ?? []), ...input.missingInformation])
    .slice(0, 3)
    .map((item) => ({ label: "More Precision Available", explanation: item }));

  return {
    heading: "How Confident Is Ninery?",
    level,
    label,
    summary:
      input.overallConfidence?.explanation ??
      "Confidence reflects the amount and quality of player, equipment, and league information available. It is not a prediction of performance.",
    supportingEvidence,
    limitingFactors
  };
}

function buildFutureGuidance(input: DecisionConversationInput, equipmentName: string, playerName: string): FutureGuidance {
  const hasCurrentBat = input.player.currentBatParts.length > 0;

  return {
    heading: "When to Reassess",
    summary: `Use ${equipmentName} as the current best-fit recommendation, then reassess when ${playerName}'s body, skill, league context, or equipment comfort meaningfully changes.`,
    keepDoing: [
      { label: "Validate Comfort", explanation: "Confirm that the final size and feel are comfortable before a purchase decision." },
      { label: "Track Fit Over Time", explanation: "Keep noting whether the bat remains easy to control in games and practice." }
    ],
    watchFor: [
      {
        label: hasCurrentBat ? "Current Bat Comparison" : "Current Bat Details",
        explanation: hasCurrentBat
          ? "Compare the recommendation against how the current bat feels during real swings."
          : "Adding current-bat details can improve future recommendation precision."
      },
      { label: "Changing Swing Feel", explanation: "Meaningful changes in comfort, control, or swing speed can change the best fit." }
    ],
    reassessWhen: [
      { type: "time", label: "After one competitive season", explanation: "A full season can reveal whether the fit still supports the player's needs." },
      { type: "growth", label: "After a significant growth spurt", explanation: "Height and weight changes can affect bat control and comfort." },
      { type: "strength", label: "After meaningful strength development", explanation: "Strength changes can make a different swing profile more appropriate." },
      { type: "league", label: "Before a league or bat-standard transition", explanation: "Certification rules should be confirmed before changing leagues or divisions." }
    ],
    longTermOutlook:
      "Ninery should continue comparing equipment fit against the player's development stage rather than assuming every future step requires a heavier bat."
  };
}

function buildUncertaintyDisclosure(input: DecisionConversationInput): UncertaintyDisclosure | undefined {
  const recommendation = input.primaryRecommendation;
  const closestAlternative = input.alternatives[0];
  const closeDecision =
    typeof recommendation?.matchPresentation?.roundedScore === "number" &&
    typeof closestAlternative?.matchPresentation?.roundedScore === "number" &&
    Math.abs(recommendation.matchPresentation.roundedScore - closestAlternative.matchPresentation.roundedScore) <= 5;
  const missingInformation = uniqueClean([
    ...input.missingInformation,
    ...(recommendation?.missingInformation ?? []),
    ...(input.player.currentBatParts.length === 0 ? ["Current bat details are not provided yet."] : [])
  ]).slice(0, 4);
  const lowConfidence = confidenceLevel(input.overallConfidence?.label, input.overallConfidence?.score) === "low";

  if (!closeDecision && missingInformation.length === 0 && !lowConfidence) return undefined;

  return {
    heading: "What We Still Do Not Know",
    summary: closeDecision
      ? "The top recommendations are close enough that real-world comfort may be an important final factor."
      : "A few additional details could make the recommendation more precise without changing the current explanation.",
    missingInformation,
    closeDecision: closeDecision || undefined,
    closeDecisionExplanation: closeDecision
      ? "When recommendations are closely grouped, final comfort and player feedback should carry extra weight."
      : undefined
  };
}

function attributesForGroup(groups: PlayerDNAGroupViewModel[], key: PlayerDNAGroupViewModel["key"]): PlayerDNAAttributeViewModel[] {
  return groups.find((group) => group.key === key)?.attributes ?? [];
}

function attributeToEvidencePoint(attribute: PlayerDNAAttributeViewModel): EvidencePoint {
  return {
    label: attribute.label,
    explanation: cleanText(attribute.summary) ?? `${attribute.label} is part of the current fit explanation.`
  };
}

function confidenceLevel(label?: string, score?: number): ConfidenceExplanation["level"] {
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("high") || (typeof score === "number" && score >= 80)) return "high";
  if (normalized.includes("low") || (typeof score === "number" && score < 60)) return "low";
  return "moderate";
}

function uniqueClean(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function cleanText(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const withoutCodes = trimmed.replace(internalCodePattern, "").replace(/\s{2,}/g, " ").trim();
  if (!withoutCodes || /\b(scored from|algorithm|rule|request constraints|player dna|equipment dna)\b/i.test(withoutCodes)) {
    return undefined;
  }
  return /[.!?]$/.test(withoutCodes) ? withoutCodes : `${withoutCodes}.`;
}
