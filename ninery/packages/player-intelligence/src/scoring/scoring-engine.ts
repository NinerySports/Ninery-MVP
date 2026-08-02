import {
  playerDNAAttributes,
  type GrowthStatus,
  type PlayerDNAAttribute,
  type PlayerDNACategories,
  type PlayerDNAInput,
  type PlayerDNAScores
} from "../player-dna.types.js";
import { buildAttributeExplanation } from "../explainability/score-explanation-builder.js";
import { clampScore, normalizeAdjustment } from "./normalization.js";
import type { AppliedRule, RuleCondition, ScoringRule } from "./scoring-rule.types.js";

export type SourceMap = Record<string, unknown>;

export type ScoreBreakdown = Record<
  PlayerDNAAttribute,
  {
    baseline: number;
    appliedRules: Array<{
      ruleId: string;
      sourceCode: string;
      adjustment: number;
      rationale: string;
      confidenceContribution: number;
    }>;
    positiveAdjustments: number;
    negativeAdjustments: number;
    finalNormalizedScore: number;
    confidenceContribution: number;
  }
>;

export type ScoringEngineOutput = {
  scores: PlayerDNAScores;
  categories: PlayerDNACategories;
  breakdown: ScoreBreakdown;
  sourceMap: SourceMap;
  explanations: ReturnType<typeof buildAttributeExplanation>[];
  missingInformation: string[];
};

const requiredSourceCodes = [
  "DATE_OF_BIRTH",
  "COMPETITION_LEVEL",
  "BATTING_SIDE",
  "EXPERIENCE_YEARS",
  "LATEST_HEIGHT_CM",
  "LATEST_WEIGHT_KG",
  "PRIMARY_GOAL",
  "CURRENT_BAT_FEEL",
  "PREFERRED_SWING_FEEL",
  "PLATE_CONFIDENCE",
  "CURRENT_EQUIPMENT"
];

export function runScoringEngine(input: PlayerDNAInput, rules: ScoringRule[]): ScoringEngineOutput {
  const sourceMap = buildSourceMap(input);
  const categories = deriveInitialCategories(input, sourceMap);
  const breakdown = buildEmptyBreakdown();

  for (const rule of rules) {
    const sourceValue = sourceMap[rule.sourceCode];

    if (!matchesCondition(sourceValue, rule.condition)) {
      continue;
    }

    const adjustment = normalizeAdjustment(rule.scoreAdjustment, rule.weight);
    const attributeBreakdown = breakdown[rule.targetAttribute];
    attributeBreakdown.appliedRules.push({
      ruleId: rule.ruleId,
      sourceCode: rule.sourceCode,
      adjustment,
      rationale: rule.rationaleTemplate,
      confidenceContribution: rule.confidenceContribution
    });
    attributeBreakdown.confidenceContribution += rule.confidenceContribution;

    if (adjustment >= 0) {
      attributeBreakdown.positiveAdjustments += adjustment;
    } else {
      attributeBreakdown.negativeAdjustments += adjustment;
    }

    applyCategoricalEffects(categories, rule);
  }

  const scores = {} as PlayerDNAScores;
  for (const attribute of playerDNAAttributes) {
    const item = breakdown[attribute];
    item.finalNormalizedScore = clampScore(item.baseline + item.positiveAdjustments + item.negativeAdjustments);
    scores[attribute] = item.finalNormalizedScore;
  }

  const missingInformation = requiredSourceCodes.filter((code) => sourceMap[code] === undefined);
  const explanations = playerDNAAttributes.map((attribute) =>
    buildAttributeExplanation(attribute, scores[attribute], breakdown[attribute], missingInformation)
  );

  return {
    scores,
    categories,
    breakdown,
    sourceMap,
    explanations,
    missingInformation
  };
}

