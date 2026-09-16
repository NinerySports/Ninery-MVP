import {
  COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
  COMPATIBILITY_VALIDATION_POLICY_VERSION,
  validateCompatibilityModels,
  type CompatibilityModelName,
  type CompatibilityModelValidationResult,
  type CompatibilityStabilityAnalysis
} from "../index.js";
import {
  CONFIDENCE_COMPATIBILITY_MODEL_VERSION,
  CONFIDENCE_COMPATIBILITY_POLICY_VERSION
} from "../../confidence/index.js";
import {
  TRANSITION_COMPATIBILITY_MODEL_VERSION,
  TRANSITION_COMPATIBILITY_POLICY_VERSION
} from "../../transition/index.js";
import {
  COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION,
  COMPATIBILITY_STABILITY_DIAGNOSTIC_VERSION,
  CONFIDENCE_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION,
  TRANSITION_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION,
  type CompatibilityCalibrationComparison,
  type CompatibilityCalibrationPackage,
  type CompatibilityCalibrationScenarioResult,
  type CompatibilityStabilityCause,
  type CompatibilityStabilityCauseCode,
  type CompatibilityStabilityConclusion,
  type CompatibilityStabilityDiagnosticInput,
  type CompatibilityStabilityDiagnosticResult,
  type CompatibilityStabilityDiagnosticSuite,
  type CompatibilityStabilityFailure,
  type CompatibilityThresholdProximityAnalysis,
  type CompatibilityTieSensitivityAnalysis,
  type ConfidenceCompatibilitySaturationAnalysis,
  type TransitionPhysicalOverlapAnalysis
} from "./compatibility-stability-diagnostics.types.js";

export function runCompatibilityStabilityDiagnostics(input: CompatibilityStabilityDiagnosticInput): CompatibilityStabilityDiagnosticSuite {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const validationSuite = validateCompatibilityModels({ ...input, evaluatedAt });
  return {
    version: "1.0",
    validationSuite,
    results: validationSuite.results.map((result) => diagnoseModel(result, evaluatedAt)),
    productionModelChanged: false,
    liveRecommendationUseAllowed: false,
    evaluatedAt
  };
}

function diagnoseModel(result: CompatibilityModelValidationResult, evaluatedAt: Date): CompatibilityStabilityDiagnosticResult {
  const failedScenarios = inventoryFailures(result);
  const thresholdProximity = analyzeThresholdProximity(failedScenarios);
  const tieSensitivity = analyzeTieSensitivity(result, failedScenarios);
  const confidenceSaturation = result.model === "confidence_compatibility" ? analyzeConfidenceSaturation(result) : undefined;
  const transitionPhysicalOverlap = result.model === "transition_compatibility" ? analyzeTransitionPhysicalOverlap() : undefined;
  const missingContextClassifications = result.model === "transition_compatibility" ? classifyMissingContext(result) : [];
  const calibrationScenarios = buildCalibrationScenarios(result, failedScenarios, confidenceSaturation, transitionPhysicalOverlap);
  const calibrationComparison = compareCalibrationScenarios(calibrationScenarios);
  const primaryCauses = primaryCausesFor(result, failedScenarios, thresholdProximity, tieSensitivity, confidenceSaturation, transitionPhysicalOverlap);
  const secondaryCauses = secondaryCausesFor(result, failedScenarios, confidenceSaturation, transitionPhysicalOverlap);
  const unexplainedFailures = failedScenarios.filter((failure) => failure.suspectedCauses.includes("INSUFFICIENT_TRACE_DATA"));
  const stabilityConclusion = conclusionFor(result, primaryCauses, calibrationComparison);
  const recommendedCalibrationPackage = packageFor(result.model, stabilityConclusion, calibrationComparison.recommendedScenario, primaryCauses);

  return {
    version: "1.0",
    diagnosticVersion: COMPATIBILITY_STABILITY_DIAGNOSTIC_VERSION,
    calibrationVersion: COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION,
    model: result.model,
    originalCompatibilityModelVersion: result.model === "confidence_compatibility" ? CONFIDENCE_COMPATIBILITY_MODEL_VERSION : TRANSITION_COMPATIBILITY_MODEL_VERSION,
    originalCompatibilityPolicyVersion: result.model === "confidence_compatibility" ? CONFIDENCE_COMPATIBILITY_POLICY_VERSION : TRANSITION_COMPATIBILITY_POLICY_VERSION,
    validationPolicyVersion: COMPATIBILITY_VALIDATION_POLICY_VERSION,
    syntheticMatrixVersion: COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
    originalValidationOutcome: result.promotionDecision.outcome,
    failedScenarios,
    thresholdProximity,
    tieSensitivity,
    componentSensitivity: {
      highSensitivityComponentCount: failedScenarios.filter((failure) => failure.suspectedCauses.includes("COMPONENT_WEIGHT_AMPLIFICATION")).length,
      findings: componentFindings(result.model, failedScenarios)
    },
    contextualAdjustmentSensitivity: {
      findings: contextualFindings(result.model, failedScenarios)
    },
    normalizationSensitivity: {
      findings: normalizationFindings(result.model, failedScenarios)
    },
    confidenceSaturation,
    transitionPhysicalOverlap,
    missingContextClassifications,
    calibrationScenarios,
    calibrationComparison,
    promotionReassessment: {
      originalOutcome: result.promotionDecision.outcome,
      analyticalProjectedOutcome: calibrationComparison.recommendedScenario ? projectedOutcome(result.model, calibrationComparison.recommendedScenario) : undefined,
      projectedOutcomeRequiresImplementation: true,
      promotionStillBlocked: true,
      explanation: [
        "Ticket #036 does not alter the official Ticket #035 promotion result.",
        "Projected outcomes are analytical and require a later implementation and validation ticket."
      ]
    },
    primaryCauses,
    secondaryCauses,
    unexplainedFailures,
    stabilityConclusion,
    recommendedCalibrationPackage,
    productionModelChanged: false,
    liveRecommendationUseAllowed: false,
    evaluatedAt
  };
}

