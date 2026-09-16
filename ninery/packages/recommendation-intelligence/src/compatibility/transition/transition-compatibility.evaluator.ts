import {
  transitionCompatibilityBandForScore,
  transitionCompatibilityDemandThresholds,
  transitionCompatibilityDimensionWeights,
  transitionCompatibilityPolicy,
  transitionCompatibilityRequiredCurrentInputs,
  transitionCompatibilityRequiredPlayerInputs,
  transitionCompatibilityRequiredProposedInputs,
  validateTransitionCompatibilityPolicy
} from "./transition-compatibility.policy.js";
import {
  buildEquipmentTransitionChangeProfile,
  normalizeCurrentEquipmentTransitionContext,
  normalizePlayerTransitionReadiness,
  normalizeProposedEquipmentTransitionContext,
  round
} from "./transition-compatibility.normalization.js";
import {
  TRANSITION_CHANGE_PROFILE_VERSION,
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_POLICY_VERSION,
  TRANSITION_COMPATIBILITY_REASON_VERSION,
  type TransitionCompatibilityDimension,
  type TransitionCompatibilityDimensionResult,
  type TransitionCompatibilityInput,
  type TransitionCompatibilityMissingInput,
  type TransitionCompatibilityReason,
  type TransitionCompatibilityResult,
  type TransitionCompatibilityTradeoff
} from "./transition-compatibility.types.js";

export function evaluateTransitionCompatibility(input: TransitionCompatibilityInput): TransitionCompatibilityResult {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const policyErrors = validateTransitionCompatibilityPolicy();
  const playerReadiness = normalizePlayerTransitionReadiness(input.playerDNA);
  const currentEquipment = normalizeCurrentEquipmentTransitionContext(input.currentEquipmentProfile);
  const proposedEquipment = normalizeProposedEquipmentTransitionContext(input.proposedEquipmentProfile);
  const changeProfile = buildEquipmentTransitionChangeProfile({ current: currentEquipment, proposed: proposedEquipment });
  const missingInformation = buildMissingInformation(playerReadiness, currentEquipment, proposedEquipment);

  if (policyErrors.length) {
    return baseResult(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation, evaluatedAt, "failed", policyErrors.join(" "));
  }
  if (!isSupportedPlayerDNAVersion(input.playerDNA.version) || input.proposedEquipmentProfile.version !== "1.0" || (input.currentEquipmentProfile && input.currentEquipmentProfile.version !== "1.0")) {
    return baseResult(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation.concat(versionMissingInput(input)), evaluatedAt, "blocked_unsupported_version", "Unsupported version blocks Transition Compatibility v1.0.");
  }
  if (!input.currentEquipmentProfile) {
    return baseResult(input, playerReadiness, currentEquipment, proposedEquipment, changeProfile, missingInformation, evaluatedAt, "blocked_missing_current_equipment", "Current equipment context is required.");
  }

  const dimensions = buildDimensions(playerReadiness, currentEquipment, proposedEquipment, changeProfile);
  const missingRequiredPlayer = transitionCompatibilityRequiredPlayerInputs.some((key) => playerReadiness[key] === undefined);
  const missingRequiredCurrent = transitionCompatibilityRequiredCurrentInputs.some((key) => currentEquipment[key] === undefined);
  const missingRequiredProposed = transitionCompatibilityRequiredProposedInputs.some((key) => proposedEquipment[key] === undefined);
  const scoredDimensions = dimensions.filter((dimension) => dimension.compatibilityScore !== undefined);
  const uncappedScore = scoredDimensions.length >= transitionCompatibilityPolicy.minimumComponentCoverage
    ? clampScore(scoredDimensions.reduce((sum, dimension) => sum + (dimension.weightedContribution ?? 0), 0))
    : undefined;
  const score = uncappedScore === undefined
    ? undefined
    : missingInformation.some((item) => item.key === "currentEquipmentFamiliarity")
      ? Math.min(98, uncappedScore)
      : uncappedScore;
  const band = score === undefined ? undefined : transitionCompatibilityBandForScore(score);
  const status = missingRequiredPlayer
    ? "blocked_missing_player_input"
    : missingRequiredCurrent
      ? "blocked_missing_current_equipment"
      : missingRequiredProposed
        ? "blocked_missing_proposed_equipment_input"
        : score === undefined
          ? "partial"
          : "completed";

  return {
    version: "1.0",
    modelVersion: TRANSITION_COMPATIBILITY_MODEL_VERSION,
    policyVersion: TRANSITION_COMPATIBILITY_POLICY_VERSION,
    reasonVersion: TRANSITION_COMPATIBILITY_REASON_VERSION,
    changeProfileVersion: TRANSITION_CHANGE_PROFILE_VERSION,
    recommendationUsePolicy: transitionCompatibilityPolicy.recommendationUsePolicy,
    playerId: input.playerDNA.playerId,
    currentEquipmentId: currentEquipment.equipmentId,
    currentEquipmentVariantId: currentEquipment.equipmentVariantId,
    proposedEquipmentId: proposedEquipment.equipmentId,
    proposedEquipmentVariantId: proposedEquipment.equipmentVariantId,
    score,
    band,
    dimensions,
    confidence: assessConfidence(playerReadiness, currentEquipment, proposedEquipment, missingInformation, status),
    reasons: buildReasons(dimensions, missingInformation),
    tradeoffs: buildTradeoffs(changeProfile, dimensions),
    missingInformation,
    playerReadiness,
    currentEquipment,
    proposedEquipment,
    changeProfile,
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
      demandThresholds: transitionCompatibilityDemandThresholds,
      readinessModifiers: ["readiness reduces demand up to 20 points but keeps at least 35% of base demand"],
      componentWeights: transitionCompatibilityDimensionWeights,
      componentCoverage: { scoredComponents: scoredDimensions.length, totalComponents: dimensions.length },
      missingInputs: missingInformation,
      confidenceFactors: confidenceFactors(playerReadiness, currentEquipment, proposedEquipment, missingInformation),
      versions: {
        model: TRANSITION_COMPATIBILITY_MODEL_VERSION,
        policy: TRANSITION_COMPATIBILITY_POLICY_VERSION,
        reason: TRANSITION_COMPATIBILITY_REASON_VERSION,
        changeProfile: TRANSITION_CHANGE_PROFILE_VERSION,
        playerDNA: input.playerDNA.version,
        currentEquipmentDNA: input.currentEquipmentProfile?.version ?? "missing",
        proposedEquipmentDNA: input.proposedEquipmentProfile.version
      },
      reasonThresholds: transitionCompatibilityPolicy.reasonThresholds
    },
    status,
    evaluatedAt
  };
}

