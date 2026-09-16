import {
  runCanonicalCandidateBalanceComparison
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest, orderedLabels } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const result = await runCanonicalCandidateBalanceComparison({ request });

  console.log("Canonical Recommendation Balance Comparison");
  console.log("");
  printRanking("Legacy authoritative", orderedLabels(result.legacyAuthoritative));
  printRanking("Ordinal-only candidate", result.ordinalCandidate ? orderedLabels(result.ordinalCandidate) : []);
  printRanking("Five-attribute numeric-reference candidate", result.numericReferenceCandidate ? orderedLabels(result.numericReferenceCandidate) : []);
  printRanking("Six-attribute numeric-reference candidate with balance", result.balanceAwareCandidate ? orderedLabels(result.balanceAwareCandidate) : []);
  console.log(`Balance execution: ${result.balanceExecutionStatus}`);
  console.log("");
  console.log("Balance values:");
  for (const value of result.balanceImpact.values) {
    console.log(`- ${value.equipmentId}: legacy ${value.legacyBalanceValue ?? "missing"} -> canonical ${value.canonicalBalanceValue ?? "missing"} -> engine ${value.recommendationInputValue ?? "missing"} (${value.canonicalOrdinal ?? "missing"}, ${value.conversionStrategy ?? "blocked"}, ${value.confidence ?? "missing"}, bridge ${value.bridgeStrategy ?? "missing"} v${value.bridgeVersion ?? "missing"})`);
  }
  console.log("");
  console.log("Score variance:");
  console.log(`Before balance: ${format(result.balanceImpact.averageScoreVarianceBefore)}`);
  console.log(`After balance: ${format(result.balanceImpact.averageScoreVarianceAfter)}`);
  console.log(`Maximum before: ${format(result.balanceImpact.maximumScoreVarianceBefore)}`);
  console.log(`Maximum after: ${format(result.balanceImpact.maximumScoreVarianceAfter)}`);
  console.log("");
  console.log("Dimension variance:");
  console.log(`Before balance: ${format(result.balanceImpact.averageDimensionVarianceBefore)}`);
  console.log(`After balance: ${format(result.balanceImpact.averageDimensionVarianceAfter)}`);
  console.log(`Balance dimension before: ${format(result.balanceImpact.balanceDimensionVarianceBefore)}`);
  console.log(`Balance dimension after: ${format(result.balanceImpact.balanceDimensionVarianceAfter)}`);
  console.log("");
  console.log("ICON-Atlas gap:");
  console.log(`Before balance: ${format(result.balanceImpact.iconAtlasGapBefore)}`);
  console.log(`After balance: ${format(result.balanceImpact.iconAtlasGapAfter)}`);
  console.log("");
  console.log("Ranking distance:");
  console.log(`Before balance: ${format(result.balanceImpact.rankingDistanceBefore)}`);
  console.log(`After balance: ${format(result.balanceImpact.rankingDistanceAfter)}`);
  console.log("");
  console.log("Reason alignment:");
  console.log(`Before balance: ${format(result.balanceImpact.reasonAlignmentBefore)}`);
  console.log(`After balance: ${format(result.balanceImpact.reasonAlignmentAfter)}`);
  console.log("");
  console.log("Tradeoff alignment:");
  console.log(`Before balance: ${format(result.balanceImpact.tradeoffAlignmentBefore)}`);
  console.log(`After balance: ${format(result.balanceImpact.tradeoffAlignmentAfter)}`);
  console.log("");
  console.log("Confidence variance:");
  console.log(`Before balance: ${format(result.balanceImpact.confidenceVarianceBefore)}`);
  console.log(`After balance: ${format(result.balanceImpact.confidenceVarianceAfter)}`);
  console.log("");
  console.log("Residual reduction:");
  console.log(`${format(result.balanceImpact.residualReductionPercent)}%`);
  console.log("");
  console.log("Conclusion:");
  console.log(result.balanceImpact.conclusion);
  console.log("");
  console.log("Live source:");
  console.log(result.liveRecommendationSource);
  console.log("");
  console.log("Candidate affects live result:");
  console.log(result.candidateAffectsLiveResult ? "yes" : "no");
}

function printRanking(label: string, values: readonly string[]) {
  console.log(`${label}:`);
  if (values.length === 0) console.log("- unavailable");
  values.forEach((value, index) => console.log(`${index + 1}. ${value}`));
  console.log("");
}

function format(value: number | undefined): string {
  if (value === undefined) return "n/a";
  return String(value);
}

main().finally(async () => prisma.$disconnect());
