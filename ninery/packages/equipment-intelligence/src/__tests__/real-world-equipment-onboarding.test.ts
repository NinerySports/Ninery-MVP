import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMARINI_THE_GOODS_2023_USA_30_20_SKU,
  assertQualitativeClaimDoesNotCreateNumericReference,
  demariniTheGoods2023UsaOnboardingPacket,
  reviewRealWorldEquipmentOnboardingPacket,
  validateRealWorldEquipmentOnboardingPacket,
  verifyPhysicalEquipment,
  type RealWorldEquipmentOnboardingPacket
} from "../onboarding/index.js";

test("validates the DeMarini onboarding identity and variant", () => {
  assert.deepEqual(validateRealWorldEquipmentOnboardingPacket(demariniTheGoods2023UsaOnboardingPacket), []);
  const review = reviewRealWorldEquipmentOnboardingPacket(demariniTheGoods2023UsaOnboardingPacket);
  assert.equal(review.identityReady, true);
  assert.equal(review.specificationReady, true);
  assert.equal(review.variantSkus[0], DEMARINI_THE_GOODS_2023_USA_30_20_SKU);
});

test("preserves unknown required behavior attributes instead of fabricating values", () => {
  const review = reviewRealWorldEquipmentOnboardingPacket(demariniTheGoods2023UsaOnboardingPacket);
  assert.equal(review.canonicalProfileReady, false);
  assert.equal(review.liveRecommendationActivationAllowed, false);
  assert.deepEqual(review.unresolvedAttributes, [
    "swing_effort",
    "forgiveness",
    "sweet_spot_support",
    "bat_control_support"
  ]);
});

test("rejects duplicate variant SKUs", () => {
  const duplicate = {
    ...demariniTheGoods2023UsaOnboardingPacket,
    variants: [
      ...demariniTheGoods2023UsaOnboardingPacket.variants,
      demariniTheGoods2023UsaOnboardingPacket.variants[0]
    ]
  };
  assert.match(validateRealWorldEquipmentOnboardingPacket(duplicate).join(" "), /Duplicate variant SKU/);
});

test("does not allow qualitative claims to create numeric precision", () => {
  assert.throws(
    () =>
      assertQualitativeClaimDoesNotCreateNumericReference({
        evidenceKey: "claim-light-swing",
        classification: "retailer_product_specification",
        nature: "claimed",
        sourceName: "Example retailer claim",
        sourceReference: "example:claim",
        method: "manual_review",
        attributeKey: "swing_effort",
        targetLevel: "equipment",
        rawValue: "light swing weight",
        normalizedValue: 25,
        notes: "This should remain a claim, not an exact measurement."
      }),
    /Qualitative published claims/
  );
});

test("preserves conflicting qualitative evidence for review", () => {
  const packet = {
    ...demariniTheGoods2023UsaOnboardingPacket,
    evidence: [
      ...demariniTheGoods2023UsaOnboardingPacket.evidence,
      {
        evidenceKey: "claim-balanced",
        classification: "retailer_product_specification",
        nature: "claimed",
        sourceName: "Retailer A",
        sourceReference: "ticket-045:claim:a",
        method: "manual_review",
        attributeKey: "balance_profile",
        targetLevel: "equipment",
        rawValue: "balanced",
        normalizedValue: "balanced",
        notes: "Claim retained as qualitative evidence."
      },
      {
        evidenceKey: "claim-end-loaded",
        classification: "retailer_product_specification",
        nature: "claimed",
        sourceName: "Retailer B",
        sourceReference: "ticket-045:claim:b",
        method: "manual_review",
        attributeKey: "balance_profile",
        targetLevel: "equipment",
        rawValue: "end loaded",
        normalizedValue: "end_loaded",
        notes: "Conflicting claim retained for review."
      }
    ]
  } as const satisfies RealWorldEquipmentOnboardingPacket;
  const review = reviewRealWorldEquipmentOnboardingPacket(packet);
  assert.deepEqual(review.conflictingEvidence, ["equipment:equipment:balance_profile"]);
});

test("physical verification confirms identity without proving subjective DNA", () => {
  const result = verifyPhysicalEquipment(demariniTheGoods2023UsaOnboardingPacket, {
    manufacturer: "DeMarini",
    model: "The Goods",
    modelYear: 2023,
    certification: "USA",
    lengthInches: 30,
    weightOunces: 20,
    dropWeight: -10,
    productIdentifier: "WBD2359010"
  });
  assert.equal(result.verified, true);
  assert.match(result.reasons.join(" "), /does not prove subjective Equipment DNA/);
});
