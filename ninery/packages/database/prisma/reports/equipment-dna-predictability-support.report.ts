import {
  PREDICTABILITY_SUPPORT_PARENT_DEFINITION,
  PREDICTABILITY_SUPPORT_TECHNICAL_DEFINITION,
  loadEquipmentDNANumericReferenceProfile,
  predictabilityExcludedComponentRationales,
  predictabilitySupportCompositePolicy
} from "../../../equipment-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  console.log("Equipment DNA Predictability Support");
  console.log("");
  console.log(`Definition: ${PREDICTABILITY_SUPPORT_TECHNICAL_DEFINITION}`);
  console.log(`Parent copy: ${PREDICTABILITY_SUPPORT_PARENT_DEFINITION}`);
  console.log("Not allowed: confidence guaranteed; this bat will make the player confident.");
  console.log("");
  console.log(`Composite version: ${predictabilitySupportCompositePolicy.version}`);
  console.log(`Recommendation use policy: ${predictabilitySupportCompositePolicy.recommendationUsePolicy}`);
  console.log(`Bridge strategy: ${predictabilitySupportCompositePolicy.bridgeStrategy}`);
  console.log(`Normalization: ${predictabilitySupportCompositePolicy.normalizationStrategy}`);
  console.log(`Minimum coverage: ${predictabilitySupportCompositePolicy.minimumComponentCoverage}`);
  console.log("");
  console.log("Components:");
  for (const component of predictabilitySupportCompositePolicy.components) {
    console.log(`- ${component.attributeKey}: weight ${component.weight}, direction ${component.direction}, required ${component.required ? "yes" : "no"}`);
  }
  console.log("");
  console.log("Excluded components:");
  for (const [key, rationale] of Object.entries(predictabilityExcludedComponentRationales)) {
    console.log(`- ${key}: ${rationale}`);
  }
  console.log("");

  for (const profile of request.canonicalProfiles) {
    const attribute = profile.attributes.find((candidate) => candidate.key === "predictability_support");
    const numeric = loadEquipmentDNANumericReferenceProfile(profile).references.find((reference) => reference.attributeKey === "predictability_support");
    const evidence = attribute?.evidence[0];
    const raw = evidence?.rawValue;
    const components = raw && typeof raw === "object" && !Array.isArray(raw) && "components" in raw
      ? raw.components as Array<{ attributeKey: string; transformedValue?: number; weight: number; weightedContribution?: number; confidence: string }>
      : [];

    console.log(profile.equipmentName);
    console.log(`Evaluation status: ${attribute?.status ?? "missing"}`);
    console.log(`Evidence linked: ${attribute?.evidence.length ? "yes" : "no"}`);
    console.log(`Ordinal: ${String(attribute?.value ?? "missing")}`);
    console.log(`Numeric reference: ${numeric?.numericReference?.numericValue ?? "missing"}`);
    console.log(`Confidence: ${attribute?.confidence ?? "missing"}`);
    console.log(`Evidence method: ${numeric?.numericReference?.referenceMethod ?? attribute?.evaluationMethod ?? "missing"}`);
    console.log(`Component coverage: ${typeof raw === "object" && raw && !Array.isArray(raw) && "componentCoverage" in raw ? String(raw.componentCoverage) : "missing"}`);
    for (const component of components) {
      console.log(`- ${component.attributeKey}: transformed ${component.transformedValue ?? "missing"}, weight ${component.weight}, contribution ${component.weightedContribution ?? "missing"}, confidence ${component.confidence}`);
    }
    console.log(`Rationale: ${attribute?.rationale ?? "missing"}`);
    console.log("");
  }

  console.log("Live recommendation source:");
  console.log("legacy");
  console.log("");
  console.log("Predictability changes live behavior:");
  console.log("no");
}

main().finally(async () => prisma.$disconnect());
