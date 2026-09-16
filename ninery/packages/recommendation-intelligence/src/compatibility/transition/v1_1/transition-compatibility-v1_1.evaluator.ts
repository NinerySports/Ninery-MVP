import {
  transitionCompatibilityDimensionWeights,
  transitionCompatibilityRequiredCurrentInputs,
  transitionCompatibilityRequiredPlayerInputs,
  transitionCompatibilityRequiredProposedInputs
} from "../transition-compatibility.policy.js";
import {
  buildEquipmentTransitionChangeProfile,
  normalizeCurrentEquipmentTransitionContext,
  normalizePlayerTransitionReadiness,
  normalizeProposedEquipmentTransitionContext,
  round
} from "../transition-compatibility.normalization.js";
import {
  TRANSITION_CHANGE_PROFILE_VERSION,
  TRANSITION_COMPATIBILITY_REASON_VERSION,
  type CurrentEquipmentTransitionContext,
  type EquipmentTransitionChangeProfile,
  type PlayerTransitionReadinessProfile,
  type ProposedEquipmentTransitionContext,
  type TransitionCompatibilityDimension,
  type TransitionCompatibilityDimensionResult,
  type TransitionCompatibilityInput,
  type TransitionCompatibilityMissingInput,
  type TransitionCompatibilityReason,
  type TransitionCompatibilityResult,
  type TransitionCompatibilityTradeoff
} from "../transition-compatibility.types.js";
import { evaluateTransitionCompatibility } from "../transition-compatibility.evaluator.js";
import {
  interpolationCurveForDimension,
  transitionCompatibilityV1_1BandForScore,
  transitionCompatibilityV1_1Policy,
  transitionCompatibilityV1_1ReadinessModifierPolicy,
  validateTransitionCompatibilityV1_1Policy
} from "./transition-compatibility-v1_1.policy.js";
import {
  interpolatePiecewiseLinearWithTrace,
  type InterpolationPoint,
  type InterpolationTrace
} from "./transition-compatibility-v1_1.interpolation.js";
import {
  TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION,
  TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1,
  TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1,
  type TransitionCompatibilityReadinessModifierTrace,
  type TransitionCompatibilityV1_1DimensionBuildResult,
  type TransitionCompatibilityV1_1Result,
  type TransitionCompatibilityVersionsInput,
  type TransitionCompatibilityVersionsResult
} from "./transition-compatibility-v1_1.types.js";