function buildDimensions(
  player: ReturnType<typeof normalizePlayerTransitionReadiness>,
  current: ReturnType<typeof normalizeCurrentEquipmentTransitionContext>,
  proposed: ReturnType<typeof normalizeProposedEquipmentTransitionContext>,
  change: ReturnType<typeof buildEquipmentTransitionChangeProfile>
): TransitionCompatibilityDimensionResult[] {
  const readiness = player.equipmentChangeTolerance;
  return [
    component("size_change_demand", current.length, proposed.length, change.rawDifferences.lengthDelta, demandFromThreshold(Math.abs(change.rawDifferences.lengthDelta ?? Number.NaN), [0, 0.5, 1, 1.5, 2]), readiness, "Compares current and proposed bat length."),
    component("mass_change_demand", current.weight, proposed.weight, change.rawDifferences.weightDelta, weightDemand(change.rawDifferences.weightDelta), averageReadiness([readiness, player.physicalReadiness]), "Compares current and proposed bat weight; heavier moves carry more physical adjustment demand."),
    component("drop_change_demand", current.drop, proposed.drop, change.rawDifferences.dropDelta, demandFromThreshold(Math.abs(change.rawDifferences.dropDelta ?? Number.NaN), [0, 1, 2, 3]), readiness, "Compares signed drop change while preserving the raw direction."),
    component("balance_change_demand", current.balanceProfile, proposed.balanceProfile, change.rawDifferences.balanceDelta, demandFromThreshold(Math.abs(change.rawDifferences.balanceDelta ?? Number.NaN), [0, 10, 20, 35, 50]), averageReadiness([readiness, player.batControlReadiness, player.swingFeelFlexibility]), "Compares canonical balance direction, where 0 is most balanced and 100 is most end-loaded."),
    component("swing_effort_change_demand", current.swingEffort, proposed.swingEffort, change.rawDifferences.swingEffortDelta, swingEffortDemand(change.rawDifferences.swingEffortDelta), averageReadiness([readiness, player.physicalReadiness, player.batControlReadiness]), "Compares canonical swing-effort demand; lower effort can still change timing."),
    experienceComponent(player, change)
  ];
}

