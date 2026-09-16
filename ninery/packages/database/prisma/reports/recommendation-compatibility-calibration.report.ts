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

  console.log("Compatibility Calibration Analysis v1.0");
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
  console.log("Scenarios:");
  for (const scenario of result.calibrationComparison.scenarios) {
    console.log(`- ${scenario.scenarioName}: ${scenario.overallAssessment}`);
    console.log(`  stability improved: ${yesNo(scenario.stabilityImproved)}, sensitivity preserved: ${yesNo(scenario.sensitivityPreserved)}, monotonicity preserved: ${yesNo(scenario.monotonicityPreserved)}, separation improved: ${yesNo(scenario.separationImproved)}`);
  }
  console.log(`Recommended analytical scenario: ${result.calibrationComparison.recommendedScenario ?? "none"}`);
  console.log(`Stability conclusion: ${result.stabilityConclusion}`);
  console.log(`Original Ticket #035 outcome: ${result.promotionReassessment.originalOutcome}`);
  console.log(`Analytical projected outcome: ${result.promotionReassessment.analyticalProjectedOutcome ?? "none"}`);
  console.log("Projected outcome requires implementation: yes");
  console.log("Promotion still blocked: yes");
  if (result.recommendedCalibrationPackage) {
    console.log("Proposed package:");
    for (const change of result.recommendedCalibrationPackage.proposedChanges) {
      console.log(`- ${change.area}: ${change.proposedBehavior}`);
      console.log(`  rationale: ${change.rationale}`);
    }
    console.log("Expected benefits:");
    for (const benefit of result.recommendedCalibrationPackage.expectedBenefits) console.log(`- ${benefit}`);
    console.log("Known risks:");
    for (const risk of result.recommendedCalibrationPackage.knownRisks) console.log(`- ${risk}`);
  } else {
    console.log("Proposed package: none");
  }
  console.log("Regressions identified:");
  const regressions = result.calibrationScenarios.flatMap((scenario) => scenario.regressions.map((regression) => `${scenario.scenarioName}: ${regression}`));
  if (regressions.length) regressions.forEach((regression) => console.log(`- ${regression}`));
  else console.log("- none");
  console.log("");
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
