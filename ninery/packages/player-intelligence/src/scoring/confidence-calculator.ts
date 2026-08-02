import type { PlayerDNAInput, ProfileConfidenceLevel } from "../player-dna.types.js";
import { buildSourceMap } from "./scoring-engine.js";

export type ProfileConfidenceResult = {
  score: number;
  level: ProfileConfidenceLevel;
  factors: Record<string, number>;
  missingInformation: string[];
};

export function calculateProfileConfidence(input: PlayerDNAInput): ProfileConfidenceResult {
  const sourceMap = buildSourceMap(input);
  const requiredProfileFields = ["DATE_OF_BIRTH", "COMPETITION_LEVEL", "BATTING_SIDE", "EXPERIENCE_YEARS"];
  const equipmentFields = ["CURRENT_EQUIPMENT", "CURRENT_BAT_FEEL"];
  const answeredQuestions = input.answers?.length ?? 0;
  const growthCount = input.growthMeasurements?.length ?? 0;

  const profileCompleteness = percentagePresent(requiredProfileFields, sourceMap);
  const batMatchCompleteness = Math.min(100, (answeredQuestions / 8) * 100);
  const growthFreshness = calculateGrowthFreshness(input);
  const equipmentCompleteness = percentagePresent(equipmentFields, sourceMap);
  const sessionCompletion = input.batMatchSession?.status === "completed" ? 100 : 0;
  const consistency = calculateConsistency(sourceMap);
  const sourceQuality = answeredQuestions > 0 ? 75 : growthCount > 0 ? 60 : 40;

  const score = Math.round(
    profileCompleteness * 0.2 +
      batMatchCompleteness * 0.22 +
      growthFreshness * 0.16 +
      equipmentCompleteness * 0.14 +
      consistency * 0.1 +
      sourceQuality * 0.08 +
      sessionCompletion * 0.1
  );

  const cappedScore = Math.min(score, 94);
  const missingInformation = [
    ...missingFor(requiredProfileFields, sourceMap),
    ...missingFor(equipmentFields, sourceMap),
    ...(growthCount === 0 ? ["Growth measurements"] : []),
    ...(input.batMatchSession?.status === "completed" ? [] : ["Completed BatMatch session"])
  ];

  return {
    score: cappedScore,
    level: confidenceBand(cappedScore),
    factors: {
      profileCompleteness,
      batMatchCompleteness,
      growthFreshness,
      equipmentCompleteness,
      consistency,
      sourceQuality,
      sessionCompletion
    },
    missingInformation
  };
}

export function confidenceBand(score: number): ProfileConfidenceLevel {
  if (score >= 95) {
    return "validated";
  }

  if (score >= 75) {
    return "high";
  }

  if (score >= 50) {
    return "medium";
  }

  return "low";
}

function percentagePresent(codes: string[], sourceMap: Record<string, unknown>): number {
  return Math.round((codes.filter((code) => sourceMap[code] !== undefined).length / codes.length) * 100);
}

function missingFor(codes: string[], sourceMap: Record<string, unknown>): string[] {
  return codes.filter((code) => sourceMap[code] === undefined);
}

function calculateGrowthFreshness(input: PlayerDNAInput): number {
  const latest = [...(input.growthMeasurements ?? [])].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  )[0];

  if (!latest) {
    return 25;
  }

  const ageDays = (Date.now() - new Date(latest.measuredAt).getTime()) / 86400000;

  if (ageDays <= 90) {
    return 100;
  }

  if (ageDays <= 180) {
    return 75;
  }

  if (ageDays <= 365) {
    return 55;
  }

  return 35;
}

function calculateConsistency(sourceMap: Record<string, unknown>): number {
  const goal = String(sourceMap.PRIMARY_GOAL ?? "").toLowerCase();
  const batFeel = String(sourceMap.CURRENT_BAT_FEEL ?? "").toLowerCase();
  const confidence = Number(sourceMap.PLATE_CONFIDENCE ?? 3);

  if (goal.includes("power") && batFeel.includes("too_heavy") && confidence <= 2) {
    return 45;
  }

  return 85;
}
