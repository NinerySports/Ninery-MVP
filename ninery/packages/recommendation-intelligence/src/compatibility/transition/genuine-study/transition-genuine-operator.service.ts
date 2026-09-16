import { evaluateCurrentEquipmentFamiliarity } from "@ninery/player-intelligence";
import {
  TransitionShadowAdminError,
  TransitionShadowAdminService,
  checkpointStatusesForStudy,
  classifyTransitionShadowStudy,
  type TransitionShadowAdminRepository
} from "../admin/index.js";
import type { TransitionExtendedShadowStudy } from "../extended-shadow/index.js";
import {
  TransitionGenuineStudyIntakeService
} from "./transition-genuine-study.service.js";
import {
  evaluateFieldObservationReadiness,
  evaluateObservationEvidenceQuality,
  registryEntryForStudy
} from "./transition-genuine-study.policy.js";
import {
  evaluateTransitionGenuineOperatorEnvironment,
  resolveTransitionGenuineOperatorActor
} from "./transition-genuine-operator.policy.js";
import {
  TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION,
  TRANSITION_GENUINE_OBSERVATION_ENTRY_VERSION,
  TransitionGenuineOperatorError,
  type GenuineTransitionOperatorIntakeInput,
  type TransitionGenuineObservationEntryInput,
  type TransitionGenuineOperatorCancelInput,
  type TransitionGenuineOperatorCompletionResult,
  type TransitionGenuineOperatorContext,
  type TransitionGenuineOperatorCreateResult,
  type TransitionGenuineOperatorInvalidateInput,
  type TransitionGenuineOperatorPredictionInput,
  type TransitionGenuineOperatorPredictionResult,
  type TransitionGenuineOperatorPrepareResult,
  type TransitionGenuineOperatorReview,
  type TransitionGenuineOperatorServiceInput,
  type TransitionGenuineOperatorStudyView
} from "./transition-genuine-operator.types.js";

export class TransitionGenuineOperatorService {
  private readonly adminService: TransitionShadowAdminService;
  private readonly genuineService: TransitionGenuineStudyIntakeService;
  private readonly actorResolver: NonNullable<TransitionGenuineOperatorServiceInput["actorResolver"]>;
  private readonly contextLoader: TransitionGenuineOperatorServiceInput["contextLoader"];

  constructor(private readonly repository: TransitionShadowAdminRepository, options: TransitionGenuineOperatorServiceInput = {}) {
    this.adminService = new TransitionShadowAdminService(repository);
    this.genuineService = new TransitionGenuineStudyIntakeService(repository);
    this.actorResolver = options.actorResolver ?? resolveTransitionGenuineOperatorActor;
    this.contextLoader = options.contextLoader;
  }

  async prepareIntake(input: GenuineTransitionOperatorIntakeInput, context: TransitionGenuineOperatorContext = {}): Promise<TransitionGenuineOperatorPrepareResult> {
    const actor = this.requireActor(context.actorId);
    if (input.actorId !== actor.actorId) throw new TransitionGenuineOperatorError("UNAUTHORIZED", "Intake actorId must match the authorized command actor.");
    this.requireEnvironment(context.environment);
    const eligibility = await this.genuineService.evaluateGenuineStudyEligibility(input, actor, input.createdAt);
    return {
      version: TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION,
      actor,
      review: this.reviewFromEligibility(input, eligibility),
      wouldPersist: false
    };
  }

  async createGenuineStudyFromOperatorIntake(input: GenuineTransitionOperatorIntakeInput, context: TransitionGenuineOperatorContext & { readonly confirmGenuineStudy?: boolean; readonly dryRun?: boolean } = {}): Promise<TransitionGenuineOperatorCreateResult> {
    const prepared = await this.prepareIntake(input, context);
    if (context.dryRun) return { version: "1.0", dryRun: true, confirmed: false, review: prepared.review, persisted: false };
    if (!context.confirmGenuineStudy) throw new TransitionGenuineOperatorError("CONFIRMATION_REQUIRED", "Use --confirm-genuine-study to commit genuine study creation.");
    if (!prepared.review.readyToCommit) throw new TransitionGenuineOperatorError("INPUT_VALIDATION_FAILED", `Genuine study intake is not ready to commit. ${prepared.review.blockers.join(" ")}`, prepared.review.blockers);
    const created = await this.genuineService.createGenuineTransitionShadowStudy(input, prepared.actor);
    return { version: "1.0", dryRun: false, confirmed: true, review: prepared.review, studyId: created.studyId, persisted: true };
  }

