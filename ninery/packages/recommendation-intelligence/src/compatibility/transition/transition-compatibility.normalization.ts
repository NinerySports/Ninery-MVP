import {
  loadEquipmentDNANumericReferenceProfile,
  type CanonicalEquipmentDNAAttributeValue,
  type CanonicalEquipmentDNAProfile
} from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  transitionCompatibilityRequiredCurrentInputs,
  transitionCompatibilityRequiredPlayerInputs,
  transitionCompatibilityRequiredProposedInputs
} from "./transition-compatibility.policy.js";
import {
  TRANSITION_CHANGE_PROFILE_VERSION,
  type CurrentEquipmentTransitionContext,
  type EquipmentTransitionChangeProfile,
  type PlayerTransitionReadinessProfile,
  type ProposedEquipmentTransitionContext
} from "./transition-compatibility.types.js";

export const TRANSITION_COMPATIBILITY_PLAYER_NORMALIZATION_VERSION = "1.0";
export const TRANSITION_COMPATIBILITY_EQUIPMENT_NORMALIZATION_VERSION = "1.0";

export function normalizePlayerTransitionReadiness(playerDNA: PlayerDNAProfileResult): PlayerTransitionReadinessProfile {
  const availableInputs: string[] = [];
  const missingInputs: string[] = [];
  const derivedInputs: string[] = [];
  const stageReadiness = developmentStageReadiness(playerDNA.categories.developmentStage);
  const goalAdjustment = goalReadinessAdjustment(playerDNA.categories.primaryHittingGoal);

  const physicalReadiness = numericPlayerInput(playerDNA.scores.physicalStrength, "player.scores.physicalStrength", availableInputs, missingInputs);
  const batControlReadiness = numericPlayerInput(playerDNA.scores.batControl, "player.scores.batControl", availableInputs, missingInputs);
  const equipmentAwareness = numericPlayerInput(playerDNA.scores.equipmentAwareness, "player.scores.equipmentAwareness", availableInputs, missingInputs);
  const growthStability = numericPlayerInput(playerDNA.scores.growthStability, "player.scores.growthStability", availableInputs, missingInputs);
  const transitionReadiness = numericPlayerInput(playerDNA.scores.transitionReadiness, "player.scores.transitionReadiness", availableInputs, missingInputs);
  const experienceYears = playerDNA.inputSnapshot.playerProfile?.experienceYears;
  const experienceReadiness = typeof experienceYears === "number"
    ? clampScore(Math.min(100, experienceYears * 14))
    : undefined;
  if (experienceReadiness !== undefined) availableInputs.push("playerProfile.experienceYears");
  else missingInputs.push("playerProfile.experienceYears");

  const developmentReadiness = clampScore(stageReadiness + goalAdjustment.development);
  derivedInputs.push("developmentReadiness from development stage and primary goal");

  const swingFeelFlexibility = swingFeelFlexibilityFromPreference(playerDNA.categories.preferredSwingFeel);
  if (swingFeelFlexibility === undefined) missingInputs.push("player.categories.preferredSwingFeel");
  else availableInputs.push("player.categories.preferredSwingFeel");

  const equipmentChangeTolerance = averageDefined([
    transitionReadiness,
    batControlReadiness,
    physicalReadiness,
    equipmentAwareness,
    experienceReadiness,
    developmentReadiness
  ]);
  if (equipmentChangeTolerance !== undefined) derivedInputs.push("equipmentChangeTolerance from Player DNA readiness signals");

  const currentEquipmentFamiliarity = undefined;
  missingInputs.push("currentEquipmentFamiliarity");

  for (const key of transitionCompatibilityRequiredPlayerInputs) {
    const value = { batControlReadiness, developmentReadiness, experienceReadiness }[key];
    if (value === undefined) missingInputs.push(key);
  }

  return {
    version: "1.0",
    playerId: playerDNA.playerId,
    physicalReadiness,
    batControlReadiness,
    experienceReadiness,
    developmentReadiness,
    equipmentChangeTolerance,
    growthStability,
    swingFeelFlexibility,
    currentEquipmentFamiliarity,
    sourceSummary: {
      availableInputs: uniqueSorted(availableInputs),
      missingInputs: uniqueSorted(missingInputs),
      derivedInputs: uniqueSorted(derivedInputs)
    },
    confidence: playerDNA.confidence.level === "high" || playerDNA.confidence.level === "validated" ? "high" : playerDNA.confidence.level === "medium" ? "moderate" : "estimated"
  };
}

export function normalizeCurrentEquipmentTransitionContext(profile: CanonicalEquipmentDNAProfile | undefined): CurrentEquipmentTransitionContext {
  if (!profile) {
    return {
      sourceSummary: {
        availableInputs: [],
        missingInputs: ["currentEquipmentProfile"]
      }
    };
  }
  const context = equipmentContextFromProfile(profile);
  return {
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    length: context.length,
    weight: context.weight,
    drop: context.drop,
    balanceProfile: context.balanceProfile,
    swingEffort: context.swingEffort,
    construction: context.construction,
    material: context.material,
    familiarity: undefined,
    sourceSummary: {
      availableInputs: uniqueSorted([...context.specificationInputs, ...context.numericReferenceInputs]),
      missingInputs: uniqueSorted([...context.missingInputs, "currentEquipmentFamiliarity"])
    }
  };
}

