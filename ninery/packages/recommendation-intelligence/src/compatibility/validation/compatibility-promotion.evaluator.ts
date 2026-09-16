import type { CanonicalEquipmentDNAProfile, EquipmentDNAAttributeKey } from "@ninery/equipment-intelligence";
import {
  CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
  CONFIDENCE_COMPATIBILITY_POLICY_VERSION,
  evaluateConfidenceCompatibility,
  type ConfidenceCompatibilityResult
} from "../confidence/index.js";
import {
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_POLICY_VERSION,
  evaluateTransitionCompatibility,
  type TransitionCompatibilityResult
} from "../transition/index.js";
import { analyzeCompatibilityDoubleCounting } from "./compatibility-double-counting.analysis.js";
import { validateCompatibilityLanguageSafety } from "./compatibility-language.validation.js";
import {
  buildCompatibilitySyntheticMatrix,
  buildCompatibilitySyntheticPlayerProfiles,
  perturbCanonicalProfile,
  perturbPlayerDNA
} from "./compatibility-player-matrix.js";
import {
  compatibilityPromotionPolicies,
  scoreSeparationLabel
} from "./compatibility-validation.policy.js";
import {
  COMPATIBILITY_PROMOTION_DECISION_VERSION,
  COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
  COMPATIBILITY_VALIDATION_MODEL_VERSION,
  COMPATIBILITY_VALIDATION_POLICY_VERSION,
  type CompatibilityConfidenceCalibrationAnalysis,
  type CompatibilityEquipmentDifferentiationAnalysis,
  type CompatibilityLegacyValidationAnalysis,
  type CompatibilityMissingInputAnalysis,
  type CompatibilityModelName,
  type CompatibilityModelValidationResult,
  type CompatibilityMonotonicityAnalysis,
  type CompatibilityPlayerDifferentiationAnalysis,
  type CompatibilityPromotionCriterionResult,
  type CompatibilityPromotionDecision,
  type CompatibilityPromotionOutcome,
  type CompatibilityScoreSeparationAnalysis,
  type CompatibilitySensitivityAnalysis,
  type CompatibilityStabilityAnalysis,
  type CompatibilitySyntheticMatrixEvaluation,
  type CompatibilitySyntheticMatrixResult,
  type CompatibilityValidationFinding,
  type CompatibilityValidationInput,
  type CompatibilityValidationSuiteResult
} from "./compatibility-validation.types.js";

type CompatibilityResult = ConfidenceCompatibilityResult | TransitionCompatibilityResult;

export function validateCompatibilityModels(input: CompatibilityValidationInput): CompatibilityValidationSuiteResult {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const matrix = buildCompatibilitySyntheticMatrix({ ...input, evaluatedAt });
  const confidence = validateCompatibilityModel("confidence_compatibility", matrix, input, evaluatedAt);
  const transition = validateCompatibilityModel("transition_compatibility", matrix, input, evaluatedAt);
  return {
    version: "1.0",
    validationVersion: COMPATIBILITY_VALIDATION_MODEL_VERSION,
    syntheticMatrixVersion: COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
    results: [confidence, transition],
    liveRecommendationUseAllowed: false,
    evaluatedAt
  };
}

export function validateCompatibilityModel(
  model: CompatibilityModelName,
  matrix: CompatibilitySyntheticMatrixResult,
  input: CompatibilityValidationInput,
  evaluatedAt: Date
): CompatibilityModelValidationResult {
  const modelResults = resultsFor(model, matrix.evaluations);
  const scoreSeparation = analyzeScoreSeparation(model, matrix);
  const playerDifferentiation = analyzePlayerDifferentiation(model, matrix);
  const equipmentDifferentiation = analyzeEquipmentDifferentiation(model, matrix);
  const stability = analyzeStability(model, input, evaluatedAt);
  const sensitivity = analyzeSensitivity(model, input, evaluatedAt);
  const monotonicity = analyzeMonotonicity(model, sensitivity);
  const missingInputBehavior = analyzeMissingInputBehavior(model, input, evaluatedAt);
  const confidenceCalibration = analyzeConfidenceCalibration(modelResults, missingInputBehavior);
  const legacyComparison = analyzeLegacyComparison(model, matrix);
  const explanationQuality = analyzeExplanationQuality(modelResults);
  const languageSafety = validateCompatibilityLanguageSafety({ model, results: modelResults });
  const doubleCounting = analyzeCompatibilityDoubleCounting(model);
  const findings = buildFindings({
    model,
    matrix,
    scoreSeparation,
    playerDifferentiation,
    equipmentDifferentiation,
    stability,
    sensitivity,
    monotonicity,
    missingInputBehavior,
    confidenceCalibration,
    legacyComparison,
    explanationQuality,
    languageSafety,
    doubleCounting
  });
  const promotionDecision = evaluatePromotionDecision(model, findings, {
    scoreSeparation,
    playerDifferentiation,
    equipmentDifferentiation,
    stability,
    sensitivity,
    monotonicity,
    missingInputBehavior,
    confidenceCalibration,
    explanationQuality,
    languageSafety,
    doubleCounting,
    completedEvaluations: modelResults.filter((result) => result.status === "completed").length
  }, evaluatedAt);
  const warnings = findings.filter((finding) => finding.severity === "warning");
  return {
    version: "1.0",
    validationVersion: COMPATIBILITY_VALIDATION_MODEL_VERSION,
    validationPolicyVersion: COMPATIBILITY_VALIDATION_POLICY_VERSION,
    syntheticMatrixVersion: COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
    promotionDecisionVersion: COMPATIBILITY_PROMOTION_DECISION_VERSION,
    model,
    modelVersion: model === "confidence_compatibility" ? CONFIDENCE_COMPATIBILITY_MODEL_VERSION : TRANSITION_COMPATIBILITY_MODEL_VERSION,
    policyVersion: model === "confidence_compatibility" ? CONFIDENCE_COMPATIBILITY_POLICY_VERSION : TRANSITION_COMPATIBILITY_POLICY_VERSION,
    playerDNAVersion: input.basePlayerDNA.version,
    equipmentDNAVersion: input.canonicalProfiles[0]?.version ?? "missing",
    syntheticMatrix: matrix,
    scoreSeparation,
    playerDifferentiation,
    equipmentDifferentiation,
    stability,
    sensitivity,
    monotonicity,
    missingInputBehavior,
    confidenceCalibration,
    legacyComparison,
    explanationQuality,
    languageSafety,
    doubleCounting,
    promotionDecision,
    findings,
    warnings,
    nextActions: promotionDecision.nextActions,
    liveRecommendationUseAllowed: false,
    evaluatedAt
  };
}

