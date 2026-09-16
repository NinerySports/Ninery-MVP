import { validateCompatibilityModels } from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

const reportDate = new Date("2026-08-04T00:00:00.000Z");

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.variantLabel === "RAW-ICON-USA-30-22");
  if (!currentProfile) throw new Error("Current demo bat RAW-ICON-USA-30-22 was not found.");
  const suite = validateCompatibilityModels({
    basePlayerDNA: request.playerInput,
    canonicalProfiles: request.canonicalProfiles,
    currentEquipmentProfile: currentProfile,
    evaluatedAt: reportDate
  });
  const matrix = suite.results[0]?.syntheticMatrix;
  if (!matrix) throw new Error("Compatibility matrix was not generated.");

  console.log("Compatibility Synthetic Matrix v1.0");
  console.log("");
  printMatrix("Confidence Compatibility", "confidence");
  printMatrix("Transition Compatibility", "transition");
  console.log("Synthetic profiles persisted: no");
  console.log("Live recommendation use: no");

  function printMatrix(title: string, model: "confidence" | "transition") {
    console.log(title);
    for (const profile of matrix.playerProfiles) {
      console.log(profile.label);
      for (const equipment of matrix.equipment) {
        const evaluation = matrix.evaluations.find((item) => item.profileId === profile.profileId && item.equipmentId === equipment.equipmentId);
        const result = model === "confidence" ? evaluation?.confidenceCompatibility : evaluation?.transitionCompatibility;
        const score = result?.score === undefined ? result?.status ?? "n/a" : format(result.score);
        console.log(`- ${equipment.equipmentName}: ${score}`);
      }
    }
    console.log("");
  }
}

function format(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