export function normalizeProposedEquipmentTransitionContext(profile: CanonicalEquipmentDNAProfile): ProposedEquipmentTransitionContext {
  const context = equipmentContextFromProfile(profile);
  return {
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    length: context.length,
    weight: context.weight,
    drop: context.drop,
    balanceProfile: context.balanceProfile,
    swingEffort: context.swingEffort,
    construction: context.construction,
    material: context.material,
    sourceSummary: {
      numericReferenceInputs: uniqueSorted(context.numericReferenceInputs),
      ordinalProjectedInputs: uniqueSorted(context.ordinalProjectedInputs),
      specificationInputs: uniqueSorted(context.specificationInputs),
      missingInputs: uniqueSorted(context.missingInputs)
    }
  };
}

export function buildEquipmentTransitionChangeProfile(input: {
  readonly current: CurrentEquipmentTransitionContext;
  readonly proposed: ProposedEquipmentTransitionContext;
}): EquipmentTransitionChangeProfile {
  const missingInputs: string[] = [];
  const requirePair = (key: "length" | "weight" | "drop" | "balanceProfile" | "swingEffort") => {
    const current = input.current[key];
    const proposed = input.proposed[key];
    if (current === undefined) missingInputs.push(`current.${key}`);
    if (proposed === undefined) missingInputs.push(`proposed.${key}`);
    if (current === undefined || proposed === undefined) return undefined;
    return round(proposed - current);
  };
  const lengthDelta = requirePair("length");
  const weightDelta = requirePair("weight");
  const dropDelta = requirePair("drop");
  const balanceDelta = requirePair("balanceProfile");
  const swingEffortDelta = requirePair("swingEffort");
  const constructionChanged = input.current.construction !== undefined && input.proposed.construction !== undefined
    ? input.current.construction !== input.proposed.construction
    : undefined;
  if (input.current.construction === undefined || input.proposed.construction === undefined) missingInputs.push("constructionChangeModel");

  return {
    version: TRANSITION_CHANGE_PROFILE_VERSION,
    sizeChange: lengthDelta === undefined ? undefined : Math.abs(lengthDelta),
    massChange: weightDelta === undefined ? undefined : Math.abs(weightDelta),
    dropChange: dropDelta === undefined ? undefined : Math.abs(dropDelta),
    balanceChange: balanceDelta === undefined ? undefined : Math.abs(balanceDelta),
    swingEffortChange: swingEffortDelta === undefined ? undefined : Math.abs(swingEffortDelta),
    constructionChange: constructionChanged === undefined ? undefined : constructionChanged ? 45 : 0,
    rawDifferences: {
      lengthDelta,
      weightDelta,
      dropDelta,
      balanceDelta,
      swingEffortDelta,
      constructionChanged
    },
    missingInputs: uniqueSorted(missingInputs)
  };
}

function equipmentContextFromProfile(profile: CanonicalEquipmentDNAProfile) {
  const numeric = loadEquipmentDNANumericReferenceProfile(profile);
  const numericReferenceInputs: string[] = [];
  const ordinalProjectedInputs: string[] = [];
  const specificationInputs: string[] = [];
  const missingInputs: string[] = [];
  const attribute = (key: string) => profile.attributes.find((candidate) => candidate.key === key);
  const scalarNumber = (key: string) => {
    const value = toNumber(attribute(key)?.value);
    if (value !== undefined) specificationInputs.push(key);
    else missingInputs.push(key);
    return value;
  };
  const scalarString = (key: string) => {
    const value = attribute(key)?.value;
    if (typeof value === "string") {
      specificationInputs.push(key);
      return value;
    }
    missingInputs.push(key);
    return undefined;
  };
  const numericReference = (key: string) => {
    const reference = numeric.references.find((candidate) => candidate.attributeKey === key);
    if (reference?.numericReference && reference.validationStatus === "pass") {
      numericReferenceInputs.push(key);
      return reference.numericReference.numericValue;
    }
    if (attribute(key)) ordinalProjectedInputs.push(key);
    else missingInputs.push(key);
    return undefined;
  };

  return {
    length: scalarNumber("length"),
    weight: scalarNumber("weight"),
    drop: scalarNumber("drop"),
    balanceProfile: numericReference("balance_profile"),
    swingEffort: numericReference("swing_effort"),
    construction: scalarString("construction"),
    material: scalarString("material"),
    numericReferenceInputs,
    ordinalProjectedInputs,
    specificationInputs,
    missingInputs
  };
}

function numericPlayerInput(value: number | undefined, key: string, available: string[], missing: string[]): number | undefined {
  if (typeof value !== "number") {
    missing.push(key);
    return undefined;
  }
  available.push(key);
  return clampScore(value);
}

function developmentStageReadiness(stage: string): number {
  if (stage === "foundation") return 35;
  if (stage === "developing") return 48;
  if (stage === "competitive") return 62;
  if (stage === "performance") return 74;
  if (stage === "advanced") return 84;
  return 50;
}

function goalReadinessAdjustment(goal: PrimaryHittingGoal): { development: number } {
  if (goal === "prepare_for_transition") return { development: 10 };
  if (goal === "maintain_current_fit") return { development: -4 };
  if (goal === "improve_power" || goal === "increase_swing_speed") return { development: 3 };
  return { development: 0 };
}

function swingFeelFlexibilityFromPreference(preference: string): number | undefined {
  if (preference === "unknown") return undefined;
  if (preference === "balanced") return 70;
  if (preference === "light" || preference === "end_loaded") return 48;
  if (preference === "slightly_end_loaded") return 58;
  return undefined;
}

function averageDefined(values: readonly (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => typeof value === "number");
  if (!present.length) return undefined;
  return round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function toNumber(value: CanonicalEquipmentDNAAttributeValue["value"] | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Score must be finite.");
  return Math.max(0, Math.min(100, round(value)));
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}
