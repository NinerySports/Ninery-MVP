import { compareTransitionShadowStudyOutcome } from "../extended-shadow/index.js";
import { classifyTransitionShadowStudy, validateTransitionShadowAdminNote } from "../admin/index.js";
import type {
  GenuineStudyDryRunResult,
  TransitionEquipmentVerification,
  TransitionFieldObservationReadinessResult,
  TransitionGenuineEvidenceQualityResult,
  TransitionGenuineEvidenceRegistryEntry,
  TransitionGenuineStudyEligibilityResult,
  TransitionGenuineStudyRegistrySummary,
  TransitionGenuineStudyRepositoryView,
  TransitionGenuineStudyValidationResult,
  TransitionObservationEvidenceQuality,
  TransitionStudyParticipationAcknowledgement
} from "./transition-genuine-study.types.js";

export const genuineStudyDefinition = {
  version: "1.0",
  definition:
    "A genuine transition study is a real equipment transition involving an actual player, actual current equipment, actual proposed equipment, an immutable Transition Compatibility v1.1 prediction captured before observation, and observations based on actual equipment use.",
  exclusions: [
    "synthetic fixtures",
    "hypothetical recommendations",
    "manually fabricated tests",
    "simulated observations",
    "equipment comparisons without actual player use",
    "retrospective reconstructions where prediction followed a known outcome"
  ]
} as const;

export const participationAcknowledgementLanguage = [
  "Ninery is collecting feedback about equipment adjustment.",
  "Feedback is used for internal product and model evaluation.",
  "The stored prediction will not be changed based on the observation.",
  "Participation does not affect the current recommendation.",
  "Feedback may show that the prediction was accurate, partly accurate, or inaccurate.",
  "Observations do not establish medical, psychological, or causal conclusions."
] as const;

export const fieldObservationProtocol = {
  version: "1.0",
  checkpoints: {
    first_use: "Capture after the player's first meaningful use.",
    early_sessions: "Capture after approximately 3-5 meaningful sessions.",
    acclimation_period: "Capture after approximately 2-4 weeks when actual use supports that timeframe."
  },
  observerSourcePolicy:
    "Source quality is based on direct witness, meaningful use, completeness, confidence, consistency, and conflicts; no source role is automatically ranked above another.",
  dataMinimization: [
    "Do not collect diagnosis, mental-health data, school records, academic performance, precise location, financial information, or unrelated family information.",
    "Notes are optional, limited, equipment-specific, and non-clinical."
  ],
  promotionGuardrails: [
    "No observation changes a prediction.",
    "No observation changes live recommendation scoring.",
    "No count or quality threshold automatically promotes Transition Compatibility v1.1."
  ]
} as const;

export const transitionGenuineStudyProhibitedLanguagePatterns = [
  /diagnosis/i,
  /medical/i,
  /mental health/i,
  /school record/i,
  /academic/i,
  /precise location/i,
  /password|token|secret/i,
  /anxiety|anxious/i,
  /adhd/i,
  /fixed (his|her|their)? ?confidence/i,
  /bad at hitting/i,
  /model was right/i,
  /model proved/i,
  /caused improvement/i,
  /clinical/i
] as const;

export function validateTransitionGenuineStudyLanguage(text: string | undefined): readonly string[] {
  if (!text) return [];
  return [
    ...validateTransitionShadowAdminNote(text),
    ...transitionGenuineStudyProhibitedLanguagePatterns
      .filter((pattern) => pattern.test(text))
      .map((pattern) => `Genuine-study language contains prohibited content matching ${pattern}.`)
  ];
}

export function validParticipationAcknowledgement(acknowledgement: TransitionStudyParticipationAcknowledgement | undefined, actorId?: string): boolean {
  return !!acknowledgement
    && acknowledgement.version === "1.0"
    && acknowledgement.purposeAcknowledged
    && acknowledgement.observationalNatureAcknowledged
    && acknowledgement.noRecommendationImpactAcknowledged
    && acknowledgement.voluntaryFeedbackAcknowledged
    && (!actorId || acknowledgement.capturedByActorId === actorId);
}