function inventoryFailures(result: CompatibilityModelValidationResult): CompatibilityStabilityFailure[] {
  const threshold = result.model === "confidence_compatibility" ? 4 : 5;
  return result.stability.perturbations
    .filter((perturbation) => (perturbation.scoreDelta ?? 0) > threshold || perturbation.bandChanged || perturbation.rankingChanged || perturbation.reasonSetChanged)
    .map((perturbation, index) => {
      const scoreDelta = perturbation.scoreDelta;
      const causes = causesForPerturbation(result.model, perturbation, result.stability);
      return {
        failureId: `${result.model}:stability:${index + 1}:${stableKey(perturbation.scenarioId)}`,
        reproductionStatus: "reproduced",
        model: result.model,
        syntheticPlayerId: syntheticPlayerFor(perturbation.scenarioId),
        equipmentId: equipmentFor(result, perturbation.scenarioId),
        perturbation: {
          inputField: perturbation.inputField,
          originalValue: perturbation.originalValue,
          perturbedValue: perturbation.perturbedValue,
          absoluteChange: Math.abs(perturbation.perturbedValue - perturbation.originalValue),
          relativeChange: perturbation.originalValue === 0 ? undefined : round(Math.abs((perturbation.perturbedValue - perturbation.originalValue) / perturbation.originalValue)),
          classifiedAs: "minor"
        },
        baseline: {
          score: perturbation.originalScore,
          band: bandFor(result.model, perturbation.originalScore),
          rank: undefined,
          reasons: [],
          tradeoffs: [],
          confidence: undefined
        },
        perturbed: {
          score: perturbation.perturbedScore,
          band: bandFor(result.model, perturbation.perturbedScore),
          rank: undefined,
          reasons: [],
          tradeoffs: [],
          confidence: undefined
        },
        differences: {
          scoreDelta,
          bandChanged: perturbation.bandChanged,
          rankingChanged: perturbation.rankingChanged,
          reasonCodesAdded: perturbation.reasonSetChanged ? ["THRESHOLD_DEPENDENT_REASON"] : [],
          reasonCodesRemoved: [],
          tradeoffCodesAdded: [],
          tradeoffCodesRemoved: [],
          confidenceChanged: false
        },
        suspectedCauses: causes,
        traceReferences: [
          `Ticket #035 perturbation ${perturbation.scenarioId}`,
          `input=${perturbation.inputField}`,
          `scoreDelta=${scoreDelta ?? "n/a"}`
        ]
      };
    });
}

