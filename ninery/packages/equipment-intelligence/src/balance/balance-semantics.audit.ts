import { LEGACY_BALANCE_SEMANTIC_AUDIT_VERSION, type LegacyBalanceSemanticAudit } from "./balance-semantics.types.js";

export function auditLegacyBalanceSemantics(): LegacyBalanceSemanticAudit {
  return {
    version: LEGACY_BALANCE_SEMANTIC_AUDIT_VERSION,
    legacyField: "balance",
    characteristicCode: "SWING_BALANCE",
    scale: "0_100",
    semanticMeaning: "balance_support",
    lowValueMeaning: "Lower values behave closer to end-loaded balance behavior in the current Recommendation Intelligence target model.",
    highValueMeaning: "Higher values behave closer to balanced or light-feel support in the current Recommendation Intelligence target model.",
    canonicalDirection: "inverse",
    intrinsicEnoughForMigration: true,
    engineUsage: {
      scoringDimensions: ["SWING_FEEL_BALANCE_FIT"],
      directScoring: true,
      inverseScoring: false,
      confidenceUse: true,
      reasonUse: true,
      tradeoffUse: true,
      rankingUse: true
    },
    evidence: [
      "EquipmentDNAAttribute balance_profile maps to legacy score attribute balance and characteristic SWING_BALANCE.",
      "Recommendation Intelligence sets balanceTarget to 85 for light, 70 for balanced, and 45 for end_loaded preferred swing feel.",
      "SWING_FEEL_BALANCE_FIT uses similarityScore(balanceTarget, scores.balance) without inverseScore().",
      "Missing balance creates dimension missingInformation and recommendation-confidence penalties."
    ],
    cautions: [
      "The legacy value is not an objective balance-point measurement.",
      "The legacy value is used relationally by Recommendation Intelligence when compared to player preferred swing feel.",
      "The canonical numeric direction is 0 most balanced to 100 most end-loaded, so legacy balance requires inverse conversion.",
      "Objective measurement is still required for validated confidence."
    ],
    conclusion: "Legacy balance is sufficiently intrinsic to migrate as an internal-derived balance_profile reference only with inverse conversion and moderate confidence; it must not be treated as measured balance."
  };
}