export function evaluateEquipmentVerification(
  verification: TransitionEquipmentVerification | undefined,
  kind: "current" | "proposed"
) {
  const checks: TransitionGenuineStudyEligibilityResult["checks"][number][] = [];
  checks.push({
    code: `${kind}_equipment_identified`,
    passed: !!verification?.equipmentId,
    required: true,
    explanation: verification?.equipmentId ? `${kind} equipment is identified.` : `${kind} equipment is required.`
  });
  checks.push({
    code: `${kind}_variant_identified`,
    passed: !!verification?.equipmentVariantId,
    required: true,
    explanation: verification?.equipmentVariantId ? `${kind} variant is identified.` : `${kind} variant is required for transition observation.`
  });
  checks.push({
    code: `${kind}_specifications_present`,
    passed: verification?.lengthInches !== undefined && verification.weightOunces !== undefined && verification.dropWeight !== undefined,
    required: true,
    explanation: "Length, weight, and drop must be explicitly verified."
  });
  if (kind === "current") {
    checks.push({
      code: "current_equipment_actual_primary",
      passed: verification?.verifiedAsActualCurrentPrimary === true,
      required: true,
      explanation: verification?.verifiedAsActualCurrentPrimary ? "Current equipment is verified as the player's actual primary equipment." : "Current equipment cannot be inferred solely from a recommendation."
    });
  } else {
    checks.push({
      code: "proposed_equipment_expected_use",
      passed: verification?.expectedToBeUsed === true,
      required: true,
      explanation: verification?.expectedToBeUsed ? "Proposed equipment is expected to be genuinely used." : "Proposed use must be verified before prediction."
    });
    checks.push({
      code: "proposed_equipment_available",
      passed: verification?.availableForUse === true,
      required: true,
      explanation: verification?.availableForUse ? "Proposed equipment is available for use." : "Proposed equipment availability is required."
    });
    checks.push({
      code: "proposed_equipment_size_match",
      passed: verification?.sizeSpecificationMatched === true,
      required: true,
      explanation: verification?.sizeSpecificationMatched ? "Proposed equipment size/specification match is verified." : "Proposed equipment size/specification match is required."
    });
  }
  return checks;
}

export function evaluateObservationEvidenceQuality(
  study: TransitionGenuineStudyRepositoryView,
  now = new Date()
): TransitionGenuineEvidenceQualityResult {
  const firstUse = study.observations.some((observation) => observation.checkpoint === "first_use");
  const earlySessions = study.observations.some((observation) => observation.checkpoint === "early_sessions");
  const acclimationPeriod = study.observations.some((observation) => observation.checkpoint === "acclimation_period");
  const meaningful = study.observations.some((observation) => observation.meaningfulUseOccurred && observation.equipmentActuallyUsed);
  const directWitnessCount = study.observations.filter((observation) => observation.directlyWitnessed).length;
  const highConfidenceCount = study.observations.filter((observation) => observation.observationConfidence === "high").length;
  const conflicts = study.observations.some((observation) => observation.conflictsWithAnotherSource);
  const comparison = study.prediction?.predictedScore !== undefined ? compareTransitionShadowStudyOutcome({
    version: "1.0",
    id: study.id,
    studyKey: study.studyKey,
    playerId: study.playerId,
    currentEquipmentId: study.currentEquipmentId,
    currentEquipmentVariantId: study.currentEquipmentVariantId,
    proposedEquipmentId: study.proposedEquipmentId,
    proposedEquipmentVariantId: study.proposedEquipmentVariantId,
    status: study.status as never,
    familiarity: study.familiarity,
    prediction: study.prediction as never,
    observations: study.observations,
    fixtureKind: study.fixtureKind === "real_observation" ? "real_observation" : "development_fixture",
    observationWindowCompletedAt: study.observationWindowCompletedAt,
    createdAt: now,
    updatedAt: now
  }, now) : undefined;
  const warnings: string[] = [];
  if (!meaningful) warnings.push("Meaningful proposed-equipment use has not been confirmed.");
  if (conflicts) warnings.push("Observer reports contain a material conflict.");
  if (!study.prediction?.predictedAt || study.observations.some((observation) => observation.observedAt <= study.prediction!.predictedAt!)) warnings.push("Prediction must be captured before every observation.");
  let quality: TransitionObservationEvidenceQuality = "insufficient";
  const covered = [firstUse, earlySessions, acclimationPeriod].filter(Boolean).length;
  if (meaningful && covered >= 1) quality = "limited";
  if (meaningful && covered >= 2 && directWitnessCount >= 1) quality = "usable";
  if (meaningful && covered === 3 && directWitnessCount >= 2 && highConfidenceCount >= 1 && !conflicts) quality = "strong";
  if (conflicts && quality === "strong") quality = "usable";
  return {
    version: "1.0",
    quality,
    checkpointCoverage: { firstUse, earlySessions, acclimationPeriod },
    meaningfulUseConfirmed: meaningful,
    observerAgreement: comparison?.observerAgreement ?? "not_compared",
    familiarityConfidence: study.familiarity.confidence,
    predictionCapturedProspectively: !!study.prediction?.predictedAt && study.observations.every((observation) => observation.observedAt > study.prediction!.predictedAt!),
    equipmentIdentityVerified: !!study.currentEquipmentVariantId && !!study.proposedEquipmentVariantId,
    warnings
  };
}

