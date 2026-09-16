import type { EquipmentDNAAttributeKey } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import { transitionCompatibilityRequiredCurrentInputs, transitionCompatibilityRequiredProposedInputs } from "../transition-compatibility.policy.js";
import type { TransitionPredictionContextFinding, TransitionPredictionContextWarningCode } from "./transition-prediction-context.types.js";

export const TRANSITION_PREDICTION_CONTEXT_POLICY_VERSION = "1.0";

export const transitionPredictionRequiredEquipmentAttributes = [
  "length",
  "weight",
  "drop"
] as const satisfies readonly EquipmentDNAAttributeKey[];

export const transitionPredictionOptionalEquipmentAttributes = [
  "balance_profile",
  "swing_effort",
  "construction",
  "material"
] as const satisfies readonly EquipmentDNAAttributeKey[];

export const transitionPredictionSupportedPlayerDNAVersions = [
  "1.0.0",
  "player-dna-mvp-v1"
] as const;

export function isTransitionPredictionSupportedPlayerDNA(profile: PlayerDNAProfileResult): boolean {
  return transitionPredictionSupportedPlayerDNAVersions.includes(profile.version as never);
}

export function requiredPlayerDNAFindings(profile: PlayerDNAProfileResult): readonly TransitionPredictionContextFinding[] {
  const blockers: TransitionPredictionContextFinding[] = [];
  if (profile.scores.batControl === undefined) blockers.push(finding("MISSING_BAT_CONTROL_READINESS", "player_dna", "Player DNA is missing bat-control readiness."));
  if (profile.inputSnapshot.playerProfile?.experienceYears === undefined) blockers.push(finding("MISSING_EXPERIENCE_READINESS", "player_dna", "Player DNA input snapshot is missing experience years."));
  if (profile.categories.developmentStage === undefined) blockers.push(finding("MISSING_DEVELOPMENT_READINESS", "player_dna", "Player DNA is missing development-stage readiness context."));
  return blockers;
}

export function optionalPlayerDNAWarnings(profile: PlayerDNAProfileResult): readonly TransitionPredictionContextFinding[] {
  const warnings: TransitionPredictionContextFinding[] = [];
  if (profile.scores.growthStability === undefined) warnings.push(warning("MISSING_OPTIONAL_GROWTH_CONTEXT", "player_dna", "Player DNA is missing optional growth-stability context."));
  if (profile.categories.preferredSwingFeel === "unknown") warnings.push(warning("MISSING_OPTIONAL_SWING_FEEL_CONTEXT", "player_dna", "Player DNA is missing optional swing-feel preference context."));
  return warnings;
}

export function requiredEquipmentInputKeys(target: "current" | "proposed") {
  return target === "current" ? transitionCompatibilityRequiredCurrentInputs : transitionCompatibilityRequiredProposedInputs;
}

export function optionalEquipmentWarningCode(target: "current" | "proposed", key: EquipmentDNAAttributeKey): TransitionPredictionContextWarningCode | undefined {
  if (target === "current" && key === "balance_profile") return "MISSING_OPTIONAL_CURRENT_BALANCE";
  if (target === "current" && key === "swing_effort") return "MISSING_OPTIONAL_CURRENT_SWING_EFFORT";
  if (target === "proposed" && key === "balance_profile") return "MISSING_OPTIONAL_PROPOSED_BALANCE";
  if (target === "proposed" && key === "swing_effort") return "MISSING_OPTIONAL_PROPOSED_SWING_EFFORT";
  return undefined;
}

export function finding(code: TransitionPredictionContextFinding["code"], sourceArea: TransitionPredictionContextFinding["sourceArea"], message: string): TransitionPredictionContextFinding {
  return { code, sourceArea, message };
}

function warning(code: TransitionPredictionContextWarningCode, sourceArea: TransitionPredictionContextFinding["sourceArea"], message: string): TransitionPredictionContextFinding {
  return { code, sourceArea, message };
}
