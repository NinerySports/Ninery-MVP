import { evaluateTransitionShadowAuthorization, type TransitionShadowInternalActor, checkpointStatusesForStudy } from "../admin/index.js";
import { TransitionPredictionContextLoaderService } from "./transition-prediction-context.service.js";
import {
  FIRST_GENUINE_STUDY_PREFLIGHT_POLICY_VERSION,
  FIRST_GENUINE_STUDY_READINESS_VERSION,
  type FirstGenuineStudyBlocker,
  type FirstGenuineStudyLifecycleReadiness,
  type FirstGenuineStudyPreflightRequest,
  type FirstGenuineStudyPreflightResult,
  type FirstGenuineStudyReadinessCheck,
  type FirstGenuineStudyReadinessRepository,
  type FirstGenuineStudyWarning
} from "./first-study-readiness.types.js";
import {
  blocker,
  check,
  defaultObserverPlan,
  nextAction,
  warning
} from "./first-study-readiness.policy.js";

export class FirstGenuineStudyReadinessService {
  private readonly contextLoader: TransitionPredictionContextLoaderService;

  constructor(private readonly repository: FirstGenuineStudyReadinessRepository) {
    this.contextLoader = new TransitionPredictionContextLoaderService(repository);
  }

  async preflight(request: FirstGenuineStudyPreflightRequest, now = new Date()): Promise<FirstGenuineStudyPreflightResult> {
    return request.studyId ? this.existingStudy(request, now) : this.prospective(request, now);
  }

  private async prospective(request: FirstGenuineStudyPreflightRequest, now: Date): Promise<FirstGenuineStudyPreflightResult> {
    const checks: FirstGenuineStudyReadinessCheck[] = [];
    const blockers: FirstGenuineStudyBlocker[] = [];
    const warnings: FirstGenuineStudyWarning[] = [];
    const observerPlan = defaultObserverPlan();

    const authorization = this.authorization(request.actor, now);
    checks.push(check("operator_authorization", authorization.allowed ? "ready" : "blocked", authorization.allowed ? "Operator is authorized for internal transition study review." : authorization.blockers.join(" "), "Use an authorized transition operator.", "Ticket #039 authorization"));
    if (!authorization.allowed) blockers.push(blocker("UNAUTHORIZED_OPERATOR", authorization.blockers.join(" "), "authorization", "Use an authorized internal transition operator."));

    const player = request.playerId ? await this.repository.getPlayer(request.playerId) : undefined;
    checks.push(check("player_eligibility", player && player.status !== "archived" && !player.synthetic ? "ready" : "blocked", player ? "Player exists and is eligible for preflight." : "Player was not found.", "Verify the player identity.", "Ticket #041 genuine-study eligibility"));
    if (!player) blockers.push(blocker("MISSING_PLAYER", "Player identity could not be verified.", "player", "Verify the player ID before continuing."));
    else if (player.synthetic || player.status === "archived") blockers.push(blocker("PLAYER_NOT_ELIGIBLE", "Player is archived or synthetic and cannot be used for a genuine study.", "player", "Select a real active player."));
    checks.push(check("genuine_study_classification", player?.synthetic ? "blocked" : "ready", "Preflight is for genuine_internal_observation only.", undefined, "Ticket #041 classification policy"));

    const duplicate = request.playerId && request.currentEquipmentId && request.proposedEquipmentId
      ? await this.repository.hasActiveStudyForTransition({
          playerId: request.playerId,
          currentEquipmentId: request.currentEquipmentId,
          currentVariantId: request.currentVariantId,
          proposedEquipmentId: request.proposedEquipmentId,
          proposedVariantId: request.proposedVariantId
        })
      : false;
    checks.push(check("duplicate_active_study", duplicate ? "blocked" : "ready", duplicate ? "An active study already exists for this player and equipment transition." : "No active duplicate study was found.", "Open the existing study instead of creating a duplicate.", "Ticket #039 duplicate protection"));

    await this.equipmentChecks("current", request.currentEquipmentId, request.currentVariantId, checks, blockers);
    await this.equipmentChecks("proposed", request.proposedEquipmentId, request.proposedVariantId, checks, blockers);

    const profiles = request.playerId ? [...await this.repository.listPlayerDNAProfiles(request.playerId)].filter((profile) => profile.status !== "archived") : [];
    const playerDNA = profiles.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())[0];
    checks.push(check("player_dna_supported", playerDNA && (playerDNA.version === "1.0.0" || playerDNA.version === "player-dna-mvp-v1") ? "ready" : "blocked", playerDNA ? `Player DNA ${playerDNA.profileId} uses version ${playerDNA.version}.` : "No supported Player DNA profile was found.", "Update or regenerate Player DNA.", "Ticket #043 Player DNA resolver"));
    checks.push(check("player_dna_ambiguity", profiles.length > 1 ? "warning" : "ready", profiles.length > 1 ? "Multiple non-archived Player DNA profiles exist; newest profile will be selected deterministically." : "No Player DNA ambiguity detected.", undefined, "Ticket #043 Player DNA resolver"));
    if (!playerDNA) blockers.push(blocker("MISSING_PLAYER_DNA", "A supported Player DNA profile is required before genuine prediction context can be assembled.", "player_dna", "Update/regenerate Player DNA and rerun readiness."));
    else if (playerDNA.version !== "1.0.0" && playerDNA.version !== "player-dna-mvp-v1") blockers.push(blocker("UNSUPPORTED_PLAYER_DNA", "Player DNA version is unsupported for Transition v1.1.", "player_dna", "Regenerate Player DNA using a supported version."));
    if (profiles.length > 1) warnings.push(warning("MULTIPLE_PLAYER_DNA_PROFILES", "Multiple Player DNA profiles exist; newest non-archived profile will be used."));

