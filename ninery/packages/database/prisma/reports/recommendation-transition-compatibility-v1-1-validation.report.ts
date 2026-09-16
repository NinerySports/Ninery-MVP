import { validateTransitionCompatibilityV1_1 } from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Rawlings ICON 2026");
  if (!currentProfile) throw new Error("Current demo bat profile Rawlings ICON 2026 was not found.");
  const validation = validateTransitionCompatibilityV1_1({
    basePlayerDNA: request.playerInput,
    currentEquipmentProfile: currentProfile,
    canonicalProfiles: request.canonicalProfiles,
    evaluatedAt: request.evaluatedAt
  });
  console.log("Transition Compatibility v1.1 Validation");
  console.log("");
  console.log(`Official v1.0 outcome: ${validation.v1_0OfficialOutcome}`);
  console.log(`v1.1 analytical outcome: ${validation.v1_1AnalyticalOutcome}`);
  console.log(`Eligible for diagnostic shadow: ${validation.eligibleForDiagnosticShadow ? "yes" : "no"}`);
  console.log(`Eligible for extended shadow: ${validation.eligibleForExtendedShadow ? "yes" : "no"}`);
  console.log(`Eligible for internal candidate: ${validation.eligibleForInternalCandidate ? "yes" : "no"}`);
  console.log("Live ranking use: no");
  console.log("Live explanation use: no");
  console.log("");
  console.log("Matrix:");
  console.log(`- completed: ${validation.matrix.completedEvaluations}`);
  console.log(`- blocked: ${validation.matrix.blockedEvaluations}`);
  console.log(`- partial: ${validation.matrix.partialEvaluations}`);
  console.log(`- average range: ${validation.matrix.averagePerPlayerEquipmentRange ?? "n/a"}`);
  console.log(`- ranking changes vs v1.0: ${validation.matrix.rankingChangeCount}`);
  console.log(`- band changes vs v1.0: ${validation.matrix.bandChangeCount}`);
  console.log(`- reason changes vs v1.0: ${validation.matrix.reasonChangeCount}`);
  console.log("");
  console.log("Stability:");
  console.log(`- v1.0 minor failures: ${validation.stability.v1_0MinorFailureCount}`);
  console.log(`- v1.1 minor failures: ${validation.stability.v1_1MinorFailureCount}`);
  console.log(`- original failure resolved: ${validation.stability.originalFailureResolved ? "yes" : "no"}`);
  console.log(`- v1.1 max minor delta: ${validation.stability.v1_1MaximumMinorDelta ?? "n/a"}`);
  console.log(`- monotonicity violations: ${validation.stability.monotonicityViolations}`);
  console.log("");
  console.log("Sensitivity:");
  validation.sensitivity.meaningfulScenarios.forEach((scenario) => console.log(`- ${scenario.scenarioId}: ${scenario.baselineScore ?? "n/a"} -> ${scenario.changedScore ?? "n/a"} (delta ${scenario.scoreDelta ?? "n/a"}, ${scenario.passed ? "pass" : "fail"})`));
  console.log("");
  console.log("Missing context:");
  console.log(`- missing current equipment blocks: ${validation.missingContext.missingCurrentEquipmentBlocks ? "yes" : "no"}`);
  console.log(`- missing experience readiness blocks: ${validation.missingContext.missingExperienceReadinessBlocks ? "yes" : "no"}`);
  console.log(`- optional familiarity lowers confidence: ${validation.missingContext.optionalFamiliarityLowersConfidence ? "yes" : "no"}`);
  console.log(`- no hidden zeroes: ${validation.missingContext.noHiddenZeroes ? "yes" : "no"}`);
  console.log("");
  console.log("Blockers:");
  if (!validation.blockers.length) console.log("- none");
  validation.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  console.log("");
  console.log("Warnings:");
  validation.warnings.forEach((warning) => console.log(`- ${warning}`));
  console.log("");
  console.log("Production model changed: no");
  console.log("v1.1 live use allowed: no");
}

main().finally(async () => prisma.$disconnect());
