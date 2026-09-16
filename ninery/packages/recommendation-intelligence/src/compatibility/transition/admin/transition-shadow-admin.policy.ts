import type {
  TransitionExtendedShadowStudy,
  TransitionOutcomeComparison
} from "../extended-shadow/index.js";
import type {
  TransitionShadowCheckpointStatus,
  TransitionShadowEvidenceClassification,
  TransitionShadowOperationalStage
} from "./transition-shadow-admin.types.js";

export const transitionShadowAdminProhibitedNotePatterns = [
  /diagnosis/i,
  /medical history/i,
  /school record/i,
  /password|token|secret/i,
  /failed the transition/i,
  /model proved/i,
  /caused improvement/i,
  /confidence problems/i,
  /anxious/i
] as const;

export function validateTransitionShadowAdminNote(text: string | undefined): readonly string[] {
  if (!text) return [];
  return transitionShadowAdminProhibitedNotePatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `Note contains prohibited or unrelated content matching ${pattern}.`);
}

export function classifyTransitionShadowStudy(study: Pick<TransitionExtendedShadowStudy, "fixtureKind">): TransitionShadowEvidenceClassification {
  if (study.fixtureKind === "development_fixture") return "development_fixture";
  if (study.fixtureKind === "real_observation") return "genuine_internal_observation";
  return "test_only";
}

export function classifyTransitionShadowObservation(payload: { readonly syntheticObservation?: boolean; readonly notRealWorldEvidence?: boolean }): TransitionShadowEvidenceClassification {
  if (payload.syntheticObservation || payload.notRealWorldEvidence) return "synthetic_observation";
  return "genuine_internal_observation";
}

export function deriveTransitionShadowOperationalStage(study?: TransitionExtendedShadowStudy): TransitionShadowOperationalStage {
  if (!study) return "eligibility_review";
  if (study.status === "cancelled") return "cancelled";
  if (study.status === "invalidated") return "invalidated";
  if (study.status === "observation_complete") return "complete";
  if (study.status === "observation_active") return study.observations.length ? "checkpoint_follow_up" : "observation_active";
  if (study.status === "prediction_captured") return "prediction_ready";
  if (study.status === "draft") return study.familiarity.level === "unknown" ? "familiarity_capture" : "draft_ready";
  return "eligibility_review";
}

export function checkpointStatusesForStudy(study: TransitionExtendedShadowStudy, now = new Date()): readonly TransitionShadowCheckpointStatus[] {
  const start = study.observationWindowStartedAt;
  return [
    checkpointStatus(study, "first_use", start ? addDays(start, 0) : undefined, start ? addDays(start, 3) : undefined, now, "first use"),
    checkpointStatus(study, "early_sessions", start ? addDays(start, 7) : undefined, start ? addDays(start, 14) : undefined, now, "first 1-2 weeks"),
    checkpointStatus(study, "acclimation_period", start ? addDays(start, 21) : undefined, start ? addDays(start, 35) : undefined, now, "3-5 weeks")
  ];
}

export function transitionShadowObservationSummary(study: TransitionExtendedShadowStudy) {
  const sourceCounts = study.observations.reduce<Record<string, number>>((counts, observation) => {
    counts[observation.source] = (counts[observation.source] ?? 0) + 1;
    return counts;
  }, {});
  return {
    total: study.observations.length,
    meaningfulUseCount: study.observations.filter((observation) => observation.meaningfulUseOccurred && observation.equipmentActuallyUsed).length,
    sourceCounts,
    conflictsDetected: study.observations.some((observation) => observation.conflictsWithAnotherSource)
  };
}

export function transitionShadowOutcomeCounts(comparisons: readonly TransitionOutcomeComparison[]): Record<string, number> {
  return comparisons.reduce<Record<string, number>>((counts, comparison) => {
    counts[comparison.comparisonStatus] = (counts[comparison.comparisonStatus] ?? 0) + 1;
    return counts;
  }, {});
}

function checkpointStatus(
  study: TransitionExtendedShadowStudy,
  checkpoint: TransitionShadowCheckpointStatus["checkpoint"],
  dueAt: Date | undefined,
  missingAt: Date | undefined,
  now: Date,
  targetWindow: string
): TransitionShadowCheckpointStatus {
  if (study.status === "draft" || study.status === "prediction_captured" || !study.observationWindowStartedAt) {
    return { checkpoint, status: "not_applicable", observationCount: 0, targetWindow, warnings: ["Observation period has not started."] };
  }
  const observations = study.observations.filter((observation) => observation.checkpoint === checkpoint);
  if (observations.length) {
    return {
      checkpoint,
      status: observations.some((observation) => observation.observationConfidence === "low") ? "completed_low_confidence" : "completed",
      observationCount: observations.length,
      targetWindow,
      warnings: observations.some((observation) => observation.conflictsWithAnotherSource) ? ["Observation sources conflict."] : []
    };
  }
  if (study.status === "observation_complete") return { checkpoint, status: "missing", observationCount: 0, targetWindow, warnings: ["Study completed without this checkpoint."] };
  if (missingAt && now > missingAt) return { checkpoint, status: "missing", observationCount: 0, targetWindow, warnings: ["Checkpoint window has passed."] };
  if (dueAt && now >= dueAt) return { checkpoint, status: "due", observationCount: 0, targetWindow, warnings: [] };
  return { checkpoint, status: "not_due", observationCount: 0, targetWindow, warnings: [] };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