    this.playerReadinessChecks(playerDNA, checks, blockers);
    await this.equipmentDNAChecks("current", request.currentEquipmentId, request.currentVariantId, checks, blockers);
    await this.equipmentDNAChecks("proposed", request.proposedEquipmentId, request.proposedVariantId, checks, blockers);

    checks.push(check("familiarity_availability", "required_action", "Current equipment familiarity is captured during genuine-study intake and is required before prediction capture.", "Capture familiarity through the approved intake workflow.", "Ticket #038 familiarity policy"));
    checks.push(check("familiarity_confidence", "required_action", "Familiarity confidence will be evaluated from the intake record.", "Capture genuine current-equipment familiarity.", "Ticket #038 familiarity policy"));
    checks.push(check("context_loader_readiness", blockers.length ? "not_applicable" : "required_action", "Context loader readiness is confirmed after the study draft exists.", "Create the study draft, then run prediction-input.", "Ticket #043 context loader"));
    checks.push(check("transition_v1_1_input_readiness", blockers.length ? "not_applicable" : "required_action", "Transition v1.1 input is assembled from the study draft, Player DNA, Equipment DNA, and familiarity.", "Create the study draft, then review prediction context.", "Ticket #043 context loader"));
    checks.push(check("observer_plan_readiness", observerPlan.status === "ready" ? "ready" : "required_action", "Observer plan covers first use, early sessions, and acclimation period.", "Complete observer plan.", "Ticket #038 checkpoints"));
    checks.push(check("acknowledgement_readiness", "required_action", "Operational acknowledgement is required at genuine-study intake before study creation.", "Capture the required operational acknowledgement.", "Ticket #041 acknowledgement policy"));
    checks.push(check("lifecycle_creation_readiness", blockers.length || duplicate ? "blocked" : "required_action", blockers.length ? "Resolve blockers before study creation." : "Study can be prepared once acknowledgement and familiarity intake are completed.", "Prepare intake and create the genuine study draft.", "Ticket #042 operator workflow"));

