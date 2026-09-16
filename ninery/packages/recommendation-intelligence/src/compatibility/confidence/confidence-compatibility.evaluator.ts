import {
  PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
  PREDICTABILITY_SUPPORT_COMPOSITE_VERSION
} from "@ninery/equipment-intelligence";
import {
  confidenceCompatibilityBandForScore,
  confidenceCompatibilityDimensionWeights,
  confidenceCompatibilityPolicy,
  confidenceCompatibilityRequiredEquipmentInputs,
  confidenceCompatibilityRequiredPlayerInputs,
  validateConfidenceCompatibilityPolicy
} from "./confidence-compatibility.policy.js";
import { normalizeEquipmentConfidenceSupport, normalizePlayerConfidenceSupportNeeds } from "./confidence-compatibility.normalization.js";
import type {
  ConfidenceCompatibilityDimension,
  ConfidenceCompatibilityDimensionResult,
  ConfidenceCompatibilityInput,
  ConfidenceCompatibilityMissingInput,
  ConfidenceCompatibilityReason,
  ConfidenceCompatibilityResult,
  ConfidenceCompatibilityTradeoff
} from "./confidence-compatibility.types.js";
import {
  CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
  CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
  CONFIDENCE_COMPATIBILITY_REASON_VERSION
} from "./confidence-compatibility.types.js";

export function evaluateConfidenceCompatibility(input: ConfidenceCompatibilityInput): ConfidenceCompatibilityResult {
  const policyErrors = validateConfidenceCompatibilityPolicy();
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const playerProfile = normalizePlayerConfidenceSupportNeeds(input.playerDNA);
  const equipmentProfile = normalizeEquipmentConfidenceSupport(input.canonicalEquipmentProfile);
  const missingInformation = buildMissingInformation(playerProfile, equipmentProfile);

  if (policyErrors.length) {
    return failedResult(input, playerProfile, equipmentProfile, missingInformation, evaluatedAt, policyErrors.join(" "));
  }
  if (!isSupportedPlayerDNAVersion(input.playerDNA.version)) {
    return blockedResult(input, playerProfile, equipmentProfile, missingInformation.concat(versionMissingInput("playerDNA", input.playerDNA.version)), evaluatedAt, "blocked_unsupported_version");
  }
  if (input.canonicalEquipmentProfile.version !== "1.0") {
    return blockedResult(input, playerProfile, equipmentProfile, missingInformation.concat(versionMissingInput("equipmentDNAProfile", input.canonicalEquipmentProfile.version)), evaluatedAt, "blocked_unsupported_version");
  }

  const dimensions = buildDimensions(playerProfile, equipmentProfile);
  const missingRequiredPlayer = confidenceCompatibilityRequiredPlayerInputs.some((key) => playerProfile[key] === undefined);
  const missingRequiredEquipment = confidenceCompatibilityRequiredEquipmentInputs.some((key) => equipmentProfile[key] === undefined);

  const completedDimensions = dimensions.filter((dimension) => dimension.score !== undefined);
  const weightedScore = completedDimensions.length
    ? round(completedDimensions.reduce((sum, dimension) => sum + (dimension.weightedContribution ?? 0), 0))
    : undefined;
  const score = weightedScore === undefined ? undefined : clampScore(weightedScore);
  const band = score === undefined ? undefined : confidenceCompatibilityBandForScore(score);
  const reasons = buildReasons(dimensions, missingInformation);
  const tradeoffs = buildTradeoffs(input.playerDNA.categories.developmentStage, dimensions);
  const confidence = assessConfidence(input, missingInformation, missingRequiredPlayer, missingRequiredEquipment);
  const status = missingRequiredPlayer
    ? "blocked_missing_player_input"
    : missingRequiredEquipment
      ? "blocked_missing_equipment_input"
      : score === undefined
        ? "partial"
        : "completed";

  return {
    version: "1.0",
    modelVersion: CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
    policyVersion: CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
    reasonVersion: CONFIDENCE_COMPATIBILITY_REASON_VERSION,
    recommendationUsePolicy: confidenceCompatibilityPolicy.recommendationUsePolicy,
    playerId: input.playerDNA.playerId,
    equipmentId: input.canonicalEquipmentProfile.equipmentId,
    equipmentVariantId: input.canonicalEquipmentProfile.equipmentVariantId,
    score,
    band,
    dimensions,
    confidence,
    reasons,
    tradeoffs,
    missingInformation,
    playerProfile,
    equipmentProfile,
    trace: {
      playerInputs: {
        batControlNeed: playerProfile.batControlNeed,
        contactConsistencyNeed: playerProfile.contactConsistencyNeed,
        predictabilityNeed: playerProfile.predictabilityNeed,
        forgivenessNeed: playerProfile.forgivenessNeed,
        manageableEffortNeed: playerProfile.manageableEffortNeed,
        developmentStage: playerProfile.developmentStage
      },
      equipmentInputs: {
        predictabilitySupport: equipmentProfile.predictabilitySupport,
        forgivenessSupport: equipmentProfile.forgivenessSupport,
        sweetSpotSupport: equipmentProfile.sweetSpotSupport,
        manageableEffortSupport: equipmentProfile.manageableEffortSupport,
        batControlSupport: equipmentProfile.batControlSupport
      },
      transformations: [
        "capability_to_need: support need = 100 - Player DNA capability + contextual adjustment",
        "support_adequacy: support below need penalized more strongly than modest support above need"
      ],
      directionInversions: ["manageableEffortSupport = 100 - canonical swing_effort demand"],
      weights: confidenceCompatibilityDimensionWeights,
      dimensionScores: dimensions,
      completeness: {
        requiredPlayerInputsPresent: confidenceCompatibilityRequiredPlayerInputs.filter((key) => playerProfile[key] !== undefined).length,
        requiredPlayerInputsTotal: confidenceCompatibilityRequiredPlayerInputs.length,
        requiredEquipmentInputsPresent: confidenceCompatibilityRequiredEquipmentInputs.filter((key) => equipmentProfile[key] !== undefined).length,
        requiredEquipmentInputsTotal: confidenceCompatibilityRequiredEquipmentInputs.length
      },
      confidenceFactors: confidenceFactors(input, missingInformation),
      versions: {
        model: CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
        policy: CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
        reasons: CONFIDENCE_COMPATIBILITY_REASON_VERSION,
        playerDNA: input.playerDNA.version,
        equipmentDNAProfile: input.canonicalEquipmentProfile.version,
        predictabilitySupport: `${PREDICTABILITY_SUPPORT_EVALUATION_VERSION}/${PREDICTABILITY_SUPPORT_COMPOSITE_VERSION}`
      },
      reasonThresholds: confidenceCompatibilityPolicy.reasonThresholds,
      missingInputs: missingInformation
    },
    status,
    evaluatedAt
  };
}