function analyzeScoreSeparation(model: CompatibilityModelName, matrix: CompatibilitySyntheticMatrixResult): CompatibilityScoreSeparationAnalysis {
  const profileIds = matrix.playerProfiles.map((profile) => profile.profileId);
  const perPlayer = profileIds.map((profileId) => {
    const scores = scoresFor(model, matrix.evaluations.filter((evaluation) => evaluation.profileId === profileId));
    const minimumScore = min(scores);
    const maximumScore = max(scores);
    const range = minimumScore === undefined || maximumScore === undefined ? undefined : round(maximumScore - minimumScore);
    return {
      profileId,
      minimumScore,
      maximumScore,
      range,
      standardSpread: standardSpread(scores),
      lowSeparation: range === undefined || range <= 5
    };
  });
  const allScores = scoresFor(model, matrix.evaluations);
  const ranges = perPlayer.map((item) => item.range).filter((range): range is number => range !== undefined);
  const averagePerPlayerRange = average(ranges);
  const sufficient = (averagePerPlayerRange ?? 0) >= compatibilityPromotionPolicies[model].minimumAverageScoreSeparation
    || perPlayer.filter((item) => scoreSeparationLabel(item.range) === "useful" || scoreSeparationLabel(item.range) === "strong").length >= 2;
  return {
    overallMinimumScore: min(allScores),
    overallMaximumScore: max(allScores),
    overallRange: difference(min(allScores), max(allScores)),
    perPlayer,
    averagePerPlayerRange,
    minimumPerPlayerRange: min(ranges),
    maximumPerPlayerRange: max(ranges),
    sufficient,
    explanation: [
      `Average per-player range is ${averagePerPlayerRange ?? "missing"} points.`,
      sufficient ? "Score separation is sufficient for continued validation." : "Score separation is low across the synthetic matrix."
    ]
  };
}

function analyzePlayerDifferentiation(model: CompatibilityModelName, matrix: CompatibilitySyntheticMatrixResult): CompatibilityPlayerDifferentiationAnalysis {
  const perEquipment = matrix.equipment.map((equipment) => {
    const evaluations = matrix.evaluations.filter((evaluation) => evaluation.equipmentId === equipment.equipmentId);
    const scoresByPlayer = evaluations.map((evaluation) => {
      const result = resultFor(model, evaluation);
      return { profileId: evaluation.profileId, score: result?.score, confidence: result?.confidence };
    });
    const scores = scoresByPlayer.map((item) => item.score).filter((score): score is number => score !== undefined);
    return {
      equipmentId: equipment.equipmentId,
      scoresByPlayer,
      scoreRange: difference(min(scores), max(scores)),
      orderingChangesAcrossPlayers: uniqueCount(scores.map((score) => Math.round(score / 5) * 5)) > 1,
      reasonChangesAcrossPlayers: uniqueResultTextCount(model, evaluations, "reason") > 1,
      tradeoffChangesAcrossPlayers: uniqueResultTextCount(model, evaluations, "tradeoff") > 1
    };
  });
  const rankingOrderVariesAcrossPlayers = uniqueCount(matrix.playerProfiles.map((profile) => orderingFor(model, matrix.evaluations.filter((evaluation) => evaluation.profileId === profile.profileId)).join(">"))) > 1;
  const reasonSetsVaryAcrossPlayers = perEquipment.some((item) => item.reasonChangesAcrossPlayers);
  const sufficient = perEquipment.some((item) => (item.scoreRange ?? 0) > 5) && reasonSetsVaryAcrossPlayers;
  return {
    perEquipment,
    rankingOrderVariesAcrossPlayers,
    reasonSetsVaryAcrossPlayers,
    sufficient,
    explanation: [
      sufficient ? "Player profiles produce materially different scores or explanations." : "Player profiles do not yet produce enough differentiation.",
      rankingOrderVariesAcrossPlayers ? "Ranking order varies across synthetic players." : "Ranking order is stable across synthetic players."
    ]
  };
}

function analyzeEquipmentDifferentiation(model: CompatibilityModelName, matrix: CompatibilitySyntheticMatrixResult): CompatibilityEquipmentDifferentiationAnalysis {
  const perPlayer = matrix.playerProfiles.map((profile) => {
    const evaluations = matrix.evaluations.filter((evaluation) => evaluation.profileId === profile.profileId);
    const scores = scoresFor(model, evaluations);
    const bands = evaluations.map((evaluation) => resultFor(model, evaluation)?.band).filter(Boolean);
    return {
      profileId: profile.profileId,
      scoreRange: difference(min(scores), max(scores)),
      bandCount: uniqueCount(bands),
      reasonSetsDiffer: uniqueResultTextCount(model, evaluations, "reason") > 1,
      tradeoffSetsDiffer: uniqueResultTextCount(model, evaluations, "tradeoff") > 1,
      ordering: orderingFor(model, evaluations),
      sufficient: (difference(min(scores), max(scores)) ?? 0) > 2 || uniqueResultTextCount(model, evaluations, "reason") > 1
    };
  });
  const sufficient = perPlayer.filter((item) => item.sufficient).length >= Math.ceil(perPlayer.length / 2);
  return {
    perPlayer,
    sufficient,
    explanation: [
      sufficient ? "Equipment differences affect scores or explanations for most synthetic players." : "Equipment differentiation is limited.",
      "Same-band results are allowed when score and explanation differences remain visible."
    ]
  };
}

