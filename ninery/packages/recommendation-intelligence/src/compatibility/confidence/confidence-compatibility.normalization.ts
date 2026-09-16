import { loadEquipmentDNANumericReferenceProfile, type CanonicalEquipmentDNAProfile, type EquipmentAttributeConfidence } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  confidenceCompatibilityRequiredEquipmentInputs,
  confidenceCompatibilityRequiredPlayerInputs
} from "./confidence-compatibility.policy.js";
import type {
  EquipmentConfidenceSupportProfile,
  PlayerConfidenceSupportNeedsProfile
} from "./confidence-compatibility.types.js";

export const CONFIDENCE_COMPATIBILITY_PLAYER_NORMALIZATION_VERSION = "1.0";
export const CONFIDENCE_COMPATIBILITY_EQUIPMENT_NORMALIZATION_VERSION = "1.0";

export function normalizePlayerConfidenceSupportNeeds(playerDNA: PlayerDNAProfileResult): PlayerConfidenceSupportNeedsProfile {
  const availableInputs: string[] = [];
  const missingInputs: string[] = [];
  const derivedInputs: string[] = [];
  const stageAdjustment = developmentStageAdjustment(playerDNA.categories.developmentStage);
  const goalAdjustments = primaryGoalAdjustments(playerDNA.categories.primaryHittingGoal);

  const batControlNeed = deriveNeedFromCapability(playerDNA.scores.batControl, stageAdjustment + goalAdjustments.batControl, "player.scores.batControl", availableInputs, missingInputs, derivedInputs);
  const contactConsistencyNeed = deriveNeedFromCapability(playerDNA.scores.contactConsistency, stageAdjustment + goalAdjustments.contactConsistency, "player.scores.contactConsistency", availableInputs, missingInputs, derivedInputs);
  const forgivenessNeed = contactConsistencyNeed === undefined ? undefined : clampScore(contactConsistencyNeed + goalAdjustments.forgiveness);
  if (forgivenessNeed !== undefined) derivedInputs.push("forgivenessNeed from contactConsistencyNeed");
  const manageableEffortNeed = deriveNeedFromCapability(playerDNA.scores.swingSpeed, stageAdjustment + goalAdjustments.manageableEffort, "player.scores.swingSpeed", availableInputs, missingInputs, derivedInputs);
  const predictabilityNeed = derivePredictabilityNeed(playerDNA, stageAdjustment, goalAdjustments.predictability, availableInputs, missingInputs, derivedInputs);
  const developmentStructureNeed = clampScore(averageDefined([batControlNeed, contactConsistencyNeed, predictabilityNeed]) ?? 50);
  derivedInputs.push("developmentStructureNeed from support needs");

  const experienceYears = playerDNA.inputSnapshot.playerProfile?.experienceYears;
  const experienceLevel = typeof experienceYears === "number" ? clampScore(experienceYears * 12) : undefined;
  if (experienceLevel !== undefined) availableInputs.push("playerProfile.experienceYears");
  else missingInputs.push("playerProfile.experienceYears");

  const currentEquipmentFamiliarity = undefined;
  missingInputs.push("currentEquipmentFamiliarity");

  for (const key of confidenceCompatibilityRequiredPlayerInputs) {
    if (profileValue({ batControlNeed, contactConsistencyNeed, predictabilityNeed, forgivenessNeed, manageableEffortNeed }, key) === undefined) {
      missingInputs.push(key);
    }
  }

  return {
    version: "1.0",
    playerId: playerDNA.playerId,
    batControlNeed,
    contactConsistencyNeed,
    predictabilityNeed,
    forgivenessNeed,
    manageableEffortNeed,
    developmentStructureNeed,
    experienceLevel,
    developmentStage: playerDNA.categories.developmentStage,
    currentEquipmentFamiliarity,
    sourceSummary: {
      availableInputs: uniqueSorted(availableInputs),
      missingInputs: uniqueSorted(missingInputs),
      derivedInputs: uniqueSorted(derivedInputs)
    },
    confidence: mapPlayerDNAConfidence(playerDNA.confidence.level)
  };
}