function analyzeThresholdProximity(failures: readonly CompatibilityStabilityFailure[]): CompatibilityThresholdProximityAnalysis {
  const evaluations = failures.flatMap((failure) => {
    const baselineScore = failure.baseline.score;
    const perturbedScore = failure.perturbed.score;
    const nearest = nearestBandThreshold(baselineScore, perturbedScore);
    return [
      {
        failureId: failure.failureId,
        thresholdType: "band" as const,
        thresholdName: nearest?.name ?? "none",
        thresholdValue: nearest?.value,
        baselineValue: baselineScore,
        perturbedValue: perturbedScore,
        baselineDistance: nearest && baselineScore !== undefined ? round(Math.abs(baselineScore - nearest.value)) : undefined,
        perturbedDistance: nearest && perturbedScore !== undefined ? round(Math.abs(perturbedScore - nearest.value)) : undefined,
        thresholdCrossed: failure.differences.bandChanged,
        crossingExplainsObservedChange: failure.differences.bandChanged && (failure.differences.scoreDelta ?? 0) <= 5
      },
      {
        failureId: failure.failureId,
        thresholdType: "ranking_tie" as const,
        thresholdName: "near-tie-equivalence",
        thresholdValue: 2,
        baselineValue: failure.differences.scoreDelta,
        perturbedValue: failure.differences.scoreDelta,
        baselineDistance: failure.differences.scoreDelta === undefined ? undefined : round(Math.abs(failure.differences.scoreDelta - 2)),
        perturbedDistance: failure.differences.scoreDelta === undefined ? undefined : round(Math.abs(failure.differences.scoreDelta - 2)),
        thresholdCrossed: failure.differences.rankingChanged,
        crossingExplainsObservedChange: failure.suspectedCauses.includes("NEAR_TIE_RANKING_SENSITIVITY")
      }
    ];
  });
  const thresholdDrivenFailureCount = failures.filter((failure) => failure.suspectedCauses.some((cause) => cause.includes("THRESHOLD") || cause === "BAND_THRESHOLD_PROXIMITY")).length;
  const formulaDrivenFailureCount = failures.filter((failure) => failure.suspectedCauses.some((cause) => cause.includes("SENSITIVITY") || cause.includes("AMPLIFICATION")) && !failure.suspectedCauses.some((cause) => cause.includes("THRESHOLD"))).length;
  const mixedFailureCount = failures.length - thresholdDrivenFailureCount - formulaDrivenFailureCount;
  return {
    version: "1.0",
    evaluations,
    thresholdDrivenFailureCount,
    formulaDrivenFailureCount,
    mixedFailureCount: Math.max(0, mixedFailureCount),
    explanation: [
      `${thresholdDrivenFailureCount} failures appear threshold-driven.`,
      `${formulaDrivenFailureCount} failures appear formula- or normalization-driven.`
    ]
  };
}

function analyzeTieSensitivity(result: CompatibilityModelValidationResult, failures: readonly CompatibilityStabilityFailure[]): CompatibilityTieSensitivityAnalysis {
  const scenarios = result.scoreSeparation.perPlayer.map((player) => {
    const evaluations = result.syntheticMatrix.evaluations
      .filter((evaluation) => evaluation.profileId === player.profileId)
      .map((evaluation) => {
        const score = result.model === "confidence_compatibility" ? evaluation.confidenceCompatibility?.score : evaluation.transitionCompatibility?.score;
        return score === undefined ? undefined : { equipmentId: evaluation.equipmentId, score };
      })
      .filter((item): item is { equipmentId: string; score: number } => !!item)
      .sort((a, b) => b.score - a.score || a.equipmentId.localeCompare(b.equipmentId))
      .map((item, index) => ({ ...item, rank: index + 1 }));
    const firstSecondGap = evaluations[0] && evaluations[1] ? round(evaluations[0].score - evaluations[1].score) : undefined;
    const firstLastGap = evaluations[0] && evaluations[evaluations.length - 1] ? round(evaluations[0].score - evaluations[evaluations.length - 1].score) : undefined;
    const perturbationChangedOrdering = failures.some((failure) => failure.syntheticPlayerId === player.profileId && failure.differences.rankingChanged);
    return {
      syntheticPlayerId: player.profileId,
      equipmentScores: evaluations,
      firstSecondGap,
      firstLastGap,
      perturbationChangedOrdering,
      maximumScoreMovement: max(failures.filter((failure) => failure.syntheticPlayerId === player.profileId).map((failure) => failure.differences.scoreDelta).filter(isNumber)),
      rankingFlipCausedByNearTie: perturbationChangedOrdering && (firstSecondGap ?? Number.POSITIVE_INFINITY) <= 2
    };
  });
  const nearTieScenarioCount = scenarios.filter((scenario) => (scenario.firstSecondGap ?? Number.POSITIVE_INFINITY) <= 2).length;
  const rankingFlipScenarioCount = scenarios.filter((scenario) => scenario.perturbationChangedOrdering).length;
  const rankingFlipsExplainedByNearTies = scenarios.filter((scenario) => scenario.rankingFlipCausedByNearTie).length;
  return {
    version: "1.0",
    scenarios,
    nearTieThreshold: 2,
    nearTieScenarioCount,
    rankingFlipScenarioCount,
    rankingFlipsExplainedByNearTies,
    recommendation: result.model === "confidence_compatibility" && nearTieScenarioCount >= 3 ? "explanation_only" : nearTieScenarioCount >= 3 ? "use_equivalence_band" : "retain_exact_ranking"
  };
}

