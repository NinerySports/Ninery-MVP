import { buildDecisionConversation } from "./decision-conversation-builder.ts";
import type {
  BackendDemoRecommendationResponse,
  BackendEquipmentVariant,
  BackendPlayerDNA,
  BackendRecommendationItem,
  PlayerDNAAttributeViewModel,
  PlayerDNAGroupViewModel,
  RecommendationCardViewModel,
  RecommendationResultsViewModel
} from "./recommendation-types";
import {
  confidenceCopy,
  confidenceLabel,
  formatCertificationApproval,
  formatCurrentBat,
  formatDevelopmentGoal,
  formatExpectedBenefit,
  formatLabel,
  formatPlayerContext,
  getHeroRecommendationCopy,
  getMatchContext,
  getMatchPresentation,
  getPlayerFirstName,
  getRecommendationReasonCopy,
  getReassuranceCopy,
  getTradeoffCopy,
  getWhyChosenSummary,
  sanitizeCustomerCopy
} from "./recommendation-copy.ts";

const playerDnaLabels: Record<string, string> = {
  batControl: "Bat Control",
  swingSpeed: "Swing Speed",
  powerPotential: "Power Potential",
  contactConsistency: "Contact Consistency",
  physicalStrength: "Physical Strength",
  confidence: "Confidence",
  transitionReadiness: "Transition Readiness",
  growthStability: "Growth Stability",
  equipmentAwareness: "Equipment Awareness",
  profileCompleteness: "Profile Completeness"
};

export function mapRecommendationResponseToViewModel(
  response: BackendDemoRecommendationResponse
): RecommendationResultsViewModel {
  const playerFirstName = getPlayerFirstName(response.player?.name);
  const primaryRecommendation = response.recommendations?.primaryRecommendation
    ? mapRecommendationItem(response.recommendations.primaryRecommendation, "primary", response.playerDNA, playerFirstName, true)
    : undefined;
  const alternatives = (response.recommendations?.alternatives ?? [])
    .slice(0, 3)
    .map((item, index) => mapRecommendationItem(item, `alternative-${index + 1}`, response.playerDNA, playerFirstName, false));
  const playerDNA = mapPlayerDNA(response.playerDNA);
  const playerDNAGroups = groupPlayerDNA(playerDNA, playerFirstName);
  const missingInformation = uniqueCompact([
    ...(primaryRecommendation?.missingInformation ?? []),
    ...(response.playerDNA?.missingInformation ?? []),
    ...(response.playerDNA?.confidence?.missingInformation ?? [])
  ]);
  const confidenceSource = response.recommendations?.primaryRecommendation?.confidence ?? response.playerDNA?.confidence;
  const overallConfidence = confidenceSource
    ? {
        label: confidenceLabel(confidenceSource.band ?? confidenceSource.level ?? "unknown") ?? "Confidence unavailable",
        score: confidenceSource.score,
        explanation: confidenceCopy(confidenceSource.score)
      }
    : undefined;
  const currentBatParts = formatCurrentBat(response.player?.currentBat);
  const decisionConversation = buildDecisionConversation({
    player: {
      name: response.player?.name ?? "Demo Player",
      firstName: playerFirstName,
      currentBatParts
    },
    primaryRecommendation,
    alternatives,
    playerDNAGroups,
    overallConfidence,
    missingInformation
  });

  return {
    player: {
      id: response.player?.id ?? "demo-player",
      name: response.player?.name ?? "Demo Player",
      firstName: playerFirstName,
      age: response.player?.age,
      competitionLevel: formatLabel(response.player?.competitionLevel) || undefined,
      displayContext: formatPlayerContext(response.player?.age, response.player?.competitionLevel),
      currentBat: response.player?.currentBat,
      currentBatParts
    },
    primaryRecommendation,
    alternatives,
    reassurance: getReassuranceCopy(playerFirstName),
    decisionSnapshot: buildDecisionSnapshot({
      currentBatParts,
      primaryRecommendation,
      primaryGoal: response.playerDNA?.categories?.primaryHittingGoal,
      confidenceLabel: overallConfidence?.label
    }),
    decisionConversation,
    playerDNAGroups,
    playerDNA: playerDNA.slice(0, 6),
    additionalPlayerDNA: playerDNA.filter((attribute) => !groupedPlayerDNAKeys.has(attribute.key)),
    overallConfidence,
    missingInformation,
    traceSummary: response.traceSummary
      ? {
          generatedAt: response.traceSummary.generatedAt,
          eligibleCount: response.traceSummary.eligibleCount,
          filteredCount: response.traceSummary.filteredCount
        }
      : undefined
  };
}