  async capturePrediction(input: TransitionGenuineOperatorPredictionInput, context: TransitionGenuineOperatorContext = {}): Promise<TransitionGenuineOperatorPredictionResult> {
    const actor = this.requireActor(context.actorId ?? input.actorId);
    this.requireEnvironment(context.environment);
    const study = await this.requireGenuineStudy(input.studyId);
    if (study.status !== "draft") throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction can only be captured for a genuine draft study.");
    if (study.observations.length) throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction must be captured before observations.");
    const inputAssembly = input.compatibilityInput ? undefined : await this.assemblePredictionInput(input.studyId, input.predictedAt);
    const inputReview = inputAssembly ? this.contextLoader?.reviewAssembly(inputAssembly) : undefined;
    if (!input.compatibilityInput && !input.confirm) throw new TransitionGenuineOperatorError("CONFIRMATION_REQUIRED", "Use --confirm to capture an assembled genuine transition prediction.");
    if (input.compatibilityInput && !input.manualInputOverride) throw new TransitionGenuineOperatorError("CONFIRMATION_REQUIRED", "Manual prediction inputs are a development override. Use --manual-input-override with --file.");
    if (inputAssembly && !inputAssembly.ready) throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction input context is not ready.", inputAssembly.blockers.map((blocker) => blocker.message));
    const compatibilityInput = input.compatibilityInput ?? inputAssembly?.input;
    if (!compatibilityInput) throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction input could not be assembled.");
    const result = await this.adminService.captureTransitionShadowPrediction({
      studyId: input.studyId,
      compatibilityInput,
      familiarity: study.familiarity,
      predictedAt: input.predictedAt
    }, actor);
    return {
      score: result.prediction.score ?? 0,
      band: result.prediction.band ?? "unknown",
      confidence: result.prediction.confidence,
      modelVersion: "1.1",
      missingInformation: result.missingInformation,
      reasons: result.reasons,
      tradeoffs: result.tradeoffs,
      predictionHash: result.study.prediction?.predictionHash,
      inputAssembly,
      inputReview,
      manualInputOverride: !!input.compatibilityInput
    };
  }

  async assemblePredictionInput(studyId: string, assembledAt = new Date()) {
    if (!this.contextLoader) throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction context loader is not configured.");
    return this.contextLoader.assemblePredictionInput({ studyId, mode: "capture", assembledAt });
  }

  async predictionInputReview(studyId: string, assembledAt = new Date()) {
    if (!this.contextLoader) throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction context loader is not configured.");
    return this.contextLoader.reviewAssembly(await this.contextLoader.assemblePredictionInput({ studyId, mode: "diagnostic", assembledAt }));
  }

  async predictionDryRun(studyId: string, assembledAt = new Date()) {
    if (!this.contextLoader) throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction context loader is not configured.");
    return this.contextLoader.dryRunPrediction({ studyId, mode: "diagnostic", assembledAt });
  }

  async contextDrift(studyId: string, evaluatedAt = new Date()) {
    if (!this.contextLoader) throw new TransitionGenuineOperatorError("PREDICTION_NOT_READY", "Prediction context loader is not configured.");
    return this.contextLoader.evaluateContextDrift(studyId, evaluatedAt);
  }

  async observationReadiness(studyId: string, observerPlanPresent = true) {
    const study = await this.requireGenuineStudy(studyId);
    return evaluateFieldObservationReadiness(studyView(study), await this.hasAcknowledgement(studyId), observerPlanPresent);
  }

  async startObservation(studyId: string, actorId: string, input: { readonly confirm?: boolean; readonly startedAt: Date }, context: TransitionGenuineOperatorContext = {}) {
    const actor = this.requireActor(context.actorId ?? actorId);
    this.requireEnvironment(context.environment);
    if (!input.confirm) throw new TransitionGenuineOperatorError("CONFIRMATION_REQUIRED", "Use --confirm to start the observation window.");
    const readiness = await this.observationReadiness(studyId, true);
    if (!readiness.ready) throw new TransitionGenuineOperatorError("OBSERVATION_NOT_READY", "Observation readiness checks did not pass.", readiness.blockers);
    return this.adminService.startTransitionShadowObservation(studyId, { startedAt: input.startedAt }, actor);
  }