export function evaluateTransitionCompatibilityV1_1(input: TransitionCompatibilityInput): TransitionCompatibilityV1_1Result {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const policyErrors = validateTransitionCompatibilityV1_1Policy();
  const playerReadiness = normalizePlayerTransitionReadiness(input.playerDNA);
  const currentEquipment = normalizeCurrentEquipmentTransitionContext(input.currentEquipmentProfile);
  const proposedEquipment = normalizeProposedEquipmentTransitionContext(input.proposedEquipmentProfile);
  const changeProfile = buildEquipmentTransitionChangeProfile({ current: currentEquipment, proposed: proposedEquipment });
  const missingInformation = buildMissingInformation(playerReadiness, currentEquipment, proposedEquipment);

  if (policyErrors.length) {
    return baseResult(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation, evaluatedAt, "failed", policyErrors.join(" "));
  }
  if (!isSupportedPlayerDNAVersion(input.playerDNA.version) || input.proposedEquipmentProfile.version !== "1.0" || (input.currentEquipmentProfile && input.currentEquipmentProfile.version !== "1.0")) {
    return baseResult(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation.concat(versionMissingInput(input)), evaluatedAt, "blocked_unsupported_version", "Unsupported version blocks Transition Compatibility v1.1 candidate.");
  }
  if (!input.currentEquipmentProfile) {
    return baseResult(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation, evaluatedAt, "blocked_missing_current_equipment", "Current equipment context is required.");
  }

  const built = buildDimensions(playerReadiness, currentEquipment, proposedEquipment, changeProfile);
  const dimensions = built.map((item) => item.dimension);
  const interpolationTrace = built.map((item) => item.interpolationTrace).filter((item): item is InterpolationTrace => !!item);
  const readinessModifierTrace = built.map((item) => item.readinessTrace).filter((item): item is TransitionCompatibilityReadinessModifierTrace => !!item);
  const missingRequiredPlayer = transitionCompatibilityRequiredPlayerInputs.some((key) => playerReadiness[key] === undefined);
  const missingRequiredCurrent = transitionCompatibilityRequiredCurrentInputs.some((key) => currentEquipment[key] === undefined);
  const missingRequiredProposed = transitionCompatibilityRequiredProposedInputs.some((key) => proposedEquipment[key] === undefined);
  const scoredDimensions = dimensions.filter((dimension) => dimension.compatibilityScore !== undefined);
  const uncappedScore = scoredDimensions.length >= transitionCompatibilityV1_1Policy.minimumComponentCoverage
    ? clampScore(scoredDimensions.reduce((sum, dimension) => sum + (dimension.weightedContribution ?? 0), 0))
    : undefined;
  const score = uncappedScore === undefined
    ? undefined
    : missingInformation.some((item) => item.key === "currentEquipmentFamiliarity")
      ? Math.min(98, uncappedScore)
      : uncappedScore;
  const band = score === undefined ? undefined : transitionCompatibilityV1_1BandForScore(score);
  const status = missingRequiredPlayer
    ? "blocked_missing_player_input"
    : missingRequiredCurrent
      ? "blocked_missing_current_equipment"
      : missingRequiredProposed
        ? "blocked_missing_proposed_equipment_input"
        : score === undefined
          ? "partial"
          : "completed";

  return result(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation, evaluatedAt, {
    score,
    band,
    dimensions,
    confidence: assessConfidence(playerReadiness, currentEquipment, proposedEquipment, missingInformation, status),
    reasons: buildReasons(dimensions, missingInformation),
    tradeoffs: buildTradeoffs(changeProfile, dimensions),
    status,
    interpolationTrace,
    readinessModifierTrace
  });
}

export function evaluateTransitionCompatibilityVersions(input: TransitionCompatibilityVersionsInput): TransitionCompatibilityVersionsResult {
  return {
    version: "1.0",
    candidateVersion: "v1_1_linear_interpolation",
    v1_0: evaluateTransitionCompatibility(input),
    v1_1: evaluateTransitionCompatibilityV1_1(input),
    productionUseAllowed: false,
    liveRecommendationUseAllowed: false
  };
}

function buildDimensions(
  player: PlayerTransitionReadinessProfile,
  current: CurrentEquipmentTransitionContext,
  proposed: ProposedEquipmentTransitionContext,
  change: EquipmentTransitionChangeProfile
): TransitionCompatibilityV1_1DimensionBuildResult[] {
  const readiness = player.equipmentChangeTolerance;
  const component = (
    dimension: Exclude<TransitionCompatibilityDimension, "experience_adjustment_demand">,
    currentValue: number | undefined,
    proposedValue: number | undefined,
    rawDifference: number | undefined,
    readinessValue: number | undefined,
    explanation: string
  ) => interpolatedComponent({ dimension, currentValue, proposedValue, rawDifference, readiness: readinessValue, explanation });

  const preliminary = [
    component("size_change_demand", current.length, proposed.length, change.rawDifferences.lengthDelta, readiness, "Compares current and proposed bat length using continuous inch-change interpolation."),
    component("mass_change_demand", current.weight, proposed.weight, change.rawDifferences.weightDelta, averageReadiness([readiness, player.physicalReadiness]), "Compares current and proposed bat weight using direction-aware continuous ounce-change interpolation."),
    component("drop_change_demand", current.drop, proposed.drop, change.rawDifferences.dropDelta, readiness, "Compares signed drop change while preserving relative-mass direction and continuous magnitude demand."),
    component("balance_change_demand", current.balanceProfile, proposed.balanceProfile, change.rawDifferences.balanceDelta, averageReadiness([readiness, player.batControlReadiness, player.swingFeelFlexibility]), "Compares canonical balance direction, where 0 is most balanced and 100 is most end-loaded, using continuous adjustment demand."),
    component("swing_effort_change_demand", current.swingEffort, proposed.swingEffort, change.rawDifferences.swingEffortDelta, averageReadiness([readiness, player.physicalReadiness, player.batControlReadiness]), "Compares canonical swing-effort demand with continuous smoothing around v1.0 thresholds; lower effort can still change timing.")
  ];
  return [...preliminary, experienceComponent(player, preliminary)];
}

