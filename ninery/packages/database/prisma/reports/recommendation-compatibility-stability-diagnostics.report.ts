import {
  runCompatibilityStabilityDiagnostics,
  type CompatibilityStabilityDiagnosticResult
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

const reportDate = new Date("2026-08-04T00:00:00.000Z");

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.variantLabel === "RAW-ICON-USA-30-22");
  if (!currentProfile) throw new Error("Current demo bat RAW-ICON-USA-30-22 was not found.");
  const suite = runCompatibilityStabilityDiagnostics({
    basePlayerDNA: request.playerInput,
    canonicalProfiles: request.canonicalProfiles,
    currentEquipmentProfile: currentProfile,
    evaluatedAt: reportDate
  });

  console.log("Compatibility Stability Diagnostics v1.0");
  console.log("");
  for (const result of suite.results) printResult(result);
  console.log("Production model changed:");
  console.log("no");
  console.log("");
  console.log("Live recommendation use allowed:");
  console.log("false");
}

function printResult(result: CompatibilityStabilityDiagnosticResult) {
  console.log(result.model === "confidence_compatibility" ? "CONFIDENCE COMPATIBILITY" : "TRANSITION COMPATIBILITY");
  console.log("");
  console.log(`Original promotion outcome: ${result.originalValidationOutcome}`);
  console.log(`Failed perturbations: ${result.failedScenarios.length}`);
  console.log(`Reproduced: ${result.failedScenarios.filter((failure) => failure.reproductionStatus === "reproduced").length}/${result.failedScenarios.length}`);
  console.log("Failure categories:");
  for (const [code, count] of countCauses(result.failedScenarios)) console.log(`- ${code}: ${count}`);
  console.log(`Threshold-driven failures: ${result.thresholdProximity.thresholdDrivenFailureCount}`);
  console.log(`Formula-driven failures: ${result.thresholdProximity.formulaDrivenFailureCount}`);
  console.log(`Near-tie scenarios: ${result.tieSensitivity.nearTieScenarioCount}`);
  console.log(`Ranking flips explained by near ties: ${result.tieSensitivity.rankingFlipsExplainedByNearTies}`);
  if (result.confidenceSaturation) {
    console.log(`Score saturation: ${result.confidenceSaturation.evaluationsNearCeiling}/${result.confidenceSaturation.totalEvaluations} at or above ${result.confidenceSaturation.ceilingThreshold}`);
    console.log(`Compression detected: ${yesNo(result.confidenceSaturation.overallCompressionDetected)}`);
  }
  if (result.transitionPhysicalOverlap) {
    console.log(`Physical overlap risk: ${result.transitionPhysicalOverlap.overlapRisk}`);
    console.log(`Physical combined weight: ${result.transitionPhysicalOverlap.currentCombinedWeight}`);
  }
  if (result.missingContextClassifications.length) {
    console.log("Missing-context classifications:");
    for (const item of result.missingContextClassifications) console.log(`- ${item.scenarioId}: ${item.classification} (${item.missingRequirements.join(", ") || "none"})`);
  }
  console.log("Failed perturbation inventory:");
  for (const failure of result.failedScenarios) {
    console.log(`- ${failure.failureId}`);
    console.log(`  input: ${failure.perturbation.inputField} ${failure.perturbation.originalValue} -> ${failure.perturbation.perturbedValue}`);
    console.log(`  score: ${format(failure.baseline.score)} -> ${format(failure.perturbed.score)} (delta ${format(failure.differences.scoreDelta)})`);
    console.log(`  band changed: ${yesNo(failure.differences.bandChanged)}, ranking changed: ${yesNo(failure.differences.rankingChanged)}, reason changed: ${yesNo(failure.differences.reasonCodesAdded.length > 0 || failure.differences.reasonCodesRemoved.length > 0)}`);
    console.log(`  causes: ${failure.suspectedCauses.join(", ")}`);
  }
  console.log("Primary causes:");
  for (const cause of result.primaryCauses) console.log(`- ${cause.code}: ${cause.message}`);
  console.log("Secondary causes:");
  for (const cause of result.secondaryCauses) console.log(`- ${cause.code}: ${cause.message}`);
  console.log(`Stability conclusion: ${result.stabilityConclusion}`);
  console.log(`Recommended calibration package: ${result.recommendedCalibrationPackage?.sourceScenario ?? "none"}`);
  console.log("Promotion remains blocked: yes");
  console.log("");
}

function countCauses(failures: readonly CompatibilityStabilityDiagnosticResult["failedScenarios"][number][]) {
  const counts = new Map<string, number>();
  for (const failure of failures) for (const cause of failure.suspectedCauses) counts.set(cause, (counts.get(cause) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function format(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(2).replace(/\.00$/, "");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