  async addObservation(input: TransitionGenuineObservationEntryInput, context: TransitionGenuineOperatorContext = {}) {
    const actor = this.requireActor(context.actorId ?? input.actorId);
    this.requireEnvironment(context.environment);
    const study = await this.requireGenuineStudy(input.studyId);
    if (study.status !== "observation_active") throw new TransitionGenuineOperatorError("OBSERVATION_NOT_READY", "Study must be observation_active before observations can be added.");
    if (!input.observation.source) throw new TransitionGenuineOperatorError("INPUT_VALIDATION_FAILED", "Observation source is required.");
    if (input.observation.observedAt <= (study.prediction?.predictedAt ?? study.createdAt)) throw new TransitionGenuineOperatorError("INPUT_VALIDATION_FAILED", "Observation timestamp must be after prediction capture.");
    const updated = await this.adminService.addTransitionShadowObservation(input.studyId, input.observation, actor);
    return {
      version: TRANSITION_GENUINE_OBSERVATION_ENTRY_VERSION,
      studyId: updated.id,
      observationCount: updated.observations.length,
      checkpoint: input.observation.checkpoint,
      appendOnly: true as const
    };
  }

  async correctObservation(input: TransitionGenuineObservationEntryInput, context: TransitionGenuineOperatorContext = {}) {
    if (!input.correctionReason?.trim()) throw new TransitionGenuineOperatorError("CORRECTION_REASON_REQUIRED", "Observation correction requires a reason.");
    return this.addObservation({
      ...input,
      observation: {
        ...input.observation,
        sourceReference: input.observation.sourceReference ? `correction:${input.observation.sourceReference}` : "correction",
        notes: input.observation.notes
      }
    }, context);
  }

  async checkpoints(studyId: string, now = new Date()) {
    const study = await this.requireGenuineStudy(studyId);
    return checkpointStatusesForStudy(study, now);
  }

  async completionReview(studyId: string, actorId: string, context: TransitionGenuineOperatorContext = {}) {
    const actor = this.requireActor(context.actorId ?? actorId);
    const study = await this.requireGenuineStudy(studyId);
    const review = await this.adminService.reviewTransitionShadowStudyForCompletion(studyId, actor);
    const quality = evaluateObservationEvidenceQuality(studyView(study));
    return { review, evidenceQuality: quality, registryEligible: !!registryEntryForStudy(studyView(study)) };
  }

  async completeStudy(studyId: string, input: { readonly actorId: string; readonly confirm?: boolean; readonly completedAt: Date; readonly overrideReason?: string }, context: TransitionGenuineOperatorContext = {}): Promise<TransitionGenuineOperatorCompletionResult> {
    const actor = this.requireActor(context.actorId ?? input.actorId);
    this.requireEnvironment(context.environment);
    if (!input.confirm) throw new TransitionGenuineOperatorError("CONFIRMATION_REQUIRED", "Use --confirm to complete a genuine transition study.");
    const review = await this.adminService.reviewTransitionShadowStudyForCompletion(studyId, actor, input.completedAt);
    const completed = await this.adminService.completeTransitionShadowStudy(studyId, { completedAt: input.completedAt, overrideReason: input.overrideReason }, actor);
    return { studyId: completed.id, completed: completed.status === "observation_complete", review };
  }

  async cancelStudy(input: TransitionGenuineOperatorCancelInput, context: TransitionGenuineOperatorContext = {}) {
    const actor = this.requireActor(context.actorId ?? input.actorId);
    this.requireEnvironment(context.environment);
    return this.adminService.cancelTransitionShadowStudy(input.studyId, input.reason, actor, input.cancelledAt);
  }

  async invalidateStudy(input: TransitionGenuineOperatorInvalidateInput, context: TransitionGenuineOperatorContext = {}) {
    const actor = this.requireActor(context.actorId ?? input.actorId);
    this.requireEnvironment(context.environment);
    return this.adminService.invalidateTransitionShadowStudy(input.studyId, { reasonCode: input.reasonCode, detail: input.reason, invalidatedAt: input.invalidatedAt }, actor);
  }

  async showStudy(studyId: string, actorId = "transition-operator"): Promise<TransitionGenuineOperatorStudyView> {
    const actor = this.requireActor(actorId);
    const view = await this.adminService.getStudyAdminView(studyId, actor);
    const study = await this.requireGenuineStudy(studyId);
    return { ...view, acknowledgementPresent: await this.hasAcknowledgement(studyId), registryEligible: !!registryEntryForStudy(studyView(study)) };
  }

  async listStudies() {
    return this.adminService.listStudies();
  }

  async audit(studyId: string) {
    return this.repository.listAuditEvents(studyId);
  }

