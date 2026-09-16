import {
  validateCompatibilityModels,
  type CompatibilityModelValidationResult
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

const reportDate = new Date("2026-08-04T00:00:00.000Z");

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.variantLabel === "RAW-ICON-USA-30-22");
  if (!currentProfile) throw new Error("Current demo bat RAW-ICON-USA-30-22 was not found.");

  const legacyDimensionInputs = await buildLegacyInputs(request);
  const suite = validateCompatibilityModels({
    basePlayerDNA: request.playerInput,
    canonicalProfiles: request.canonicalProfiles,
    currentEquipmentProfile: currentProfile,
    confidenceLegacyInputs: legacyDimensionInputs,
    transitionLegacyInputs: legacyDimensionInputs.map((legacy) => ({
      equipmentId: legacy.equipmentId,
      equipmentVariantId: legacy.equipmentVariantId,
      legacyTransitionFriendliness: request.legacyEquipmentInputs.find((profile) => profile.equipmentId === legacy.equipmentId)?.scores.transitionFriendliness,
      dimensions: legacy.dimensions,
      reasonCodes: legacy.reasonCodes,
      tradeoffCodes: legacy.tradeoffCodes
    })),
    evaluatedAt: reportDate
  });

  console.log("Compatibility Intelligence Validation v1.0");
  console.log("");
  for (const result of suite.results) printResult(result);
  console.log("Live recommendation use allowed:");
  console.log(String(suite.liveRecommendationUseAllowed));
  console.log("");
  console.log("No compatibility validation result changes live scoring, rankings, APIs, routes, database schema, BatMatch demo output, or web UI.");
}

function printResult(result: CompatibilityModelValidationResult) {
  const title = result.model === "confidence_compatibility" ? "CONFIDENCE COMPATIBILITY" : "TRANSITION COMPATIBILITY";
  console.log(title);
  console.log("");
  console.log(`Synthetic player profiles: ${result.syntheticMatrix.playerProfiles.length}`);
  console.log(`Completed evaluations: ${completedFor(result)}/${result.syntheticMatrix.playerProfiles.length * result.syntheticMatrix.equipment.length}`);
  console.log(`Blocked evaluations: ${blockedFor(result)}`);
  console.log(`Partial evaluations: ${partialFor(result)}`);
  console.log(`Average per-player score range: ${format(result.scoreSeparation.averagePerPlayerRange)}`);
  console.log(`Minimum per-player score range: ${format(result.scoreSeparation.minimumPerPlayerRange)}`);
  console.log(`Maximum per-player score range: ${format(result.scoreSeparation.maximumPerPlayerRange)}`);
  console.log(`Player differentiation: ${pass(result.playerDifferentiation.sufficient)}`);
  console.log(`Equipment differentiation: ${pass(result.equipmentDifferentiation.sufficient)}`);
  console.log(`Stability: ${pass(result.stability.stable)} (max minor delta ${format(result.stability.maximumMinorPerturbationDelta)})`);
  console.log(`Meaningful-input sensitivity: ${pass(result.sensitivity.sensitive)}`);
  console.log(`Directional checks: ${pass(result.monotonicity.passed)}`);
  console.log(`Missing-input behavior: ${pass(result.missingInputBehavior.safe)}`);
  console.log(`Confidence calibration: ${pass(result.confidenceCalibration.reasonable)}`);
  console.log(`Legacy comparison: ${pass(result.legacyComparison.sufficient)} (${result.legacyComparison.materialDivergenceCount} material divergences)`);
  console.log(`Reason quality: ${pass(result.explanationQuality.sufficient)}`);
  console.log(`Language safety: ${pass(result.languageSafety.safe)}`);
  console.log(`Double-counting risk: ${result.doubleCounting.highestRisk}`);
  console.log(`Promotion outcome: ${result.promotionDecision.outcome}`);
  console.log(`Extended shadow eligible: ${String(result.promotionDecision.eligibleForExtendedShadow)}`);
  console.log(`Internal candidate eligible: ${String(result.promotionDecision.eligibleForInternalCandidate)}`);
  console.log(`Explanation-only eligible: ${String(result.promotionDecision.eligibleForExplanationOnly)}`);
  console.log("Primary limitations:");
  for (const item of [...result.promotionDecision.failedCriteria.map((criterion) => criterion.explanation), ...result.promotionDecision.warnings.map((warning) => warning.message)].slice(0, 4)) {
    console.log(`- ${item}`);
  }
  console.log("Next actions:");
  for (const action of result.nextActions) console.log(`- ${action}`);
  console.log("Live ranking use: no");
  console.log("Live explanation use: no");
  console.log("");
}

async function buildLegacyInputs(request: Awaited<ReturnType<typeof loadCanonicalDemoRecommendationRequest>>) {
  const service = await import("../../../recommendation-intelligence/src/index.ts");
  const engine = new service.CompatibilityScoringEngine();
  const dimensions = request.legacyEquipmentInputs.map((equipment) => ({
    equipment,
    dimensions: engine.score({ playerDNA: request.playerInput, equipment: [equipment], context: request.requestContext }).primaryRecommendation?.dimensions ?? []
  }));
  return dimensions.map((item) => ({
    equipmentId: item.equipment.equipmentId,
    equipmentVariantId: item.equipment.equipmentVariantId,
    dimensions: item.dimensions.map((dimension) => ({ code: dimension.code, rawScore: dimension.rawScore })),
    reasonCodes: item.dimensions.filter((dimension) => dimension.rawScore >= 75).map((dimension) => dimension.code),
    tradeoffCodes: item.dimensions.filter((dimension) => dimension.rawScore < 65).map((dimension) => dimension.code)
  }));
}

function completedFor(result: CompatibilityModelValidationResult): number {
  return result.syntheticMatrix.evaluations.filter((evaluation) => (result.model === "confidence_compatibility" ? evaluation.confidenceCompatibility : evaluation.transitionCompatibility)?.status === "completed").length;
}

function blockedFor(result: CompatibilityModelValidationResult): number {
  return result.syntheticMatrix.evaluations.filter((evaluation) => (result.model === "confidence_compatibility" ? evaluation.confidenceCompatibility : evaluation.transitionCompatibility)?.status.startsWith("blocked")).length;
}

function partialFor(result: CompatibilityModelValidationResult): number {
  return result.syntheticMatrix.evaluations.filter((evaluation) => (result.model === "confidence_compatibility" ? evaluation.confidenceCompatibility : evaluation.transitionCompatibility)?.status === "partial").length;
}

function pass(value: boolean): string {
  return value ? "pass" : "review";
}

function format(value: number | undefined): string {
  return value === undefined ? "n/a" : value.toFixed(2).replace(/\.00$/, "");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
