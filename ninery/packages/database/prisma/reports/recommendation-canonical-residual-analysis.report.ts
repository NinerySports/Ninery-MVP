import {
  analyzeCanonicalResidualVariance,
  runCanonicalCandidateThreePathComparison,
  type CanonicalResidualScenarioSummary,
  type OptionalSignalAttribution
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const threePath = await runCanonicalCandidateThreePathComparison(request);
  const analysis = await analyzeCanonicalResidualVariance({ request, threePath, evaluatedAt: request.evaluatedAt });

  console.log("Canonical Recommendation Residual Analysis");
  console.log("");
  console.log(`Analysis version: ${analysis.version}`);
  console.log(`Three-path conclusion: ${analysis.threePathConclusion}`);
  console.log(`Activation readiness: ${analysis.activationReadiness}`);
  console.log("");
  console.log("Primary cause codes:");
  analysis.primaryCauseCodes.forEach((code) => console.log(`- ${code}`));
  console.log("");
  console.log("Missing optional legacy signals:");
  const balanceResolved = request.canonicalProfiles.every((profile) => profile.attributes.some((attribute) => attribute.key === "balance_profile" && attribute.status === "active"));
  const predictabilityResolved = request.canonicalProfiles.every((profile) => profile.attributes.some((attribute) => attribute.key === "predictability_support" && attribute.status === "active"));
  for (const signal of analysis.missingSignalInventory) {
    console.log(`- ${signal.signal} -> ${signal.canonicalKey}`);
    if (signal.signal === "balance" && balanceResolved) console.log("  status: resolved canonically by active balance_profile evaluations");
    if (signal.signal === "confidenceBuilding" && predictabilityResolved) console.log("  status: validated in shadow; confidence_compatibility promotion outcome blocked_unstable_behavior");
    if (signal.signal === "transitionFriendliness") console.log("  status: validated in shadow; transition_compatibility promotion outcome blocked_unstable_behavior");
    console.log(`  legacy present: ${signal.presentInLegacyCount}, numeric-reference present: ${signal.signal === "balance" && balanceResolved ? request.canonicalProfiles.length : signal.presentInNumericReferenceCount}`);
    console.log(`  dimensions: ${signal.affectedDimensions.join(", ")}`);
    console.log(`  role: ${signal.recommendationRole}`);
  }
  if (balanceResolved) {
    if (predictabilityResolved) console.log("- validated in shadow: confidenceBuilding -> predictability_support + confidence_compatibility; promotion blocked_unstable_behavior");
    console.log("- production unresolved: confidenceBuilding replacement still requires stability, separation, double-counting, and parity review");
    console.log("- validated in shadow: transitionFriendliness -> transition_compatibility; promotion blocked_unstable_behavior");
    console.log("- production unresolved: transitionFriendliness replacement still requires stability and parity review");
  }
  console.log("");
  console.log("Scenario summary:");
  analysis.scenarios.forEach(printScenario);
  console.log("");
  console.log("Optional signal attribution:");
  analysis.optionalSignalAttribution.forEach(printAttribution);
  console.log("");
  console.log("Completeness and confidence:");
  console.log(`- completeness affects match score: ${yesNo(analysis.completeness.completenessPenaltyAffectsMatchScore)}`);
  console.log(`- completeness affects confidence: ${yesNo(analysis.completeness.completenessPenaltyAffectsConfidence)}`);
  console.log(`- evidence confidence affects match score: ${yesNo(analysis.completeness.evidenceConfidenceAffectsMatchScore)}`);
  console.log(`- evidence confidence affects confidence: ${yesNo(analysis.completeness.evidenceConfidenceAffectsConfidence)}`);
  console.log("");
  console.log("Normalization:");
  console.log(`- missing optional signals treated as zero: ${yesNo(analysis.normalization.missingOptionalSignalsAreTreatedAsZero)}`);
  console.log(`- neutral raw score for missing optional dimensions: ${analysis.normalization.missingOptionalDimensionRawScore}`);
  console.log(`- weights renormalized: ${yesNo(analysis.normalization.weightsRenormalizedWhenSignalsMissing)}`);
  console.log("");
  console.log("Threshold crossings:");
  console.log(`- reasons: ${analysis.thresholds.reasonThresholdCrossings.length ? analysis.thresholds.reasonThresholdCrossings.join(", ") : "none"}`);
  console.log(`- tradeoffs: ${analysis.thresholds.tradeoffThresholdCrossings.length ? analysis.thresholds.tradeoffThresholdCrossings.join(", ") : "none"}`);
  console.log(`- alternatives: ${analysis.thresholds.alternativeSetChanges.length ? analysis.thresholds.alternativeSetChanges.join(", ") : "none"}`);
  console.log("");
  console.log("ICON vs Atlas:");
  console.log(`- legacy gap: ${format(analysis.iconAtlasPairwise.legacyGap)}`);
  console.log(`- numeric-reference gap: ${format(analysis.iconAtlasPairwise.numericReferenceGap)}`);
  console.log(`- gap residual: ${format(analysis.iconAtlasPairwise.gapResidual)}`);
  for (const item of analysis.iconAtlasPairwise.optionalCarryoverGapDeltas) {
    console.log(`- ${item.signal} gap delta: ${format(item.delta)}`);
  }
  console.log("");
  console.log("Score decomposition:");
  for (const item of analysis.decomposition) {
    console.log(`- ${item.label}: total ${format(item.totalResidual)}, optional ${format(item.allOptionalSignalContribution)}, completeness ${format(item.completenessContribution)}, evidence ${format(item.evidenceConfidenceContribution)}, unexplained ${format(item.unexplainedResidual)}`);
  }
  console.log("");
  console.log("Architecture recommendations:");
  analysis.architectureRecommendations.forEach((item) => console.log(`- ${item}`));
  console.log("");
  console.log("Live recommendation source:");
  console.log(analysis.liveRecommendationSource);
  console.log("");
  console.log("Candidate affects live result:");
  console.log(analysis.candidateAffectsLiveResult ? "yes" : "no");
}

function printScenario(scenario: CanonicalResidualScenarioSummary) {
  console.log(`- ${scenario.id}: winner ${scenario.winnerLabel ?? "none"}, rank distance ${scenario.rankingDistanceFromLegacy}, avg score delta ${format(scenario.averageOverallScoreDeltaFromLegacy)}, avg dimension delta ${format(scenario.averageDimensionDeltaFromLegacy)}, avg confidence delta ${format(scenario.averageConfidenceDeltaFromLegacy)}, ICON-Atlas gap ${format(scenario.iconAtlasGap)}`);
}

function printAttribution(attribution: OptionalSignalAttribution) {
  console.log(`- ${attribution.signal}: ranking changed ${yesNo(attribution.rankingChangedFromNumericReferenceCurrent)}, ICON-Atlas gap delta ${format(attribution.iconAtlasGapDelta)}, reason alignment delta ${format(attribution.reasonAlignmentDelta)}, tradeoff alignment delta ${format(attribution.tradeoffAlignmentDelta)}`);
}

function format(value: number | undefined): string {
  if (value === undefined) return "n/a";
  return value > 0 ? `+${value}` : `${value}`;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

main().finally(async () => prisma.$disconnect());