function isSupportedPlayerDNAVersion(version: string): boolean {
  return version === "1.0.0" || version === "player-dna-mvp-v1";
}

function buildDimensions(
  player: ReturnType<typeof normalizePlayerConfidenceSupportNeeds>,
  equipment: ReturnType<typeof normalizeEquipmentConfidenceSupport>
): ConfidenceCompatibilityDimensionResult[] {
  return [
    dimension("predictability_alignment", player.predictabilityNeed, equipment.predictabilitySupport, "Compares current consistency support need with equipment predictability support."),
    dimension("forgiveness_alignment", player.forgivenessNeed, equipment.forgivenessSupport, "Compares contact outcome support need with equipment forgiveness."),
    dimension("bat_control_alignment", player.batControlNeed, equipment.batControlSupport, "Compares bat-control support need with equipment bat-control support."),
    dimension("manageable_effort_alignment", player.manageableEffortNeed, equipment.manageableEffortSupport, "Compares manageable-effort need with inverted swing-effort demand."),
    dimension("contact_support_alignment", player.contactConsistencyNeed, equipment.sweetSpotSupport, "Compares contact consistency support need with sweet-spot support.")
  ];
}

function dimension(
  dimensionName: ConfidenceCompatibilityDimension,
  playerNeed: number | undefined,
  equipmentSupport: number | undefined,
  explanation: string
): ConfidenceCompatibilityDimensionResult {
  const weight = confidenceCompatibilityDimensionWeights[dimensionName];
  if (playerNeed === undefined || equipmentSupport === undefined) {
    return { dimension: dimensionName, playerNeed, equipmentSupport, weight, status: "missing_input", explanation: `${explanation} Missing input prevents scoring.` };
  }
  const score = scoreSupportAdequacy(playerNeed, equipmentSupport);
  return {
    dimension: dimensionName,
    playerNeed,
    equipmentSupport,
    score,
    weight,
    weightedContribution: round(score * weight),
    status: statusFor(playerNeed, equipmentSupport),
    explanation
  };
}