function analyzeStability(model: CompatibilityModelName, input: CompatibilityValidationInput, evaluatedAt: Date): CompatibilityStabilityAnalysis {
  const players = buildCompatibilitySyntheticPlayerProfiles(input.basePlayerDNA);
  const player = players[1]?.playerDNA ?? input.basePlayerDNA;
  const current = input.currentEquipmentProfile;
  const proposed = input.canonicalProfiles[1] ?? input.currentEquipmentProfile;
  const scenarios = model === "confidence_compatibility"
    ? [
        stabilityScenario(model, "minor-player-bat-control", "player.scores.batControl", player.scores.batControl, player.scores.batControl + 2, () => confidenceScore(player, proposed, evaluatedAt), () => confidenceScore(perturbPlayerDNA(player, { scoreChanges: { batControl: player.scores.batControl + 2 } }), proposed, evaluatedAt)),
        stabilityScenario(model, "minor-equipment-forgiveness", "equipment.forgiveness", 80, 82, () => confidenceScore(player, proposed, evaluatedAt), () => confidenceScore(player, perturbCanonicalProfile(proposed, { forgiveness: 82 }), evaluatedAt))
      ]
    : [
        stabilityScenario(model, "minor-player-readiness", "player.scores.transitionReadiness", player.scores.transitionReadiness, player.scores.transitionReadiness + 2, () => transitionScore(player, current, proposed, evaluatedAt), () => transitionScore(perturbPlayerDNA(player, { scoreChanges: { transitionReadiness: player.scores.transitionReadiness + 2 } }), current, proposed, evaluatedAt)),
        stabilityScenario(model, "minor-swing-effort-change", "equipment.swing_effort", numberAttribute(proposed, "swing_effort") ?? 50, (numberAttribute(proposed, "swing_effort") ?? 50) + 2, () => transitionScore(player, current, proposed, evaluatedAt), () => transitionScore(player, current, perturbCanonicalProfile(proposed, { swing_effort: (numberAttribute(proposed, "swing_effort") ?? 50) + 2 }), evaluatedAt))
      ];
  const maximumMinorPerturbationDelta = max(scenarios.map((scenario) => scenario.scoreDelta).filter((delta): delta is number => delta !== undefined));
  const excessiveBandFlips = scenarios.filter((scenario) => scenario.bandChanged).length;
  const excessiveRankingFlips = scenarios.filter((scenario) => scenario.rankingChanged).length;
  const policy = compatibilityPromotionPolicies[model];
  const stable = (maximumMinorPerturbationDelta ?? 0) <= policy.maximumMinorPerturbationScoreDelta && excessiveBandFlips <= policy.maximumMinorPerturbationBandFlips;
  return {
    perturbations: scenarios,
    maximumMinorPerturbationDelta,
    excessiveBandFlips,
    excessiveRankingFlips,
    stable,
    explanation: [
      stable ? "Minor perturbations stay within policy thresholds." : "Minor perturbations cause excessive movement.",
      `Maximum minor score delta: ${maximumMinorPerturbationDelta ?? "missing"}.`
    ]
  };
}

function analyzeSensitivity(model: CompatibilityModelName, input: CompatibilityValidationInput, evaluatedAt: Date): CompatibilitySensitivityAnalysis {
  const players = buildCompatibilitySyntheticPlayerProfiles(input.basePlayerDNA);
  const developing = players[0]?.playerDNA ?? input.basePlayerDNA;
  const ready = players[2]?.playerDNA ?? input.basePlayerDNA;
  const current = input.currentEquipmentProfile;
  const proposed = input.canonicalProfiles[1] ?? current;
  const scenarios = model === "confidence_compatibility"
    ? (() => {
        const lowerSupportProfile = perturbCanonicalProfile(proposed, { forgiveness: 45 });
        return [
          sensitivityScenario("higher-support-need", "player.scores.batControl -20", "not_increase", confidenceScore(developing, proposed, evaluatedAt), confidenceScore(perturbPlayerDNA(developing, { scoreChanges: { batControl: Math.max(0, developing.scores.batControl - 20) } }), proposed, evaluatedAt)),
          sensitivityScenario("higher-equipment-support", "equipment.forgiveness 45 to 65", "not_decrease", confidenceScore(developing, lowerSupportProfile, evaluatedAt), confidenceScore(developing, perturbCanonicalProfile(lowerSupportProfile, { forgiveness: 65 }), evaluatedAt)),
          sensitivityScenario("lower-equipment-support", "equipment.predictability_support -20", "not_increase", confidenceScore(developing, proposed, evaluatedAt), confidenceScore(developing, perturbCanonicalProfile(proposed, { predictability_support: clamp((numberAttribute(proposed, "predictability_support") ?? 70) - 20) }), evaluatedAt))
        ];
      })()
    : [
        sensitivityScenario("increased-mass-change", "proposed.weight +2", "not_increase", transitionScore(ready, current, proposed, evaluatedAt), transitionScore(ready, current, perturbCanonicalProfile(proposed, { weight: (scalarNumber(proposed, "weight") ?? 22) + 2 }), evaluatedAt)),
        sensitivityScenario("increased-effort-change", "proposed.swing_effort +20", "not_increase", transitionScore(ready, current, proposed, evaluatedAt), transitionScore(ready, current, perturbCanonicalProfile(proposed, { swing_effort: clamp((numberAttribute(proposed, "swing_effort") ?? 50) + 20) }), evaluatedAt)),
        sensitivityScenario("increased-readiness", "player.scores.transitionReadiness +20", "not_decrease", transitionScore(developing, current, proposed, evaluatedAt), transitionScore(perturbPlayerDNA(developing, { scoreChanges: { transitionReadiness: clamp(developing.scores.transitionReadiness + 20), batControl: clamp(developing.scores.batControl + 20), physicalStrength: clamp(developing.scores.physicalStrength + 20) } }), current, proposed, evaluatedAt))
      ];
  const sensitive = scenarios.every((scenario) => scenario.passed) && scenarios.some((scenario) => Math.abs(scenario.scoreDelta ?? 0) >= 2);
  return {
    scenarios,
    sensitive,
    explanation: [
      sensitive ? "Meaningful input changes move scores in the expected direction." : "One or more meaningful input changes underreacted or moved in the wrong direction."
    ]
  };
}

