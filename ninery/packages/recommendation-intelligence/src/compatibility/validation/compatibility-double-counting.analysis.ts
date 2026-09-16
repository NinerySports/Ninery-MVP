import type {
  CompatibilityDoubleCountingAnalysis,
  CompatibilityModelName
} from "./compatibility-validation.types.js";
import { COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION } from "./compatibility-validation.types.js";

export function analyzeCompatibilityDoubleCounting(model: CompatibilityModelName): CompatibilityDoubleCountingAnalysis {
  if (model === "confidence_compatibility") {
    const overlaps = [
      overlap("forgiveness_alignment", "FORGIVENESS_FIT", "same_input", "high", "Uses forgiveness support that already participates in existing recommendation fit."),
      overlap("bat_control_alignment", "BAT_CONTROL_FIT", "same_input", "high", "Uses bat-control support that already participates in existing recommendation fit."),
      overlap("manageable_effort_alignment", "SWING_WEIGHT_FIT", "derived_input", "moderate", "Uses inverted canonical swing effort, closely related to swing-effort scoring."),
      overlap("contact_support_alignment", "SWEET_SPOT_FIT", "same_input", "high", "Uses sweet-spot support that already contributes to contact-related equipment fit."),
      overlap("predictability_alignment", "CONFIDENCE_BUILDING_FIT", "related_signal", "moderate", "Predictability is an equipment-side replacement candidate for part of the legacy mixed confidence-building signal."),
      overlap("developmentStructureNeed", "DEVELOPMENT_GOAL_FIT", "related_signal", "moderate", "Player development support needs can overlap with development-goal matching.")
    ] as const;
    return {
      version: COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION,
      model,
      overlappingInputs: overlaps,
      highestRisk: "high",
      safeForExplanationOnly: true,
      safeForIndependentRankingWeight: false,
      requiresReplacementRatherThanAddition: true,
      recommendations: [
        "Do not add confidence_compatibility as an independent weighted dimension.",
        "Evaluate it as an explanation-only or replacement candidate after parity review.",
        "Resolve overlap with forgiveness, bat-control, sweet-spot, and development-goal dimensions before live use."
      ]
    };
  }

  const overlaps = [
    overlap("size_change_demand", "SIZE_FIT", "related_signal", "moderate", "Transition size-change demand overlaps with size fit but is explicitly current-to-proposed."),
    overlap("mass_change_demand", "SWING_WEIGHT_FIT", "related_signal", "moderate", "Weight change may overlap with swing effort and current size fit."),
    overlap("balance_change_demand", "SWING_FEEL_BALANCE_FIT", "related_signal", "moderate", "Balance change reuses canonical balance but compares change from the current bat."),
    overlap("swing_effort_change_demand", "SWING_WEIGHT_FIT", "derived_input", "moderate", "Swing-effort change is related to but not identical to swing-effort fit."),
    overlap("experience_adjustment_demand", "TRANSITION_READINESS_FIT", "related_signal", "moderate", "This is the intended relational replacement area for legacy transition readiness."),
    overlap("developmentReadiness", "DEVELOPMENT_GOAL_FIT", "related_signal", "low", "Development readiness has limited overlap with broader development-goal matching.")
  ] as const;
  return {
    version: COMPATIBILITY_DOUBLE_COUNTING_ANALYSIS_VERSION,
    model,
    overlappingInputs: overlaps,
    highestRisk: "moderate",
    safeForExplanationOnly: true,
    safeForIndependentRankingWeight: false,
    requiresReplacementRatherThanAddition: true,
    recommendations: [
      "Keep transition_compatibility shadow-only while validating it as a replacement candidate for transition readiness.",
      "Do not add it on top of legacy transition dimensions without removing overlapping transition fit.",
      "Collect current-equipment familiarity before increasing confidence."
    ]
  };
}

function overlap(
  compatibilityComponent: string,
  existingRecommendationDimension: string,
  overlapType: "same_input" | "derived_input" | "related_signal" | "presentation_only",
  risk: "low" | "moderate" | "high",
  explanation: string
) {
  return { compatibilityComponent, existingRecommendationDimension, overlapType, risk, explanation };
}
