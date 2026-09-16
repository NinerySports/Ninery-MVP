import {
  compareTransitionCompatibilityVersions,
  reproduceTransitionCompatibilityV1_0Failure,
  sweepTransitionCompatibilityV1_1Boundaries,
  validateTransitionCompatibilityV1_1
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Rawlings ICON 2026");
  if (!currentProfile) throw new Error("Current demo bat profile Rawlings ICON 2026 was not found.");
  const proposed = request.canonicalProfiles.find((profile) => profile.variantLabel === "LS-ATLAS-USA-30-22") ?? request.canonicalProfiles[1] ?? currentProfile;
  const failure = reproduceTransitionCompatibilityV1_0Failure({
    playerDNA: request.playerInput,
    currentEquipmentProfile: currentProfile,
    proposedEquipmentProfile: proposed,
    evaluatedAt: request.evaluatedAt
  });
  const validation = validateTransitionCompatibilityV1_1({
    basePlayerDNA: request.playerInput,
    currentEquipmentProfile: currentProfile,
    canonicalProfiles: request.canonicalProfiles,
    evaluatedAt: request.evaluatedAt
  });

  console.log("Transition Compatibility v1.0 / v1.1 Version Comparison");
  console.log("");
  console.log("Reproduced swing-effort perturbation:");
  console.log(`- input: ${failure.inputField} ${failure.originalValue} -> ${failure.perturbedValue}`);
  console.log(`- v1.0 score: ${failure.v1_0Baseline.score ?? "blocked"} -> ${failure.v1_0Perturbed.score ?? "blocked"} (delta ${format(failure.v1_0Delta)})`);
  console.log(`- v1.1 score: ${failure.v1_1Baseline.score ?? "blocked"} -> ${failure.v1_1Perturbed.score ?? "blocked"} (delta ${format(failure.v1_1Delta)})`);
  console.log(`- v1.0 band changed: ${yesNo(failure.v1_0BandChanged)}`);
  console.log(`- v1.1 band changed: ${yesNo(failure.v1_1BandChanged)}`);
  console.log(`- resolved: ${yesNo(failure.resolved)}`);
  console.log(`- interpolation segment: ${failure.interpolationSegment?.segmentStart.input ?? "n/a"} to ${failure.interpolationSegment?.segmentEnd.input ?? "n/a"}`);
  console.log("");
  console.log("Demo equipment comparisons:");
  for (const profile of request.canonicalProfiles) {
    const comparison = compareTransitionCompatibilityVersions({
      playerDNA: request.playerInput,
      currentEquipmentProfile: currentProfile,
      proposedEquipmentProfile: profile,
      evaluatedAt: request.evaluatedAt
    });
    console.log(`- ${profile.equipmentName}: v1.0 ${comparison.v1_0.score ?? "blocked"}, v1.1 ${comparison.v1_1.score ?? "blocked"}, delta ${format(comparison.scoreDelta)}, band changed ${yesNo(comparison.bandChanged)}, reasons +${comparison.reasonsAdded.length}/-${comparison.reasonsRemoved.length}`);
  }
  console.log("");
  console.log("Threshold boundary sweeps:");
  for (const sweep of sweepTransitionCompatibilityV1_1Boundaries()) {
    console.log(`- ${sweep.dimension} @ ${sweep.threshold}: below ${sweep.demandBelow}, at ${sweep.demandAt}, above ${sweep.demandAbove}, continuity ${sweep.continuous ? "pass" : "fail"}, monotonic ${sweep.monotonic ? "pass" : "fail"}`);
  }
  console.log("");
  console.log("Synthetic matrix and stability:");
  console.log(`- completed: ${validation.matrix.completedEvaluations}`);
  console.log(`- blocked: ${validation.matrix.blockedEvaluations}`);
  console.log(`- partial: ${validation.matrix.partialEvaluations}`);
  console.log(`- average per-player equipment range: ${validation.matrix.averagePerPlayerEquipmentRange ?? "n/a"}`);
  console.log(`- v1.0 maximum minor delta: ${format(validation.stability.v1_0MaximumMinorDelta)}`);
  console.log(`- v1.1 maximum minor delta: ${format(validation.stability.v1_1MaximumMinorDelta)}`);
  console.log(`- v1.1 minor failure count: ${validation.stability.v1_1MinorFailureCount}`);
  console.log(`- monotonicity violations: ${validation.stability.monotonicityViolations}`);
  console.log(`- same-equipment v1.1 score: ${validation.sameEquipment.v1_1Score ?? "n/a"}`);
  console.log(`- missing current equipment blocks: ${yesNo(validation.missingContext.missingCurrentEquipmentBlocks)}`);
  console.log(`- missing experience readiness blocks: ${yesNo(validation.missingContext.missingExperienceReadinessBlocks)}`);
  console.log(`- v1.1 promotion assessment: ${validation.v1_1AnalyticalOutcome}`);
  console.log("");
  console.log("Production model changed: no");
  console.log("v1.1 live use allowed: no");
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function format(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(2).replace(/\.00$/, "");
}

main().finally(async () => prisma.$disconnect());