function analyzeMonotonicity(model: CompatibilityModelName, sensitivity: CompatibilitySensitivityAnalysis): CompatibilityMonotonicityAnalysis {
  const checks = sensitivity.scenarios.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    expectation: `${scenario.changedInput} should ${scenario.expectedDirection.replace("_", " ")} score.`,
    baselineScore: scenario.originalScore,
    changedScore: scenario.changedScore,
    passed: scenario.passed
  }));
  const passed = checks.every((check) => check.passed);
  return {
    checks,
    passed,
    explanation: [passed ? `${model} monotonicity checks passed.` : `${model} has a directional inconsistency.`]
  };
}

function analyzeMissingInputBehavior(model: CompatibilityModelName, input: CompatibilityValidationInput, evaluatedAt: Date): CompatibilityMissingInputAnalysis {
  const player = buildCompatibilitySyntheticPlayerProfiles(input.basePlayerDNA)[0]?.playerDNA ?? input.basePlayerDNA;
  const proposed = input.canonicalProfiles[0] ?? input.currentEquipmentProfile;
  const scenarios = model === "confidence_compatibility"
    ? [
        missingScenario("missing-equipment-predictability", "predictability_support", evaluateConfidenceCompatibility({ playerDNA: player, canonicalEquipmentProfile: removeAttribute(proposed, "predictability_support"), evaluatedAt })),
        missingScenario("missing-player-contact", "player.scores.contactConsistency", evaluateConfidenceCompatibility({ playerDNA: perturbPlayerDNA(player, { scoreChanges: { contactConsistency: undefined as unknown as number } }), canonicalEquipmentProfile: proposed, evaluatedAt }))
      ]
    : [
        missingScenario("missing-current-equipment", "currentEquipmentProfile", evaluateTransitionCompatibility({ playerDNA: player, proposedEquipmentProfile: proposed, evaluatedAt })),
        missingScenario("missing-current-weight", "current.weight", evaluateTransitionCompatibility({ playerDNA: player, currentEquipmentProfile: removeAttribute(input.currentEquipmentProfile, "weight"), proposedEquipmentProfile: proposed, evaluatedAt }))
      ];
  const safe = scenarios.every((scenario) => scenario.passed);
  return {
    scenarios,
    safe,
    explanation: [safe ? "Missing inputs block or reduce confidence and are reported." : "Missing-input handling failed for at least one scenario."]
  };
}

function analyzeConfidenceCalibration(results: readonly CompatibilityResult[], missing: CompatibilityMissingInputAnalysis): CompatibilityConfidenceCalibrationAnalysis {
  const complete = results.filter((result) => result.status === "completed");
  const highConfidenceCount = complete.filter((result) => result.confidence === "high").length;
  const moderateConfidenceCount = complete.filter((result) => result.confidence === "moderate").length;
  const estimatedConfidenceCount = results.filter((result) => result.confidence === "estimated").length;
  const validatedConfidenceCount = 0;
  const incompleteResultsReduceConfidence = missing.scenarios.every((scenario) => scenario.confidence === "estimated" || scenario.confidence === "moderate");
  const reasonable = validatedConfidenceCount === 0 && incompleteResultsReduceConfidence && moderateConfidenceCount >= highConfidenceCount;
  return {
    completeResultCount: complete.length,
    highConfidenceCount,
    moderateConfidenceCount,
    estimatedConfidenceCount,
    validatedConfidenceCount,
    incompleteResultsReduceConfidence,
    reasonable,
    explanation: [
      reasonable ? "Confidence remains appropriately limited for v1.0." : "Confidence calibration appears overstated or incomplete.",
      `Validated confidence count: ${validatedConfidenceCount}.`
    ]
  };
}

function analyzeLegacyComparison(model: CompatibilityModelName, matrix: CompatibilitySyntheticMatrixResult): CompatibilityLegacyValidationAnalysis {
  const comparisons = matrix.evaluations
    .map((evaluation) => model === "confidence_compatibility" ? evaluation.confidenceLegacyComparison : evaluation.transitionLegacyComparison)
    .filter((comparison): comparison is NonNullable<typeof comparison> => !!comparison);
  const materialDivergenceCount = comparisons.filter((comparison) => comparison.status === "material_difference").length;
  const unexplainedMaterialDivergenceCount = comparisons.filter((comparison) => comparison.status === "material_difference" && !/not equivalent|broader|shadow|concepts|product-level/i.test(comparison.explanation)).length;
  return {
    comparisons,
    materialDivergenceCount,
    unexplainedMaterialDivergenceCount,
    semanticDifferenceExplained: unexplainedMaterialDivergenceCount === 0,
    sufficient: unexplainedMaterialDivergenceCount === 0,
    explanation: [
      `Material legacy divergences: ${materialDivergenceCount}.`,
      "Legacy parity is not required because the canonical models are relational and shadow-only."
    ]
  };
}

