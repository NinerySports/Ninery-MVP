import {
  compareConfidenceCompatibilityWithLegacyDimension,
  evaluateConfidenceCompatibility,
  CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
  CONFIDENCE_COMPATIBILITY_PARENT_DEFINITION,
  CONFIDENCE_COMPATIBILITY_TECHNICAL_DEFINITION,
  confidenceCompatibilityPolicy,
  type ConfidenceCompatibilityResult
} from "../../../recommendation-intelligence/src/index.ts";
import { CompatibilityScoringEngine } from "../../../recommendation-intelligence/src/scoring/compatibility-scoring-engine.ts";
import { loadCanonicalDemoRecommendationRequest, orderedLabels } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const legacy = new CompatibilityScoringEngine().score({
    playerDNA: request.playerInput,
    equipment: [...request.legacyEquipmentInputs],
    context: request.requestContext
  });
  const legacyItems = orderedItems(legacy);
  const results = request.canonicalProfiles.map((profile) => evaluateConfidenceCompatibility({
    playerDNA: request.playerInput,
    canonicalEquipmentProfile: profile,
    evaluatedAt: request.evaluatedAt
  }));

  console.log(`Confidence Compatibility Intelligence v${CONFIDENCE_COMPATIBILITY_MODEL_VERSION}`);
  console.log("");
  console.log("Technical definition:");
  console.log(CONFIDENCE_COMPATIBILITY_TECHNICAL_DEFINITION);
  console.log("");
  console.log("Parent-friendly definition:");
  console.log(CONFIDENCE_COMPATIBILITY_PARENT_DEFINITION);
  console.log("");
  console.log(`Recommendation use policy: ${confidenceCompatibilityPolicy.recommendationUsePolicy}`);
  console.log("Production ranking use: no");
  console.log("");
  console.log("Player:");
  console.log(`${request.playerInput.inputSnapshot.player.id === request.playerInput.playerId ? "Jackson Sanders" : request.playerInput.playerId}`);
  printPlayerProfile(results[0]);
  console.log("");

  for (const result of results) {
    const legacyItem = legacyItems.find((item) => item.equipment.equipmentId === result.equipmentId && item.equipment.variantId === result.equipmentVariantId);
    const comparison = compareConfidenceCompatibilityWithLegacyDimension({
      result,
      legacy: {
        equipmentId: result.equipmentId,
        equipmentVariantId: result.equipmentVariantId,
        dimensions: legacyItem?.dimensions ?? [],
        reasonCodes: legacyItem?.explanation.topReasons.map((reason) => reason.dimension),
        tradeoffCodes: legacyItem?.explanation.tradeoffs
      }
    });
    const profile = request.canonicalProfiles.find((candidate) => candidate.equipmentId === result.equipmentId);
    console.log(profile?.equipmentName ?? result.equipmentId);
    if (profile?.variantLabel) console.log(`Variant: ${profile.variantLabel}`);
    console.log(`Score: ${result.score ?? "blocked"}`);
    console.log(`Band: ${result.band ?? "n/a"}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Status: ${result.status}`);
    console.log("");
    console.log("Dimension scores:");
    for (const dimension of result.dimensions) {
      console.log(`- ${dimension.dimension}: ${dimension.score ?? "missing"} (${dimension.status}; need ${dimension.playerNeed ?? "missing"}, support ${dimension.equipmentSupport ?? "missing"})`);
    }
    console.log("");
    console.log("Strongest reasons:");
    result.reasons.slice(0, 4).forEach((reason) => console.log(`- ${reason.message}`));
    console.log("");
    console.log("Tradeoffs:");
    if (result.tradeoffs.length === 0) console.log("- none");
    result.tradeoffs.forEach((tradeoff) => console.log(`- ${tradeoff.message}`));
    console.log("");
    console.log("Missing information:");
    if (result.missingInformation.length === 0) console.log("- none");
    result.missingInformation.forEach((missing) => console.log(`- ${missing.key}: ${missing.effect}`));
    console.log("");
    console.log(`Legacy CONFIDENCE_BUILDING_FIT: ${comparison.legacyConfidenceBuildingFit ?? "missing"}`);
    console.log(`Legacy DEVELOPMENT_GOAL_FIT: ${comparison.legacyDevelopmentGoalFit ?? "missing"}`);
    console.log(`Comparison: ${comparison.status}`);
    console.log(`Confidence delta: ${format(comparison.scoreDeltas.confidenceBuilding)}`);
    console.log(`Development-goal delta: ${format(comparison.scoreDeltas.developmentGoal)}`);
    console.log(`Explanation: ${comparison.explanation}`);
    console.log("");
  }

  printRanking("Shadow confidence-compatibility ordering", results
    .filter((result) => result.score !== undefined)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.equipmentId.localeCompare(b.equipmentId))
    .map((result) => request.canonicalProfiles.find((profile) => profile.equipmentId === result.equipmentId)?.equipmentName ?? result.equipmentId));
  printRanking("Legacy recommendation ranking", orderedLabels(legacy));
  console.log("Legacy recommendation ranking remains authoritative.");
  console.log("");
  console.log("Live source:");
  console.log("legacy");
  console.log("");
  console.log("Confidence compatibility affects live result:");
  console.log("no");
}

function printPlayerProfile(result: ConfidenceCompatibilityResult | undefined) {
  const profile = result?.playerProfile;
  if (!profile) return;
  console.log(`Development stage: ${profile.developmentStage ?? "missing"}`);
  console.log(`Bat-control support need: ${profile.batControlNeed ?? "missing"}`);
  console.log(`Contact-consistency support need: ${profile.contactConsistencyNeed ?? "missing"}`);
  console.log(`Predictability support need: ${profile.predictabilityNeed ?? "missing"}`);
  console.log(`Manageable-effort support need: ${profile.manageableEffortNeed ?? "missing"}`);
  console.log(`Profile confidence: ${profile.confidence}`);
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