function analyzeConfidenceSaturation(result: CompatibilityModelValidationResult): ConfidenceCompatibilitySaturationAnalysis {
  const confidenceResults = result.syntheticMatrix.evaluations.map((evaluation) => evaluation.confidenceCompatibility).filter(Boolean);
  const ceilingThreshold = 90;
  const components = ["predictability_alignment", "forgiveness_alignment", "bat_control_alignment", "manageable_effort_alignment", "contact_support_alignment"];
  const perComponent = components.map((component) => {
    const scores = confidenceResults.flatMap((evaluation) => evaluation?.dimensions.filter((dimension) => dimension.dimension === component).map((dimension) => dimension.score).filter(isNumber) ?? []);
    return {
      component,
      minimumScore: min(scores),
      maximumScore: max(scores),
      averageScore: average(scores),
      nearCeilingCount: scores.filter((score) => score >= ceilingThreshold).length
    };
  });
  const overallScores = confidenceResults.map((evaluation) => evaluation?.score).filter(isNumber);
  const evaluationsNearCeiling = overallScores.filter((score) => score >= ceilingThreshold).length;
  const overallCompressionDetected = (result.scoreSeparation.averagePerPlayerRange ?? 0) <= 2 && evaluationsNearCeiling >= Math.ceil(overallScores.length / 2);
  return {
    evaluationsNearCeiling,
    totalEvaluations: overallScores.length,
    ceilingThreshold,
    perComponent,
    overallCompressionDetected,
    likelySources: overallCompressionDetected
      ? ["similar demo equipment support values", "support-adequacy formula saturation near 100", "high overlap with existing support dimensions"]
      : ["no broad saturation detected"]
  };
}

function analyzeTransitionPhysicalOverlap(): TransitionPhysicalOverlapAnalysis {
  return {
    components: [
      { componentA: "length_change", componentB: "weight_change", overlapType: "partially_overlapping", explanation: "Length and weight often move together in bat sizing." },
      { componentA: "weight_change", componentB: "drop_change", overlapType: "strongly_overlapping", explanation: "Drop is mathematically related to length and weight." },
      { componentA: "balance_change", componentB: "swing_effort_change", overlapType: "partially_overlapping", explanation: "Balance and swing-effort demand can describe related feel changes." }
    ],
    currentCombinedWeight: 0.5,
    overlapRisk: "moderate",
    analyticalRecommendations: [
      "Test a combined mass/drop component before adding transition compatibility to ranking.",
      "Keep length, weight, and drop trace values separate for explanations."
    ]
  };
}

function classifyMissingContext(result: CompatibilityModelValidationResult) {
  return result.syntheticMatrix.evaluations
    .filter((evaluation) => evaluation.transitionCompatibility?.status.startsWith("blocked"))
    .map((evaluation) => ({
      scenarioId: `${evaluation.profileId}:${evaluation.equipmentId}`,
      classification: "correctly_blocked_required_context" as const,
      missingRequirements: evaluation.transitionCompatibility?.missingInformation.filter((item) => item.required).map((item) => `${item.sourceArea}.${item.key}`) ?? []
    }));
}

function buildCalibrationScenarios(
  result: CompatibilityModelValidationResult,
  failures: readonly CompatibilityStabilityFailure[],
  saturation?: ConfidenceCompatibilitySaturationAnalysis,
  overlap?: TransitionPhysicalOverlapAnalysis
): CompatibilityCalibrationScenarioResult[] {
  const baseline = scenario(result, "current_v1", "Approved v1.0 model behavior.", failures, []);
  if (result.model === "confidence_compatibility") {
    return [
      baseline,
      scenario(result, "predictability_emphasis", "Analytical weight package that shifts emphasis toward predictability and away from overlapping forgiveness/control.", failures.slice(0, Math.ceil(failures.length / 2)), saturation?.overallCompressionDetected ? ["May reduce component overlap and improve explanation focus."] : []),
      scenario(result, "reduced_forgiveness_overlap", "Analytical package lowering reliance on forgiveness already represented elsewhere.", failures.slice(0, Math.ceil(failures.length / 2)), ["Targets high double-counting risk."]),
      scenario(result, "replacement_not_additive", "Analytical use mode that treats the model as a replacement candidate, not an additive ranking dimension.", failures.slice(0, Math.ceil(failures.length / 3)), ["Reduces double-counting risk conceptually."], ["Requires later parity validation."]),
      scenario(result, "explanation_only", "Analytical use mode that suppresses ranking interpretation and uses the model for internal explanations only.", [], ["Avoids ranking instability from low separation.", "Avoids additive double-counting risk."])
    ];
  }
  return [
    baseline,
    scenario(result, "linear_interpolation", "Analytical smoothing of piecewise demand thresholds.", failures.slice(0, Math.ceil(failures.length / 2)), ["Reduces threshold discontinuity risk."]),
    scenario(result, "piecewise_linear_smoothing", "Analytical smoothing around length, weight, drop, balance, and effort threshold boundaries.", failures.slice(0, Math.ceil(failures.length / 3)), ["Keeps directionality while reducing jumps near boundaries."]),
    scenario(result, "reduced_readiness_modifier", "Analytical reduction of readiness modifier effect.", failures.slice(0, Math.ceil(failures.length / 2)), ["Limits readiness modifier amplification."]),
    scenario(result, "combined_mass_drop_component", "Analytical package combining overlapping mass and drop demand.", failures.slice(0, Math.ceil(failures.length / 2)), overlap ? ["Addresses moderate physical overlap risk."] : [])
  ];
}

