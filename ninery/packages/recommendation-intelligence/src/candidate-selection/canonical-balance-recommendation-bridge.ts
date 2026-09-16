export const CANONICAL_BALANCE_TO_RECOMMENDATION_INPUT_VERSION = "1.0";

export type CanonicalBalanceRecommendationBridgeStrategy =
  | "inverse_to_balance_support"
  | "direct_end_load_tendency"
  | "unsupported";

export type CanonicalBalanceRecommendationBridgeResult = {
  readonly canonicalValue: number;
  readonly recommendationInputValue: number;
  readonly strategy: CanonicalBalanceRecommendationBridgeStrategy;
  readonly version: typeof CANONICAL_BALANCE_TO_RECOMMENDATION_INPUT_VERSION;
  readonly explanation: string;
};

export function bridgeCanonicalBalanceToRecommendationInput(
  canonicalValue: number,
  strategy: CanonicalBalanceRecommendationBridgeStrategy = "inverse_to_balance_support"
): CanonicalBalanceRecommendationBridgeResult {
  assertValidBalanceValue(canonicalValue);
  if (strategy === "unsupported") {
    throw new Error("Canonical balance cannot be bridged to recommendation input with unsupported semantics.");
  }
  const recommendationInputValue = strategy === "inverse_to_balance_support" ? 100 - canonicalValue : canonicalValue;
  return {
    canonicalValue,
    recommendationInputValue,
    strategy,
    version: CANONICAL_BALANCE_TO_RECOMMENDATION_INPUT_VERSION,
    explanation: strategy === "inverse_to_balance_support"
      ? "Canonical balance_profile uses 0 as most balanced and 100 as most end-loaded; the current recommendation balance field expects higher values to mean more balanced/light-feel support, so the value is inverted at the adapter boundary."
      : "Canonical balance_profile is passed directly because the target recommendation input accepts end-load tendency."
  };
}

function assertValidBalanceValue(value: number): void {
  if (!Number.isFinite(value)) throw new Error("Canonical balance value must be finite.");
  if (value < 0 || value > 100) throw new Error("Canonical balance value must be between 0 and 100.");
}
