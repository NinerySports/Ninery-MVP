import type { EquipmentDNAAttribute, EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import type { CompatibilityRequestContext, CompatibilityRunResult } from "../compatibility.types.js";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import type {
  CandidateCalibrationScenarioName,
  CandidateCalibrationScenarioResult,
  EquipmentIdentity
} from "./canonical-candidate-attribution.types.js";

export const supportedCandidateFields = [
  "batControl",
  "swingWeight",
  "barrelForgiveness",
  "sweetSpotSize",
  "powerPotential"
] as const satisfies readonly EquipmentDNAAttribute[];

export const unsupportedCandidateFields = [
  "balance",
  "confidenceBuilding",
  "transitionFriendliness"
] as const satisfies readonly EquipmentDNAAttribute[];

export type CalibrationScenarioInput = {
  readonly name: CandidateCalibrationScenarioName;
  readonly legacyEquipment: readonly EquipmentDNAProfile[];
  readonly candidateEquipment: readonly EquipmentDNAProfile[];
  readonly playerDNA: PlayerDNAProfileResult;
  readonly context: CompatibilityRequestContext;
  readonly legacyWinnerId: string;
  readonly currentCandidateWinnerId?: string;
};

export function runCalibrationScenario(input: CalibrationScenarioInput): CandidateCalibrationScenarioResult {
  try {
    const equipment = scenarioEquipment(input.name, input.legacyEquipment, input.candidateEquipment);
    const result = new CompatibilityScoringEngine().score({
      playerDNA: input.playerDNA,
      equipment,
      context: input.context
    });
    const ranking = orderedIdentities(result);
    const winner = ranking[0];
    return {
      name: input.name,
      description: scenarioDescription(input.name),
      completed: true,
      winner,
      ranking,
      scores: orderedItems(result).map((item) => ({ equipmentId: item.equipment.equipmentId, score: item.overallMatchScore })),
      differsFromLegacyWinner: winner?.equipmentId !== input.legacyWinnerId,
      differsFromCurrentCandidateWinner: winner?.equipmentId !== input.currentCandidateWinnerId,
      scoreGapBetweenIconAndAtlas: scoreGap(result, "Rawlings", "Louisville Slugger"),
      materialWarnings: scenarioWarnings(input.name)
    };
  } catch (error) {
    return {
      name: input.name,
      description: scenarioDescription(input.name),
      completed: false,
      failureReason: error instanceof Error ? error.message : String(error),
      ranking: [],
      scores: [],
      differsFromLegacyWinner: true,
      differsFromCurrentCandidateWinner: true,
      materialWarnings: ["Scenario failed; no production behavior was changed."]
    };
  }
}

export function scenarioEquipment(
  name: CandidateCalibrationScenarioName,
  legacyEquipment: readonly EquipmentDNAProfile[],
  candidateEquipment: readonly EquipmentDNAProfile[]
): EquipmentDNAProfile[] {
  switch (name) {
    case "current_midpoint":
      return cloneEquipment(candidateEquipment);
    case "lower_bound":
      return remapSupported(candidateEquipment, lowerBound);
    case "upper_bound":
      return remapSupported(candidateEquipment, upperBound);
    case "interval_center":
      return remapSupported(candidateEquipment, intervalCenter);
    case "legacy_preserving_reference":
      return mergeScores(candidateEquipment, legacyEquipment, "supported_only");
    case "supported_attributes_only":
      return removeUnsupported(cloneEquipment(legacyEquipment));
    case "optional_legacy_carryover_estimate":
      return mergeScores(candidateEquipment, legacyEquipment, "unsupported_only");
  }
}

function remapSupported(equipment: readonly EquipmentDNAProfile[], mapper: (value: number) => number): EquipmentDNAProfile[] {
  return equipment.map((item) => {
    const scores = { ...item.scores };
    for (const field of supportedCandidateFields) {
      const value = scores[field];
      if (value !== undefined) scores[field] = mapper(value);
    }
    return { ...item, scores };
  });
}

function mergeScores(
  candidateEquipment: readonly EquipmentDNAProfile[],
  legacyEquipment: readonly EquipmentDNAProfile[],
  mode: "supported_only" | "unsupported_only"
): EquipmentDNAProfile[] {
  return candidateEquipment.map((candidate) => {
    const legacy = legacyEquipment.find((item) => item.equipmentId === candidate.equipmentId);
    const scores = { ...candidate.scores };
    const fields = mode === "supported_only" ? supportedCandidateFields : unsupportedCandidateFields;
    for (const field of fields) {
      scores[field] = legacy?.scores[field];
    }
    return { ...candidate, scores };
  });
}

function removeUnsupported(equipment: readonly EquipmentDNAProfile[]): EquipmentDNAProfile[] {
  return equipment.map((item) => {
    const scores = { ...item.scores };
    for (const field of unsupportedCandidateFields) delete scores[field];
    return { ...item, scores, missingCharacteristics: [...new Set([...item.missingCharacteristics, ...unsupportedCandidateFields])] };
  });
}

function cloneEquipment(equipment: readonly EquipmentDNAProfile[]): EquipmentDNAProfile[] {
  return equipment.map((item) => ({ ...item, scores: { ...item.scores }, missingCharacteristics: [...item.missingCharacteristics] }));
}

function lowerBound(value: number): number {
  if (value <= 10) return 0;
  if (value <= 30) return 20;
  if (value <= 50) return 40;
  if (value <= 70) return 60;
  return 80;
}

function upperBound(value: number): number {
  if (value <= 10) return 19;
  if (value <= 30) return 39;
  if (value <= 50) return 59;
  if (value <= 70) return 79;
  return 100;
}

function intervalCenter(value: number): number {
  if (value <= 10) return 9.5;
  if (value <= 30) return 29.5;
  if (value <= 50) return 49.5;
  if (value <= 70) return 69.5;
  return 90;
}

function orderedItems(result: CompatibilityRunResult) {
  return [
    ...(result.primaryRecommendation ? [result.primaryRecommendation] : []),
    ...result.alternatives,
    ...result.nonRecommended
  ];
}

function orderedIdentities(result: CompatibilityRunResult): EquipmentIdentity[] {
  return orderedItems(result).map((item) => identity(item.equipment));
}

function identity(equipment: EquipmentDNAProfile): EquipmentIdentity {
  return {
    equipmentId: equipment.equipmentId,
    equipmentVariantId: equipment.variantId,
    label: `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}`
  };
}

function scoreGap(result: CompatibilityRunResult, sourceManufacturer: string, targetManufacturer: string): number | undefined {
  const source = orderedItems(result).find((item) => item.equipment.manufacturer === sourceManufacturer);
  const target = orderedItems(result).find((item) => item.equipment.manufacturer === targetManufacturer);
  return source && target ? round(source.overallMatchScore - target.overallMatchScore) : undefined;
}

function scenarioDescription(name: CandidateCalibrationScenarioName): string {
  switch (name) {
    case "current_midpoint":
      return "Current Ticket #024 midpoint mapping.";
    case "lower_bound":
      return "Maps each ordinal to the lower bound of its source interval.";
    case "upper_bound":
      return "Maps each ordinal to the upper bound of its source interval.";
    case "interval_center":
      return "Maps each ordinal to a mathematically centered interval value.";
    case "legacy_preserving_reference":
      return "Analytical reference using preserved legacy numeric values for supported candidate fields.";
    case "supported_attributes_only":
      return "Analytical symmetry scenario removing unsupported fields from the legacy path.";
    case "optional_legacy_carryover_estimate":
      return "Noncanonical sensitivity estimate carrying unsupported legacy fields into candidate input.";
  }
}

function scenarioWarnings(name: CandidateCalibrationScenarioName): string[] {
  if (name === "optional_legacy_carryover_estimate") {
    return ["Analysis only: unsupported legacy values are carried over and must not be treated as canonical."];
  }
  if (name === "legacy_preserving_reference") {
    return ["Analysis only: uses legacy numeric references to estimate ordinal precision loss."];
  }
  return [];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