export function normalizeEquipmentConfidenceSupport(profile: CanonicalEquipmentDNAProfile): EquipmentConfidenceSupportProfile {
  const numericProfile = loadEquipmentDNANumericReferenceProfile(profile);
  const numericReferenceInputs: string[] = [];
  const ordinalProjectedInputs: string[] = [];
  const missingInputs: string[] = [];

  const numeric = (key: string): number | undefined => {
    const reference = numericProfile.references.find((candidate) => candidate.attributeKey === key);
    if (reference?.numericReference && reference.validationStatus === "pass") {
      numericReferenceInputs.push(key);
      return reference.numericReference.numericValue;
    }
    const attribute = profile.attributes.find((candidate) => candidate.key === key);
    if (attribute) ordinalProjectedInputs.push(key);
    else missingInputs.push(key);
    return undefined;
  };

  const predictabilitySupport = numeric("predictability_support");
  const forgivenessSupport = numeric("forgiveness");
  const sweetSpotSupport = numeric("sweet_spot_support");
  const batControlSupport = numeric("bat_control_support");
  const swingEffortDemand = numeric("swing_effort");
  const manageableEffortSupport = swingEffortDemand === undefined ? undefined : clampScore(100 - swingEffortDemand);

  if (swingEffortDemand !== undefined) numericReferenceInputs.push("manageableEffortSupport from inverse swing_effort");

  for (const key of confidenceCompatibilityRequiredEquipmentInputs) {
    if (profileValue({ predictabilitySupport, forgivenessSupport, sweetSpotSupport, manageableEffortSupport, batControlSupport }, key) === undefined) {
      missingInputs.push(key);
    }
  }

  return {
    version: "1.0",
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    predictabilitySupport,
    forgivenessSupport,
    sweetSpotSupport,
    manageableEffortSupport,
    batControlSupport,
    sourceSummary: {
      numericReferenceInputs: uniqueSorted(numericReferenceInputs),
      ordinalProjectedInputs: uniqueSorted(ordinalProjectedInputs),
      missingInputs: uniqueSorted(missingInputs)
    },
    confidence: minimumEquipmentConfidence(profile, ["predictability_support", "forgiveness", "sweet_spot_support", "bat_control_support", "swing_effort"])
  };
}

function deriveNeedFromCapability(
  capability: number | undefined,
  adjustment: number,
  source: string,
  availableInputs: string[],
  missingInputs: string[],
  derivedInputs: string[]
): number | undefined {
  if (typeof capability !== "number") {
    missingInputs.push(source);
    return undefined;
  }
  availableInputs.push(source);
  derivedInputs.push(`${source}: support need = 100 - capability + contextual adjustment`);
  return clampScore(100 - capability + adjustment);
}

function derivePredictabilityNeed(
  playerDNA: PlayerDNAProfileResult,
  stageAdjustment: number,
  goalAdjustment: number,
  availableInputs: string[],
  missingInputs: string[],
  derivedInputs: string[]
): number | undefined {
  const contact = deriveNeedFromCapability(playerDNA.scores.contactConsistency, 0, "player.scores.contactConsistency for predictability", availableInputs, missingInputs, derivedInputs);
  const batControl = deriveNeedFromCapability(playerDNA.scores.batControl, 0, "player.scores.batControl for predictability", availableInputs, missingInputs, derivedInputs);
  const confidenceSupport = deriveNeedFromCapability(playerDNA.scores.confidence, 0, "player.scores.confidence for non-clinical support", availableInputs, missingInputs, derivedInputs);
  const value = averageDefined([contact, batControl, confidenceSupport]);
  if (value === undefined) return undefined;
  derivedInputs.push("predictabilityNeed from control, contact, and non-clinical support signal");
  return clampScore(value + stageAdjustment + goalAdjustment);
}

function developmentStageAdjustment(stage: string): number {
  if (stage === "foundation") return 12;
  if (stage === "developing") return 7;
  if (stage === "competitive") return 0;
  if (stage === "performance") return -6;
  if (stage === "advanced") return -12;
  return 0;
}

function primaryGoalAdjustments(goal: PrimaryHittingGoal): {
  batControl: number;
  contactConsistency: number;
  predictability: number;
  forgiveness: number;
  manageableEffort: number;
} {
  switch (goal) {
    case "improve_bat_control":
      return { batControl: 12, contactConsistency: 4, predictability: 5, forgiveness: 0, manageableEffort: 8 };
    case "improve_contact":
      return { batControl: 4, contactConsistency: 12, predictability: 8, forgiveness: 8, manageableEffort: 2 };
    case "build_confidence":
      return { batControl: 4, contactConsistency: 8, predictability: 12, forgiveness: 8, manageableEffort: 4 };
    case "increase_swing_speed":
      return { batControl: 0, contactConsistency: 0, predictability: -4, forgiveness: -4, manageableEffort: 8 };
    case "improve_power":
      return { batControl: -4, contactConsistency: -2, predictability: -6, forgiveness: -4, manageableEffort: -2 };
    default:
      return { batControl: 0, contactConsistency: 0, predictability: 0, forgiveness: 0, manageableEffort: 0 };
  }
}

function minimumEquipmentConfidence(profile: CanonicalEquipmentDNAProfile, keys: readonly string[]): EquipmentAttributeConfidence {
  const order = { estimated: 0, moderate: 1, high: 2, validated: 3 } as const;
  const values = keys
    .map((key) => profile.attributes.find((attribute) => attribute.key === key)?.confidence)
    .filter((value): value is EquipmentAttributeConfidence => !!value);
  if (!values.length) return "estimated";
  const first = values[0] ?? "estimated";
  return values.reduce((lowest, value) => order[value] < order[lowest] ? value : lowest, first);
}

function mapPlayerDNAConfidence(level: "low" | "medium" | "high" | "validated") {
  if (level === "validated") return "high";
  if (level === "high") return "high";
  if (level === "medium") return "moderate";
  return "estimated";
}

function averageDefined(values: readonly (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => typeof value === "number");
  if (!present.length) return undefined;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function profileValue<T extends Record<string, number | undefined>>(profile: T, key: keyof T): number | undefined {
  return profile[key];
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Score must be finite.");
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}