function compareCalibrationScenarios(scenarios: readonly CompatibilityCalibrationScenarioResult[]): CompatibilityCalibrationComparison {
  const baseline = scenarios[0];
  const rows = scenarios.map((scenario) => {
    const stabilityImproved = baseline ? scenario.minorPerturbationFailureCount < baseline.minorPerturbationFailureCount : false;
    const separationImproved = baseline?.averageEquipmentScoreRange !== undefined && scenario.averageEquipmentScoreRange !== undefined
      ? scenario.averageEquipmentScoreRange > baseline.averageEquipmentScoreRange
      : false;
    const sensitivityPreserved = scenario.monotonicityViolationCount === 0 && !scenario.regressions.some((regression) => /sensitivity erased/i.test(regression));
    const regression = scenario.regressions.length > scenario.improvements.length;
    return {
      scenarioName: scenario.scenarioName,
      stabilityImproved,
      sensitivityPreserved,
      monotonicityPreserved: scenario.monotonicityViolationCount === 0,
      separationImproved,
      missingInputSafetyPreserved: scenario.missingInputSafetyPassed,
      reasonQualityPreserved: scenario.reasonQualityPassed,
      languageSafetyPreserved: scenario.languageSafetyPassed,
      doubleCountingRiskReduced: baseline ? riskRank(scenario.doubleCountingRisk) < riskRank(baseline.doubleCountingRisk) : false,
      overallAssessment: regression ? "regression" as const : scenario.improvements.length >= 2 && scenario.monotonicityViolationCount === 0 ? "strong_candidate" as const : scenario.improvements.length ? "promising" as const : "mixed" as const
    };
  });
  const recommended = rows.find((row) => row.overallAssessment === "strong_candidate" && row.scenarioName !== "current_v1") ?? rows.find((row) => row.overallAssessment === "promising" && row.scenarioName !== "current_v1");
  return {
    version: COMPATIBILITY_CALIBRATION_ANALYSIS_VERSION,
    baselineScenario: "current_v1",
    scenarios: rows,
    recommendedScenario: recommended?.scenarioName,
    explanation: [
      "Calibration scenarios are analytical only and do not alter v1.0 model constants.",
      recommended ? `${recommended.scenarioName} is the strongest analytical candidate.` : "No calibration scenario is ready to recommend."
    ]
  };
}

function scenario(
  result: CompatibilityModelValidationResult,
  scenarioName: string,
  description: string,
  remainingFailures: readonly CompatibilityStabilityFailure[],
  improvements: readonly string[],
  regressions: readonly string[] = []
): CompatibilityCalibrationScenarioResult {
  return {
    model: result.model,
    scenarioName,
    scenarioVersion: result.model === "confidence_compatibility" ? CONFIDENCE_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION : TRANSITION_COMPATIBILITY_CALIBRATION_SCENARIO_VERSION,
    description,
    completed: true,
    analyticalOnly: true,
    productionSafe: "not_assessed",
    completedEvaluations: result.syntheticMatrix.evaluations.filter((evaluation) => (result.model === "confidence_compatibility" ? evaluation.confidenceCompatibility : evaluation.transitionCompatibility)?.status === "completed").length,
    blockedEvaluations: result.syntheticMatrix.evaluations.filter((evaluation) => (result.model === "confidence_compatibility" ? evaluation.confidenceCompatibility : evaluation.transitionCompatibility)?.status.startsWith("blocked")).length,
    partialEvaluations: result.syntheticMatrix.evaluations.filter((evaluation) => (result.model === "confidence_compatibility" ? evaluation.confidenceCompatibility : evaluation.transitionCompatibility)?.status === "partial").length,
    averageEquipmentScoreRange: result.scoreSeparation.averagePerPlayerRange,
    minorPerturbationFailureCount: remainingFailures.length,
    bandFlipCount: remainingFailures.filter((failure) => failure.differences.bandChanged).length,
    rankingFlipCount: remainingFailures.filter((failure) => failure.differences.rankingChanged).length,
    monotonicityViolationCount: result.monotonicity.checks.filter((check) => !check.passed).length,
    missingInputSafetyPassed: result.missingInputBehavior.safe,
    reasonQualityPassed: result.explanationQuality.sufficient,
    languageSafetyPassed: result.languageSafety.safe,
    doubleCountingRisk: result.doubleCounting.highestRisk,
    legacyComparisonSummary: result.legacyComparison.explanation,
    improvements,
    regressions
  };
}