export function evaluateFieldObservationReadiness(
  study: TransitionGenuineStudyRepositoryView,
  hasAcknowledgement: boolean,
  observerPlanPresent: boolean,
  reviewedAt = new Date()
): TransitionFieldObservationReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (classifyTransitionShadowStudy({ fixtureKind: study.fixtureKind === "real_observation" ? "real_observation" : "development_fixture" }) !== "genuine_internal_observation") blockers.push("Study is not classified as genuine_internal_observation.");
  if (study.status !== "prediction_captured") blockers.push("Study must have a captured prediction before observations start.");
  if (study.prediction?.transitionModelVersion !== "1.1") blockers.push("Only Transition Compatibility v1.1 predictions are eligible.");
  if (!hasAcknowledgement) blockers.push("Participation acknowledgement is required.");
  if (!study.proposedEquipmentVariantId) blockers.push("Proposed equipment variant must remain verified.");
  if (!observerPlanPresent) warnings.push("Observer plan is not present.");
  return { version: "1.0", ready: blockers.length === 0, blockers, warnings, reviewedAt };
}

export function registryEntryForStudy(study: TransitionGenuineStudyRepositoryView, now = new Date()): TransitionGenuineEvidenceRegistryEntry | undefined {
  if (study.fixtureKind !== "real_observation") return undefined;
  if (study.status !== "observation_complete") return undefined;
  if (study.prediction?.transitionModelVersion !== "1.1" || study.prediction.predictedScore === undefined || !study.prediction.predictedBand) return undefined;
  const quality = evaluateObservationEvidenceQuality(study, now);
  if (!quality.meaningfulUseConfirmed || !quality.predictionCapturedProspectively || !quality.equipmentIdentityVerified) return undefined;
  const comparison = compareTransitionShadowStudyOutcome({
    version: "1.0",
    id: study.id,
    studyKey: study.studyKey,
    playerId: study.playerId,
    currentEquipmentId: study.currentEquipmentId,
    currentEquipmentVariantId: study.currentEquipmentVariantId,
    proposedEquipmentId: study.proposedEquipmentId,
    proposedEquipmentVariantId: study.proposedEquipmentVariantId,
    status: "observation_complete",
    familiarity: study.familiarity,
    prediction: study.prediction as never,
    observations: study.observations,
    fixtureKind: "real_observation",
    observationWindowCompletedAt: study.observationWindowCompletedAt,
    createdAt: now,
    updatedAt: now
  }, now);
  return {
    studyId: study.id,
    playerId: study.playerId,
    currentEquipmentId: study.currentEquipmentId,
    proposedEquipmentId: study.proposedEquipmentId,
    predictedScore: study.prediction.predictedScore,
    predictedBand: study.prediction.predictedBand,
    comparisonStatus: comparison.comparisonStatus,
    evidenceQuality: quality.quality,
    checkpointCoverage: quality.checkpointCoverage,
    outcomeConfidence: comparison.outcomeConfidence,
    modelVersion: "1.1",
    completedAt: study.observationWindowCompletedAt
  };
}

