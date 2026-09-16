import { evaluateCurrentEquipmentFamiliarity } from "@ninery/player-intelligence";
import {
  TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
  compareTransitionShadowStudyOutcome,
  createTransitionPredictionSnapshot,
  createTransitionShadowStudyKey,
  validateObservation,
  type TransitionAdjustmentObservation,
  type TransitionExtendedShadowStudy,
  type TransitionOutcomeComparison
} from "../extended-shadow/index.js";
import { evaluateTransitionCompatibilityV1_1 } from "../v1_1/index.js";
import { evaluateTransitionShadowAuthorization } from "./transition-shadow-admin.authorization.js";
import {
  checkpointStatusesForStudy,
  classifyTransitionShadowStudy,
  deriveTransitionShadowOperationalStage,
  transitionShadowObservationSummary,
  transitionShadowOutcomeCounts,
  validateTransitionShadowAdminNote
} from "./transition-shadow-admin.policy.js";
import {
  TRANSITION_SHADOW_ADMIN_DELIVERY_MODE,
  TRANSITION_SHADOW_ADMIN_WORKFLOW_VERSION,
  TRANSITION_SHADOW_AUDIT_EVENT_VERSION,
  TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION,
  type TransitionShadowAdminCapability,
  TransitionShadowAdminError,
  type TransitionShadowAuditAction,
  type TransitionShadowAuditEvent,
  type TransitionShadowCompletionReview,
  type TransitionShadowCreateDraftInput,
  type TransitionShadowEvidenceClassification,
  type TransitionShadowInternalActor,
  type TransitionShadowInvalidationReasonCode,
  type TransitionShadowOperationalSummary,
  type TransitionShadowPredictionCaptureInput,
  type TransitionShadowPredictionCaptureResult,
  type TransitionShadowAdminRepository,
  type TransitionShadowEquipmentIdentity,
  type TransitionShadowStudyAdminView,
  type TransitionShadowStudyEligibilityResult,
  type TransitionShadowStudyListFilters
} from "./transition-shadow-admin.types.js";

export class TransitionShadowAdminService {
  constructor(private readonly repository: TransitionShadowAdminRepository) {}

