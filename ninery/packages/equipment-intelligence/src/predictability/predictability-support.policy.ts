import {
  PREDICTABILITY_SUPPORT_COMPOSITE_VERSION,
  type PredictabilitySupportCompositePolicy
} from "./predictability-support.types.js";

export const PREDICTABILITY_SUPPORT_TECHNICAL_DEFINITION =
  "The degree to which a bat's behavior and performance feedback remain stable, understandable, and repeatable across typical swings, contact locations, and mishit outcomes.";

export const PREDICTABILITY_SUPPORT_PARENT_DEFINITION =
  "How consistent and understandable the bat's response tends to feel from swing to swing.";

export const PREDICTABILITY_SUPPORT_EXCLUSIONS = [
  "player confidence",
  "psychological outcome",
  "player preference",
  "transition ease",
  "swing effort alone",
  "forgiveness alone",
  "barrel stability alone",
  "bat-control compatibility",
  "overall product quality"
] as const;

export const predictabilitySupportCompositePolicy: PredictabilitySupportCompositePolicy = {
  version: PREDICTABILITY_SUPPORT_COMPOSITE_VERSION,
  recommendationUsePolicy: "profile_only",
  bridgeStrategy: "profile_only",
  components: [
    {
      attributeKey: "forgiveness",
      weight: 0.4,
      direction: "direct",
      required: true,
      rationale: "Forgiveness contributes to predictable outcomes because useful contact quality is less volatile on imperfect contact."
    },
    {
      attributeKey: "sweet_spot_support",
      weight: 0.35,
      direction: "direct",
      required: true,
      rationale: "Sweet-spot support contributes to predictability because a larger useful contact area makes normal contact outcomes easier to interpret."
    },
    {
      attributeKey: "swing_effort",
      weight: 0.25,
      direction: "inverse",
      required: true,
      rationale: "Swing-effort demand is inverted into manageability because easier-to-manage effort can make equipment response more repeatable."
    }
  ],
  minimumComponentCoverage: 1,
  allowMissingOptionalComponents: true,
  normalizationStrategy: "fixed_weight"
};

export const predictabilityExcludedComponentRationales = {
  balance_profile:
    "Excluded from v1.0 because balanced is not universally more predictable; balance fit can be player-relative and should not be double-counted as predictability.",
  barrel_stability:
    "Excluded from v1.0 demo scoring because the current demo profiles do not have active barrel_stability evaluations.",
  confidence_building_potential:
    "Excluded because it is the legacy mixed psychological/relational concept being replaced, not an input to the equipment-side replacement.",
  transition_difficulty:
    "Excluded because transition is player- and context-relative Compatibility Intelligence."
} as const;

export function validatePredictabilitySupportCompositePolicy(
  policy: PredictabilitySupportCompositePolicy = predictabilitySupportCompositePolicy
): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  let weightTotal = 0;
  for (const component of policy.components) {
    if (keys.has(component.attributeKey)) errors.push(`${component.attributeKey} is duplicated.`);
    keys.add(component.attributeKey);
    if (component.weight <= 0) errors.push(`${component.attributeKey} weight must be positive.`);
    weightTotal += component.weight;
  }
  if (Math.abs(weightTotal - 1) > 0.0001 && policy.normalizationStrategy === "fixed_weight") {
    errors.push(`Fixed-weight predictability components must total 1.0; received ${weightTotal}.`);
  }
  if (policy.minimumComponentCoverage <= 0 || policy.minimumComponentCoverage > 1) {
    errors.push("Minimum component coverage must be greater than 0 and at most 1.");
  }
  return errors;
}