function component(
  dimension: TransitionCompatibilityDimension,
  currentValue: number | undefined,
  proposedValue: number | undefined,
  rawDifference: number | undefined,
  baseAdjustmentDemand: number | undefined,
  readiness: number | undefined,
  explanation: string
): TransitionCompatibilityDimensionResult {
  const weight = transitionCompatibilityDimensionWeights[dimension];
  if (currentValue === undefined || proposedValue === undefined || rawDifference === undefined || baseAdjustmentDemand === undefined) {
    return { dimension, currentValue, proposedValue, rawDifference, weight, status: "missing_input", explanation: `${explanation} Missing input prevents scoring.` };
  }
  const readinessModifier = readinessModifierFor(readiness);
  const finalAdjustmentDemand = applyReadiness(baseAdjustmentDemand, readinessModifier);
  const compatibilityScore = clampScore(100 - finalAdjustmentDemand);
  return {
    dimension,
    currentValue,
    proposedValue,
    rawDifference,
    baseAdjustmentDemand,
    readinessModifier,
    finalAdjustmentDemand,
    compatibilityScore,
    weight,
    weightedContribution: round(compatibilityScore * weight),
    status: statusFor(compatibilityScore),
    explanation
  };
}

function experienceComponent(
  player: ReturnType<typeof normalizePlayerTransitionReadiness>,
  change: ReturnType<typeof buildEquipmentTransitionChangeProfile>
): TransitionCompatibilityDimensionResult {
  const changes = [change.sizeChange, change.massChange, change.dropChange, change.balanceChange, change.swingEffortChange].filter((value): value is number => typeof value === "number");
  const base = changes.length ? clampScore(changes.reduce((sum, value) => sum + value, 0) / changes.length) : undefined;
  const readiness = averageReadiness([player.equipmentChangeTolerance, player.experienceReadiness, player.developmentReadiness]);
  const weight = transitionCompatibilityDimensionWeights.experience_adjustment_demand;
  if (base === undefined || readiness === undefined) {
    return {
      dimension: "experience_adjustment_demand",
      currentValue: player.experienceReadiness,
      proposedValue: player.equipmentChangeTolerance,
      weight,
      status: "missing_input",
      explanation: "Uses player experience and development readiness to assess transition adjustment capacity. Missing readiness input prevents scoring."
    };
  }
  const readinessModifier = readinessModifierFor(readiness);
  const finalAdjustmentDemand = applyReadiness(base, readinessModifier);
  const compatibilityScore = clampScore(100 - finalAdjustmentDemand);
  return {
    dimension: "experience_adjustment_demand",
    currentValue: player.experienceReadiness,
    proposedValue: player.equipmentChangeTolerance,
    rawDifference: base,
    baseAdjustmentDemand: base,
    readinessModifier,
    finalAdjustmentDemand,
    compatibilityScore,
    weight,
    weightedContribution: round(compatibilityScore * weight),
    status: statusFor(compatibilityScore),
    explanation: "Uses player experience and development readiness to assess transition adjustment capacity."
  };
}

export function demandFromThreshold(value: number, thresholds: readonly number[]): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined;
  if (value <= thresholds[0]) return 0;
  if (value <= thresholds[1]) return 20;
  if (value <= thresholds[2]) return 45;
  if (value <= thresholds[3]) return 70;
  return 90;
}

function weightDemand(delta: number | undefined): number | undefined {
  if (delta === undefined) return undefined;
  const abs = Math.abs(delta);
  const base = demandFromThreshold(abs, [0, 1, 2, 3]);
  if (base === undefined) return undefined;
  if (delta > 0) return clampScore(base + Math.min(12, abs * 3));
  if (delta < 0) return clampScore(base + Math.min(8, abs * 2));
  return base;
}

function swingEffortDemand(delta: number | undefined): number | undefined {
  if (delta === undefined) return undefined;
  const abs = Math.abs(delta);
  const base = demandFromThreshold(abs, [0, 10, 20, 35, 50]);
  if (base === undefined) return undefined;
  if (delta > 0) return clampScore(base + Math.min(12, abs * 0.25));
  if (delta < 0) return clampScore(base + Math.min(8, abs * 0.15));
  return base;
}

function readinessModifierFor(readiness: number | undefined): number {
  if (readiness === undefined) return 0;
  const neutral = transitionCompatibilityPolicy.readinessModifier.neutralReadiness;
  if (readiness >= neutral) {
    return -Math.min(transitionCompatibilityPolicy.readinessModifier.maximumReduction, (readiness - neutral) * 0.5);
  }
  return Math.min(transitionCompatibilityPolicy.readinessModifier.maximumIncrease, (neutral - readiness) * 0.4);
}