  async evaluateEligibility(input: TransitionShadowCreateDraftInput, actor: TransitionShadowInternalActor, evaluatedAt = new Date()): Promise<TransitionShadowStudyEligibilityResult> {
    const checks: TransitionShadowStudyEligibilityResult["checks"][number][] = [];
    const warnings: string[] = [];
    const authorization = evaluateTransitionShadowAuthorization({ actor, capability: "transition_shadow_study_create", evaluatedAt });
    checks.push({ code: "operator_authorized", passed: authorization.allowed, required: true, explanation: authorization.allowed ? "Operator has study creation capability." : authorization.blockers.join(" ") });
    const player = await this.repository.getPlayer(input.playerId);
    checks.push({ code: "player_exists", passed: !!player, required: true, explanation: player ? "Player was found." : "Player was not found." });
    checks.push({ code: "player_active", passed: !!player && player.status !== "archived", required: true, explanation: player && player.status !== "archived" ? "Player is usable." : "Player is archived or unavailable." });
    const hasPlayerDNA = player ? await this.repository.hasPlayerDNA(input.playerId) : false;
    checks.push({ code: "player_dna_available", passed: hasPlayerDNA, required: true, explanation: hasPlayerDNA ? "Player DNA is available." : "Player DNA is required before prediction capture." });
    const currentEquipment = await this.repository.getEquipment(input.currentEquipmentId);
    checks.push({ code: "current_equipment_exists", passed: !!currentEquipment, required: true, explanation: currentEquipment ? "Current equipment exists." : "Current equipment was not found." });
    const proposedEquipment = await this.repository.getEquipment(input.proposedEquipmentId);
    checks.push({ code: "proposed_equipment_exists", passed: !!proposedEquipment, required: true, explanation: proposedEquipment ? "Proposed equipment exists." : "Proposed equipment was not found." });
    const currentVariant = input.currentEquipmentVariantId ? await this.repository.getEquipmentVariant(input.currentEquipmentVariantId) : undefined;
    const proposedVariant = input.proposedEquipmentVariantId ? await this.repository.getEquipmentVariant(input.proposedEquipmentVariantId) : undefined;
    checks.push({ code: "current_variant_resolvable", passed: !input.currentEquipmentVariantId || (!!currentVariant && currentVariant.equipmentId === input.currentEquipmentId), required: true, explanation: !input.currentEquipmentVariantId || currentVariant ? "Current variant is resolvable." : "Current variant was not found." });
    checks.push({ code: "proposed_variant_resolvable", passed: !input.proposedEquipmentVariantId || (!!proposedVariant && proposedVariant.equipmentId === input.proposedEquipmentId), required: true, explanation: !input.proposedEquipmentVariantId || proposedVariant ? "Proposed variant is resolvable." : "Proposed variant was not found." });
    const sameSetup = (input.currentEquipmentVariantId ?? input.currentEquipmentId) === (input.proposedEquipmentVariantId ?? input.proposedEquipmentId);
    checks.push({ code: "not_accidentally_identical", passed: !sameSetup || !!input.allowSameEquipmentStudy, required: true, explanation: sameSetup ? "Same-equipment study must be explicitly intentional." : "Current and proposed setup differ." });
    const studyKey = createTransitionShadowStudyKey(input);
    const activeStudy = await this.repository.findActiveStudyByKey(studyKey);
    checks.push({ code: "no_conflicting_active_study", passed: !activeStudy, required: true, explanation: activeStudy ? "An active study already exists for this player/equipment/period." : "No active duplicate study exists." });
    if (input.evidenceClassification === "genuine_internal_observation" && (player?.synthetic || currentEquipment?.synthetic || proposedEquipment?.synthetic)) {
      checks.push({ code: "genuine_not_based_on_synthetic", passed: false, required: true, explanation: "Genuine studies cannot use synthetic players or equipment." });
    } else {
      checks.push({ code: "genuine_not_based_on_synthetic", passed: true, required: true, explanation: "Synthetic/genuine classification is consistent." });
    }
    const familiarity = evaluateCurrentEquipmentFamiliarity(input.familiarityInput);
    if (familiarity.level === "unknown") warnings.push("Current-equipment familiarity is incomplete.");
    const noteWarnings = validateTransitionShadowAdminNote(input.internalNote);
    for (const warning of noteWarnings) warnings.push(warning);
    const blockers = checks.filter((check) => check.required && !check.passed).map((check) => check.explanation);
    return {
      version: "1.0",
      playerId: input.playerId,
      currentEquipmentId: input.currentEquipmentId,
      currentEquipmentVariantId: input.currentEquipmentVariantId,
      proposedEquipmentId: input.proposedEquipmentId,
      proposedEquipmentVariantId: input.proposedEquipmentVariantId,
      eligible: blockers.length === 0,
      checks,
      blockers,
      warnings,
      evaluatedAt
    };
  }