export function scoreSupportAdequacy(playerNeed: number, equipmentSupport: number): number {
  const need = clampScore(playerNeed);
  const support = clampScore(equipmentSupport);
  if (support < need) return clampScore(100 - (need - support) * confidenceCompatibilityPolicy.alignment.supportBelowNeedPenaltyMultiplier);
  const excessPenalty = Math.min(
    confidenceCompatibilityPolicy.alignment.supportAboveNeedMaximumPenalty,
    (support - need) * confidenceCompatibilityPolicy.alignment.supportAboveNeedPenaltyMultiplier
  );
  return clampScore(100 - excessPenalty);
}

function statusFor(playerNeed: number, equipmentSupport: number) {
  if (equipmentSupport + confidenceCompatibilityPolicy.alignment.supportMetTolerance < playerNeed) return "support_below_need";
  if (equipmentSupport - playerNeed >= confidenceCompatibilityPolicy.reasonThresholds.tradeoffExcessMinimum) return "support_exceeds_need";
  return "support_met";
}

function buildReasons(
  dimensions: readonly ConfidenceCompatibilityDimensionResult[],
  missing: readonly ConfidenceCompatibilityMissingInput[]
): ConfidenceCompatibilityReason[] {
  const reasons: ConfidenceCompatibilityReason[] = [];
  for (const dimensionResult of dimensions) {
    if (dimensionResult.status === "missing_input") continue;
    if ((dimensionResult.score ?? 0) >= confidenceCompatibilityPolicy.reasonThresholds.supportiveMinimum) {
      reasons.push(supportiveReason(dimensionResult.dimension));
    } else if (dimensionResult.status === "support_below_need") {
      reasons.push({
        code: "EQUIPMENT_SUPPORT_BELOW_CURRENT_NEED",
        dimension: dimensionResult.dimension,
        message: "Equipment support is below the player's current development-support need for this dimension."
      });
    } else if (dimensionResult.status === "support_exceeds_need") {
      reasons.push({
        code: "EQUIPMENT_SUPPORT_EXCEEDS_CURRENT_NEED",
        dimension: dimensionResult.dimension,
        message: "Equipment support exceeds the current need; this may be acceptable but should be reviewed in context."
      });
    }
  }
  if (missing.some((item) => item.sourceArea === "player_dna" && item.required)) {
    reasons.push({ code: "PLAYER_INPUT_INCOMPLETE", message: "Required Player DNA inputs are incomplete." });
  }
  if (missing.some((item) => item.sourceArea === "equipment_dna" && item.required)) {
    reasons.push({ code: "EQUIPMENT_INPUT_INCOMPLETE", message: "Required Equipment DNA inputs are incomplete." });
  }
  if (missing.some((item) => item.sourceArea === "current_equipment")) {
    reasons.push({ code: "CURRENT_EQUIPMENT_CONTEXT_MISSING", message: "Current equipment familiarity is not available, limiting confidence in this shadow result." });
  }
  reasons.push({ code: "MODEL_CONFIDENCE_LIMITED", message: "Confidence Compatibility v1.0 is shadow-only and requires more validation before ranking use." });
  return dedupeReasons(reasons);
}

function supportiveReason(dimension: ConfidenceCompatibilityDimension): ConfidenceCompatibilityReason {
  const map = {
    predictability_alignment: ["PREDICTABLE_RESPONSE_SUPPORTS_CURRENT_NEEDS", "Predictable response aligns with current consistency and development-support needs."],
    forgiveness_alignment: ["FORGIVENESS_SUPPORTS_CURRENT_NEEDS", "Forgiveness support aligns with current contact-outcome support needs."],
    manageable_effort_alignment: ["MANAGEABLE_EFFORT_SUPPORTS_CURRENT_NEEDS", "Manageable swing effort aligns with current development-support needs."],
    bat_control_alignment: ["BAT_CONTROL_SUPPORTS_CURRENT_NEEDS", "Bat-control support aligns with the player's current development needs."],
    contact_support_alignment: ["SWEET_SPOT_SUPPORTS_CURRENT_NEEDS", "Sweet-spot support aligns with current contact-consistency needs."]
  } as const;
  const [code, message] = map[dimension];
  return { code, dimension, message };
}

