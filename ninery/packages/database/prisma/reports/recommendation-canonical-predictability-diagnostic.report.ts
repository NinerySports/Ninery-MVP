import {
  loadEquipmentDNANumericReferenceProfile,
  predictabilitySupportCompositePolicy
} from "../../../equipment-intelligence/src/index.ts";
import { runCanonicalCandidateBalanceComparison } from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest, orderedLabels } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const balance = await runCanonicalCandidateBalanceComparison({ request });
  console.log("Canonical Recommendation Predictability Diagnostic");
  console.log("");
  console.log(`Bridge strategy: ${predictabilitySupportCompositePolicy.bridgeStrategy}`);
  console.log("Execution: blocked");
  console.log("Reason: predictability_support is equipment-side response consistency, while legacy confidenceBuilding is player-relative confidence support. Direct substitution into confidenceBuilding is prohibited.");
  console.log("");
  printRanking("Legacy authoritative", orderedLabels(balance.legacyAuthoritative));
  printRanking("Six-attribute balance-aware candidate", balance.balanceAwareCandidate ? orderedLabels(balance.balanceAwareCandidate) : []);
  console.log("Seven-attribute predictability-aware candidate:");
  console.log("- blocked by profile_only bridge strategy");
  console.log("");

  console.log("Predictability vs legacy confidenceBuilding:");
  for (const legacy of request.legacyEquipmentInputs) {
    const profile = request.canonicalProfiles.find((candidate) => candidate.equipmentId === legacy.equipmentId && candidate.equipmentVariantId === legacy.variantId);
    const attribute = profile?.attributes.find((candidate) => candidate.key === "predictability_support");
    const numeric = profile
      ? loadEquipmentDNANumericReferenceProfile(profile).references.find((reference) => reference.attributeKey === "predictability_support")?.numericReference
      : undefined;
    const difference = numeric?.numericValue !== undefined && legacy.scores.confidenceBuilding !== undefined
      ? round(numeric.numericValue - legacy.scores.confidenceBuilding)
      : undefined;
    console.log(`- ${legacy.manufacturer} ${legacy.model} ${legacy.modelYear ?? ""}`.trim());
    console.log(`  predictability ordinal: ${String(attribute?.value ?? "missing")}`);
    console.log(`  predictability numeric: ${numeric?.numericValue ?? "missing"}`);
    console.log(`  legacy confidenceBuilding: ${legacy.scores.confidenceBuilding ?? "missing"}`);
    console.log(`  descriptive difference: ${difference === undefined ? "missing" : format(difference)}`);
  }
  console.log("");

  console.log("Impact analysis:");
  console.log(`Balance-aware score variance from five-attribute baseline: ${format(balance.balanceImpact.averageScoreVarianceAfter)}`);
  console.log("Predictability score variance: n/a");
  console.log("Reason alignment impact: n/a; no semantic bridge into CONFIDENCE_BUILDING_FIT was run.");
  console.log("Tradeoff alignment impact: n/a; no semantic bridge into CONFIDENCE_BUILDING_FIT was run.");
  console.log("Residual resolution: equipment-side confidence building is represented by predictability_support; player-relative confidence_compatibility is implemented in shadow and still not production-resolved.");
  console.log("");
  console.log("Live source:");
  console.log(balance.liveRecommendationSource);
  console.log("");
  console.log("Candidate affects live result:");
  console.log(balance.candidateAffectsLiveResult ? "yes" : "no");
}

function printRanking(label: string, values: readonly string[]) {
  console.log(`${label}:`);
  if (values.length === 0) console.log("- unavailable");
  values.forEach((value, index) => console.log(`${index + 1}. ${value}`));
  console.log("");
}

function format(value: number | undefined): string {
  if (value === undefined) return "n/a";
  return value > 0 ? `+${value}` : `${value}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

main().finally(async () => prisma.$disconnect());