  private reviewFromEligibility(input: GenuineTransitionOperatorIntakeInput, eligibility: Awaited<ReturnType<TransitionGenuineStudyIntakeService["evaluateGenuineStudyEligibility"]>>): TransitionGenuineOperatorReview {
    const checkPassed = (code: string) => eligibility.checks.some((check) => check.code === code && check.passed);
    const duplicate = eligibility.adminEligibility?.checks.find((check) => check.code === "no_conflicting_active_study");
    const familiarity = evaluateCurrentEquipmentFamiliarity(input.familiarityInput);
    const actorAuthorized = checkPassed("authorized_internal_operator");
    const environmentAllowed = true;
    return {
      version: "1.0",
      evidenceClassification: "genuine_internal_observation",
      actorAuthorized,
      environmentAllowed,
      player: eligibility.adminEligibility?.checks.find((check) => check.code === "player_exists")?.passed ? "verified" : "blocked",
      currentEquipment: checkPassed("current_equipment_identified") && eligibility.adminEligibility?.checks.find((check) => check.code === "current_equipment_exists")?.passed ? "verified" : "blocked",
      currentVariant: checkPassed("current_variant_identified") && eligibility.adminEligibility?.checks.find((check) => check.code === "current_variant_resolvable")?.passed ? "verified" : "blocked",
      proposedEquipment: checkPassed("proposed_equipment_identified") && eligibility.adminEligibility?.checks.find((check) => check.code === "proposed_equipment_exists")?.passed ? "verified" : "blocked",
      proposedVariant: checkPassed("proposed_variant_identified") && eligibility.adminEligibility?.checks.find((check) => check.code === "proposed_variant_resolvable")?.passed ? "verified" : "blocked",
      acknowledgement: checkPassed("participation_acknowledgement_captured") ? "captured" : "missing",
      familiarity: { level: familiarity.level, confidence: familiarity.confidence },
      playerDNA: checkPassed("transition_v1_1_prediction_possible") ? "available" : "blocked",
      transitionV1_1Dependencies: checkPassed("transition_v1_1_prediction_possible") ? "ready" : "blocked",
      duplicateActiveStudy: duplicate?.passed === false ? "yes" : "no",
      prospectiveStudy: checkPassed("not_retrospective") ? "yes" : "no",
      syntheticFixture: eligibility.adminEligibility?.checks.find((check) => check.code === "genuine_not_based_on_synthetic")?.passed === false ? "yes" : "no",
      warnings: eligibility.warnings,
      blockers: eligibility.blockers,
      readyToCommit: eligibility.eligible,
      eligibility
    };
  }

  private requireActor(actorId: string | undefined) {
    const actor = this.actorResolver(actorId ?? "");
    if (!actor) throw new TransitionGenuineOperatorError("UNAUTHORIZED", "UNAUTHORIZED: an authorized internal actor is required.");
    return actor;
  }

  private requireEnvironment(environment?: string) {
    const decision = evaluateTransitionGenuineOperatorEnvironment(environment);
    if (!decision.allowed) throw new TransitionGenuineOperatorError("UNSUPPORTED_ENVIRONMENT", decision.blockers.join(" "), decision.blockers);
  }

  private async requireGenuineStudy(studyId: string): Promise<TransitionExtendedShadowStudy> {
    const study = await this.repository.getStudy(studyId);
    if (!study) throw new TransitionShadowAdminError("STUDY_NOT_FOUND", `Study ${studyId} was not found.`);
    if (classifyTransitionShadowStudy(study) !== "genuine_internal_observation") throw new TransitionGenuineOperatorError("STUDY_NOT_GENUINE", "Study is not genuine_internal_observation.");
    return study;
  }

  private async hasAcknowledgement(studyId: string) {
    const events = await this.repository.listAuditEvents(studyId);
    return events.some((event) => event.metadata?.genuineIntakeVersion === "1.0" || event.metadata?.acknowledgementVersion === "1.0");
  }
}

function studyView(study: TransitionExtendedShadowStudy) {
  return {
    id: study.id,
    studyKey: study.studyKey,
    playerId: study.playerId,
    currentEquipmentId: study.currentEquipmentId,
    currentEquipmentVariantId: study.currentEquipmentVariantId,
    proposedEquipmentId: study.proposedEquipmentId,
    proposedEquipmentVariantId: study.proposedEquipmentVariantId,
    status: study.status,
    fixtureKind: study.fixtureKind,
    prediction: study.prediction,
    observations: study.observations,
    familiarity: study.familiarity,
    observationWindowCompletedAt: study.observationWindowCompletedAt
  };
}