export function hasRecommendationContent(viewModel: RecommendationResultsViewModel): boolean {
  return Boolean(viewModel.primaryRecommendation);
}

function mapRecommendationItem(
  item: BackendRecommendationItem,
  fallbackId: string,
  playerDNA: BackendPlayerDNA | undefined,
  playerFirstName: string | undefined,
  isPrimary: boolean
): RecommendationCardViewModel {
  const equipment = item.equipment;
  const variant = equipment?.selectedVariant ?? equipment?.availableVariants?.[0];
  const leagueApprovalLabel = formatCertificationApproval(equipment?.certification);
  const batName = [equipment?.manufacturer, equipment?.model].filter(Boolean).join(" ") || equipment?.model || "this bat";
  const matchPresentation = getMatchPresentation(item.overallMatchScore);
  const reasons = bestReasons(item, playerFirstName, leagueApprovalLabel);
  const summary = isPrimary
    ? getWhyChosenSummary({
        playerFirstName,
        batName,
        developmentGoal: playerDNA?.categories?.primaryHittingGoal,
        primaryReasons: reasons
      })
    : sanitizeCustomerCopy(item.explanation?.summary) ?? "This bat ranked as another option worth reviewing for the player's current fit.";
  const tradeoffs = bestTradeoffs(item);

  return {
    id: equipment?.variantId ?? equipment?.equipmentId ?? item.trace?.traceId ?? fallbackId,
    brand: equipment?.manufacturer,
    model: equipment?.model ?? "Recommended bat",
    displayName: batName === "this bat" ? equipment?.model ?? "Recommended bat" : batName,
    variant: variantLabel(variant),
    size: sizeLabel(variant),
    certification: formatLabel(equipment?.certification) || undefined,
    leagueApprovalLabel,
    matchScore: item.overallMatchScore,
    matchPresentation,
    matchContext: getMatchContext({ playerFirstName, matchLabel: matchPresentation?.label }),
    heroRecommendationCopy: getHeroRecommendationCopy(playerFirstName),
    matchBand: matchPresentation?.label,
    confidenceLabel: confidenceLabel(item.confidence?.band),
    confidenceScore: item.confidence?.score,
    summary,
    whyChosenSummary: isPrimary ? summary : undefined,
    reasons: reasons.length > 0 ? reasons : [fallbackReason(playerFirstName)],
    tradeoffs,
    missingInformation: uniqueCompact([
      ...(item.confidence?.missingInformation ?? []),
      ...(item.explanation?.uncertainties ?? []),
      ...(item.dimensions ?? []).flatMap((dimension) => dimension.missingInformation ?? [])
    ]).map(formatSentence)
  };
}

const playerDNAStoryGroups = [
  {
    key: "strengths",
    title: (playerFirstName?: string) =>
      playerFirstName ? `${playerFirstName}'s Current Strengths` : "Current Strengths",
    attributeKeys: ["batControl", "equipmentAwareness"]
  },
  {
    key: "developing",
    title: () => "Areas Still Developing",
    attributeKeys: ["swingSpeed", "transitionReadiness"]
  },
  {
    key: "moreInformation",
    title: () => "More Information Helps",
    attributeKeys: ["profileCompleteness", "confidence"]
  }
] as const;

const groupedPlayerDNAKeys: ReadonlySet<string> = new Set(playerDNAStoryGroups.flatMap((group) => group.attributeKeys));

function groupPlayerDNA(
  attributes: PlayerDNAAttributeViewModel[],
  playerFirstName: string | undefined
): PlayerDNAGroupViewModel[] {
  return playerDNAStoryGroups
    .map((group) => ({
      key: group.key,
      title: group.title(playerFirstName),
      attributes: group.attributeKeys
        .map((key) => attributes.find((attribute) => attribute.key === key))
        .filter(isPresent)
    }))
    .filter((group) => group.attributes.length > 0);
}