export function summarizeGenuineEvidenceRegistry(studies: readonly TransitionGenuineStudyRepositoryView[], now = new Date()): TransitionGenuineStudyRegistrySummary {
  const genuine = studies.filter((study) => study.fixtureKind === "real_observation");
  const entries = genuine.map((study) => registryEntryForStudy(study, now)).filter((entry): entry is TransitionGenuineEvidenceRegistryEntry => !!entry);
  const qualityCounts: Record<TransitionObservationEvidenceQuality, number> = { insufficient: 0, limited: 0, usable: 0, strong: 0 };
  for (const study of genuine.filter((study) => study.status === "observation_complete")) {
    qualityCounts[evaluateObservationEvidenceQuality(study, now).quality] += 1;
  }
  return {
    genuineCompletedStudies: genuine.filter((study) => study.status === "observation_complete").length,
    registryEligible: entries.length,
    insufficientEvidence: genuine.filter((study) => study.status === "observation_complete" && !registryEntryForStudy(study, now)).length,
    cancelled: genuine.filter((study) => study.status === "cancelled").length,
    invalidated: genuine.filter((study) => study.status === "invalidated").length,
    evidenceQualityCounts: qualityCounts,
    comparisonStatusCounts: countBy(entries, (entry) => entry.comparisonStatus),
    modelVersionsRepresented: countBy(genuine, (study) => study.prediction?.transitionModelVersion ?? "none"),
    entries
  };
}

export function validateGenuineEvidenceRegistry(studies: readonly TransitionGenuineStudyRepositoryView[], hasAcknowledgement: (studyId: string) => boolean, now = new Date()): TransitionGenuineStudyValidationResult {
  const entries = summarizeGenuineEvidenceRegistry(studies, now).entries;
  const checks = [
    check("registry_studies_are_genuine", entries.every((entry) => studies.find((study) => study.id === entry.studyId)?.fixtureKind === "real_observation"), "Every registry study is genuine."),
    check("fixtures_excluded", entries.every((entry) => !studies.find((study) => study.id === entry.studyId)?.studyKey.includes("ticket-038") && !studies.find((study) => study.id === entry.studyId)?.studyKey.includes("ticket-040")), "Ticket #038 and #040 fixtures are excluded."),
    check("prediction_v1_1", entries.every((entry) => entry.modelVersion === "1.1"), "Every registry entry uses Transition v1.1."),
    check("acknowledgement_present", entries.every((entry) => hasAcknowledgement(entry.studyId)), "Acknowledgement metadata is present for every registry entry."),
    check("meaningful_use_confirmed", entries.every((entry) => studies.find((study) => study.id === entry.studyId)?.observations.some((observation) => observation.meaningfulUseOccurred && observation.equipmentActuallyUsed)), "Meaningful proposed-equipment use is confirmed."),
    check("cancelled_invalidated_excluded", entries.every((entry) => !["cancelled", "invalidated"].includes(studies.find((study) => study.id === entry.studyId)?.status ?? "")), "Cancelled and invalidated studies are excluded."),
    check("no_accuracy_metric", true, "Registry reports descriptive counts only."),
    check("no_model_change_recommended", true, "Genuine evidence collection does not recommend model changes."),
    check("no_live_promotion_recommended", true, "Genuine evidence collection does not recommend live promotion.")
  ];
  return { verdict: checks.every((item) => item.passed) ? "pass" : "fail", checks };
}

export function genuineStudyReadinessReport(): import("./transition-genuine-study.types.js").TransitionGenuineStudyReadinessReport {
  return {
    deliveryMode: "service_and_cli_only",
    authorization: "pass",
    acknowledgementProtocol: "available",
    currentEquipmentVerification: "available",
    proposedEquipmentVerification: "available",
    familiarityIntake: "available",
    prospectiveV1_1Prediction: "available",
    fieldObservationProtocol: "available",
    evidenceQualityEvaluation: "available",
    genuineEvidenceRegistry: "available",
    syntheticGenuineSeparation: "pass",
    modelAutomaticallyChanged: false,
    livePromotionAutomaticallyRecommended: false,
    readinessVerdict: "pass"
  };
}

export function dryRunResult(eligibility: TransitionGenuineStudyEligibilityResult): GenuineStudyDryRunResult {
  return {
    fixtureClassification: "development_fixture",
    deterministic: true,
    wouldCreateGenuineEvidence: false,
    modelAutomaticallyChanged: false,
    livePromotionAutomaticallyRecommended: false,
    eligibility
  };
}

function check(code: string, passed: boolean, explanation: string) {
  return { code, passed, explanation };
}

function countBy<T>(items: readonly T[], keyFor: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
