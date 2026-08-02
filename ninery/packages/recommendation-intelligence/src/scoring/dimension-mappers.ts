import type { EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type { CompatibilityDimensionCode, DimensionScore } from "../compatibility.types.js";
import { average, clampScore, inverseScore, preferredRangeScore, similarityScore } from "./score-normalization.js";

type DimensionInput = {
  code: CompatibilityDimensionCode;
  playerTarget: string;
  equipmentCapability: string;
  rawScore?: number;
  weight: number;
  appliedRules: string[];
  sourceCodes: string[];
  reason: string;
  missingInformation?: string[];
  tradeoff?: boolean;
};

export function buildDimension(input: DimensionInput): DimensionScore {
  const rawScore = input.rawScore === undefined ? 50 : clampScore(input.rawScore);
  return {
    code: input.code,
    playerTarget: input.playerTarget,
    equipmentCapability: input.equipmentCapability,
    rawScore,
    weight: input.weight,
    weightedContribution: clampScore(rawScore * input.weight),
    confidenceContribution: input.missingInformation?.length ? 0.35 : 1,
    appliedRules: input.appliedRules,
    sourceCodes: input.sourceCodes,
    reason: input.reason,
    missingInformation: input.missingInformation ?? [],
    tradeoff: input.tradeoff ?? rawScore < 70
  };
}

export function scoreDimensions(input: {
  playerDNA: PlayerDNAProfileResult;
  equipment: EquipmentDNAProfile;
  weights: Record<CompatibilityDimensionCode, number>;
  budgetMaximum?: number;
}): DimensionScore[] {
  const player = input.playerDNA;
  const equipment = input.equipment;
  const scores = equipment.scores;
  const missing = (attribute: string) => [`equipment:${attribute}`];
  const variantPrice = equipment.selectedVariant?.msrp ?? equipment.availableVariants[0]?.msrp;
  const balanceTarget = player.categories.preferredSwingFeel === "light" ? 85 : player.categories.preferredSwingFeel === "end_loaded" ? 45 : 70;

  return [
    buildDimension({
      code: "BAT_CONTROL_FIT",
      playerTarget: `bat control need ${player.scores.batControl}`,
      equipmentCapability: `bat control ${scores.batControl ?? "missing"}`,
      rawScore: scores.batControl === undefined ? undefined : similarityScore(player.scores.batControl, scores.batControl),
      weight: input.weights.BAT_CONTROL_FIT,
      appliedRules: ["TARGET_TO_CAPABILITY_SIMILARITY"],
      sourceCodes: ["player.batControl", "equipment.BAT_CONTROL"],
      reason: "Compares the player's control need with the bat's control profile.",
      missingInformation: scores.batControl === undefined ? missing("batControl") : []
    }),
    buildDimension({
      code: "SWING_FEEL_BALANCE_FIT",
      playerTarget: player.categories.preferredSwingFeel,
      equipmentCapability: `balance ${scores.balance ?? "missing"}`,
      rawScore: scores.balance === undefined ? undefined : similarityScore(balanceTarget, scores.balance),
      weight: input.weights.SWING_FEEL_BALANCE_FIT,
      appliedRules: ["PREFERRED_SWING_FEEL_ALIGNMENT"],
      sourceCodes: ["player.preferredSwingFeel", "equipment.SWING_BALANCE"],
      reason: "Compares preferred swing feel with equipment balance behavior.",
      missingInformation: scores.balance === undefined ? missing("balance") : []
    }),
    buildDimension({
      code: "SWING_WEIGHT_FIT",
      playerTarget: `swing speed ${player.scores.swingSpeed}`,
      equipmentCapability: `swing weight ${scores.swingWeight ?? "missing"}`,
      rawScore: scores.swingWeight === undefined ? undefined : average([similarityScore(player.scores.swingSpeed, inverseScore(scores.swingWeight)), preferredRangeScore(scores.swingWeight, 35, 75) ?? 50]),
      weight: input.weights.SWING_WEIGHT_FIT,
      appliedRules: ["INVERSE_SWING_WEIGHT_ALIGNMENT", "PREFERRED_RANGE"],
      sourceCodes: ["player.swingSpeed", "equipment.SWING_WEIGHT"],
      reason: "Rewards manageable swing weight for the player's current swing-speed profile.",
      missingInformation: scores.swingWeight === undefined ? missing("swingWeight") : []
    }),
    buildDimension({
      code: "BARREL_FORGIVENESS_FIT",
      playerTarget: `contact consistency ${player.scores.contactConsistency}`,
      equipmentCapability: `barrel forgiveness ${scores.barrelForgiveness ?? "missing"}`,
      rawScore: scores.barrelForgiveness === undefined ? undefined : similarityScore(100 - player.scores.contactConsistency + 65, scores.barrelForgiveness, 45),
      weight: input.weights.BARREL_FORGIVENESS_FIT,
      appliedRules: ["FORGIVENESS_NEED_ALIGNMENT"],
      sourceCodes: ["player.contactConsistency", "equipment.BARREL_FORGIVENESS"],
      reason: "Players with less consistent contact benefit more from forgiveness.",
      missingInformation: scores.barrelForgiveness === undefined ? missing("barrelForgiveness") : []
    }),
    buildDimension({
      code: "SWEET_SPOT_FIT",
      playerTarget: `contact consistency ${player.scores.contactConsistency}`,
      equipmentCapability: `sweet spot ${scores.sweetSpotSize ?? "missing"}`,
      rawScore: scores.sweetSpotSize === undefined ? undefined : similarityScore(100 - player.scores.contactConsistency + 70, scores.sweetSpotSize, 45),
      weight: input.weights.SWEET_SPOT_FIT,
      appliedRules: ["SWEET_SPOT_NEED_ALIGNMENT"],
      sourceCodes: ["player.contactConsistency", "equipment.SWEET_SPOT_SIZE"],
      reason: "Compares contact consistency needs to sweet-spot support.",
      missingInformation: scores.sweetSpotSize === undefined ? missing("sweetSpotSize") : []
    }),
    buildDimension({
      code: "POWER_POTENTIAL_FIT",
      playerTarget: `power goal ${player.scores.powerPotential}`,
      equipmentCapability: `power potential ${scores.powerPotential ?? "missing"}`,
      rawScore: scores.powerPotential === undefined ? undefined : similarityScore(player.scores.powerPotential, scores.powerPotential, 40),
      weight: input.weights.POWER_POTENTIAL_FIT,
      appliedRules: ["POWER_NEED_ALIGNMENT"],
      sourceCodes: ["player.powerPotential", "equipment.POWER_POTENTIAL"],
      reason: "High power capability only helps when it matches the player's development need.",
      missingInformation: scores.powerPotential === undefined ? missing("powerPotential") : []
    }),
    buildDimension({
      code: "CONFIDENCE_BUILDING_FIT",
      playerTarget: `confidence ${player.scores.confidence}`,
      equipmentCapability: `confidence building ${scores.confidenceBuilding ?? "missing"}`,
      rawScore: scores.confidenceBuilding === undefined ? undefined : similarityScore(100 - player.scores.confidence + 70, scores.confidenceBuilding, 45),
      weight: input.weights.CONFIDENCE_BUILDING_FIT,
      appliedRules: ["CONFIDENCE_SUPPORT_ALIGNMENT"],
      sourceCodes: ["player.confidence", "equipment.CONFIDENCE_BUILDING"],
      reason: "Players with lower confidence benefit from more confidence-building equipment behavior.",
      missingInformation: scores.confidenceBuilding === undefined ? missing("confidenceBuilding") : []
    }),
    buildDimension({
      code: "TRANSITION_READINESS_FIT",
      playerTarget: `transition readiness ${player.scores.transitionReadiness}`,
      equipmentCapability: `transition friendliness ${scores.transitionFriendliness ?? "missing"}`,
      rawScore: scores.transitionFriendliness === undefined ? undefined : similarityScore(player.scores.transitionReadiness, scores.transitionFriendliness, 45),
      weight: input.weights.TRANSITION_READINESS_FIT,
      appliedRules: ["TRANSITION_ALIGNMENT"],
      sourceCodes: ["player.transitionReadiness", "equipment.TRANSITION_FRIENDLINESS"],
      reason: "Compares player transition readiness with equipment transition friendliness.",
      missingInformation: scores.transitionFriendliness === undefined ? missing("transitionFriendliness") : []
    }),
    buildDimension({
      code: "DEVELOPMENT_GOAL_FIT",
      playerTarget: player.categories.primaryHittingGoal,
      equipmentCapability: "goal-related DNA attributes",
      rawScore: scoreGoalFit(player, equipment),
      weight: input.weights.DEVELOPMENT_GOAL_FIT,
      appliedRules: ["PRIMARY_GOAL_ALIGNMENT"],
      sourceCodes: ["player.primaryHittingGoal"],
      reason: "Scores the bat against the player's primary development goal.",
      missingInformation: []
    }),
    buildDimension({
      code: "GROWTH_USEFUL_LIFE_FIT",
      playerTarget: player.categories.growthStatus,
      equipmentCapability: `${equipment.availableVariants.length} variants available`,
      rawScore: player.categories.growthStatus === "rapid_growth" ? Math.min(100, 55 + equipment.availableVariants.length * 8) : 80,
      weight: input.weights.GROWTH_USEFUL_LIFE_FIT,
      appliedRules: ["VARIANT_DEPTH_FOR_GROWTH"],
      sourceCodes: ["player.growthStatus", "equipment.variants"],
      reason: "Rewards variant depth when growth may require future size changes.",
      missingInformation: []
    }),
    buildDimension({
      code: "EQUIPMENT_PREFERENCE_FIT",
      playerTarget: player.categories.currentEquipmentAssessment ?? "unknown",
      equipmentCapability: equipment.primaryPersonality?.personalityCode ?? "unknown",
      rawScore: equipment.primaryPersonality ? 78 : 62,
      weight: input.weights.EQUIPMENT_PREFERENCE_FIT,
      appliedRules: ["PERSONALITY_PREFERENCE_PROXY"],
      sourceCodes: ["player.currentEquipmentAssessment", "equipment.personality"],
      reason: "Uses structured equipment personality as an MVP preference proxy.",
      missingInformation: equipment.primaryPersonality ? [] : ["equipment:primaryPersonality"]
    }),
    buildDimension({
      code: "BUDGET_FIT",
      playerTarget: input.budgetMaximum === undefined ? "no maximum" : `max ${input.budgetMaximum}`,
      equipmentCapability: variantPrice === undefined ? "price missing" : `price ${variantPrice}`,
      rawScore: input.budgetMaximum === undefined ? 80 : variantPrice === undefined ? undefined : variantPrice <= input.budgetMaximum ? 100 : clampScore(100 - (variantPrice - input.budgetMaximum) / 4),
      weight: input.weights.BUDGET_FIT,
      appliedRules: ["BUDGET_THRESHOLD"],
      sourceCodes: ["request.budget", "equipment.variant.msrp"],
      reason: "Checks whether the selected or first available variant fits the requested budget.",
      missingInformation: input.budgetMaximum !== undefined && variantPrice === undefined ? ["equipment:variantPrice"] : []
    }),
    buildDimension({
      code: "EVIDENCE_QUALITY",
      playerTarget: "reliable recommendation evidence",
      equipmentCapability: `evidence confidence ${equipment.evidenceConfidence.score}`,
      rawScore: equipment.evidenceConfidence.score,
      weight: input.weights.EVIDENCE_QUALITY,
      appliedRules: ["EVIDENCE_CONFIDENCE_PASS_THROUGH"],
      sourceCodes: ["equipment.evidenceConfidence"],
      reason: "Rewards equipment profiles with stronger evidence support."
    }),
    buildDimension({
      code: "PROFILE_COMPLETENESS",
      playerTarget: "complete comparable profiles",
      equipmentCapability: `profile completeness ${equipment.profileCompleteness}`,
      rawScore: average([player.scores.profileCompleteness, equipment.profileCompleteness]),
      weight: input.weights.PROFILE_COMPLETENESS,
      appliedRules: ["PROFILE_COMPLETENESS_AVERAGE"],
      sourceCodes: ["player.profileCompleteness", "equipment.profileCompleteness"],
      reason: "Rewards complete player and equipment profiles."
    })
  ];
}

function scoreGoalFit(player: PlayerDNAProfileResult, equipment: EquipmentDNAProfile): number {
  switch (player.categories.primaryHittingGoal) {
    case "improve_bat_control":
      return average([equipment.scores.batControl ?? 50, equipment.scores.swingWeight === undefined ? 50 : inverseScore(equipment.scores.swingWeight)]);
    case "improve_power":
      return average([equipment.scores.powerPotential ?? 50, equipment.scores.sweetSpotSize ?? 50]);
    case "build_confidence":
      return average([equipment.scores.confidenceBuilding ?? 50, equipment.scores.barrelForgiveness ?? 50, equipment.scores.sweetSpotSize ?? 50]);
    case "prepare_for_transition":
      return average([equipment.scores.transitionFriendliness ?? 50, equipment.scores.swingWeight === undefined ? 50 : inverseScore(equipment.scores.swingWeight)]);
    default:
      return 75;
  }
}