function applyReadiness(base: number, modifier: number): number {
  if (base === 0) return 0;
  const adjusted = base + modifier;
  const minimum = base * transitionCompatibilityPolicy.readinessModifier.minimumDemandRetained;
  return clampScore(Math.max(minimum, adjusted));
}

function buildMissingInformation(
  player: ReturnType<typeof normalizePlayerTransitionReadiness>,
  current: ReturnType<typeof normalizeCurrentEquipmentTransitionContext>,
  proposed: ReturnType<typeof normalizeProposedEquipmentTransitionContext>
): TransitionCompatibilityMissingInput[] {
  const missing: TransitionCompatibilityMissingInput[] = [];
  for (const key of transitionCompatibilityRequiredPlayerInputs) {
    if (player[key] === undefined) missing.push(missingInput("player_dna", key, true, "Blocks completed transition compatibility scoring.", "Regenerate Player DNA with complete player profile and BatMatch inputs."));
  }
  for (const key of transitionCompatibilityRequiredCurrentInputs) {
    if (current[key] === undefined) missing.push(missingInput("current_equipment", key, true, "Blocks transition compatibility because current equipment specification is missing.", "Add current bat catalog specifications or canonical current-equipment evaluations."));
  }
  for (const key of transitionCompatibilityRequiredProposedInputs) {
    if (proposed[key] === undefined) missing.push(missingInput("proposed_equipment", key, true, "Blocks transition compatibility because proposed equipment specification is missing.", "Add proposed bat catalog specifications or canonical evaluations."));
  }
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
    if ((dimension.compatibilityScore ?? 0) >= transitionCompatibilityPolicy.reasonThresholds.manageableMinimum) {
      reasons.push(manageableReason(dimension.dimension));
    } else {
      reasons.push(adjustmentReason(dimension.dimension));
    }
  }
  if (dimensions.every((dimension) => dimension.status !== "missing_input" && (dimension.compatibilityScore ?? 0) >= 80)) {
    reasons.push({ code: "CURRENT_EQUIPMENT_IS_SIMILAR", message: "Current and proposed equipment are closely aligned across the available transition inputs." });
  }
  if (dimensions.some((dimension) => dimension.dimension === "experience_adjustment_demand" && (dimension.compatibilityScore ?? 0) >= 75)) {
    reasons.push({ code: "PLAYER_READINESS_SUPPORTS_TRANSITION", message: "Player readiness inputs support a manageable equipment adjustment." });
  }
  if (dimensions.some((dimension) => dimension.dimension === "experience_adjustment_demand" && (dimension.compatibilityScore ?? 0) < 65)) {
    reasons.push({ code: "PLAYER_READINESS_LIMITS_TRANSITION", message: "Player readiness inputs limit confidence in this equipment adjustment." });
  }
  if (missing.some((item) => item.key === "currentEquipmentFamiliarity")) {
    reasons.push({ code: "CURRENT_EQUIPMENT_FAMILIARITY_MISSING", message: "Current equipment familiarity is missing, limiting confidence in this transition estimate." });
  }
  if (missing.some((item) => item.key === "growthStability")) reasons.push({ code: "GROWTH_CONTEXT_MISSING", message: "Growth context is incomplete." });
  if (missing.some((item) => item.key === "preferredSwingFeel")) reasons.push({ code: "SWING_FEEL_PREFERENCE_MISSING", message: "Swing-feel preference is unavailable for balance-change interpretation." });
  reasons.push({ code: "MODEL_CONFIDENCE_LIMITED", message: "Transition Compatibility v1.0 is shadow-only and requires validation before ranking use." });
  return [...new Map(reasons.map((reason) => [`${reason.code}:${reason.dimension ?? ""}`, reason])).values()];
}