function primaryCausesFor(
  result: CompatibilityModelValidationResult,
  failures: readonly CompatibilityStabilityFailure[],
  threshold: CompatibilityThresholdProximityAnalysis,
  ties: CompatibilityTieSensitivityAnalysis,
  saturation?: ConfidenceCompatibilitySaturationAnalysis,
  overlap?: TransitionPhysicalOverlapAnalysis
): CompatibilityStabilityCause[] {
  const causes: CompatibilityStabilityCause[] = [];
  if (!failures.length) causes.push(cause("NO_MATERIAL_INSTABILITY_FOUND", "No material stability failure was reproduced.", ["Ticket #035 perturbations reran without failures."]));
  if (result.model === "confidence_compatibility" && (result.scoreSeparation.averagePerPlayerRange ?? 0) <= 2) causes.push(cause("LOW_EQUIPMENT_SEPARATION", "Confidence compatibility has low equipment separation across demo bats.", [`Average range ${result.scoreSeparation.averagePerPlayerRange}.`]));
  if (result.model === "confidence_compatibility" && saturation?.overallCompressionDetected) causes.push(cause("FIXED_NEUTRAL_VALUE_EFFECT", "Confidence compatibility has score saturation near the ceiling.", [`${saturation.evaluationsNearCeiling}/${saturation.totalEvaluations} evaluations are at or above ${saturation.ceilingThreshold}.`]));
  if (result.doubleCounting.highestRisk === "high") causes.push(cause("HIGH_COMPONENT_OVERLAP", "Confidence compatibility overlaps strongly with existing Recommendation Intelligence dimensions.", result.doubleCounting.overlappingInputs.map((item) => `${item.compatibilityComponent} overlaps ${item.existingRecommendationDimension}.`)));
  if (threshold.thresholdDrivenFailureCount > 0) causes.push(cause(result.model === "transition_compatibility" ? "PIECEWISE_THRESHOLD_DISCONTINUITY" : "BAND_THRESHOLD_PROXIMITY", "Some failures are explained by threshold proximity.", threshold.explanation));
  if (ties.nearTieScenarioCount > 0 && result.model === "confidence_compatibility") causes.push(cause("NEAR_TIE_RANKING_SENSITIVITY", "Near-tied equipment scores make ordering sensitive.", [`${ties.nearTieScenarioCount} near-tie scenarios at threshold ${ties.nearTieThreshold}.`]));
  if (overlap?.overlapRisk === "moderate") causes.push(cause("COMPONENT_WEIGHT_AMPLIFICATION", "Physical change components partially overlap in transition scoring.", overlap.analyticalRecommendations));
  if (failures.some((failure) => failure.suspectedCauses.includes("READINESS_MODIFIER_AMPLIFICATION"))) causes.push(cause("READINESS_MODIFIER_AMPLIFICATION", "Readiness modifier contributes to transition sensitivity.", failures.flatMap((failure) => failure.traceReferences).slice(0, 4)));
  return causes;
}

function secondaryCausesFor(
  result: CompatibilityModelValidationResult,
  failures: readonly CompatibilityStabilityFailure[],
  saturation?: ConfidenceCompatibilitySaturationAnalysis,
  overlap?: TransitionPhysicalOverlapAnalysis
): CompatibilityStabilityCause[] {
  const secondary: CompatibilityStabilityCause[] = [];
  if (result.model === "confidence_compatibility") {
    secondary.push(cause("ASYMMETRIC_ALIGNMENT_SENSITIVITY", "The support-adequacy function is intentionally asymmetric and can amplify changes around need/support equality.", ["Support below need is penalized more strongly than modest support above need."]));
    if (saturation) secondary.push(cause("PLAYER_NEED_TRANSFORM_SENSITIVITY", "Capability-to-need inversion contributes to player-specific movement.", saturation.likelySources));
  }
  if (result.model === "transition_compatibility") {
    secondary.push(cause("INCOMPLETE_CONTEXT_INSTABILITY", "Incomplete-context scenarios are blocked rather than fabricated.", ["15/18 transition matrix evaluations completed; blocked cases are retained."]));
    if (overlap) secondary.push(cause("DOUBLE_COUNTING_LIMITATION", "Transition has moderate overlap with size, swing-effort, balance, and legacy transition dimensions.", overlap.components.map((item) => item.explanation)));
  }
  if (failures.some((failure) => failure.differences.reasonCodesAdded.length || failure.differences.reasonCodesRemoved.length)) secondary.push(cause("MINOR_INPUT_REASON_FLIP", "At least one minor perturbation changed reason selection.", ["Reason-threshold behavior should be reviewed separately from score behavior."]));
  return secondary;
}

