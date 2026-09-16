import {
  runCanonicalCandidateThreePathComparison
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest, orderedLabels } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const result = await runCanonicalCandidateThreePathComparison(await loadCanonicalDemoRecommendationRequest());
  console.log("Canonical Recommendation Three-Path Comparison");
  console.log("");
  printRanking("Legacy authoritative", orderedLabels(result.legacyAuthoritative));
  printRanking("Ordinal-only candidate", result.ordinalCandidate ? orderedLabels(result.ordinalCandidate) : []);
  printRanking("Numeric-reference-aware candidate", result.numericReferenceCandidate ? orderedLabels(result.numericReferenceCandidate) : []);
  console.log("Winner alignment:");
  console.log(`Ordinal-only: ${result.precisionRestoration.ordinalWinnerMatchesLegacy ? "yes" : "no"}`);
  console.log(`Numeric reference: ${result.precisionRestoration.numericReferenceWinnerMatchesLegacy ? "yes" : "no"}`);
  console.log("");
  console.log("Ranking distance:");
  console.log(`Ordinal-only: ${result.precisionRestoration.ordinalRankingDistance}`);
  console.log(`Numeric reference: ${result.precisionRestoration.numericReferenceRankingDistance}`);
  console.log("");
  console.log("Average score variance:");
  console.log(`Ordinal-only: ${result.precisionRestoration.ordinalAverageScoreDelta}`);
  console.log(`Numeric reference: ${result.precisionRestoration.numericReferenceAverageScoreDelta}`);
  console.log("");
  console.log("Dimension variance:");
  console.log(`Ordinal-only: ${result.precisionRestoration.ordinalDimensionVariance}`);
  console.log(`Numeric reference: ${result.precisionRestoration.numericReferenceDimensionVariance}`);
  console.log("");
  console.log("Reason alignment:");
  console.log(`Ordinal-only: ${result.precisionRestoration.ordinalReasonAlignmentRatio}`);
  console.log(`Numeric reference: ${result.precisionRestoration.numericReferenceReasonAlignmentRatio}`);
  console.log("");
  console.log("Conclusion:");
  console.log(result.precisionRestoration.conclusion);
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

main().finally(async () => prisma.$disconnect());
