import {
  compareTransitionCompatibilityWithLegacyDimension,
  evaluateTransitionCompatibility,
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_PARENT_DEFINITION,
  TRANSITION_COMPATIBILITY_TECHNICAL_DEFINITION,
  transitionCompatibilityPolicy,
  type TransitionCompatibilityResult
} from "../../../recommendation-intelligence/src/index.ts";
import { CompatibilityScoringEngine } from "../../../recommendation-intelligence/src/scoring/compatibility-scoring-engine.ts";
import { loadCanonicalDemoRecommendationRequest, orderedLabels } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Rawlings ICON 2026");
  if (!currentProfile) throw new Error("Current demo bat profile Rawlings ICON 2026 was not found.");
  const legacy = new CompatibilityScoringEngine().score({
    playerDNA: request.playerInput,
    equipment: [...request.legacyEquipmentInputs],
    context: request.requestContext
  });
  const legacyItems = orderedItems(legacy);
  const results = request.canonicalProfiles.map((profile) => evaluateTransitionCompatibility({
    playerDNA: request.playerInput,
    currentEquipmentProfile: currentProfile,
    proposedEquipmentProfile: profile,
    evaluatedAt: request.evaluatedAt
  }));

  console.log(`Transition Compatibility Intelligence v${TRANSITION_COMPATIBILITY_MODEL_VERSION}`);
  console.log("");
  console.log("Technical definition:");
  console.log(TRANSITION_COMPATIBILITY_TECHNICAL_DEFINITION);
  console.log("");
  console.log("Parent-friendly definition:");
  console.log(TRANSITION_COMPATIBILITY_PARENT_DEFINITION);
  console.log("");
  console.log(`Recommendation use policy: ${transitionCompatibilityPolicy.recommendationUsePolicy}`);
  console.log("Production ranking use: no");
  console.log("");
  console.log("Player:");
  console.log("Jackson Sanders");
  printPlayerReadiness(results[0]);
  console.log("");
  console.log("Current bat:");
  console.log(`${currentProfile.equipmentName} - ${currentProfile.variantLabel ?? "selected variant"}`);
  printCurrentContext(results[0]);
  console.log("");

  for (const result of results) {
    const profile = request.canonicalProfiles.find((candidate) => candidate.equipmentId === result.proposedEquipmentId);
    const legacyInput = request.legacyEquipmentInputs.find((candidate) => candidate.equipmentId === result.proposedEquipmentId && candidate.variantId === result.proposedEquipmentVariantId);
    const legacyItem = legacyItems.find((item) => item.equipment.equipmentId === result.proposedEquipmentId && item.equipment.variantId === result.proposedEquipmentVariantId);
    const comparison = compareTransitionCompatibilityWithLegacyDimension({
      result,
      legacy: {
        equipmentId: result.proposedEquipmentId,
        equipmentVariantId: result.proposedEquipmentVariantId,
        legacyTransitionFriendliness: legacyInput?.scores.transitionFriendliness,
        dimensions: legacyItem?.dimensions ?? [],
        reasonCodes: legacyItem?.explanation.topReasons.map((reason) => reason.dimension),
        tradeoffCodes: legacyItem?.explanation.tradeoffs
      }
    });

    console.log(profile?.equipmentName ?? result.proposedEquipmentId);
    if (profile?.variantLabel) console.log(`Variant: ${profile.variantLabel}`);
    if (result.currentEquipmentId === result.proposedEquipmentId && result.currentEquipmentVariantId === result.proposedEquipmentVariantId) {
      console.log("Scenario: same current-bat setup");
    }
    console.log(`Score: ${result.score ?? "blocked"}`);
    console.log(`Band: ${result.band ?? "n/a"}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Status: ${result.status}`);
    console.log("");
    console.log("Adjustment demand:");
    result.dimensions.forEach((dimension) => {
      console.log(`- ${dimension.dimension}: demand ${dimension.finalAdjustmentDemand ?? "missing"}, compatibility ${dimension.compatibilityScore ?? "missing"} (${dimension.status})`);
    });
    console.log("");
    console.log("Raw differences:");
    console.log(`- Length delta: ${format(result.changeProfile.rawDifferences.lengthDelta)} in.`);
    console.log(`- Weight delta: ${format(result.changeProfile.rawDifferences.weightDelta)} oz.`);
    console.log(`- Drop delta: ${format(result.changeProfile.rawDifferences.dropDelta)}`);
    console.log(`- Balance delta: ${format(result.changeProfile.rawDifferences.balanceDelta)}`);
    console.log(`- Swing-effort delta: ${format(result.changeProfile.rawDifferences.swingEffortDelta)}`);
    console.log("");
    console.log("Strongest reasons:");
    result.reasons.slice(0, 4).forEach((reason) => console.log(`- ${reason.message}`));
    console.log("");
    console.log("Tradeoffs:");
    if (!result.tradeoffs.length) console.log("- none");
    result.tradeoffs.forEach((tradeoff) => console.log(`- ${tradeoff.message}`));
    console.log("");
    console.log("Missing information:");
    if (!result.missingInformation.length) console.log("- none");
    result.missingInformation.forEach((missing) => console.log(`- ${missing.key}: ${missing.effect}`));
    console.log("");
    console.log(`Legacy transitionFriendliness: ${comparison.legacyTransitionFriendliness ?? "missing"}`);
    console.log(`Legacy TRANSITION_READINESS_FIT: ${comparison.legacyTransitionFit ?? "missing"}`);
    console.log(`Comparison: ${comparison.status}`);
    console.log(`Friendliness delta: ${format(comparison.scoreDeltas.friendliness)}`);
    console.log(`Fit delta: ${format(comparison.scoreDeltas.fit)}`);
    console.log(`Explanation: ${comparison.explanation}`);
    console.log("");
  }

  printRanking("Shadow transition ordering", results
    .filter((result) => result.score !== undefined)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.proposedEquipmentId.localeCompare(b.proposedEquipmentId))
    .map((result) => request.canonicalProfiles.find((profile) => profile.equipmentId === result.proposedEquipmentId)?.equipmentName ?? result.proposedEquipmentId));
  printRanking("Legacy recommendation ranking", orderedLabels(legacy));
  console.log("Legacy recommendation ranking remains authoritative.");
  console.log("");
  console.log("Live source:");
  console.log("legacy");
  console.log("");
  console.log("Transition compatibility affects live result:");
  console.log("no");
}