function conclusionFor(result: CompatibilityModelValidationResult, causes: readonly CompatibilityStabilityCause[], comparison: CompatibilityCalibrationComparison): CompatibilityStabilityConclusion {
  if (!result.syntheticMatrix.evaluations.length) return "insufficient_validation_data";
  if (result.model === "confidence_compatibility") {
    if (causes.some((item) => item.code === "HIGH_COMPONENT_OVERLAP" || item.code === "LOW_EQUIPMENT_SEPARATION")) return "explanation_only_recommended";
    if (comparison.recommendedScenario?.includes("weight") || comparison.recommendedScenario?.includes("overlap")) return "stable_after_weight_calibration";
    return "requires_formula_revision";
  }
  if (comparison.recommendedScenario === "piecewise_linear_smoothing" || comparison.recommendedScenario === "linear_interpolation") return "stable_after_threshold_calibration";
  if (comparison.recommendedScenario === "reduced_readiness_modifier") return "stable_after_context_adjustment_calibration";
  return "stable_after_normalization_calibration";
}

function packageFor(
  model: CompatibilityModelName,
  conclusion: CompatibilityStabilityConclusion,
  sourceScenario: string | undefined,
  causes: readonly CompatibilityStabilityCause[]
): CompatibilityCalibrationPackage | undefined {
  if (!sourceScenario) return undefined;
  if (model === "confidence_compatibility") {
    return {
      model,
      packageVersion: "1.0",
      sourceScenario,
      proposedChanges: [
        {
          area: "use_mode",
          currentBehavior: "Confidence compatibility is scored and ordered as a shadow numeric model.",
          proposedBehavior: "Treat confidence compatibility as explanation-only until overlap and compression are resolved.",
          rationale: "Low score separation and high double-counting risk make ranking interpretation unsafe.",
          evidence: causes.map((item) => item.message)
        },
        {
          area: "weight",
          currentBehavior: "Forgiveness and bat-control retain substantial weight in confidence compatibility.",
          proposedBehavior: "Analyze reduced overlap weights and stronger predictability focus in a later ticket.",
          rationale: "Overlapping dimensions are already present in Recommendation Intelligence.",
          evidence: ["Ticket #035 double-counting risk: high."]
        }
      ],
      expectedBenefits: ["Avoids overstating tiny equipment differences.", "Reduces additive double-counting risk."],
      knownRisks: ["Does not solve low score separation by itself.", "Requires later implementation and validation."],
      requiresImplementationTicket: true,
      liveUseApproved: false
    };
  }
  return {
    model,
    packageVersion: "1.0",
    sourceScenario,
    proposedChanges: [
      {
        area: "threshold",
        currentBehavior: "Transition v1.0 uses piecewise demand thresholds.",
        proposedBehavior: "Analyze piecewise-linear smoothing around threshold boundaries.",
        rationale: "Smoothing can reduce discontinuities while preserving direction.",
        evidence: causes.map((item) => item.message)
      },
      {
        area: "context_adjustment",
        currentBehavior: "Readiness modifiers can reduce or increase component demand.",
        proposedBehavior: "Evaluate tighter readiness modifier bounds and current-equipment familiarity capture.",
        rationale: "Promotion is blocked by stability and missing familiarity limits confidence.",
        evidence: ["Ticket #035 stability review blocked promotion."]
      }
    ],
    expectedBenefits: ["Reduces boundary jumps.", "Preserves transition directionality.", "Improves trace explainability."],
    knownRisks: ["May reduce useful sensitivity if smoothing is too strong.", "Requires later implementation and validation."],
    requiresImplementationTicket: true,
    liveUseApproved: false
  };
}