    const status = duplicate ? "study_already_exists" : blockers.length ? "blocked" : "ready_to_prepare";
    return this.result(status, checks, blockers, warnings, observerPlan, status === "blocked" ? "NONE_BLOCKED" : duplicate ? "NONE_BLOCKED" : "CAPTURE_ACKNOWLEDGEMENT", undefined, undefined, now);
  }

  private async existingStudy(request: FirstGenuineStudyPreflightRequest, now: Date): Promise<FirstGenuineStudyPreflightResult> {
    const checks: FirstGenuineStudyReadinessCheck[] = [];
    const blockers: FirstGenuineStudyBlocker[] = [];
    const warnings: FirstGenuineStudyWarning[] = [];
    const observerPlan = defaultObserverPlan();
    const authorization = this.authorization(request.actor, now);
    checks.push(check("operator_authorization", authorization.allowed ? "ready" : "blocked", authorization.allowed ? "Operator is authorized." : authorization.blockers.join(" ")));
    if (!authorization.allowed) blockers.push(blocker("UNAUTHORIZED_OPERATOR", authorization.blockers.join(" "), "authorization", "Use an authorized internal transition operator."));

    const study = await this.repository.getStudy(request.studyId!);
    if (!study) {
      blockers.push(blocker("MISSING_STUDY", "Study was not found.", "study_lifecycle", "Verify the study ID."));
      return this.result("blocked", checks, blockers, warnings, observerPlan, "NONE_BLOCKED", undefined, undefined, now);
    }

    const contextAssembly = await this.contextLoader.assemblePredictionInput({ studyId: study.id, mode: "diagnostic", assembledAt: now });
    checks.push(check("context_loader_readiness", contextAssembly.ready ? "ready" : "blocked", contextAssembly.ready ? "Context loader can assemble Transition v1.1 input." : "Context loader is blocked.", "Resolve context loader blockers.", "Ticket #043 context loader"));
    checks.push(check("transition_v1_1_input_readiness", contextAssembly.input ? "ready" : "blocked", contextAssembly.input ? "Transition v1.1 input is available." : "Transition v1.1 input is not ready.", "Resolve missing context.", "Ticket #043 context loader"));
    for (const item of contextAssembly.blockers) blockers.push(blocker(item.code, item.message, item.sourceArea === "player_dna" ? "player_dna" : item.sourceArea.includes("equipment") ? "equipment" : item.sourceArea === "familiarity" ? "familiarity" : "context", "Resolve the source data and rerun readiness."));
    for (const item of contextAssembly.warnings) warnings.push(warning(item.code, item.message));

    const hasAcknowledgement = await this.repository.hasAcknowledgement?.(study.id) ?? false;
    checks.push(check("acknowledgement_readiness", hasAcknowledgement ? "ready" : "required_action", hasAcknowledgement ? "Operational acknowledgement is present." : "Operational acknowledgement is missing.", "Capture acknowledgement before observation.", "Ticket #041 acknowledgement policy"));

    const checkpoints = checkpointStatusesForStudy(study, now);
    const lifecycle: FirstGenuineStudyLifecycleReadiness = {
      draftReadiness: study.status === "draft" ? "ready" : "complete",
      predictionReadiness: study.prediction ? "complete" : study.status === "draft" && contextAssembly.ready ? "ready" : "not_ready",
      observationReadiness: study.status === "prediction_captured" && hasAcknowledgement ? "ready" : study.status === "observation_active" || study.status === "observation_complete" ? "complete" : "not_ready",
      checkpointReadiness: study.status === "observation_active" ? "ready" : study.status === "observation_complete" ? "complete" : "not_applicable",
      completionReadiness: study.status === "observation_active" && checkpoints.every((row) => row.status === "completed" || row.status === "completed_low_confidence") ? "ready" : study.status === "observation_complete" ? "complete" : "not_ready",
      checkpoints
    };
    checks.push(check("lifecycle_creation_readiness", "complete", "Study already exists."));
    checks.push(check("observer_plan_readiness", observerPlan.status === "ready" ? "ready" : "required_action", "Observer plan covers first use, early sessions, and acclimation period."));
    checks.push(check("checkpoint_progress", lifecycle.checkpointReadiness, `Checkpoint readiness is ${lifecycle.checkpointReadiness}.`));
    checks.push(check("completion_readiness", lifecycle.completionReadiness, `Completion readiness is ${lifecycle.completionReadiness}.`, "Run completion review before completing the study.", "Ticket #042 completion review"));

    const next = study.status === "draft" ? "CAPTURE_PREDICTION" : study.status === "prediction_captured" ? "BEGIN_OBSERVATION" : lifecycle.completionReadiness === "ready" ? "COMPLETE_STUDY" : study.status === "observation_active" ? "RECORD_CHECKPOINT_OBSERVATION" : "NONE_COMPLETE";
    return this.result(blockers.length ? "blocked" : "study_already_exists", checks, blockers, warnings, observerPlan, next, contextAssembly, { ...lifecycle, checkpoints }, now, study);
  }

  private async equipmentChecks(kind: "current" | "proposed", equipmentId: string | undefined, variantId: string | undefined, checks: FirstGenuineStudyReadinessCheck[], blockers: FirstGenuineStudyBlocker[]) {
    const sourceArea = kind === "current" ? "current" : "proposed";
    const equipment = equipmentId ? await this.repository.getEquipment(equipmentId) : undefined;
    checks.push(check(`${sourceArea}_equipment_identity`, equipment && !equipment.synthetic ? "ready" : "blocked", equipment ? `${kind} equipment identity is verified.` : `${kind} equipment was not found.`, `Verify ${kind} equipment identity.`));
    if (!equipment) blockers.push(blocker(`MISSING_${kind.toUpperCase()}_EQUIPMENT`, `${kind} equipment identity could not be verified.`, "equipment", `Verify ${kind} equipment identity.`));
    const variant = variantId ? await this.repository.getEquipmentVariant(variantId) : undefined;
    checks.push(check(`${sourceArea}_variant_identity`, variant && variant.equipmentId === equipmentId ? "ready" : "blocked", variant ? `${kind} variant belongs to selected equipment.` : `${kind} variant was not found.`, `Verify ${kind} variant identity.`));
    if (!variant || variant.equipmentId !== equipmentId) blockers.push(blocker(`MISSING_${kind.toUpperCase()}_VARIANT`, `${kind} variant identity could not be verified.`, "equipment", `Verify ${kind} variant identity.`));
    const spec = variantId ? await this.repository.getVariantSpecification(variantId) : undefined;
    const specReady = spec?.length !== undefined && spec.weight !== undefined && spec.drop !== undefined;
    checks.push(check(`${sourceArea}_equipment_specifications`, specReady ? "ready" : "blocked", specReady ? `${kind} length, weight, and drop are present.` : `${kind} length, weight, and drop are required.`, "Correct Equipment Intelligence catalog data."));
    if (!specReady) blockers.push(blocker(`MISSING_${kind.toUpperCase()}_SPECIFICATIONS`, `${kind} variant is missing length, weight, or drop.`, "equipment", "Correct Equipment Intelligence/catalog data and rerun readiness."));
  }

  private playerReadinessChecks(playerDNA: Awaited<ReturnType<FirstGenuineStudyReadinessRepository["listPlayerDNAProfiles"]>>[number] | undefined, checks: FirstGenuineStudyReadinessCheck[], blockers: FirstGenuineStudyBlocker[]) {
    const experience = playerDNA?.inputSnapshot.playerProfile?.experienceYears !== undefined;
    const batControl = playerDNA?.scores.batControl !== undefined;
    const development = playerDNA?.categories.developmentStage !== undefined;
    checks.push(check("experience_readiness", experience ? "ready" : "blocked", experience ? "Experience readiness source is available." : "Experience years are missing from Player DNA input snapshot.", "Regenerate Player DNA with player profile experience."));
    checks.push(check("bat_control_readiness", batControl ? "ready" : "blocked", batControl ? "Bat-control readiness is available." : "Bat-control readiness is missing.", "Regenerate Player DNA."));
    checks.push(check("development_readiness", development ? "ready" : "blocked", development ? "Development readiness source is available." : "Development stage is missing.", "Regenerate Player DNA."));
    if (!experience) blockers.push(blocker("MISSING_EXPERIENCE_READINESS", "Prediction context cannot be assembled without experience readiness.", "player_dna", "Update/regenerate Player DNA."));
    if (!batControl) blockers.push(blocker("MISSING_BAT_CONTROL_READINESS", "Prediction context cannot be assembled without bat-control readiness.", "player_dna", "Update/regenerate Player DNA."));
    if (!development) blockers.push(blocker("MISSING_DEVELOPMENT_READINESS", "Prediction context cannot be assembled without development readiness.", "player_dna", "Update/regenerate Player DNA."));
  }

  private async equipmentDNAChecks(kind: "current" | "proposed", equipmentId: string | undefined, variantId: string | undefined, checks: FirstGenuineStudyReadinessCheck[], blockers: FirstGenuineStudyBlocker[]) {
    if (!equipmentId || !variantId) return;
    const profile = await this.repository.loadCanonicalEquipmentDNAProfile({ equipmentId, equipmentVariantId: variantId }).catch(() => undefined);
    const ready = !!profile?.readiness.ready;
    checks.push(check(`${kind}_equipment_dna`, ready ? "ready" : "blocked", ready ? `${kind} canonical Equipment DNA is recommendation-ready.` : `${kind} canonical Equipment DNA is missing or not ready.`, "Repair canonical Equipment DNA evidence/evaluations.", "Ticket #020/#021/#043 canonical loader"));
    if (!ready) blockers.push(blocker(`MISSING_${kind.toUpperCase()}_EQUIPMENT_DNA`, `${kind} canonical Equipment DNA is required for extended-shadow prediction context.`, "equipment_dna", "Repair Equipment DNA and rerun readiness."));
    const admission = await this.repository.getAdmissionDecision?.(equipmentId, variantId);
    if (kind === "proposed") {
      const admitted = !admission || admission.eligibleForShadow || admission.eligibleForInternalCandidate;
      checks.push(check("equipment_dna_admission", admitted ? "ready" : "blocked", admission ? `Admission outcome: ${admission.outcome}.` : "Admission decision not available; canonical readiness is used for preflight.", "Repair Equipment DNA admission blockers.", "Ticket #023 admission"));
      if (!admitted) blockers.push(blocker("EQUIPMENT_DNA_NOT_ADMITTED", "Proposed Equipment DNA admission is blocked.", "equipment_dna", "Resolve Equipment DNA admission blockers."));
    }
  }

  private authorization(actor: TransitionShadowInternalActor | undefined, evaluatedAt: Date) {
    return evaluateTransitionShadowAuthorization({ actor, capability: "transition_shadow_study_create", evaluatedAt });
  }

  private result(
    status: FirstGenuineStudyPreflightResult["status"],
    checks: readonly FirstGenuineStudyReadinessCheck[],
    blockers: readonly FirstGenuineStudyBlocker[],
    warnings: readonly FirstGenuineStudyWarning[],
    observerPlan: FirstGenuineStudyPreflightResult["observerPlan"],
    action: FirstGenuineStudyPreflightResult["nextAction"]["code"],
    contextAssembly: FirstGenuineStudyPreflightResult["contextAssembly"],
    lifecycle: FirstGenuineStudyPreflightResult["lifecycle"],
    generatedAt: Date,
    study?: FirstGenuineStudyPreflightResult["study"]
  ): FirstGenuineStudyPreflightResult {
    return {
      version: FIRST_GENUINE_STUDY_READINESS_VERSION,
      policyVersion: FIRST_GENUINE_STUDY_PREFLIGHT_POLICY_VERSION,
      status,
      checks,
      blockers,
      warnings,
      observerPlan,
      nextAction: nextAction(action, summaryFor(action), commandFor(action)),
      model: { version: "1.1", mode: "extended_shadow", liveUseAllowed: false },
      contextAssembly,
      lifecycle,
      study,
      generatedAt
    };
  }
}