function interpolatedComponent(input: {
  readonly dimension: Exclude<TransitionCompatibilityDimension, "experience_adjustment_demand">;
  readonly currentValue: number | undefined;
  readonly proposedValue: number | undefined;
  readonly rawDifference: number | undefined;
  readonly readiness: number | undefined;
  readonly explanation: string;
}): TransitionCompatibilityV1_1DimensionBuildResult {
  const weight = transitionCompatibilityDimensionWeights[input.dimension];
  if (input.currentValue === undefined || input.proposedValue === undefined || input.rawDifference === undefined) {
    return { dimension: { dimension: input.dimension, currentValue: input.currentValue, proposedValue: input.proposedValue, rawDifference: input.rawDifference, weight, status: "missing_input", explanation: `${input.explanation} Missing input prevents scoring.` } };
  }
  const curve = interpolationCurveForDimension(input.dimension, input.rawDifference);
  const interpolationTrace = interpolatePiecewiseLinearWithTrace(input.dimension, Math.abs(input.rawDifference), curve, { clamp: true });
  const readinessTrace = applyReadiness(input.dimension, interpolationTrace.interpolatedDemand, input.readiness);
  const compatibilityScore = clampScore(100 - readinessTrace.adjustedDemand);
  return {
    dimension: {
      dimension: input.dimension,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      rawDifference: input.rawDifference,
      baseAdjustmentDemand: interpolationTrace.interpolatedDemand,
      readinessModifier: round(readinessTrace.adjustedDemand - interpolationTrace.interpolatedDemand),
      finalAdjustmentDemand: readinessTrace.adjustedDemand,
      compatibilityScore,
      weight,
      weightedContribution: round(compatibilityScore * weight),
      status: statusFor(compatibilityScore),
      explanation: input.explanation
    },
    interpolationTrace,
    readinessTrace
  };
}

function experienceComponent(
  player: PlayerTransitionReadinessProfile,
  components: readonly TransitionCompatibilityV1_1DimensionBuildResult[]
): TransitionCompatibilityV1_1DimensionBuildResult {
  const scored = components
    .map((item) => item.dimension.baseAdjustmentDemand)
    .filter((value): value is number => typeof value === "number");
  const base = scored.length ? clampScore(scored.reduce((sum, value) => sum + value, 0) / scored.length) : undefined;
  const readiness = averageReadiness([player.equipmentChangeTolerance, player.experienceReadiness, player.developmentReadiness]);
  const weight = transitionCompatibilityDimensionWeights.experience_adjustment_demand;
  if (base === undefined || readiness === undefined) {
    return {
      dimension: {
        dimension: "experience_adjustment_demand",
        currentValue: player.experienceReadiness,
        proposedValue: player.equipmentChangeTolerance,
        weight,
        status: "missing_input",
        explanation: "Uses player experience and development readiness to assess transition adjustment capacity. Missing readiness input prevents scoring."
      }
    };
  }
  const readinessTrace = applyReadiness("experience_adjustment_demand", base, readiness);
  const compatibilityScore = clampScore(100 - readinessTrace.adjustedDemand);
  return {
    dimension: {
      dimension: "experience_adjustment_demand",
      currentValue: player.experienceReadiness,
      proposedValue: player.equipmentChangeTolerance,
      rawDifference: base,
      baseAdjustmentDemand: base,
      readinessModifier: round(readinessTrace.adjustedDemand - base),
      finalAdjustmentDemand: readinessTrace.adjustedDemand,
      compatibilityScore,
      weight,
      weightedContribution: round(compatibilityScore * weight),
      status: statusFor(compatibilityScore),
      explanation: "Uses player experience and development readiness to assess transition adjustment capacity."
    },
    readinessTrace
  };
}