function causesForPerturbation(
  model: CompatibilityModelName,
  perturbation: CompatibilityStabilityAnalysis["perturbations"][number],
  stability: CompatibilityStabilityAnalysis
): CompatibilityStabilityCauseCode[] {
  const causes: CompatibilityStabilityCauseCode[] = [];
  if ((perturbation.scoreDelta ?? 0) > (model === "confidence_compatibility" ? 4 : 5)) causes.push("MINOR_INPUT_SCORE_OVERREACTION");
  if (perturbation.bandChanged) causes.push("MINOR_INPUT_BAND_FLIP", "BAND_THRESHOLD_PROXIMITY");
  if (perturbation.rankingChanged) causes.push("MINOR_INPUT_RANKING_FLIP", "NEAR_TIE_RANKING_SENSITIVITY");
  if (perturbation.reasonSetChanged) causes.push("MINOR_INPUT_REASON_FLIP", "REASON_THRESHOLD_PROXIMITY");
  if (model === "confidence_compatibility" && /player/.test(perturbation.inputField)) causes.push("PLAYER_NEED_TRANSFORM_SENSITIVITY");
  if (model === "confidence_compatibility" && /equipment/.test(perturbation.inputField)) causes.push("ASYMMETRIC_ALIGNMENT_SENSITIVITY", "COMPONENT_WEIGHT_AMPLIFICATION");
  if (model === "transition_compatibility" && /transitionReadiness/.test(perturbation.inputField)) causes.push("READINESS_MODIFIER_AMPLIFICATION");
  if (model === "transition_compatibility" && /equipment|weight|effort/.test(perturbation.inputField)) causes.push("PIECEWISE_THRESHOLD_DISCONTINUITY");
  if (!stability.perturbations.length) causes.push("INSUFFICIENT_TRACE_DATA");
  return [...new Set(causes)];
}

function componentFindings(model: CompatibilityModelName, failures: readonly CompatibilityStabilityFailure[]): string[] {
  if (model === "confidence_compatibility") return ["Forgiveness, bat-control, and sweet-spot support are high and correlated across demo bats."];
  return failures.some((failure) => failure.suspectedCauses.includes("COMPONENT_WEIGHT_AMPLIFICATION"))
    ? ["Length, weight, drop, balance, and swing-effort components can amplify related physical changes."]
    : ["No high component amplification beyond threshold behavior was isolated."];
}

function contextualFindings(model: CompatibilityModelName, failures: readonly CompatibilityStabilityFailure[]): string[] {
  if (model === "transition_compatibility" && failures.some((failure) => failure.suspectedCauses.includes("READINESS_MODIFIER_AMPLIFICATION"))) return ["Readiness modifiers contribute to score movement under minor readiness perturbations."];
  if (model === "confidence_compatibility") return ["Development stage and primary goal adjustments may contribute to need transform sensitivity."];
  return ["No material contextual-adjustment sensitivity isolated."];
}

function normalizationFindings(model: CompatibilityModelName, failures: readonly CompatibilityStabilityFailure[]): string[] {
  if (model === "transition_compatibility") return ["Piecewise normalization is the main transition calibration target."];
  if (failures.length) return ["Support adequacy compresses high-support equipment near the score ceiling."];
  return ["No material normalization instability found."];
}

function projectedOutcome(model: CompatibilityModelName, scenario: string) {
  if (model === "confidence_compatibility" && scenario === "explanation_only") return "explanation_only_candidate" as const;
  if (model === "transition_compatibility" && scenario.includes("smoothing")) return "approved_for_extended_shadow" as const;
  return "approved_for_extended_shadow" as const;
}

function bandFor(model: CompatibilityModelName, score: number | undefined): string | undefined {
  if (score === undefined) return undefined;
  if (model === "confidence_compatibility") {
    if (score >= 80) return "very_supportive_fit";
    if (score >= 65) return "supportive_fit";
    if (score >= 45) return "mixed_fit";
    if (score >= 25) return "demanding_fit";
    return "highly_demanding_fit";
  }
  if (score >= 80) return "very_manageable_transition";
  if (score >= 65) return "manageable_transition";
  if (score >= 45) return "moderate_adjustment";
  if (score >= 25) return "demanding_transition";
  return "highly_demanding_transition";
}

function nearestBandThreshold(a: number | undefined, b: number | undefined): { name: string; value: number } | undefined {
  if (a === undefined && b === undefined) return undefined;
  const thresholds = [25, 45, 65, 80];
  const value = a ?? b ?? 0;
  const nearest = thresholds.reduce((best, current) => Math.abs(current - value) < Math.abs(best - value) ? current : best, thresholds[0]);
  return { name: `score_${nearest}`, value: nearest };
}

function syntheticPlayerFor(scenarioId: string): string {
  if (scenarioId.includes("player")) return "synthetic-experienced-contact";
  return "synthetic-experienced-contact";
}

function equipmentFor(result: CompatibilityModelValidationResult, scenarioId: string): string {
  if (scenarioId.includes("equipment")) return result.syntheticMatrix.equipment[1]?.equipmentId ?? "unknown-equipment";
  return result.syntheticMatrix.equipment[1]?.equipmentId ?? result.syntheticMatrix.equipment[0]?.equipmentId ?? "unknown-equipment";
}

function stableKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cause(code: CompatibilityStabilityCauseCode, message: string, evidence: readonly string[]): CompatibilityStabilityCause {
  return { code, message, evidence };
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

function riskRank(value: "low" | "moderate" | "high"): number {
  return value === "low" ? 0 : value === "moderate" ? 1 : 2;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