function buildDecisionSnapshot(input: {
  currentBatParts: string[];
  primaryRecommendation?: RecommendationCardViewModel;
  primaryGoal?: string;
  confidenceLabel?: string;
}): RecommendationResultsViewModel["decisionSnapshot"] {
  const recommendation = input.primaryRecommendation;
  const recommendedBat = [recommendation?.displayName, recommendation?.size].filter(Boolean).join(" - ");

  return [
    {
      label: "Current Bat",
      value: input.currentBatParts.length > 0 ? input.currentBatParts.join(" - ") : "Not provided yet"
    },
    {
      label: "Recommended Bat",
      value: recommendedBat || "Recommendation unavailable"
    },
    {
      label: "Primary Goal",
      value: formatDevelopmentGoal(input.primaryGoal)
    },
    {
      label: "Expected Benefit",
      value: formatExpectedBenefit(input.primaryGoal)
    },
    {
      label: "Confidence",
      value: input.confidenceLabel ?? "Confidence unavailable"
    }
  ];
}

function mapPlayerDNA(playerDNA?: BackendPlayerDNA): PlayerDNAAttributeViewModel[] {
  const explanations = playerDNA?.explanations ?? [];
  const fromExplanations = explanations
    .filter((explanation) => explanation.attribute)
    .map((explanation) => ({
      key: explanation.attribute ?? "attribute",
      label: playerDnaLabels[explanation.attribute ?? ""] ?? formatLabel(explanation.attribute),
      score: explanation.score,
      confidence: formatLabel(explanation.confidence) || undefined,
      summary: sanitizeCustomerCopy(explanation.summary)
    }));

  if (fromExplanations.length > 0) {
    return fromExplanations.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  return Object.entries(playerDNA?.scores ?? {})
    .map(([key, score]) => ({
      key,
      label: playerDnaLabels[key] ?? formatLabel(key),
      score,
      confidence: formatLabel(playerDNA?.categories?.profileConfidenceLevel) || undefined,
      summary: dnaScoreSummary(key, score)
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function bestReasons(
  item: BackendRecommendationItem,
  playerFirstName: string | undefined,
  certificationLabel: string | undefined
): string[] {
  const explanationReasons = (item.explanation?.topReasons ?? [])
    .map((reason) =>
      getRecommendationReasonCopy({
        code: reason.dimension,
        fallback: reason.reason,
        playerFirstName,
        certificationLabel
      })
    )
    .filter(isPresent);
  const dimensionReasons = (item.dimensions ?? [])
    .map((dimension) =>
      getRecommendationReasonCopy({
        code: dimension.code,
        fallback: dimension.reason,
        playerFirstName,
        certificationLabel
      })
    )
    .filter(isPresent);
  const leagueReason = certificationLabel
    ? getRecommendationReasonCopy({ code: "LEAGUE_LEGALITY_FIT", playerFirstName, certificationLabel })
    : undefined;

  return uniqueCompact([...explanationReasons, ...dimensionReasons, leagueReason]).slice(0, 5);
}

function bestTradeoffs(item: BackendRecommendationItem): string[] {
  const explicitTradeoffs = item.explanation?.tradeoffs ?? [];
  const uncertainties = item.explanation?.uncertainties ?? [];
  const changes = item.explanation?.whatCouldChange ?? [];
  const dimensionTradeoffs = (item.dimensions ?? [])
    .filter((dimension) => dimension.tradeoff)
    .map((dimension) => dimension.reason ?? dimension.code);

  return uniqueCompact([...explicitTradeoffs, ...uncertainties, ...changes, ...dimensionTradeoffs].map(getTradeoffCopy))
    .slice(0, 5);
}

function sizeLabel(variant?: BackendEquipmentVariant): string | undefined {
  if (!variant) return undefined;
  const parts = [];
  if (variant.lengthInches) parts.push(`${variant.lengthInches} in.`);
  if (variant.weightOunces) parts.push(`${variant.weightOunces} oz`);
  if (variant.dropWeight) parts.push(`drop ${variant.dropWeight}`);
  return parts.length > 0 ? parts.join(" / ") : undefined;
}

function variantLabel(variant?: BackendEquipmentVariant): string | undefined {
  return variant?.sku;
}

function dnaScoreSummary(key: string, score: number): string {
  const label = playerDnaLabels[key] ?? formatLabel(key);
  if (score >= 75) return `${label} is a clear strength in this profile.`;
  if (score >= 50) return `${label} is developing and relevant to the recommendation.`;
  return `${label} may be an area to watch as the player develops.`;
}

function fallbackReason(playerFirstName: string | undefined): string {
  const player = playerFirstName ?? "this player";
  return `Fits ${player}'s current profile better than the other eligible bats.`;
}

function uniqueCompact(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const sanitized = sanitizeCustomerCopy(value) ?? value?.trim();
    if (!sanitized) continue;
    const key = sanitized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(formatSentence(sanitized));
  }

  return result;
}

function formatSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}






