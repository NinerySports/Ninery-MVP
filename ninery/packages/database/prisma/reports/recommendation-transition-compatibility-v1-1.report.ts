import {
  evaluateTransitionCompatibilityVersions,
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1,
  type TransitionCompatibilityResult,
  type TransitionCompatibilityV1_1Result
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Rawlings ICON 2026");
  if (!currentProfile) throw new Error("Current demo bat profile Rawlings ICON 2026 was not found.");
  const rows = request.canonicalProfiles.map((profile) => ({
    profile,
    versions: evaluateTransitionCompatibilityVersions({
      playerDNA: request.playerInput,
      currentEquipmentProfile: currentProfile,
      proposedEquipmentProfile: profile,
      evaluatedAt: request.evaluatedAt
    })
  }));

  console.log("Transition Compatibility v1.1 Candidate");
  console.log("");
  for (const row of rows) {
    console.log(row.profile.equipmentName);
    if (row.profile.variantLabel) console.log(`Variant: ${row.profile.variantLabel}`);
    printPair(row.versions.v1_0, row.versions.v1_1);
    console.log("");
  }
  printOrdering("v1.0 ordering", rows.map((row) => ({ name: row.profile.equipmentName, result: row.versions.v1_0 })));
  printOrdering("v1.1 ordering", rows.map((row) => ({ name: row.profile.equipmentName, result: row.versions.v1_1 })));
  console.log(`Production version: v${TRANSITION_COMPATIBILITY_MODEL_VERSION} remains unchanged`);
  console.log(`v1.1 candidate version: v${TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1}`);
  console.log("v1.1 live use: no");
  console.log("Production recommendation behavior changed: no");
}

function printPair(v1: TransitionCompatibilityResult, v11: TransitionCompatibilityV1_1Result) {
  console.log(`v1.0 score: ${v1.score ?? "blocked"}`);
  console.log(`v1.1 score: ${v11.score ?? "blocked"}`);
  console.log(`band: ${v11.band ?? "n/a"}`);
  console.log(`confidence: ${v11.confidence}`);
  console.log(`status: ${v11.status}`);
  console.log("v1.1 adjustment demand:");
  for (const dimension of v11.dimensions) console.log(`- ${dimension.dimension}: demand ${dimension.finalAdjustmentDemand ?? "missing"}, compatibility ${dimension.compatibilityScore ?? "missing"}`);
}

function printOrdering(label: string, rows: readonly { readonly name: string; readonly result: { readonly score?: number } }[]) {
  console.log(`${label}:`);
  rows
    .filter((row) => row.result.score !== undefined)
    .sort((a, b) => (b.result.score ?? -1) - (a.result.score ?? -1) || a.name.localeCompare(b.name))
    .forEach((row, index) => console.log(`${index + 1}. ${row.name} (${row.result.score})`));
  console.log("");
}

main().finally(async () => prisma.$disconnect());