function buildTradeoffs(
  change: ReturnType<typeof buildEquipmentTransitionChangeProfile>,
  dimensions: readonly TransitionCompatibilityDimensionResult[]
): TransitionCompatibilityTradeoff[] {
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

function statusFor(score: number) {
  if (score >= 85) return "very_manageable";
  if (score >= 70) return "manageable";
  if (score >= 50) return "moderate_adjustment";
  if (score >= 25) return "demanding";
  return "highly_demanding";
}

function assessConfidence(
  player: ReturnType<typeof normalizePlayerTransitionReadiness>,
  current: ReturnType<typeof normalizeCurrentEquipmentTransitionContext>,
  proposed: ReturnType<typeof normalizeProposedEquipmentTransitionContext>,
  missing: readonly TransitionCompatibilityMissingInput[],
  status: TransitionCompatibilityResult["status"]
) {
  if (status !== "completed") return "estimated";
  if (missing.some((item) => item.required)) return "estimated";
  if (missing.some((item) => item.key === "currentEquipmentFamiliarity" || item.key === "balanceProfile" || item.key === "swingEffort")) return "moderate";
  if (player.confidence === "high" && current.balanceProfile !== undefined && proposed.balanceProfile !== undefined) return "high";
  return "moderate";
}

function confidenceFactors(
  player: ReturnType<typeof normalizePlayerTransitionReadiness>,
  current: ReturnType<typeof normalizeCurrentEquipmentTransitionContext>,
  proposed: ReturnType<typeof normalizeProposedEquipmentTransitionContext>,
  missing: readonly TransitionCompatibilityMissingInput[]
): string[] {
  return [
    `Player readiness confidence: ${player.confidence}`,
    `Current equipment required specs present: ${transitionCompatibilityRequiredCurrentInputs.every((key) => current[key] !== undefined) ? "yes" : "no"}`,
    `Proposed equipment required specs present: ${transitionCompatibilityRequiredProposedInputs.every((key) => proposed[key] !== undefined) ? "yes" : "no"}`,
    `Missing inputs: ${missing.length}`,
    "Validated confidence disabled for v1.0"
  ];
}

function baseResult(
  input: TransitionCompatibilityInput,
  playerReadiness: ReturnType<typeof normalizePlayerTransitionReadiness>,
  currentEquipment: ReturnType<typeof normalizeCurrentEquipmentTransitionContext>,
  proposedEquipment: ReturnType<typeof normalizeProposedEquipmentTransitionContext>,
  changeProfile: ReturnType<typeof buildEquipmentTransitionChangeProfile>,
  missingInformation: readonly TransitionCompatibilityMissingInput[],
  evaluatedAt: Date,
  status: TransitionCompatibilityResult["status"],
  message: string
): TransitionCompatibilityResult {
  return {
    version: "1.0",
    modelVersion: TRANSITION_COMPATIBILITY_MODEL_VERSION,
    policyVersion: TRANSITION_COMPATIBILITY_POLICY_VERSION,
    reasonVersion: TRANSITION_COMPATIBILITY_REASON_VERSION,
    changeProfileVersion: TRANSITION_CHANGE_PROFILE_VERSION,
    recommendationUsePolicy: transitionCompatibilityPolicy.recommendationUsePolicy,
    playerId: input.playerDNA.playerId,
    currentEquipmentId: currentEquipment.equipmentId,
    currentEquipmentVariantId: currentEquipment.equipmentVariantId,
    proposedEquipmentId: proposedEquipment.equipmentId,
    proposedEquipmentVariantId: proposedEquipment.equipmentVariantId,
    dimensions: [],
    confidence: "estimated",
    reasons: [{ code: "MODEL_CONFIDENCE_LIMITED", message }],
    tradeoffs: [],
    missingInformation,
    playerReadiness,
    currentEquipment,
    proposedEquipment,
    changeProfile,
    trace: {
      currentEquipmentValues: {},
      proposedEquipmentValues: {},
      normalizedDifferences: changeProfile.rawDifferences,
      demandThresholds: transitionCompatibilityDemandThresholds,
      readinessModifiers: [],
      componentWeights: transitionCompatibilityDimensionWeights,
      componentCoverage: { scoredComponents: 0, totalComponents: 6 },
      missingInputs: missingInformation,
      confidenceFactors: [],
      versions: {
        model: TRANSITION_COMPATIBILITY_MODEL_VERSION,
        policy: TRANSITION_COMPATIBILITY_POLICY_VERSION,
        reason: TRANSITION_COMPATIBILITY_REASON_VERSION,
        changeProfile: TRANSITION_CHANGE_PROFILE_VERSION,
        playerDNA: input.playerDNA.version,
        currentEquipmentDNA: input.currentEquipmentProfile?.version ?? "missing",
        proposedEquipmentDNA: input.proposedEquipmentProfile.version
      },
      reasonThresholds: transitionCompatibilityPolicy.reasonThresholds
    },
    status,
    evaluatedAt
  };
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

function clampScore(value: number): number {
  if (!Number.isFinite(value)) throw new Error("Score must be finite.");
  return Math.max(0, Math.min(100, round(value)));
}