function buildEmptyBreakdown(): ScoreBreakdown {
  return playerDNAAttributes.reduce((breakdown, attribute) => {
    breakdown[attribute] = {
      baseline: 50,
      appliedRules: [],
      positiveAdjustments: 0,
      negativeAdjustments: 0,
      finalNormalizedScore: 50,
      confidenceContribution: 0
    };
    return breakdown;
  }, {} as ScoreBreakdown);
}

function applyCategoricalEffects(categories: PlayerDNACategories, rule: ScoringRule): void {
  if (!rule.categoricalEffects) {
    return;
  }

  if (rule.categoricalEffects.preferredSwingFeel) {
    categories.preferredSwingFeel = rule.categoricalEffects.preferredSwingFeel;
  }

  if (rule.categoricalEffects.primaryHittingGoal) {
    categories.primaryHittingGoal = rule.categoricalEffects.primaryHittingGoal;
  }

  if (rule.categoricalEffects.currentEquipmentAssessment) {
    categories.currentEquipmentAssessment = rule.categoricalEffects.currentEquipmentAssessment;
  }
}

export function matchesCondition(value: unknown, condition: RuleCondition): boolean {
  if (condition.type === "exists") {
    return value !== undefined && value !== null && value !== "";
  }

  if (value === undefined || value === null) {
    return false;
  }

  if (condition.type === "equals") {
    return normalizeValue(value) === normalizeValue(condition.value);
  }

  if (condition.type === "includes") {
    return String(normalizeValue(value)).includes(String(normalizeValue(condition.value)));
  }

  if (condition.type === "oneOf") {
    return condition.values.map(normalizeValue).includes(normalizeValue(value));
  }

  if (condition.type === "numberGte") {
    return Number(value) >= condition.value;
  }

  if (condition.type === "numberLte") {
    return Number(value) <= condition.value;
  }

  return false;
}

function normalizeValue(value: unknown): string | number | boolean {
  if (typeof value === "string") {
    return value.trim().toLowerCase().replaceAll(" ", "_");
  }

  return value as string | number | boolean;
}