function analyzeExplanationQuality(results: readonly CompatibilityResult[]): import("./compatibility-validation.types.js").CompatibilityExplanationQualityAnalysis {
  const evaluatedResultCount = results.length;
  let duplicateFindingCount = 0;
  let missingActionableCount = 0;
  let missingTotal = 0;
  let groundedCount = 0;
  let textCount = 0;
  const unsupportedClaims: string[] = [];
  for (const result of results) {
    const reasonKeys = result.reasons.map((reason) => `${reason.code}:${reason.dimension ?? ""}`);
    const tradeoffKeys = result.tradeoffs.map((tradeoff) => `${tradeoff.code}:${tradeoff.dimension ?? ""}`);
    duplicateFindingCount += reasonKeys.length - new Set(reasonKeys).size;
    duplicateFindingCount += tradeoffKeys.length - new Set(tradeoffKeys).size;
    for (const item of [...result.reasons, ...result.tradeoffs]) {
      textCount += 1;
      if (item.dimension || /missing|current|equipment|player|support|change|readiness|forgiveness|swing|balance|weight|length/i.test(item.message)) groundedCount += 1;
      if (/guarantee|will make|wrong bat|will struggle|fixes confidence/i.test(item.message)) unsupportedClaims.push(item.message);
    }
    for (const missing of result.missingInformation) {
      missingTotal += 1;
      if (missing.recommendedNextAction.trim().length > 0) missingActionableCount += 1;
    }
  }
  const inputGroundingRatio = textCount ? round(groundedCount / textCount) : 1;
  const missingInformationActionabilityRatio = missingTotal ? round(missingActionableCount / missingTotal) : 1;
  const sufficient = duplicateFindingCount === 0 && unsupportedClaims.length === 0 && inputGroundingRatio >= 0.8 && missingInformationActionabilityRatio >= 0.9;
  return {
    evaluatedResultCount,
    genericReasonCount: textCount - groundedCount,
    contradictoryFindingCount: 0,
    duplicateFindingCount,
    unsupportedClaimCount: unsupportedClaims.length,
    inputGroundingRatio,
    missingInformationActionabilityRatio,
    sufficient,
    findings: sufficient ? ["Reasons and tradeoffs are grounded and deterministic."] : ["Explanation quality needs review."]
  };
}

function evaluatePromotionDecision(
  model: CompatibilityModelName,
  findings: readonly CompatibilityValidationFinding[],
  analyses: {
    readonly scoreSeparation: CompatibilityScoreSeparationAnalysis;
    readonly playerDifferentiation: CompatibilityPlayerDifferentiationAnalysis;
    readonly equipmentDifferentiation: CompatibilityEquipmentDifferentiationAnalysis;
    readonly stability: CompatibilityStabilityAnalysis;
    readonly sensitivity: CompatibilitySensitivityAnalysis;
    readonly monotonicity: CompatibilityMonotonicityAnalysis;
    readonly missingInputBehavior: CompatibilityMissingInputAnalysis;
    readonly confidenceCalibration: CompatibilityConfidenceCalibrationAnalysis;
    readonly explanationQuality: import("./compatibility-validation.types.js").CompatibilityExplanationQualityAnalysis;
    readonly languageSafety: import("./compatibility-validation.types.js").CompatibilityLanguageSafetyAnalysis;
    readonly doubleCounting: import("./compatibility-validation.types.js").CompatibilityDoubleCountingAnalysis;
    readonly completedEvaluations: number;
  },
  evaluatedAt: Date
): CompatibilityPromotionDecision {
  const policy = compatibilityPromotionPolicies[model];
  const criteria: CompatibilityPromotionCriterionResult[] = [
    criterion("synthetic_matrix_completed", analyses.completedEvaluations >= policy.minimumCompletedSyntheticEvaluations, analyses.completedEvaluations >= policy.minimumCompletedSyntheticEvaluations ? "SYNTHETIC_MATRIX_COMPLETED" : "SYNTHETIC_MATRIX_INCOMPLETE", `${analyses.completedEvaluations} completed evaluations.`),
    criterion("score_separation", analyses.scoreSeparation.sufficient, analyses.scoreSeparation.sufficient ? "SCORE_SEPARATION_SUFFICIENT" : "SCORE_SEPARATION_LOW", analyses.scoreSeparation.explanation.join(" ")),
    criterion("player_differentiation", analyses.playerDifferentiation.sufficient, analyses.playerDifferentiation.sufficient ? "PLAYER_DIFFERENTIATION_SUFFICIENT" : "PLAYER_DIFFERENTIATION_INSUFFICIENT", analyses.playerDifferentiation.explanation.join(" ")),
    criterion("equipment_differentiation", analyses.equipmentDifferentiation.sufficient, analyses.equipmentDifferentiation.sufficient ? "EQUIPMENT_DIFFERENTIATION_SUFFICIENT" : "EQUIPMENT_DIFFERENTIATION_INSUFFICIENT", analyses.equipmentDifferentiation.explanation.join(" ")),
    criterion("stability", analyses.stability.stable, analyses.stability.stable ? "MINOR_INPUT_STABILITY_CONFIRMED" : "MINOR_INPUT_OVERREACTION", analyses.stability.explanation.join(" ")),
    criterion("sensitivity", analyses.sensitivity.sensitive, analyses.sensitivity.sensitive ? "MEANINGFUL_INPUT_SENSITIVITY_CONFIRMED" : "MEANINGFUL_INPUT_UNDERREACTION", analyses.sensitivity.explanation.join(" ")),
    criterion("monotonicity", analyses.monotonicity.passed, analyses.monotonicity.passed ? "MONOTONICITY_CONFIRMED" : "MONOTONICITY_VIOLATION", analyses.monotonicity.explanation.join(" ")),
    criterion("missing_input_behavior", analyses.missingInputBehavior.safe, analyses.missingInputBehavior.safe ? "MISSING_INPUT_CONFIDENCE_REDUCTION_CONFIRMED" : "MISSING_INPUT_HANDLING_INVALID", analyses.missingInputBehavior.explanation.join(" ")),
    criterion("confidence_calibration", analyses.confidenceCalibration.reasonable, analyses.confidenceCalibration.reasonable ? "CONFIDENCE_CALIBRATION_REASONABLE" : "CONFIDENCE_CALIBRATION_OVERSTATED", analyses.confidenceCalibration.explanation.join(" ")),
    criterion("reason_quality", analyses.explanationQuality.sufficient, analyses.explanationQuality.sufficient ? "REASON_QUALITY_SUFFICIENT" : "REASON_QUALITY_INSUFFICIENT", analyses.explanationQuality.findings.join(" ")),
    criterion("language_safety", analyses.languageSafety.safe, analyses.languageSafety.safe ? "LANGUAGE_SAFETY_CONFIRMED" : "LANGUAGE_SAFETY_VIOLATION", analyses.languageSafety.safe ? "Language scan passed." : analyses.languageSafety.prohibitedPhraseMatches.join(" ")),
    criterion("double_counting", analyses.doubleCounting.highestRisk !== "high", analyses.doubleCounting.highestRisk === "high" ? "DOUBLE_COUNTING_RISK_HIGH" : "DOUBLE_COUNTING_RISK_MODERATE", `Highest double-counting risk: ${analyses.doubleCounting.highestRisk}.`)
  ];
  const failedCriteria = criteria.filter((item) => !item.passed);
  const blockers = findings.filter((finding) => finding.severity === "blocker");
  const warnings = findings.filter((finding) => finding.severity === "warning");
  const outcome = primaryOutcome(model, failedCriteria, analyses);
  const nextActions = nextActionsFor(model, outcome, analyses);
  return {
    version: "1.0",
    model,
    outcome,
    eligibleForDiagnosticShadow: true,
    eligibleForExtendedShadow: outcome === "approved_for_extended_shadow" || outcome === "approved_for_internal_candidate",
    eligibleForInternalCandidate: outcome === "approved_for_internal_candidate",
    eligibleForExplanationOnly: outcome === "explanation_only_candidate" || outcome === "approved_for_extended_shadow" || outcome === "approved_for_internal_candidate",
    liveRankingUseAllowed: false,
    liveExplanationUseAllowed: false,
    blockers,
    warnings,
    passedCriteria: criteria.filter((item) => item.passed),
    failedCriteria,
    nextActions,
    evaluatedAt
  };
}