function buildTradeoffs(stage: string | undefined, dimensions: readonly ConfidenceCompatibilityDimensionResult[]): ConfidenceCompatibilityTradeoff[] {
  const tradeoffs: ConfidenceCompatibilityTradeoff[] = [];
  for (const dimensionResult of dimensions) {
    if (dimensionResult.status === "support_below_need") {
      tradeoffs.push({
        code: "LOWER_SUPPORT_MAY_CHALLENGE_CURRENT_CONSISTENCY",
        dimension: dimensionResult.dimension,
        message: "Lower support may ask more of the player's current consistency."
      });
    }
    if (dimensionResult.dimension === "manageable_effort_alignment" && dimensionResult.status === "support_below_need") {
      tradeoffs.push({
        code: "MORE_DEMANDING_SWING_MAY_REQUIRE_ADJUSTMENT",
        dimension: dimensionResult.dimension,
        message: "More demanding swing behavior may require adjustment."
      });
    }
    if (dimensionResult.dimension === "predictability_alignment" && dimensionResult.status === "support_exceeds_need") {
      tradeoffs.push({
        code: "PREDICTABILITY_MAY_REDUCE_DIRECT_FEEDBACK",
        dimension: dimensionResult.dimension,
        message: "Very predictable response may provide less direct feedback in some development contexts."
      });
    }
    if (dimensionResult.dimension === "forgiveness_alignment" && dimensionResult.status === "support_exceeds_need") {
      tradeoffs.push({
        code: "HIGH_FORGIVENESS_MAY_MASK_FEEDBACK",
        dimension: dimensionResult.dimension,
        message: "High forgiveness may soften some feedback about contact quality."
      });
    }
  }
  if (stage === "advanced" && dimensions.some((dimensionResult) => dimensionResult.status === "support_exceeds_need")) {
    tradeoffs.push({
      code: "ADVANCED_PLAYER_MAY_PREFER_MORE_DIRECT_RESPONSE",
      message: "Advanced players may prefer a more direct equipment response in some development contexts."
    });
  }
  return dedupeTradeoffs(tradeoffs);
}

function buildMissingInformation(
  player: ReturnType<typeof normalizePlayerConfidenceSupportNeeds>,
  equipment: ReturnType<typeof normalizeEquipmentConfidenceSupport>
): ConfidenceCompatibilityMissingInput[] {
  const missing: ConfidenceCompatibilityMissingInput[] = [];
  for (const key of confidenceCompatibilityRequiredPlayerInputs) {
    if (player[key] === undefined) {
      missing.push({
        sourceArea: "player_dna",
        key,
        required: true,
        effect: "Blocks completed confidence compatibility scoring.",
        recommendedNextAction: "Regenerate Player DNA with complete BatMatch and player profile inputs."
      });
    }
  }
  for (const key of confidenceCompatibilityRequiredEquipmentInputs) {
    if (equipment[key] === undefined) {
      missing.push({
        sourceArea: "equipment_dna",
        key,
        required: true,
        effect: "Blocks completed confidence compatibility scoring.",
        recommendedNextAction: "Create active canonical Equipment DNA evaluations and numeric references."
      });
    }
  }
  if (player.currentEquipmentFamiliarity === undefined) {
    missing.push({
      sourceArea: "current_equipment",
      key: "currentEquipmentFamiliarity",
      required: false,
      effect: "Lowers confidence because current bat familiarity is unavailable.",
      recommendedNextAction: "Capture how long and how comfortably the player has used the current bat."
    });
  }
  return dedupeMissing(missing);
}

function assessConfidence(
  input: ConfidenceCompatibilityInput,
  missing: readonly ConfidenceCompatibilityMissingInput[],
  missingRequiredPlayer: boolean,
  missingRequiredEquipment: boolean
) {
  if (missingRequiredPlayer || missingRequiredEquipment) return "estimated";
  if (missing.some((item) => item.sourceArea === "current_equipment")) return "moderate";
  if (input.playerDNA.confidence.level === "high" && input.canonicalEquipmentProfile.attributes.every((attribute) => attribute.confidence === "high" || attribute.confidence === "validated")) {
    return "high";
  }
  return "moderate";
}

function confidenceFactors(input: ConfidenceCompatibilityInput, missing: readonly ConfidenceCompatibilityMissingInput[]): string[] {
  return [
    `Player DNA confidence: ${input.playerDNA.confidence.level}`,
    `Equipment profile readiness: ${input.canonicalEquipmentProfile.readiness.ready ? "ready" : "not ready"}`,
    `Missing inputs: ${missing.length}`,
    "Validated confidence disabled for v1.0"
  ];
}

function failedResult(
  input: ConfidenceCompatibilityInput,
  playerProfile: ReturnType<typeof normalizePlayerConfidenceSupportNeeds>,
  equipmentProfile: ReturnType<typeof normalizeEquipmentConfidenceSupport>,
  missingInformation: readonly ConfidenceCompatibilityMissingInput[],
  evaluatedAt: Date,
  message: string
): ConfidenceCompatibilityResult {
  return {
    ...baseResult(input, playerProfile, equipmentProfile, missingInformation, evaluatedAt),
    status: "failed",
    confidence: "estimated",
    reasons: [{ code: "MODEL_CONFIDENCE_LIMITED", message }]
  };
}

