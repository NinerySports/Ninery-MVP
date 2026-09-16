import { loadEquipmentDNANumericReferenceProfile } from "../../../equipment-intelligence/src/index.ts";
import {
  selectCanonicalCandidateAttributeSources,
  selectCanonicalCandidateAttributeSourcesWithBalance
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  console.log("Canonical Candidate Attribute-Source Selection");
  console.log("");

  for (const profile of request.canonicalProfiles) {
    const admissionDecision = request.admissionDecisions.find((decision) => decision.equipmentId === profile.equipmentId && decision.equipmentVariantId === profile.equipmentVariantId);
    if (!admissionDecision) continue;
    const numericProfile = loadEquipmentDNANumericReferenceProfile(profile);
    const selection = selectCanonicalCandidateAttributeSources({
      canonicalProfile: profile,
      admissionDecision,
      numericReferences: numericProfile.references.map((reference) => reference.numericReference).filter((reference): reference is NonNullable<typeof reference> => Boolean(reference)),
      evaluatedAt: request.evaluatedAt
    });
    console.log(profile.equipmentName);
    for (const decision of selection.decisions) {
      console.log("");
      console.log(decision.attributeKey);
      console.log(`Selected source: ${decision.selectedSource}`);
      console.log(`Ordinal: ${String(decision.canonicalOrdinalValue ?? "missing")}`);
      console.log(`Ordinal projection: ${decision.ordinalProjectedValue ?? "missing"}`);
      console.log(`Numeric reference: ${decision.numericReference?.value ?? "missing"}`);
      console.log(`Selected value: ${decision.selectedNumericValue ?? "blocked"}`);
      console.log(`Confidence: ${decision.numericReference?.confidence ?? "missing"}`);
      console.log(`Outcome: ${decision.outcome}`);
    }
    console.log("");
    const balanceSelection = selectCanonicalCandidateAttributeSourcesWithBalance({
      canonicalProfile: profile,
      admissionDecision,
      numericReferences: numericProfile.references.map((reference) => reference.numericReference).filter((reference): reference is NonNullable<typeof reference> => Boolean(reference)),
      evaluatedAt: request.evaluatedAt
    }).decisions.find((decision) => decision.attributeKey === "balance_profile");
    console.log("Optional balance_profile:");
    console.log(`Selected source: ${balanceSelection?.selectedSource ?? "missing"}`);
    console.log(`Numeric reference: ${balanceSelection?.numericReference?.value ?? "missing"}`);
    console.log(`Selected value: ${balanceSelection?.selectedNumericValue ?? "blocked"}`);
    console.log(`Confidence: ${balanceSelection?.numericReference?.confidence ?? "missing"}`);
    console.log(`Fallback used: ${balanceSelection?.fallbackUsed ? "yes" : "no"}`);
    console.log(`Outcome: ${balanceSelection?.outcome ?? "missing"}`);
    console.log("");
    const predictability = numericProfile.references.find((reference) => reference.attributeKey === "predictability_support");
    console.log("Optional predictability_support:");
    console.log(`Selected source: ${predictability?.numericReference ? "profile_only" : "missing"}`);
    console.log(`Numeric reference: ${predictability?.numericReference?.numericValue ?? "missing"}`);
    console.log(`Confidence: ${predictability?.numericReference?.confidence ?? "missing"}`);
    console.log("Fallback used: no");
    console.log("Outcome: blocked_no_safe_source");
    console.log("Reason: direct mapping to confidenceBuilding is prohibited; confidence_compatibility is shadow-only and not a canonical Equipment DNA source.");
    console.log("");
    console.log("Summary:");
    console.log(`Numeric references selected: ${selection.selectedNumericReferenceCount}`);
    console.log(`Ordinal fallbacks: ${selection.selectedOrdinalProjectionCount}`);
    console.log(`Blocked required attributes: ${selection.blockedRequiredAttributes.length}`);
    console.log(`Candidate input allowed: ${selection.candidateInputAllowed ? "yes" : "no"}`);
    console.log("");
  }
}

main().finally(async () => prisma.$disconnect());