function primaryOutcome(
  model: CompatibilityModelName,
  failedCriteria: readonly CompatibilityPromotionCriterionResult[],
  analyses: {
    readonly scoreSeparation: CompatibilityScoreSeparationAnalysis;
    readonly doubleCounting: import("./compatibility-validation.types.js").CompatibilityDoubleCountingAnalysis;
    readonly completedEvaluations: number;
  }
): CompatibilityPromotionOutcome {
  const failedCodes = new Set(failedCriteria.map((item) => item.findingCode));
  if (failedCodes.has("LANGUAGE_SAFETY_VIOLATION")) return "blocked_language_safety";
  if (failedCodes.has("MONOTONICITY_VIOLATION") || failedCodes.has("DIRECTIONAL_BEHAVIOR_INCONSISTENT")) return "blocked_directional_inconsistency";
  if (failedCodes.has("MINOR_INPUT_OVERREACTION")) return "blocked_unstable_behavior";
  if (failedCodes.has("MISSING_INPUT_HANDLING_INVALID")) return "blocked_missing_player_context";
  if (failedCodes.has("CONFIDENCE_CALIBRATION_OVERSTATED")) return "blocked_confidence_miscalibration";
  if (failedCodes.has("REASON_QUALITY_INSUFFICIENT")) return "blocked_reason_quality";
  if (analyses.completedEvaluations < compatibilityPromotionPolicies[model].minimumCompletedSyntheticEvaluations) return "blocked_insufficient_validation";
  if (failedCodes.has("SCORE_SEPARATION_LOW") && (analyses.scoreSeparation.averagePerPlayerRange ?? 0) < 2) return "blocked_low_score_separation";
  if (analyses.doubleCounting.highestRisk === "high") return "explanation_only_candidate";
  if (failedCodes.has("SCORE_SEPARATION_LOW") || failedCodes.has("PLAYER_DIFFERENTIATION_INSUFFICIENT") || failedCodes.has("EQUIPMENT_DIFFERENTIATION_INSUFFICIENT")) return "approved_for_extended_shadow";
  return model === "transition_compatibility" ? "approved_for_extended_shadow" : "explanation_only_candidate";
}

