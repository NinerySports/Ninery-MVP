import {
  CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION,
  type CurrentEquipmentFamiliarityInput,
  type CurrentEquipmentFamiliarityLevel,
  type CurrentEquipmentFamiliarityResult
} from "./current-equipment-familiarity.types.js";
import {
  currentEquipmentFamiliarityNumericReferences,
  currentEquipmentFamiliarityPolicy
} from "./current-equipment-familiarity.policy.js";

export function evaluateCurrentEquipmentFamiliarity(input: CurrentEquipmentFamiliarityInput): CurrentEquipmentFamiliarityResult {
  const availableInputs: string[] = [];
  const missingInputs: string[] = [];
  const reasons: string[] = [];
  const warnings: string[] = [];
  const scores: number[] = [];

  const addScore = (key: string, score: number | undefined) => {
    if (score === undefined) {
      missingInputs.push(key);
      return;
    }
    availableInputs.push(key);
    scores.push(score);
  };

  if (input.ownershipOnly) warnings.push("Ownership alone is insufficient to establish equipment familiarity.");
  addScore("estimatedSessionsUsed", sessionsScore(input.estimatedSessionsUsed));
  addScore("estimatedWeeksUsed", weeksScore(input.estimatedWeeksUsed));
  addScore("regularUseFrequency", frequencyScore(input.regularUseFrequency));
  addScore("directlyReportedFamiliarity", reportedScore(input.directlyReportedFamiliarity));
  if (input.currentlyPrimaryEquipment === undefined) missingInputs.push("currentlyPrimaryEquipment");
  else {
    availableInputs.push("currentlyPrimaryEquipment");
    scores.push(input.currentlyPrimaryEquipment ? 70 : 20);
  }
  if (input.usageContexts?.length) availableInputs.push("usageContexts");
  else missingInputs.push("usageContexts");
  if (input.firstUsedAt && input.mostRecentUseAt) availableInputs.push("firstUsedAt", "mostRecentUseAt");
  else missingInputs.push("firstUsedAt", "mostRecentUseAt");

  const level = input.ownershipOnly && scores.length === 0
    ? "unknown"
    : levelFor(scores);
  const confidence = confidenceFor(input, scores.length);
  const numericReference = currentEquipmentFamiliarityNumericReferences[level];

  if (level === "unknown") reasons.push("Available information is insufficient to determine current-equipment familiarity.");
  else reasons.push(`Familiarity is ${level.replace(/_/g, " ")} based on factual use and direct-report inputs.`);
  if (input.conflictingReports) warnings.push("Conflicting familiarity reports lower confidence and should be retained for review.");
  if (input.source === "system_history") warnings.push("System history supports familiarity but should not override direct reports without review.");
  if (input.directlyReportedFamiliarity === undefined || input.directlyReportedFamiliarity === "unknown") warnings.push("Directly reported familiarity is missing or unknown.");

  return {
    version: CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION,
    playerId: input.playerId,
    equipmentId: input.equipmentId,
    equipmentVariantId: input.equipmentVariantId,
    level,
    numericReference,
    confidence,
    availableInputs: uniqueSorted(availableInputs),
    missingInputs: uniqueSorted(missingInputs),
    reasons,
    warnings,
    evaluatedAt: input.capturedAt
  };
}

function sessionsScore(value: number | undefined): number | undefined {
  if (value === undefined || value < 0 || !Number.isFinite(value)) return undefined;
  if (value === 0) return 0;
  if (value < 5) return 20;
  if (value < currentEquipmentFamiliarityPolicy.minimumEstablishedSessions) return 50;
  if (value < currentEquipmentFamiliarityPolicy.minimumHighlyEstablishedSessions) return 75;
  return 95;
}

function weeksScore(value: number | undefined): number | undefined {
  if (value === undefined || value < 0 || !Number.isFinite(value)) return undefined;
  if (value === 0) return 0;
  if (value < 3) return 20;
  if (value < currentEquipmentFamiliarityPolicy.minimumEstablishedWeeks) return 50;
  if (value < currentEquipmentFamiliarityPolicy.minimumHighlyEstablishedWeeks) return 75;
  return 95;
}

function frequencyScore(value: CurrentEquipmentFamiliarityInput["regularUseFrequency"]): number | undefined {
  if (!value || value === "unknown") return undefined;
  if (value === "less_than_weekly") return 25;
  if (value === "weekly") return 45;
  if (value === "multiple_times_weekly") return 75;
  return 90;
}

function reportedScore(value: CurrentEquipmentFamiliarityInput["directlyReportedFamiliarity"]): number | undefined {
  if (!value || value === "unknown") return undefined;
  if (value === "not_familiar") return 5;
  if (value === "somewhat_familiar") return 35;
  if (value === "familiar") return 70;
  return 90;
}

function levelFor(scores: readonly number[]): CurrentEquipmentFamiliarityLevel {
  if (!scores.length) return "unknown";
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  if (average <= 15) return "new_or_unfamiliar";
  if (average < 38) return "limited_familiarity";
  if (average < 63) return "developing_familiarity";
  if (average < 86) return "established_familiarity";
  return "highly_established_familiarity";
}

function confidenceFor(input: CurrentEquipmentFamiliarityInput, evidenceCount: number): CurrentEquipmentFamiliarityResult["confidence"] {
  if (input.conflictingReports) return "estimated";
  if (evidenceCount >= currentEquipmentFamiliarityPolicy.minimumHighConfidenceEvidenceCount && input.source !== "system_history") return "high";
  if (evidenceCount >= 2) return "moderate";
  return "estimated";
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