export function buildSourceMap(input: PlayerDNAInput): SourceMap {
  const answers = new Map((input.answers ?? []).map((answer) => [answer.questionCode, extractAnswerValue(answer.answer)]));
  const latestGrowth = [...(input.growthMeasurements ?? [])].sort(
    (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
  )[0];

  return {
    DATE_OF_BIRTH: input.player.dateOfBirth,
    SPORT: input.player.sport,
    PLAYER_STATUS: input.player.status,
    BATTING_SIDE: input.playerProfile?.battingSide ?? input.playerProfile?.bats,
    THROWING_HAND: input.playerProfile?.throwingHand ?? input.playerProfile?.throws,
    PRIMARY_POSITION: input.playerProfile?.primaryPosition,
    SECONDARY_POSITION: input.playerProfile?.secondaryPosition,
    COMPETITION_LEVEL: input.playerProfile?.competitionLevel,
    PRACTICE_FREQUENCY: input.playerProfile?.practiceFrequency,
    EXPERIENCE_YEARS: input.playerProfile?.experienceYears,
    LATEST_HEIGHT_CM: latestGrowth?.heightCm,
    LATEST_WEIGHT_KG: latestGrowth?.weightKg,
    GROWTH_STATUS: deriveGrowthStatus(input.growthMeasurements ?? []),
    BATMATCH_STATUS: input.batMatchSession?.status,
    BATMATCH_TYPE: input.batMatchSession?.type,
    BATMATCH_CONFIDENCE: input.batMatchSession?.confidenceScore,
    PRIMARY_GOAL: answers.get("PRIMARY_GOAL") ?? answers.get("BIGGEST_GOAL_THIS_SEASON") ?? answers.get("goal-primary"),
    CURRENT_BAT_FEEL: answers.get("CURRENT_BAT_FEEL") ?? answers.get("current-bat-feel"),
    HARDEST_AT_PLATE: answers.get("HARDEST_AT_PLATE") ?? answers.get("hardest-at-plate"),
    PLATE_CONFIDENCE: answers.get("PLATE_CONFIDENCE") ?? answers.get("CONFIDENCE_IN_BOX") ?? answers.get("box-confidence"),
    PREFERRED_SWING_FEEL: answers.get("PREFERRED_SWING_FEEL") ?? answers.get("preferred-swing-feel"),
    GROWTH_CHANGE: answers.get("GROWTH_CHANGE") ?? answers.get("recent-growth-change"),
    BUDGET: answers.get("BUDGET") ?? answers.get("budget-comfort-level"),
    CURRENT_EQUIPMENT: answers.get("CURRENT_EQUIPMENT") ?? answers.get("CURRENT_BAT") ?? answers.get("current-bat-model")
  };
}

function extractAnswerValue(answer: unknown): unknown {
  if (!answer || typeof answer !== "object") {
    return answer;
  }

  const record = answer as Record<string, unknown>;
  return record.value ?? record.selected ?? record.answer ?? record.text ?? record.options ?? answer;
}

export function deriveGrowthStatus(measurements: NonNullable<PlayerDNAInput["growthMeasurements"]>): GrowthStatus {
  if (measurements.length < 2) {
    return "insufficient_data";
  }

  const sorted = [...measurements].sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const heightDelta = (latest.heightCm ?? 0) - (first.heightCm ?? 0);
  const days = Math.max(1, (new Date(latest.measuredAt).getTime() - new Date(first.measuredAt).getTime()) / 86400000);
  const annualizedHeightGain = (heightDelta / days) * 365;

  if (annualizedHeightGain >= 12) {
    return "rapid_growth";
  }

  if (annualizedHeightGain >= 6) {
    return "moderate_growth";
  }

  return "stable";
}

function deriveInitialCategories(input: PlayerDNAInput, sourceMap: SourceMap): PlayerDNACategories {
  return {
    preferredSwingFeel: mapSwingFeel(sourceMap.PREFERRED_SWING_FEEL),
    developmentStage: deriveDevelopmentStage(input),
    primaryHittingGoal: "unknown",
    currentEquipmentAssessment: undefined,
    growthStatus: sourceMap.GROWTH_STATUS as GrowthStatus,
    profileConfidenceLevel: "low"
  };
}

function mapSwingFeel(value: unknown) {
  const normalized = String(value ?? "unknown").toLowerCase().replaceAll(" ", "_");

  if (["light", "balanced", "slightly_end_loaded", "end_loaded"].includes(normalized)) {
    return normalized as PlayerDNACategories["preferredSwingFeel"];
  }

  return "unknown";
}

function deriveDevelopmentStage(input: PlayerDNAInput): PlayerDNACategories["developmentStage"] {
  const level = String(input.playerProfile?.competitionLevel ?? "").toLowerCase();
  const years = input.playerProfile?.experienceYears ?? 0;

  if (level.includes("elite") || years >= 8) {
    return "advanced";
  }

  if (level.includes("showcase") || years >= 6) {
    return "performance";
  }

  if (level.includes("travel") || years >= 4) {
    return "competitive";
  }

  if (years >= 2 || level.includes("school")) {
    return "developing";
  }

  return "foundation";
}

export function getAppliedRulesForAttribute(breakdown: ScoreBreakdown, attribute: PlayerDNAAttribute): AppliedRule[] {
  return breakdown[attribute].appliedRules.map((applied) => ({
    rule: {
      ruleId: applied.ruleId,
      version: "unknown",
      targetAttribute: attribute,
      sourceType: "derived",
      sourceCode: applied.sourceCode,
      condition: { type: "exists" },
      scoreAdjustment: applied.adjustment,
      weight: 1,
      confidenceContribution: applied.confidenceContribution,
      rationaleTemplate: applied.rationale,
      active: true
    },
    adjustment: applied.adjustment
  }));
}