function blockedResult(
  input: ConfidenceCompatibilityInput,
  playerProfile: ReturnType<typeof normalizePlayerConfidenceSupportNeeds>,
  equipmentProfile: ReturnType<typeof normalizeEquipmentConfidenceSupport>,
  missingInformation: readonly ConfidenceCompatibilityMissingInput[],
  evaluatedAt: Date,
  status: "blocked_unsupported_version"
): ConfidenceCompatibilityResult {
  return {
    ...baseResult(input, playerProfile, equipmentProfile, missingInformation, evaluatedAt),
    status,
    confidence: "estimated",
    reasons: [{ code: "MODEL_CONFIDENCE_LIMITED", message: "Unsupported version blocks Confidence Compatibility v1.0." }]
  };
}

function baseResult(
  input: ConfidenceCompatibilityInput,
  playerProfile: ReturnType<typeof normalizePlayerConfidenceSupportNeeds>,
  equipmentProfile: ReturnType<typeof normalizeEquipmentConfidenceSupport>,
  missingInformation: readonly ConfidenceCompatibilityMissingInput[],
  evaluatedAt: Date
): ConfidenceCompatibilityResult {
  return {
    version: "1.0",
    modelVersion: CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
    policyVersion: CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
    reasonVersion: CONFIDENCE_COMPATIBILITY_REASON_VERSION,
    recommendationUsePolicy: confidenceCompatibilityPolicy.recommendationUsePolicy,
    playerId: input.playerDNA.playerId,
    equipmentId: input.canonicalEquipmentProfile.equipmentId,
    equipmentVariantId: input.canonicalEquipmentProfile.equipmentVariantId,
    dimensions: [],
    confidence: "estimated",
    reasons: [],
    tradeoffs: [],
    missingInformation,
    playerProfile,
    equipmentProfile,
    trace: {
      playerInputs: {},
      equipmentInputs: {},
      transformations: [],
      directionInversions: [],
      weights: confidenceCompatibilityDimensionWeights,
      dimensionScores: [],
      completeness: {
        requiredPlayerInputsPresent: 0,
        requiredPlayerInputsTotal: confidenceCompatibilityRequiredPlayerInputs.length,
        requiredEquipmentInputsPresent: 0,
        requiredEquipmentInputsTotal: confidenceCompatibilityRequiredEquipmentInputs.length
      },
      confidenceFactors: [],
      versions: {
        model: CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
        policy: CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
        reasons: CONFIDENCE_COMPATIBILITY_REASON_VERSION,
        playerDNA: input.playerDNA.version,
        equipmentDNAProfile: input.canonicalEquipmentProfile.version,
        predictabilitySupport: `${PREDICTABILITY_SUPPORT_EVALUATION_VERSION}/${PREDICTABILITY_SUPPORT_COMPOSITE_VERSION}`
      },
      reasonThresholds: confidenceCompatibilityPolicy.reasonThresholds,
      missingInputs: missingInformation
    },
    status: "failed",
    evaluatedAt
  };
}

function versionMissingInput(key: string, version: string): ConfidenceCompatibilityMissingInput {
  return {
    sourceArea: "version",
    key,
    required: true,
    effect: `Unsupported version ${version} blocks v1.0 evaluation.`,
    recommendedNextAction: "Use supported v1.0-compatible Player DNA and Equipment DNA profiles."
  };
}

function dedupeReasons(reasons: readonly ConfidenceCompatibilityReason[]): ConfidenceCompatibilityReason[] {
  return [...new Map(reasons.map((reason) => [`${reason.code}:${reason.dimension ?? ""}`, reason])).values()];
}

function dedupeTradeoffs(tradeoffs: readonly ConfidenceCompatibilityTradeoff[]): ConfidenceCompatibilityTradeoff[] {
  return [...new Map(tradeoffs.map((tradeoff) => [`${tradeoff.code}:${tradeoff.dimension ?? ""}`, tradeoff])).values()];
}

function dedupeMissing(missing: readonly ConfidenceCompatibilityMissingInput[]): ConfidenceCompatibilityMissingInput[] {
  return [...new Map(missing.map((item) => [`${item.sourceArea}:${item.key}`, item])).values()];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, round(value)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