function applyReadiness(dimension: TransitionCompatibilityDimension, baselineDemand: number, readinessValue: number | undefined): TransitionCompatibilityReadinessModifierTrace {
  const readiness = readinessValue ?? transitionCompatibilityV1_1ReadinessModifierPolicy.neutralReadiness;
  if (baselineDemand === 0) {
    return { dimension, baselineDemand, readinessValue: readiness, multiplier: 1, absoluteAdjustment: 0, adjustedDemand: 0, bounded: false };
  }
  const neutral = transitionCompatibilityV1_1ReadinessModifierPolicy.neutralReadiness;
  const rawAdjustment = readiness >= neutral
    ? -Math.min(transitionCompatibilityV1_1ReadinessModifierPolicy.maximumAbsoluteDemandReduction, (readiness - neutral) * 0.5)
    : Math.min(transitionCompatibilityV1_1ReadinessModifierPolicy.maximumAbsoluteDemandIncrease, (neutral - readiness) * 0.4);
  const rawAdjusted = baselineDemand + rawAdjustment;
  const minimum = baselineDemand * transitionCompatibilityV1_1ReadinessModifierPolicy.minimumMultiplier;
  const maximum = baselineDemand * transitionCompatibilityV1_1ReadinessModifierPolicy.maximumMultiplier;
  const adjustedDemand = clampScore(Math.max(minimum, Math.min(maximum, rawAdjusted)));
  return {
    dimension,
    baselineDemand,
    readinessValue: readiness,
    multiplier: round(adjustedDemand / baselineDemand),
    absoluteAdjustment: round(adjustedDemand - baselineDemand),
    adjustedDemand,
    bounded: adjustedDemand !== round(rawAdjusted)
  };
}

