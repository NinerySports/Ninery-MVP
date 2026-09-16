import type { BehavioralEquipmentDNAAttributeKey } from "../real-world-behavioral-evaluation.types.js";

export const STANDALONE_ABSOLUTE_EVIDENCE_SYNTHESIS_VERSION = "1.0";
export const CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION = "1.0";

export const standaloneAbsolutePromotionPolicy = {
  minimumIndependentStandaloneSources: 2,
  confidenceForExactIndependentAgreement: "moderate",
  confidenceForBoundedAdjacentAgreement: "estimated",
  promotionEvaluationMethod: "multi_evaluator_consensus",
  promotedEvaluationVersion: 1
} as const;

export const standaloneAbsoluteBehavioralAttributes = [
  "swing_effort",
  "bat_control_support",
  "forgiveness",
  "sweet_spot_support"
] as const satisfies readonly BehavioralEquipmentDNAAttributeKey[];

export const swingEffortOrdinalScale = [
  "very_easy",
  "easy",
  "moderate",
  "demanding",
  "very_demanding"
] as const;

export const supportOrdinalScale = [
  "very_low",
  "low",
  "moderate",
  "high",
  "very_high"
] as const;

export function ordinalScaleFor(attributeKey: BehavioralEquipmentDNAAttributeKey): readonly string[] {
  return attributeKey === "swing_effort" ? swingEffortOrdinalScale : supportOrdinalScale;
}

export function validateStandaloneAbsoluteEvidencePolicy() {
  const checks = [
    check("policy version present", STANDALONE_ABSOLUTE_EVIDENCE_SYNTHESIS_VERSION === "1.0"),
    check("promotion policy version present", CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION === "1.0"),
    check("two independent standalone sources required", standaloneAbsolutePromotionPolicy.minimumIndependentStandaloneSources === 2),
    check("exact agreement is not validated confidence", String(standaloneAbsolutePromotionPolicy.confidenceForExactIndependentAgreement) !== "validated"),
    check("bounded adjacent agreement stays estimated", standaloneAbsolutePromotionPolicy.confidenceForBoundedAdjacentAgreement === "estimated"),
    check("promotion method is multi evaluator consensus", standaloneAbsolutePromotionPolicy.promotionEvaluationMethod === "multi_evaluator_consensus"),
    check("swing effort uses demand scale", swingEffortOrdinalScale[0] === "very_easy" && swingEffortOrdinalScale.at(-1) === "very_demanding"),
    check("support attributes use support scale", supportOrdinalScale[0] === "very_low" && supportOrdinalScale.at(-1) === "very_high")
  ];
  return {
    verdict: checks.every((item) => item.passed) ? "pass" as const : "fail" as const,
    checks
  };
}

function check(name: string, passed: boolean, details = passed ? "pass" : "fail") {
  return { name, passed, details };
}