function summaryFor(action: FirstGenuineStudyPreflightResult["nextAction"]["code"]): string {
  const map: Record<typeof action, string> = {
    AUTHORIZE_OPERATOR: "Use an authorized internal transition operator.",
    VERIFY_PLAYER: "Verify the player identity.",
    VERIFY_CURRENT_EQUIPMENT: "Verify current equipment and variant identity.",
    VERIFY_PROPOSED_EQUIPMENT: "Verify proposed equipment and variant identity.",
    UPDATE_PLAYER_DNA: "Update or regenerate Player DNA.",
    REPAIR_EQUIPMENT_DNA: "Repair canonical Equipment DNA evidence/evaluations.",
    CAPTURE_FAMILIARITY: "Capture current-equipment familiarity through approved intake.",
    CAPTURE_ACKNOWLEDGEMENT: "Capture the required operational acknowledgement.",
    COMPLETE_OBSERVER_PLAN: "Complete observer plan source roles.",
    CREATE_STUDY_DRAFT: "Create the genuine study draft.",
    CAPTURE_PREDICTION: "Review context and capture the immutable v1.1 prediction.",
    BEGIN_OBSERVATION: "Begin the observation window.",
    RECORD_CHECKPOINT_OBSERVATION: "Record the next checkpoint observation.",
    COMPLETE_STUDY: "Run completion review and complete the study if eligible.",
    NONE_BLOCKED: "Resolve blockers before continuing.",
    NONE_COMPLETE: "No further readiness action is required."
  };
  return map[action];
}

function commandFor(action: FirstGenuineStudyPreflightResult["nextAction"]["code"]): string | undefined {
  if (action === "CAPTURE_ACKNOWLEDGEMENT") return "pnpm transition:genuine-study:prepare -- --file=path/to/intake.json --actor=transition-operator";
  if (action === "CAPTURE_PREDICTION") return "pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --confirm";
  if (action === "BEGIN_OBSERVATION") return "pnpm transition:genuine-study:start-observation -- --study=<study-id> --actor=transition-operator --confirm";
  if (action === "COMPLETE_STUDY") return "pnpm transition:genuine-study:completion-review -- --study=<study-id> --actor=transition-operator";
  return undefined;
}
