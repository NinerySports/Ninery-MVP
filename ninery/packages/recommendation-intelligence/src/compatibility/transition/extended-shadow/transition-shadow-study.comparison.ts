import {
  predictedAdjustmentCategory,
  transitionAdjustmentOrdering
} from "./transition-shadow-study.policy.js";
import {
  TRANSITION_OUTCOME_COMPARISON_VERSION,
  type TransitionAdjustmentDemandLabel,
  type TransitionAdjustmentObservation,
  type TransitionExtendedShadowStudy,
  type TransitionOutcomeComparison,
  type TransitionOutcomeFinding
} from "./transition-shadow-study.types.js";

export function compareTransitionShadowStudyOutcome(study: TransitionExtendedShadowStudy, comparedAt = new Date()): TransitionOutcomeComparison {
  if (!study.prediction) throw new Error("Cannot compare a study without an immutable prediction snapshot.");
  const findings: TransitionOutcomeFinding[] = [];
  const warnings: TransitionOutcomeFinding[] = [];
  const predicted = predictedAdjustmentCategory(study.prediction.predictedScore);
  if (study.status === "invalidated") {
    warnings.push(finding("STUDY_INVALIDATED", "warning", study.invalidationReason ?? "Study was invalidated."));
    return baseComparison(study, predicted, undefined, "study_invalidated", "insufficient_data", "low", findings, warnings, comparedAt);
  }
  const meaningful = study.observations.filter((observation) => observation.equipmentActuallyUsed && observation.meaningfulUseOccurred);
  if (!meaningful.length) {
    warnings.push(finding("INSUFFICIENT_OBSERVATION", "warning", "No meaningful-use observation is available."));
    return baseComparison(study, predicted, undefined, "insufficient_observation", "insufficient_data", "low", findings, warnings, comparedAt);
  }
  const agreement = observerAgreement(meaningful);
  const observed = aggregateObservedAdjustment(meaningful);
  if (!observed || agreement === "material_conflict") {
    warnings.push(finding("OBSERVATION_CONFLICT", "warning", "Observations contain material disagreement and should not be forced into model alignment."));
    return baseComparison(study, predicted, observed, agreement === "material_conflict" ? "conflicting_observations" : "insufficient_observation", agreement, "low", findings, warnings, comparedAt);
  }
  const difference = Math.abs(transitionAdjustmentOrdering[observed] - transitionAdjustmentOrdering[predicted]);
  const status = difference <= 1 ? "broadly_aligned" : difference === 2 ? "partially_aligned" : "materially_different";
  const confidence = outcomeConfidence(meaningful, agreement);
  findings.push(finding("OBSERVATIONAL_ONLY", "info", "Comparison is descriptive extended-shadow evidence and does not prove causation."));
  if (status === "materially_different") warnings.push(finding("MODEL_OUTCOME_DIFFERENCE", "warning", "Observed adjustment appears materially different from the stored prediction."));
  return baseComparison(study, predicted, observed, status, agreement, confidence, findings, warnings, comparedAt);
}

export function aggregateObservedAdjustment(observations: readonly TransitionAdjustmentObservation[]): Exclude<TransitionAdjustmentDemandLabel, "unknown"> | undefined {
  const scored = observations
    .map((observation) => ({ observation, label: observation.observedAdjustmentDemand }))
    .filter((item): item is { readonly observation: TransitionAdjustmentObservation; readonly label: Exclude<TransitionAdjustmentDemandLabel, "unknown"> } => !!item.label && item.label !== "unknown");
  if (!scored.length) return undefined;
  const weighted = scored.map(({ observation, label }) => ({
    label,
    weight: observation.checkpoint === "acclimation_period" ? 1.25 : observation.checkpoint === "early_sessions" ? 1.1 : 1,
    score: transitionAdjustmentOrdering[label]
  }));
  const average = weighted.reduce((sum, item) => sum + item.score * item.weight, 0) / weighted.reduce((sum, item) => sum + item.weight, 0);
  const nearest = Object.entries(transitionAdjustmentOrdering).reduce((best, [label, score]) => Math.abs(score - average) < Math.abs(best.score - average) ? { label, score } : best, { label: "moderate", score: 3 });
  return nearest.label as Exclude<TransitionAdjustmentDemandLabel, "unknown">;
}

function baseComparison(
  study: TransitionExtendedShadowStudy,
  predicted: string,
  observed: Exclude<TransitionAdjustmentDemandLabel, "unknown"> | undefined,
  status: TransitionOutcomeComparison["comparisonStatus"],
  agreement: TransitionOutcomeComparison["observerAgreement"],
  confidence: TransitionOutcomeComparison["outcomeConfidence"],
  findings: readonly TransitionOutcomeFinding[],
  warnings: readonly TransitionOutcomeFinding[],
  comparedAt: Date
): TransitionOutcomeComparison {
  const prediction = study.prediction;
  if (!prediction) throw new Error("Cannot compare a study without prediction.");
  return {
    version: TRANSITION_OUTCOME_COMPARISON_VERSION,
    studyId: study.id,
    predictedScore: prediction.predictedScore,
    predictedBand: prediction.predictedBand,
    predictedAdjustmentCategory: predicted,
    observedAdjustmentCategory: observed ?? "insufficient_data",
    comparisonStatus: status,
    checkpointComparisons: study.observations.map((observation) => ({
      checkpoint: observation.checkpoint,
      observedCategory: observation.observedAdjustmentDemand,
      alignment: observation.observedAdjustmentDemand && observation.observedAdjustmentDemand !== "unknown" ? status : undefined,
      explanation: observation.meaningfulUseOccurred ? "Meaningful use observation retained for descriptive comparison." : "Observation did not include meaningful equipment use."
    })),
    observerAgreement: agreement,
    outcomeConfidence: confidence,
    findings,
    warnings,
    modelChangeRecommended: false,
    livePromotionRecommended: false,
    comparedAt
  };
}

function observerAgreement(observations: readonly TransitionAdjustmentObservation[]): TransitionOutcomeComparison["observerAgreement"] {
  const observed = observations.map((observation) => observation.observedAdjustmentDemand).filter((value): value is Exclude<TransitionAdjustmentDemandLabel, "unknown"> => !!value && value !== "unknown");
  const sources = new Set(observations.map((observation) => observation.source));
  if (!observed.length) return "insufficient_data";
  if (observations.some((observation) => observation.conflictsWithAnotherSource)) return "material_conflict";
  if (sources.size === 1) return "single_source";
  const spread = Math.max(...observed.map((label) => transitionAdjustmentOrdering[label])) - Math.min(...observed.map((label) => transitionAdjustmentOrdering[label]));
  if (spread >= 3) return "material_conflict";
  if (spread >= 2) return "mixed";
  return "generally_consistent";
}

function outcomeConfidence(observations: readonly TransitionAdjustmentObservation[], agreement: TransitionOutcomeComparison["observerAgreement"]): TransitionOutcomeComparison["outcomeConfidence"] {
  if (agreement === "material_conflict" || agreement === "insufficient_data") return "low";
  if (observations.some((observation) => observation.observationConfidence === "low")) return "low";
  if (observations.length >= 2 && observations.some((observation) => observation.directlyWitnessed) && agreement === "generally_consistent") return "high";
  return "moderate";
}

function finding(code: string, severity: TransitionOutcomeFinding["severity"], message: string): TransitionOutcomeFinding {
  return { code, severity, message };
}