function result(
  input: TransitionCompatibilityInput,
  playerReadiness: PlayerTransitionReadinessProfile,
  currentEquipment: CurrentEquipmentTransitionContext,
  proposedEquipment: ProposedEquipmentTransitionContext,
  changeProfile: EquipmentTransitionChangeProfile,
  missingInformation: readonly TransitionCompatibilityMissingInput[],
  evaluatedAt: Date,
  values: {
    readonly score?: number;
    readonly band?: TransitionCompatibilityResult["band"];
    readonly dimensions: readonly TransitionCompatibilityDimensionResult[];
    readonly confidence: TransitionCompatibilityResult["confidence"];
    readonly reasons: readonly TransitionCompatibilityReason[];
    readonly tradeoffs: readonly TransitionCompatibilityTradeoff[];
    readonly status: TransitionCompatibilityResult["status"];
    readonly interpolationTrace: readonly InterpolationTrace[];
    readonly readinessModifierTrace: readonly TransitionCompatibilityReadinessModifierTrace[];
  }
): TransitionCompatibilityV1_1Result {
  return {
    version: "1.1",
    modelVersion: TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1,
    policyVersion: TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1,
    reasonVersion: TRANSITION_COMPATIBILITY_REASON_VERSION,
    changeProfileVersion: TRANSITION_CHANGE_PROFILE_VERSION,
    interpolationVersion: TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION,
    candidateVersion: "v1_1_linear_interpolation",
    recommendationUsePolicy: "shadow_only",
    playerId: input.playerDNA.playerId,
    currentEquipmentId: currentEquipment.equipmentId,
    currentEquipmentVariantId: currentEquipment.equipmentVariantId,
    proposedEquipmentId: proposedEquipment.equipmentId,
    proposedEquipmentVariantId: proposedEquipment.equipmentVariantId,
    score: values.score,
    band: values.band,
    dimensions: values.dimensions,
    confidence: values.confidence,
    reasons: values.reasons,
    tradeoffs: values.tradeoffs,
    missingInformation,
    playerReadiness,
    currentEquipment,
    proposedEquipment,
    changeProfile,
    interpolationTrace: values.interpolationTrace,
    readinessModifierTrace: values.readinessModifierTrace,
    productionUseAllowed: false,
    liveRecommendationUseAllowed: false,
    trace: {
      currentEquipmentValues: {
        length: currentEquipment.length,
        weight: currentEquipment.weight,
        drop: currentEquipment.drop,
        balanceProfile: currentEquipment.balanceProfile,
        swingEffort: currentEquipment.swingEffort,
        construction: currentEquipment.construction
      },
      proposedEquipmentValues: {
        length: proposedEquipment.length,
        weight: proposedEquipment.weight,
        drop: proposedEquipment.drop,
        balanceProfile: proposedEquipment.balanceProfile,
        swingEffort: proposedEquipment.swingEffort,
        construction: proposedEquipment.construction
      },
      normalizedDifferences: changeProfile.rawDifferences,
      demandThresholds: transitionCompatibilityV1_1Policy.demandThresholds,
      readinessModifiers: ["v1.1 uses explicit bounded readiness multipliers and absolute adjustment caps"],
      componentWeights: transitionCompatibilityDimensionWeights,
      componentCoverage: { scoredComponents: values.dimensions.filter((dimension) => dimension.compatibilityScore !== undefined).length, totalComponents: values.dimensions.length },
      missingInputs: missingInformation,
      confidenceFactors: confidenceFactors(playerReadiness, currentEquipment, proposedEquipment, missingInformation),
      versions: {
        model: TRANSITION_COMPATIBILITY_MODEL_VERSION_V1_1,
        policy: TRANSITION_COMPATIBILITY_POLICY_VERSION_V1_1,
        reason: TRANSITION_COMPATIBILITY_REASON_VERSION,
        changeProfile: TRANSITION_CHANGE_PROFILE_VERSION,
        playerDNA: input.playerDNA.version,
        currentEquipmentDNA: input.currentEquipmentProfile?.version ?? "missing",
        proposedEquipmentDNA: input.proposedEquipmentProfile.version
      },
      reasonThresholds: transitionCompatibilityV1_1Policy.reasonThresholds,
      interpolationVersion: TRANSITION_COMPATIBILITY_INTERPOLATION_VERSION,
      interpolationCurves: transitionCompatibilityV1_1Policy.interpolationCurves as Record<string, readonly InterpolationPoint[]>,
      readinessBounds: transitionCompatibilityV1_1Policy.readinessModifier,
      candidateVersion: "v1_1_linear_interpolation",
      productionUseAllowed: false,
      liveRecommendationUseAllowed: false
    },
    status: values.status,
    evaluatedAt
  };
}

function baseResult(
  input: TransitionCompatibilityInput,
  playerReadiness: PlayerTransitionReadinessProfile,
  currentEquipment: CurrentEquipmentTransitionContext,
  proposedEquipment: ProposedEquipmentTransitionContext,
  changeProfile: EquipmentTransitionChangeProfile,
  missingInformation: readonly TransitionCompatibilityMissingInput[],
  evaluatedAt: Date,
  status: TransitionCompatibilityResult["status"],
  message: string
): TransitionCompatibilityV1_1Result {
  return result(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation, evaluatedAt, {
    dimensions: [],
    confidence: "estimated",
    reasons: [{ code: "MODEL_CONFIDENCE_LIMITED", message }],
    tradeoffs: [],
    status,
    interpolationTrace: [],
    readinessModifierTrace: []
  });
}