function buildFindings(input: {
  readonly model: CompatibilityModelName;
  readonly matrix: CompatibilitySyntheticMatrixResult;
  readonly scoreSeparation: CompatibilityScoreSeparationAnalysis;
  readonly playerDifferentiation: CompatibilityPlayerDifferentiationAnalysis;
  readonly equipmentDifferentiation: CompatibilityEquipmentDifferentiationAnalysis;
  readonly stability: CompatibilityStabilityAnalysis;
  readonly sensitivity: CompatibilitySensitivityAnalysis;
  readonly monotonicity: CompatibilityMonotonicityAnalysis;
  readonly missingInputBehavior: CompatibilityMissingInputAnalysis;
  readonly confidenceCalibration: CompatibilityConfidenceCalibrationAnalysis;
  readonly legacyComparison: CompatibilityLegacyValidationAnalysis;
  readonly explanationQuality: import("./compatibility-validation.types.js").CompatibilityExplanationQualityAnalysis;
  readonly languageSafety: import("./compatibility-validation.types.js").CompatibilityLanguageSafetyAnalysis;
  readonly doubleCounting: import("./compatibility-validation.types.js").CompatibilityDoubleCountingAnalysis;
}): CompatibilityValidationFinding[] {
  const findings: CompatibilityValidationFinding[] = [];
  const add = (passed: boolean, passCode: CompatibilityValidationFinding["code"], failCode: CompatibilityValidationFinding["code"], message: string, blocker = false) => {
    findings.push({ model: input.model, code: passed ? passCode : failCode, severity: passed ? "pass" : blocker ? "blocker" : "warning", message });
  };
  add(input.matrix.completedEvaluationCount > 0, "MODEL_OUTPUT_VALID", "MODEL_OUTPUT_INVALID", `${input.model} produced model outputs.`, true);
  add(input.scoreSeparation.sufficient, "SCORE_SEPARATION_SUFFICIENT", "SCORE_SEPARATION_LOW", input.scoreSeparation.explanation.join(" "));
  add(input.playerDifferentiation.sufficient, "PLAYER_DIFFERENTIATION_SUFFICIENT", "PLAYER_DIFFERENTIATION_INSUFFICIENT", input.playerDifferentiation.explanation.join(" "));
  add(input.equipmentDifferentiation.sufficient, "EQUIPMENT_DIFFERENTIATION_SUFFICIENT", "EQUIPMENT_DIFFERENTIATION_INSUFFICIENT", input.equipmentDifferentiation.explanation.join(" "));
  add(input.stability.stable, "MINOR_INPUT_STABILITY_CONFIRMED", "MINOR_INPUT_OVERREACTION", input.stability.explanation.join(" "), true);
  add(input.sensitivity.sensitive, "MEANINGFUL_INPUT_SENSITIVITY_CONFIRMED", "MEANINGFUL_INPUT_UNDERREACTION", input.sensitivity.explanation.join(" "));
  add(input.monotonicity.passed, "MONOTONICITY_CONFIRMED", "MONOTONICITY_VIOLATION", input.monotonicity.explanation.join(" "), true);
  add(input.missingInputBehavior.safe, "MISSING_INPUT_CONFIDENCE_REDUCTION_CONFIRMED", "MISSING_INPUT_HANDLING_INVALID", input.missingInputBehavior.explanation.join(" "), true);
  add(input.confidenceCalibration.reasonable, "CONFIDENCE_CALIBRATION_REASONABLE", "CONFIDENCE_CALIBRATION_OVERSTATED", input.confidenceCalibration.explanation.join(" "), true);
  add(input.legacyComparison.sufficient, input.legacyComparison.materialDivergenceCount ? "LEGACY_DIVERGENCE_EXPLAINED" : "LEGACY_ALIGNMENT_OBSERVED", "LEGACY_DIVERGENCE_UNEXPLAINED", input.legacyComparison.explanation.join(" "));
  add(input.explanationQuality.sufficient, "REASON_QUALITY_SUFFICIENT", "REASON_QUALITY_INSUFFICIENT", input.explanationQuality.findings.join(" "), true);
  findings.push({ model: input.model, code: input.explanationQuality.sufficient ? "TRADEOFF_QUALITY_SUFFICIENT" : "TRADEOFF_QUALITY_INSUFFICIENT", severity: input.explanationQuality.sufficient ? "pass" : "blocker", message: "Tradeoff quality follows the same grounding and duplication checks as reasons." });
  add(input.languageSafety.safe, "LANGUAGE_SAFETY_CONFIRMED", "LANGUAGE_SAFETY_VIOLATION", input.languageSafety.safe ? "Language safety scan passed." : input.languageSafety.prohibitedPhraseMatches.join(" "), true);
  findings.push({
    model: input.model,
    code: input.doubleCounting.highestRisk === "high" ? "DOUBLE_COUNTING_RISK_HIGH" : input.doubleCounting.highestRisk === "moderate" ? "DOUBLE_COUNTING_RISK_MODERATE" : "DOUBLE_COUNTING_RISK_LOW",
    severity: input.doubleCounting.highestRisk === "high" ? "warning" : "pass",
    message: `Highest double-counting risk is ${input.doubleCounting.highestRisk}.`
  });
  findings.push({ model: input.model, code: "MORE_REAL_WORLD_VALIDATION_REQUIRED", severity: "warning", message: "Synthetic validation is not a substitute for real-world outcome validation." });
  return findings;
}

function nextActionsFor(
  model: CompatibilityModelName,
  outcome: CompatibilityPromotionOutcome,
  analyses: {
    readonly scoreSeparation: CompatibilityScoreSeparationAnalysis;
    readonly doubleCounting: import("./compatibility-validation.types.js").CompatibilityDoubleCountingAnalysis;
  }
): string[] {
  const actions = [
    "Collect current-equipment familiarity before increasing compatibility confidence.",
    "Run validation against a larger player and equipment scenario set.",
    "Add real-world outcome validation before any ranking use."
  ];
  if (model === "confidence_compatibility" && analyses.doubleCounting.highestRisk === "high") {
    actions.push("Resolve overlap with forgiveness, bat-control, sweet-spot, and development-goal dimensions before internal-candidate ranking experiments.");
  }
  if (model === "transition_compatibility") {
    actions.push("Validate transition compatibility as a replacement candidate for legacy transition readiness rather than an additive dimension.");
  }
  if (outcome === "blocked_low_score_separation" || (analyses.scoreSeparation.averagePerPlayerRange ?? 0) < 5) {
    actions.push("Review score compression and reason thresholds for similar equipment options.");
  }
  return [...new Set(actions)];
}

function resultsFor(model: CompatibilityModelName, evaluations: readonly CompatibilitySyntheticMatrixEvaluation[]): CompatibilityResult[] {
  return evaluations.map((evaluation) => resultFor(model, evaluation)).filter((result): result is CompatibilityResult => !!result);
}

function resultFor(model: CompatibilityModelName, evaluation: CompatibilitySyntheticMatrixEvaluation): CompatibilityResult | undefined {
  return model === "confidence_compatibility" ? evaluation.confidenceCompatibility : evaluation.transitionCompatibility;
}

function scoresFor(model: CompatibilityModelName, evaluations: readonly CompatibilitySyntheticMatrixEvaluation[]): number[] {
  return resultsFor(model, evaluations).map((result) => result.score).filter((score): score is number => score !== undefined);
}

function orderingFor(model: CompatibilityModelName, evaluations: readonly CompatibilitySyntheticMatrixEvaluation[]): string[] {
  return [...evaluations]
    .sort((a, b) => (resultFor(model, b)?.score ?? -1) - (resultFor(model, a)?.score ?? -1) || a.equipmentId.localeCompare(b.equipmentId))
    .map((evaluation) => evaluation.equipmentId);
}

function uniqueResultTextCount(model: CompatibilityModelName, evaluations: readonly CompatibilitySyntheticMatrixEvaluation[], type: "reason" | "tradeoff"): number {
  return uniqueCount(evaluations.map((evaluation) => {
    const result = resultFor(model, evaluation);
    const items = type === "reason" ? result?.reasons : result?.tradeoffs;
    return items?.map((item) => `${item.code}:${item.dimension ?? ""}`).sort().join("|") ?? "";
  }));
}

