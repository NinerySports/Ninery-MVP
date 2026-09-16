import {
  auditLegacyBalanceSemantics,
  validateBalanceNumericReference
} from "../../../equipment-intelligence/src/index.ts";
import { loadEquipmentDNANumericReferenceProfile } from "../../../equipment-intelligence/src/index.ts";
import {
  selectCanonicalCandidateAttributeSourcesWithBalance
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const audit = auditLegacyBalanceSemantics();
  console.log("Equipment DNA Balance Reference");
  console.log("");
  console.log(`Audit version: ${audit.version}`);
  console.log(`Audit conclusion: ${audit.conclusion}`);
  console.log(`Legacy meaning: ${audit.semanticMeaning}`);
  console.log(`Legacy low value: ${audit.lowValueMeaning}`);
  console.log(`Legacy high value: ${audit.highValueMeaning}`);
  console.log(`Conversion strategy: ${audit.canonicalDirection}`);
  console.log("Canonical direction: 0 = most balanced, 100 = most end-loaded");
  console.log("");

  for (const legacy of request.legacyEquipmentInputs) {
    const sourceValue = legacy.scores.balance;
    console.log(`${legacy.manufacturer} ${legacy.model} ${legacy.modelYear ?? ""}`.trim());
    console.log(`Variant: ${legacy.selectedVariant?.sku ?? legacy.variantId ?? "model"}`);
    if (sourceValue === undefined) {
      console.log("Balance reference: unavailable");
      console.log("Reason: legacy balance score missing");
      console.log("");
      continue;
    }
    const profile = request.canonicalProfiles.find((candidate) => candidate.equipmentId === legacy.equipmentId && candidate.equipmentVariantId === legacy.variantId);
    const balanceAttribute = profile?.attributes.find((attribute) => attribute.key === "balance_profile");
    const numericProfile = profile ? loadEquipmentDNANumericReferenceProfile(profile) : undefined;
    const balanceReference = numericProfile?.references.find((reference) => reference.attributeKey === "balance_profile")?.numericReference;
    const evidenceLinked = Boolean(balanceAttribute?.evidence.length);
    const active = balanceAttribute?.status === "active";
    const validation = validateBalanceNumericReference({
      ordinal: String(balanceAttribute?.value ?? "very_balanced") as "very_balanced" | "balanced" | "slightly_end_loaded" | "end_loaded" | "very_end_loaded",
      numericReference: balanceReference,
      conversionExplanation: balanceAttribute?.rationale,
      sourceValue: balanceReference?.sourceScore
    });
    const admission = request.admissionDecisions.find((candidate) => candidate.equipmentId === legacy.equipmentId && candidate.equipmentVariantId === legacy.variantId);
    const numericReferences = numericProfile
      ? numericProfile.references.map((reference) => reference.numericReference).filter((reference): reference is NonNullable<typeof reference> => Boolean(reference))
      : [];
    const selection = profile && admission
      ? selectCanonicalCandidateAttributeSourcesWithBalance({
        canonicalProfile: profile,
        admissionDecision: admission,
        numericReferences,
        evaluatedAt: request.evaluatedAt
      }).decisions.find((decision) => decision.attributeKey === "balance_profile")
      : undefined;

    console.log(`Evaluation status: ${active ? "active" : "missing"}`);
    console.log(`Evidence linked: ${evidenceLinked ? "yes" : "no"}`);
    console.log(`Legacy balance source value: ${balanceReference?.sourceScore ?? sourceValue}`);
    console.log(`Canonical balance numeric reference: ${balanceReference?.numericValue ?? "missing"}`);
    console.log(`Canonical ordinal: ${String(balanceAttribute?.value ?? "missing")}`);
    console.log("Conversion: inverse");
    console.log(`Confidence: ${balanceReference?.confidence ?? balanceAttribute?.confidence ?? "missing"}`);
    console.log(`Evidence method: ${balanceReference?.referenceMethod ?? balanceAttribute?.evaluationMethod ?? "missing"}`);
    console.log(`Ordinal consistency: ${validation.valid ? "PASS" : "FAIL"}`);
    console.log(`Source selection eligible: ${selection?.candidateInputAllowed ? "yes" : "no"}`);
    if (selection && !selection.candidateInputAllowed) {
      console.log(`Selection outcome: ${selection.outcome}`);
      console.log(`Selection reason: ${[...selection.reasons, ...selection.warnings].map((item) => item.message).join(" ")}`);
    }
    if (!validation.valid) console.log(`Validation errors: ${validation.errors.join("; ")}`);
    console.log("");
  }

  console.log("Persistence decision:");
  console.log("No Prisma schema change. Ticket #020 evidence/evaluation records represent the active balance_profile data.");
  console.log("");
  console.log("Live recommendation source:");
  console.log("legacy");
  console.log("");
  console.log("Balance reference changes live behavior:");
  console.log("no");
}

main().finally(async () => prisma.$disconnect());