function buildMissingInformation(
  player: PlayerTransitionReadinessProfile,
  current: CurrentEquipmentTransitionContext,
  proposed: ProposedEquipmentTransitionContext
): TransitionCompatibilityMissingInput[] {
  const missing: TransitionCompatibilityMissingInput[] = [];
  for (const key of transitionCompatibilityRequiredPlayerInputs) if (player[key] === undefined) missing.push(missingInput("player_dna", key, true, "Blocks completed transition compatibility scoring.", "Regenerate Player DNA with complete player profile and BatMatch inputs."));
  for (const key of transitionCompatibilityRequiredCurrentInputs) if (current[key] === undefined) missing.push(missingInput("current_equipment", key, true, "Blocks transition compatibility because current equipment specification is missing.", "Add current bat catalog specifications or canonical current-equipment evaluations."));
  for (const key of transitionCompatibilityRequiredProposedInputs) if (proposed[key] === undefined) missing.push(missingInput("proposed_equipment", key, true, "Blocks transition compatibility because proposed equipment specification is missing.", "Add proposed bat catalog specifications or canonical evaluations."));
  if (current.familiarity === undefined) missing.push(missingInput("current_equipment", "currentEquipmentFamiliarity", false, "Lowers confidence because current-bat familiarity is unavailable.", "Capture how long and how comfortably the player has used the current bat."));
  if (player.growthStability === undefined) missing.push(missingInput("player_dna", "growthStability", false, "Lowers confidence because growth context is incomplete.", "Add recent growth measurements."));
  if (player.swingFeelFlexibility === undefined) missing.push(missingInput("player_dna", "preferredSwingFeel", false, "Lowers confidence for balance-change interpretation.", "Capture swing-feel preference."));
  if (current.balanceProfile === undefined) missing.push(missingInput("current_equipment", "balanceProfile", false, "Removes balance-change component from transition scoring.", "Create current equipment balance_profile evaluation."));
  if (current.swingEffort === undefined) missing.push(missingInput("current_equipment", "swingEffort", false, "Removes swing-effort-change component from transition scoring.", "Create current equipment swing_effort evaluation."));
  return [...new Map(missing.map((item) => [`${item.sourceArea}:${item.key}`, item])).values()];
}

function buildReasons(dimensions: readonly TransitionCompatibilityDimensionResult[], missing: readonly TransitionCompatibilityMissingInput[]): TransitionCompatibilityReason[] {
  const reasons: TransitionCompatibilityReason[] = [];
  for (const dimension of dimensions) {
    if (dimension.status === "missing_input") continue;
    reasons.push((dimension.compatibilityScore ?? 0) >= transitionCompatibilityV1_1Policy.reasonThresholds.manageableMinimum ? manageableReason(dimension.dimension) : adjustmentReason(dimension.dimension));
  }
  if (dimensions.every((dimension) => dimension.status !== "missing_input" && (dimension.compatibilityScore ?? 0) >= 80)) reasons.push({ code: "CURRENT_EQUIPMENT_IS_SIMILAR", message: "Current and proposed equipment are closely aligned across the available transition inputs." });
  if (dimensions.some((dimension) => dimension.dimension === "experience_adjustment_demand" && (dimension.compatibilityScore ?? 0) >= 75)) reasons.push({ code: "PLAYER_READINESS_SUPPORTS_TRANSITION", message: "Player readiness inputs support a manageable equipment adjustment." });
  if (dimensions.some((dimension) => dimension.dimension === "experience_adjustment_demand" && (dimension.compatibilityScore ?? 0) < 65)) reasons.push({ code: "PLAYER_READINESS_LIMITS_TRANSITION", message: "Player readiness inputs limit confidence in this equipment adjustment." });
  if (missing.some((item) => item.key === "currentEquipmentFamiliarity")) reasons.push({ code: "CURRENT_EQUIPMENT_FAMILIARITY_MISSING", message: "Current equipment familiarity is missing, limiting confidence in this transition estimate." });
  if (missing.some((item) => item.key === "growthStability")) reasons.push({ code: "GROWTH_CONTEXT_MISSING", message: "Growth context is incomplete." });
  if (missing.some((item) => item.key === "preferredSwingFeel")) reasons.push({ code: "SWING_FEEL_PREFERENCE_MISSING", message: "Swing-feel preference is unavailable for balance-change interpretation." });
  reasons.push({ code: "MODEL_CONFIDENCE_LIMITED", message: "Transition Compatibility v1.1 is shadow-only and requires extended validation before ranking use." });
  return [...new Map(reasons.map((reason) => [`${reason.code}:${reason.dimension ?? ""}`, reason])).values()];
}