function confidenceScore(playerDNA: import("@ninery/player-intelligence").PlayerDNAProfileResult, profile: CanonicalEquipmentDNAProfile, evaluatedAt: Date) {
  return evaluateConfidenceCompatibility({ playerDNA, canonicalEquipmentProfile: profile, evaluatedAt });
}

function transitionScore(playerDNA: import("@ninery/player-intelligence").PlayerDNAProfileResult, current: CanonicalEquipmentDNAProfile, proposed: CanonicalEquipmentDNAProfile, evaluatedAt: Date) {
  return evaluateTransitionCompatibility({ playerDNA, currentEquipmentProfile: current, proposedEquipmentProfile: proposed, evaluatedAt });
}

function stabilityScenario(
  model: CompatibilityModelName,
  scenarioId: string,
  inputField: string,
  originalValue: number,
  perturbedValue: number,
  original: () => CompatibilityResult,
  perturbed: () => CompatibilityResult
) {
  const originalResult = original();
  const perturbedResult = perturbed();
  const scoreDelta = subtract(perturbedResult.score, originalResult.score);
  return {
    model,
    scenarioId,
    inputField,
    originalValue,
    perturbedValue,
    originalScore: originalResult.score,
    perturbedScore: perturbedResult.score,
    scoreDelta: scoreDelta === undefined ? undefined : Math.abs(scoreDelta),
    bandChanged: originalResult.band !== perturbedResult.band,
    rankingChanged: false,
    reasonSetChanged: signature(originalResult.reasons) !== signature(perturbedResult.reasons)
  };
}

function sensitivityScenario(
  scenarioId: string,
  changedInput: string,
  expectedDirection: "increase" | "decrease" | "not_increase" | "not_decrease",
  original: CompatibilityResult,
  changed: CompatibilityResult
) {
  const delta = subtract(changed.score, original.score);
  const passed = delta === undefined
    ? false
    : expectedDirection === "increase"
      ? delta > 0
      : expectedDirection === "decrease"
        ? delta < 0
        : expectedDirection === "not_increase"
          ? delta <= 0
          : delta >= 0;
  return {
    scenarioId,
    changedInput,
    originalScore: original.score,
    changedScore: changed.score,
    scoreDelta: delta,
    expectedDirection,
    passed
  };
}

function missingScenario(scenarioId: string, missingInput: string, result: CompatibilityResult) {
  const normalizedMissingInput = normalizeKey(missingInput.replace(/^.*\./, ""));
  const missingReported = result.missingInformation.some((item) => {
    const normalizedItemKey = normalizeKey(item.key);
    return item.key === missingInput
      || `${item.sourceArea}.${item.key}` === missingInput
      || missingInput.includes(item.key)
      || normalizedItemKey.includes(normalizedMissingInput)
      || normalizedMissingInput.includes(normalizedItemKey)
      || (missingInput === "currentEquipmentProfile" && item.sourceArea === "current_equipment" && item.required);
  });
  const zeroSubstitutionDetected = result.dimensions.some((dimension) => dimension.status === "missing_input" && dimensionScore(dimension) === 0);
  const passed = missingReported && !zeroSubstitutionDetected && (result.status.startsWith("blocked") || result.confidence === "estimated" || result.confidence === "moderate");
  return {
    scenarioId,
    missingInput,
    status: result.status,
    confidence: result.confidence,
    score: result.score,
    missingReported,
    zeroSubstitutionDetected,
    passed
  };
}

function criterion(
  criterionName: string,
  passed: boolean,
  findingCode: import("./compatibility-validation.types.js").CompatibilityValidationFindingCode,
  explanation: string
): CompatibilityPromotionCriterionResult {
  return { criterion: criterionName, passed, findingCode, explanation };
}

function dimensionScore(
  dimension: import("../confidence/index.js").ConfidenceCompatibilityDimensionResult | import("../transition/index.js").TransitionCompatibilityDimensionResult
): number | undefined {
  const transitionDimension = dimension as { readonly compatibilityScore?: number };
  if (transitionDimension.compatibilityScore !== undefined) return transitionDimension.compatibilityScore;
  return (dimension as { readonly score?: number }).score;
}

function removeAttribute(profile: CanonicalEquipmentDNAProfile, key: EquipmentDNAAttributeKey): CanonicalEquipmentDNAProfile {
  return { ...profile, attributes: profile.attributes.filter((attribute) => attribute.key !== key) };
}

function numberAttribute(profile: CanonicalEquipmentDNAProfile, key: EquipmentDNAAttributeKey): number | undefined {
  const evidence = profile.attributes.find((attribute) => attribute.key === key)?.evidence[0]?.rawValue;
  if (typeof evidence === "object" && evidence !== null && "normalizedScore" in evidence && typeof evidence.normalizedScore === "number") return evidence.normalizedScore;
  return scalarNumber(profile, key);
}

function scalarNumber(profile: CanonicalEquipmentDNAProfile, key: EquipmentDNAAttributeKey): number | undefined {
  const value = profile.attributes.find((attribute) => attribute.key === key)?.value;
  if (typeof value === "number") return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function signature(items: readonly { code: string; dimension?: string }[]): string {
  return items.map((item) => `${item.code}:${item.dimension ?? ""}`).sort().join("|");
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/support|readiness|need|profile/g, "");
}

function uniqueCount(values: readonly unknown[]): number {
  return new Set(values).size;
}

function min(values: readonly number[]): number | undefined {
  return values.length ? Math.min(...values) : undefined;
}

function max(values: readonly number[]): number | undefined {
  return values.length ? Math.max(...values) : undefined;
}

function average(values: readonly number[]): number | undefined {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined;
}

function standardSpread(values: readonly number[]): number | undefined {
  const avg = average(values);
  if (avg === undefined || values.length === 0) return undefined;
  return round(Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length));
}

function difference(minimum: number | undefined, maximum: number | undefined): number | undefined {
  return minimum === undefined || maximum === undefined ? undefined : round(maximum - minimum);
}

function subtract(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined || b === undefined ? undefined : round(a - b);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, round(value)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