  async createTransitionShadowStudyDraft(input: TransitionShadowCreateDraftInput, actor: TransitionShadowInternalActor): Promise<{ readonly study: TransitionExtendedShadowStudy; readonly eligibility: TransitionShadowStudyEligibilityResult }> {
    this.requireCapability(actor, "transition_shadow_study_create", input.createdAt);
    if (input.evidenceClassification === "genuine_internal_observation" && !input.captureOrigin) throw new TransitionShadowAdminError("SYNTHETIC_GENUINE_MISMATCH", "Genuine studies require a capture origin.");
    const eligibility = await this.evaluateEligibility(input, actor, input.createdAt);
    if (!eligibility.eligible) throw new TransitionShadowAdminError(eligibility.blockers.some((blocker) => /active study/i.test(blocker)) ? "ACTIVE_STUDY_EXISTS" : "STUDY_NOT_ELIGIBLE", eligibility.blockers.join(" "));
    const familiarity = evaluateCurrentEquipmentFamiliarity(input.familiarityInput);
    const study: TransitionExtendedShadowStudy = {
      version: TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
      id: input.id,
      studyKey: createTransitionShadowStudyKey(input),
      playerId: input.playerId,
      currentEquipmentId: input.currentEquipmentId,
      currentEquipmentVariantId: input.currentEquipmentVariantId,
      proposedEquipmentId: input.proposedEquipmentId,
      proposedEquipmentVariantId: input.proposedEquipmentVariantId,
      status: "draft",
      familiarity,
      observations: [],
      fixtureKind: input.evidenceClassification === "development_fixture" ? "development_fixture" : "real_observation",
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
    const saved = await this.repository.createStudy(study);
    await this.audit("study_draft_created", actor, "transition_shadow_study_create", saved, input.createdAt, {
      afterSummary: lifecycleSummary(saved),
      metadata: { workflowVersion: TRANSITION_SHADOW_ADMIN_WORKFLOW_VERSION, deliveryMode: TRANSITION_SHADOW_ADMIN_DELIVERY_MODE, evidenceClassification: input.evidenceClassification, studyPurpose: input.studyPurpose, captureOrigin: input.captureOrigin }
    });
    return { study: saved, eligibility };
  }

  async captureTransitionShadowPrediction(input: TransitionShadowPredictionCaptureInput, actor: TransitionShadowInternalActor): Promise<TransitionShadowPredictionCaptureResult> {
    this.requireCapability(actor, "transition_shadow_prediction_capture", input.predictedAt);
    const study = await this.requiredStudy(input.studyId);
    if (study.status !== "draft") throw new TransitionShadowAdminError(study.prediction ? "PREDICTION_ALREADY_CAPTURED" : "INVALID_STATUS_TRANSITION", "Prediction can only be captured from draft status.");
    if (study.prediction) throw new TransitionShadowAdminError("PREDICTION_ALREADY_CAPTURED", "Prediction is already captured and immutable.");
    const result = evaluateTransitionCompatibilityV1_1({ ...input.compatibilityInput, evaluatedAt: input.predictedAt });
    if (result.status !== "completed" || result.score === undefined || result.band === undefined) throw new TransitionShadowAdminError("PREDICTION_BLOCKED", `Transition v1.1 prediction did not complete: ${result.status}.`);
    const prediction = createTransitionPredictionSnapshot(result, input.familiarity, input.predictedAt);
    const updated = await this.repository.updateStudy({ ...study, status: "prediction_captured", prediction, updatedAt: input.predictedAt }, study.updatedAt);
    await this.audit("prediction_captured", actor, "transition_shadow_prediction_capture", updated, input.predictedAt, {
      beforeSummary: lifecycleSummary(study),
      afterSummary: lifecycleSummary(updated),
      metadata: { transitionModelVersion: prediction.transitionModelVersion, predictionHash: prediction.predictionHash }
    });
    return { study: updated, prediction: result, reasons: result.reasons, tradeoffs: result.tradeoffs, missingInformation: result.missingInformation };
  }

  async startTransitionShadowObservation(studyId: string, input: { readonly startedAt: Date }, actor: TransitionShadowInternalActor): Promise<TransitionExtendedShadowStudy> {
    this.requireCapability(actor, "transition_shadow_observation_add", input.startedAt);
    const study = await this.requiredStudy(studyId);
    if (study.status !== "prediction_captured" || !study.prediction) throw new TransitionShadowAdminError("INVALID_STATUS_TRANSITION", "Observation can only start after prediction capture.");
    const updated = await this.repository.updateStudy({ ...study, status: "observation_active", observationWindowStartedAt: input.startedAt, updatedAt: input.startedAt }, study.updatedAt);
    await this.audit("observation_started", actor, "transition_shadow_observation_add", updated, input.startedAt, { beforeSummary: lifecycleSummary(study), afterSummary: lifecycleSummary(updated) });
    return updated;
  }

  async addTransitionShadowObservation(studyId: string, observation: TransitionAdjustmentObservation, actor: TransitionShadowInternalActor): Promise<TransitionExtendedShadowStudy> {
    this.requireCapability(actor, "transition_shadow_observation_add", observation.observedAt);
    const study = await this.requiredStudy(studyId);
    if (study.status !== "observation_active") throw new TransitionShadowAdminError("OBSERVATION_WINDOW_NOT_ACTIVE", "Observation window is not active.");
    try {
      validateObservation(study, observation);
    } catch (error) {
      throw new TransitionShadowAdminError("OBSERVATION_INVALID", error instanceof Error ? error.message : "Observation is invalid.");
    }
    const noteWarnings = validateTransitionShadowAdminNote(observation.notes);
    if (noteWarnings.length) throw new TransitionShadowAdminError("OBSERVATION_INVALID", noteWarnings.join(" "));
    const updated = await this.repository.updateStudy({ ...study, observations: [...study.observations, observation], updatedAt: observation.observedAt }, study.updatedAt);
    await this.audit("observation_added", actor, "transition_shadow_observation_add", updated, observation.observedAt, {
      beforeSummary: { observationCount: study.observations.length },
      afterSummary: { observationCount: updated.observations.length, checkpoint: observation.checkpoint, source: observation.source, confidence: observation.observationConfidence }
    });
    return updated;
  }

  async reviewTransitionShadowStudyForCompletion(studyId: string, actor: TransitionShadowInternalActor, reviewedAt = new Date()): Promise<TransitionShadowCompletionReview> {
    this.requireCapability(actor, "transition_shadow_study_complete", reviewedAt);
    const study = await this.requiredStudy(studyId);
    const checkpointStatuses = checkpointStatusesForStudy(study, reviewedAt);
    const meaningfulUseObservationCount = study.observations.filter((observation) => observation.meaningfulUseOccurred && observation.equipmentActuallyUsed).length;
    const unresolvedConflicts = study.observations.some((observation) => observation.conflictsWithAnotherSource);
    const lowConfidence = study.observations.some((observation) => observation.observationConfidence === "low");
    const warnings: string[] = [];
    const blockers: string[] = [];
    if (study.status !== "observation_active") blockers.push("Study must be observation_active for completion.");
    if (!meaningfulUseObservationCount) warnings.push("No meaningful-use observation is available.");
    if (unresolvedConflicts) warnings.push("Observation sources materially conflict.");
    const comparison = study.prediction ? compareTransitionShadowStudyOutcome(study, reviewedAt) : undefined;
    return {
      studyId,
      meaningfulUseObservationCount,
      checkpointStatuses,
      unresolvedConflicts,
      observationConfidence: lowConfidence ? "low" : study.observations.length > 1 ? "high" : "moderate",
      outcomeComparison: comparison,
      completionEligible: blockers.length === 0 && meaningfulUseObservationCount > 0 && !unresolvedConflicts,
      warnings,
      blockers,
      overrideReasonRequired: meaningfulUseObservationCount === 0 || unresolvedConflicts,
      reviewedAt
    };
  }

  async completeTransitionShadowStudy(studyId: string, input: { readonly completedAt: Date; readonly overrideReason?: string }, actor: TransitionShadowInternalActor): Promise<TransitionExtendedShadowStudy> {
    const review = await this.reviewTransitionShadowStudyForCompletion(studyId, actor, input.completedAt);
    if (review.blockers.length) throw new TransitionShadowAdminError("INVALID_STATUS_TRANSITION", review.blockers.join(" "));
    if (!review.completionEligible && !input.overrideReason) throw new TransitionShadowAdminError("COMPLETION_REQUIREMENTS_NOT_MET", "Completion requires sufficient evidence or an explicit administrative override reason.");
    const study = await this.requiredStudy(studyId);
    const updated = await this.repository.updateStudy({ ...study, status: "observation_complete", observationWindowCompletedAt: input.completedAt, updatedAt: input.completedAt }, study.updatedAt);
    await this.audit("study_completed", actor, "transition_shadow_study_complete", updated, input.completedAt, {
      beforeSummary: lifecycleSummary(study),
      afterSummary: { ...lifecycleSummary(updated), comparisonStatus: review.outcomeComparison?.comparisonStatus },
      reason: input.overrideReason
    });
    return updated;
  }

  async cancelTransitionShadowStudy(studyId: string, reason: string, actor: TransitionShadowInternalActor, cancelledAt = new Date()): Promise<TransitionExtendedShadowStudy> {
    this.requireCapability(actor, "transition_shadow_study_cancel", cancelledAt);
    if (!reason.trim()) throw new TransitionShadowAdminError("CANCELLATION_REASON_REQUIRED", "Cancellation reason is required.");
    const study = await this.requiredStudy(studyId);
    if (!["draft", "prediction_captured", "observation_active"].includes(study.status)) throw new TransitionShadowAdminError("INVALID_STATUS_TRANSITION", "Study cannot be cancelled from its current status.");
    const updated = await this.repository.updateStudy({ ...study, status: "cancelled", cancellationReason: reason, updatedAt: cancelledAt }, study.updatedAt);
    await this.audit("study_cancelled", actor, "transition_shadow_study_cancel", updated, cancelledAt, { beforeSummary: lifecycleSummary(study), afterSummary: lifecycleSummary(updated), reason });
    return updated;
  }

  async invalidateTransitionShadowStudy(studyId: string, input: { readonly reasonCode: TransitionShadowInvalidationReasonCode; readonly detail: string; readonly invalidatedAt: Date }, actor: TransitionShadowInternalActor): Promise<TransitionExtendedShadowStudy> {
    this.requireCapability(actor, "transition_shadow_study_invalidate", input.invalidatedAt);
    if (!input.detail.trim()) throw new TransitionShadowAdminError("INVALIDATION_REASON_REQUIRED", "Invalidation detail is required.");
    const study = await this.requiredStudy(studyId);
    const updated = await this.repository.updateStudy({ ...study, status: "invalidated", invalidationReason: `${input.reasonCode}: ${input.detail}`, updatedAt: input.invalidatedAt }, study.updatedAt);
    await this.audit("study_invalidated", actor, "transition_shadow_study_invalidate", updated, input.invalidatedAt, { beforeSummary: lifecycleSummary(study), afterSummary: lifecycleSummary(updated), reason: input.detail, metadata: { reasonCode: input.reasonCode } });
    return updated;
  }

  async getStudyAdminView(studyId: string, actor: TransitionShadowInternalActor, viewedAt = new Date()): Promise<TransitionShadowStudyAdminView> {
    const study = await this.requiredStudy(studyId);
    const classification = classifyTransitionShadowStudy(study);
    this.requireCapability(actor, "transition_shadow_study_view", viewedAt, classification === "development_fixture");
    const [player, currentEquipment, proposedEquipment, audits] = await Promise.all([
      this.repository.getPlayer(study.playerId),
      this.repository.getEquipment(study.currentEquipmentId),
      this.repository.getEquipment(study.proposedEquipmentId),
      this.repository.listAuditEvents(study.id)
    ]);
    const comparison = study.prediction && ["observation_complete", "invalidated"].includes(study.status) ? compareTransitionShadowStudyOutcome(study, viewedAt) : undefined;
    const observationSummary = transitionShadowObservationSummary(study);
    return {
      study,
      evidenceClassification: classification,
      playerSummary: { playerId: study.playerId, displayLabel: player?.label },
      currentEquipmentSummary: equipmentIdentity(study.currentEquipmentId, study.currentEquipmentVariantId, currentEquipment?.label),
      proposedEquipmentSummary: equipmentIdentity(study.proposedEquipmentId, study.proposedEquipmentVariantId, proposedEquipment?.label),
      familiaritySummary: study.familiarity,
      predictionSummary: study.prediction ? { score: study.prediction.predictedScore, band: study.prediction.predictedBand, confidence: study.prediction.predictedConfidence, predictedAt: study.prediction.predictedAt, modelVersion: study.prediction.transitionModelVersion } : undefined,
      checkpointStatuses: checkpointStatusesForStudy(study, viewedAt),
      observationSummary,
      outcomeComparison: comparison,
      lifecycleActions: lifecycleActions(study, actor, viewedAt),
      auditSummary: { eventCount: audits.length, latestEventAt: audits[0]?.createdAt },
    };
  }

  async listStudies(filters: TransitionShadowStudyListFilters = {}): Promise<readonly TransitionExtendedShadowStudy[]> {
    return this.repository.listStudies({ ...filters, includeSynthetic: filters.includeSynthetic ?? false });
  }

  async operationalSummary(generatedAt = new Date()): Promise<TransitionShadowOperationalSummary> {
    const studies = await this.repository.listStudies({ includeSynthetic: true });
    const comparisons: TransitionOutcomeComparison[] = [];
    for (const study of studies) if (study.prediction && ["observation_complete", "invalidated"].includes(study.status)) comparisons.push(compareTransitionShadowStudyOutcome(study, generatedAt));
    const checkpoints = studies.flatMap((study) => checkpointStatusesForStudy(study, generatedAt));
    const genuine = studies.filter((study) => classifyTransitionShadowStudy(study) === "genuine_internal_observation");
    const synthetic = studies.length - genuine.length;
    return {
      version: TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION,
      studyCounts: {
        total: studies.length,
        genuine: genuine.length,
        synthetic,
        draft: countStatus(studies, "draft"),
        predictionCaptured: countStatus(studies, "prediction_captured"),
        observationActive: countStatus(studies, "observation_active"),
        observationComplete: countStatus(studies, "observation_complete"),
        cancelled: countStatus(studies, "cancelled"),
        invalidated: countStatus(studies, "invalidated")
      },
      checkpointCounts: {
        due: checkpoints.filter((checkpoint) => checkpoint.status === "due").length,
        missing: checkpoints.filter((checkpoint) => checkpoint.status === "missing").length,
        completed: checkpoints.filter((checkpoint) => checkpoint.status === "completed").length,
        lowConfidence: checkpoints.filter((checkpoint) => checkpoint.status === "completed_low_confidence").length
      },
      outcomeCounts: transitionShadowOutcomeCounts(comparisons),
      conflictCount: studies.filter((study) => study.observations.some((observation) => observation.conflictsWithAnotherSource)).length,
      insufficientObservationCount: comparisons.filter((comparison) => comparison.comparisonStatus === "insufficient_observation").length,
      modelVersions: studies.reduce<Record<string, number>>((counts, study) => {
        const version = study.prediction?.transitionModelVersion ?? "none";
        counts[version] = (counts[version] ?? 0) + 1;
        return counts;
      }, {}),
      generatedAt
    };
  }

  private requireCapability(actor: TransitionShadowInternalActor | undefined, capability: TransitionShadowAdminCapability, evaluatedAt: Date, requiresFixtureAccess = false) {
    const decision = evaluateTransitionShadowAuthorization({ actor, capability, requiresFixtureAccess, evaluatedAt });
    if (!decision.allowed) throw new TransitionShadowAdminError("UNAUTHORIZED", decision.blockers.join(" "));
  }

  private async requiredStudy(studyId: string): Promise<TransitionExtendedShadowStudy> {
    const study = await this.repository.getStudy(studyId);
    if (!study) throw new TransitionShadowAdminError("STUDY_NOT_FOUND", `Transition shadow study ${studyId} was not found.`);
    return study;
  }

  private async audit(action: TransitionShadowAuditAction, actor: TransitionShadowInternalActor, capability: TransitionShadowAdminCapability, study: TransitionExtendedShadowStudy, createdAt: Date, details: { readonly reason?: string; readonly beforeSummary?: Record<string, unknown>; readonly afterSummary?: Record<string, unknown>; readonly metadata?: Record<string, unknown> } = {}) {
    await this.repository.writeAuditEvent({
      version: TRANSITION_SHADOW_AUDIT_EVENT_VERSION,
      id: `${study.id}:${action}:${createdAt.toISOString()}`,
      studyId: study.id,
      studyKey: study.studyKey,
      actorId: actor.actorId,
      actorRole: actor.roleCodes[0],
      capability,
      action,
      reason: details.reason,
      beforeSummary: details.beforeSummary,
      afterSummary: details.afterSummary,
      metadata: details.metadata,
      createdAt
    });
  }
}

export function observationCorrectionPolicy() {
  return {
    policy: "append_only",
    explanation: "Observation corrections are captured as additional observations plus audit context. Existing observation content is not silently overwritten.",
    correctionReasonRequired: true,
    originalTimestampPreserved: true
  } as const;
}

function lifecycleSummary(study: TransitionExtendedShadowStudy) {
  return {
    status: study.status,
    playerId: study.playerId,
    currentEquipmentId: study.currentEquipmentId,
    currentEquipmentVariantId: study.currentEquipmentVariantId,
    proposedEquipmentId: study.proposedEquipmentId,
    proposedEquipmentVariantId: study.proposedEquipmentVariantId,
    predictionHash: study.prediction?.predictionHash,
    observationCount: study.observations.length
  };
}

function lifecycleActions(study: TransitionExtendedShadowStudy, actor: TransitionShadowInternalActor, evaluatedAt: Date) {
  return [
    action("capture_prediction", actor, "transition_shadow_prediction_capture", study.status === "draft" && !study.prediction, evaluatedAt),
    action("start_observation", actor, "transition_shadow_observation_add", study.status === "prediction_captured" && !!study.prediction, evaluatedAt),
    action("add_observation", actor, "transition_shadow_observation_add", study.status === "observation_active", evaluatedAt),
    action("complete", actor, "transition_shadow_study_complete", study.status === "observation_active", evaluatedAt),
    action("cancel", actor, "transition_shadow_study_cancel", ["draft", "prediction_captured", "observation_active"].includes(study.status), evaluatedAt),
    action("invalidate", actor, "transition_shadow_study_invalidate", study.status !== "invalidated", evaluatedAt)
  ];
}

function action(name: string, actor: TransitionShadowInternalActor, capability: TransitionShadowAdminCapability, statusAllowed: boolean, evaluatedAt: Date) {
  const decision = evaluateTransitionShadowAuthorization({ actor, capability, evaluatedAt });
  const blockers = [...decision.blockers, ...(statusAllowed ? [] : ["Study status blocks this action."])];
  return { action: name, allowed: decision.allowed && statusAllowed, blockers };
}

function equipmentIdentity(equipmentId: string, equipmentVariantId: string | undefined, label?: string): TransitionShadowEquipmentIdentity {
  return { equipmentId, equipmentVariantId, label, variantLabel: equipmentVariantId };
}

function countStatus(studies: readonly TransitionExtendedShadowStudy[], status: TransitionExtendedShadowStudy["status"]) {
  return studies.filter((study) => study.status === status).length;
}