function buildTradeoffs(change: EquipmentTransitionChangeProfile, dimensions: readonly TransitionCompatibilityDimensionResult[]): TransitionCompatibilityTradeoff[] {
  const tradeoffs: TransitionCompatibilityTradeoff[] = [];
  if ((change.rawDifferences.weightDelta ?? 0) > 0) tradeoffs.push({ code: "HEAVIER_SETUP_MAY_REQUIRE_ACCLIMATION", dimension: "mass_change_demand", message: "Moving heavier may require an adjustment period." });
  if ((change.rawDifferences.weightDelta ?? 0) < 0) tradeoffs.push({ code: "LIGHTER_SETUP_MAY_CHANGE_TIMING", dimension: "mass_change_demand", message: "Moving lighter may change timing even when it lowers effort." });
  if ((change.rawDifferences.balanceDelta ?? 0) > 10) tradeoffs.push({ code: "END_LOAD_CHANGE_MAY_ALTER_BARREL_FEEL", dimension: "balance_change_demand", message: "A more end-loaded balance may alter barrel feel." });
  if ((change.rawDifferences.swingEffortDelta ?? 0) < -10) tradeoffs.push({ code: "EASIER_SWING_EFFORT_MAY_CHANGE_TIMING", dimension: "swing_effort_change_demand", message: "Easier swing effort may still change timing." });
  if (change.rawDifferences.constructionChanged) tradeoffs.push({ code: "CONSTRUCTION_CHANGE_MAY_CHANGE_FEEDBACK", message: "Construction differences may change feedback and feel." });
  if (dimensions.some((dimension) => (dimension.compatibilityScore ?? 100) < 65)) tradeoffs.push({ code: "MORE_POWERFUL_SETUP_REQUIRES_ADJUSTMENT", message: "The proposed setup may require acclimation before it feels natural." });
  tradeoffs.push({ code: "CURRENT_FAMILIARITY_LIMITS_CERTAINTY", message: "Missing current-bat familiarity limits certainty." });
  return [...new Map(tradeoffs.map((tradeoff) => [`${tradeoff.code}:${tradeoff.dimension ?? ""}`, tradeoff])).values()];
}

function manageableReason(dimension: TransitionCompatibilityDimension): TransitionCompatibilityReason {
  const map = {
    size_change_demand: ["SIZE_CHANGE_IS_MANAGEABLE", "Length change appears manageable based on current and proposed specs."],
    mass_change_demand: ["MASS_CHANGE_IS_MANAGEABLE", "Weight change appears manageable based on current and proposed specs."],
    drop_change_demand: ["DROP_CHANGE_IS_MANAGEABLE", "Drop change appears manageable with the signed drop convention preserved."],
    balance_change_demand: ["BALANCE_CHANGE_IS_MANAGEABLE", "Balance change appears manageable using canonical balance direction."],
    swing_effort_change_demand: ["SWING_EFFORT_CHANGE_IS_MANAGEABLE", "Swing-effort change appears manageable using canonical effort demand."],
    experience_adjustment_demand: ["PLAYER_READINESS_SUPPORTS_TRANSITION", "Player readiness inputs support transition manageability."]
  } as const;
  const [code, message] = map[dimension];
  return { code, dimension, message };
}