function printPlayerReadiness(result: TransitionCompatibilityResult | undefined) {
  if (!result) return;
  console.log(`Bat-control readiness: ${result.playerReadiness.batControlReadiness ?? "missing"}`);
  console.log(`Physical readiness: ${result.playerReadiness.physicalReadiness ?? "missing"}`);
  console.log(`Experience readiness: ${result.playerReadiness.experienceReadiness ?? "missing"}`);
  console.log(`Development readiness: ${result.playerReadiness.developmentReadiness ?? "missing"}`);
  console.log(`Equipment-change tolerance: ${result.playerReadiness.equipmentChangeTolerance ?? "missing"}`);
  console.log(`Profile confidence: ${result.playerReadiness.confidence}`);
}

function printCurrentContext(result: TransitionCompatibilityResult | undefined) {
  if (!result) return;
  console.log(`Length: ${result.currentEquipment.length ?? "missing"} in.`);
  console.log(`Weight: ${result.currentEquipment.weight ?? "missing"} oz.`);
  console.log(`Drop: ${result.currentEquipment.drop ?? "missing"}`);
  console.log(`Balance profile: ${result.currentEquipment.balanceProfile ?? "missing"}`);
  console.log(`Swing effort: ${result.currentEquipment.swingEffort ?? "missing"}`);
}

function printRanking(label: string, values: readonly string[]) {
  console.log(`${label}:`);
  if (!values.length) console.log("- unavailable");
  values.forEach((value, index) => console.log(`${index + 1}. ${value}`));
  console.log("");
}

function orderedItems(result: ReturnType<CompatibilityScoringEngine["score"]>) {
  return [
    ...(result.primaryRecommendation ? [result.primaryRecommendation] : []),
    ...result.alternatives,
    ...result.nonRecommended
  ];
}

function format(value: number | undefined): string {
  if (value === undefined) return "n/a";
  return value > 0 ? `+${value}` : `${value}`;
}

main().finally(async () => prisma.$disconnect());