function adjustmentReason(dimension: TransitionCompatibilityDimension): TransitionCompatibilityReason {
  const map = {
    size_change_demand: ["SIZE_CHANGE_REQUIRES_ADJUSTMENT", "Length change may require an adjustment period."],
    mass_change_demand: ["MASS_CHANGE_REQUIRES_ADJUSTMENT", "Weight change may require an adjustment period."],
    drop_change_demand: ["DROP_CHANGE_REQUIRES_ADJUSTMENT", "Drop change may require an adjustment period."],
    balance_change_demand: ["BALANCE_CHANGE_REQUIRES_ADJUSTMENT", "Balance change may alter barrel feel and require adjustment."],
    swing_effort_change_demand: ["SWING_EFFORT_CHANGE_REQUIRES_ADJUSTMENT", "Swing-effort change may require timing or physical adjustment."],
    experience_adjustment_demand: ["PLAYER_READINESS_LIMITS_TRANSITION", "Player readiness inputs limit transition manageability."]
  } as const;
  const [code, message] = map[dimension];
  return { code, dimension, message };
}

function assessConfidence(
  player: PlayerTransitionReadinessProfile,
  current: CurrentEquipmentTransitionContext,
  proposed: ProposedEquipmentTransitionContext,
  missing: readonly TransitionCompatibilityMissingInput[],
  status: TransitionCompatibilityResult["status"]
): TransitionCompatibilityResult["confidence"] {
  if (status !== "completed") return "estimated";
  if (missing.some((item) => item.required)) return "estimated";
  if (missing.some((item) => item.key === "currentEquipmentFamiliarity" || item.key === "balanceProfile" || item.key === "swingEffort")) return "moderate";
  if (player.confidence === "high" && current.balanceProfile !== undefined && proposed.balanceProfile !== undefined) return "high";
  return "moderate";
}

function confidenceFactors(player: PlayerTransitionReadinessProfile, current: CurrentEquipmentTransitionContext, proposed: ProposedEquipmentTransitionContext, missing: readonly TransitionCompatibilityMissingInput[]): string[] {
  return [
    `Player readiness confidence: ${player.confidence}`,
    `Current equipment required specs present: ${transitionCompatibilityRequiredCurrentInputs.every((key) => current[key] !== undefined) ? "yes" : "no"}`,
    `Proposed equipment required specs present: ${transitionCompatibilityRequiredProposedInputs.every((key) => proposed[key] !== undefined) ? "yes" : "no"}`,
    `Missing inputs: ${missing.length}`,
    "Validated confidence disabled for v1.1 candidate"
  ];
}

function missingInput(sourceArea: TransitionCompatibilityMissingInput["sourceArea"], key: string, required: boolean, effect: string, recommendedNextAction: string): TransitionCompatibilityMissingInput {
  return { sourceArea, key, required, effect, recommendedNextAction };
}

function versionMissingInput(input: TransitionCompatibilityInput): TransitionCompatibilityMissingInput {
  return {
    sourceArea: "version",
    key: "profileVersion",
    required: true,
    effect: `Unsupported versions: player ${input.playerDNA.version}, current ${input.currentEquipmentProfile?.version ?? "missing"}, proposed ${input.proposedEquipmentProfile.version}.`,
    recommendedNextAction: "Use supported v1.0-compatible Player DNA and canonical Equipment DNA profiles."
  };
}

function isSupportedPlayerDNAVersion(version: string): boolean {
  return version === "1.0.0" || version === "player-dna-mvp-v1";
}

function averageReadiness(values: readonly (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => typeof value === "number");
  if (!present.length) return undefined;
  return round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function statusFor(score: number) {
  if (score >= 85) return "very_manageable";
  if (score >= 70) return "manageable";
  if (score >= 50) return "moderate_adjustment";
  if (score >= 25) return "demanding";
  return "highly_demanding";
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Score must be finite.");
  return Math.max(0, Math.min(100, round(value)));
}
