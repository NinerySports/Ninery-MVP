import { evaluateCurrentEquipmentFamiliarity } from "@ninery/player-intelligence";
import { evaluateTransitionShadowAuthorization, TransitionShadowAdminError, TransitionShadowAdminService } from "../admin/index.js";
import type {
  TransitionShadowAdminRepository,
  TransitionShadowInternalActor
} from "../admin/index.js";
import type {
  TransitionGenuineStudyCreateInput,
  TransitionGenuineStudyCreationResult,
  TransitionGenuineStudyEligibilityResult,
  TransitionGenuineStudyIntakeSnapshot
} from "./transition-genuine-study.types.js";
import {
  dryRunResult,
  evaluateEquipmentVerification,
  validParticipationAcknowledgement,
  validateTransitionGenuineStudyLanguage
} from "./transition-genuine-study.policy.js";

export class TransitionGenuineStudyIntakeService {
  private readonly adminService: TransitionShadowAdminService;

  constructor(private readonly repository: TransitionShadowAdminRepository) {
    this.adminService = new TransitionShadowAdminService(repository);
  }

  async evaluateGenuineStudyEligibility(input: TransitionGenuineStudyCreateInput, actor: TransitionShadowInternalActor, evaluatedAt = input.createdAt): Promise<TransitionGenuineStudyEligibilityResult> {
    const familiarity = evaluateCurrentEquipmentFamiliarity(input.familiarityInput);
    const adminDraftInput = toAdminDraftInput(input);
    const adminEligibility = await this.adminService.evaluateEligibility(adminDraftInput, actor, evaluatedAt);
    const checks: TransitionGenuineStudyEligibilityResult["checks"][number][] = [
      {
        code: "authorized_internal_operator",
        passed: evaluateTransitionShadowAuthorization({ actor, capability: "transition_shadow_study_create", evaluatedAt }).allowed,
        required: true,
        explanation: "Authorized internal operator is required."
      },
      {
        code: "genuine_classification_required",
        passed: adminDraftInput.evidenceClassification === "genuine_internal_observation",
        required: true,
        explanation: "Genuine intake must use genuine_internal_observation classification."
      },
      {
        code: "participation_acknowledgement_captured",
        passed: validParticipationAcknowledgement(input.participationAcknowledgement, actor.actorId),
        required: true,
        explanation: "Operational participation acknowledgement must be captured before genuine intake."
      },
      {
        code: "not_retrospective",
        passed: input.outcomeAlreadyKnownBeforePrediction !== true,
        required: true,
        explanation: input.outcomeAlreadyKnownBeforePrediction ? "OUTCOME_ALREADY_KNOWN_BEFORE_PREDICTION" : "Outcome is not known before prediction."
      },
      ...evaluateEquipmentVerification(input.currentEquipmentVerification, "current"),
      ...evaluateEquipmentVerification(input.proposedEquipmentVerification, "proposed"),
      {
        code: "familiarity_evaluable",
        passed: familiarity.level !== "unknown",
        required: true,
        explanation: familiarity.level === "unknown" ? "Current-equipment familiarity must be evaluable before prediction." : "Current-equipment familiarity is evaluable."
      },
      {
        code: "transition_v1_1_prediction_possible",
        passed: input.playerDNAProfileId !== undefined || adminEligibility.checks.some((check) => check.code === "player_dna_available" && check.passed),
        required: true,
        explanation: "Player DNA must be sufficient for Transition Compatibility v1.1."
      },
      {
        code: "admin_eligibility_passes",
        passed: adminEligibility.eligible,
        required: true,
        explanation: adminEligibility.eligible ? "Ticket #039 admin eligibility passes." : adminEligibility.blockers.join(" ")
      }
    ];
    const noteWarnings = validateTransitionGenuineStudyLanguage(input.internalNote);
    const blockers = checks.filter((check) => check.required && !check.passed).map((check) => check.explanation);
    const warnings = [...adminEligibility.warnings, ...familiarity.warnings, ...noteWarnings];
    return {
      version: "1.0",
      eligible: blockers.length === 0,
      checks,
      blockers,
      warnings,
      adminEligibility,
      evaluatedAt
    };
  }

  async createGenuineTransitionShadowStudy(input: TransitionGenuineStudyCreateInput, actor: TransitionShadowInternalActor): Promise<TransitionGenuineStudyCreationResult> {
    const eligibility = await this.evaluateGenuineStudyEligibility(input, actor, input.createdAt);
    if (!eligibility.eligible) throw new TransitionShadowAdminError("STUDY_NOT_ELIGIBLE", eligibility.blockers.join(" "));
    const intakeSnapshot = createIntakeSnapshot(input, actor.actorId);
    const adminDraftInput = toAdminDraftInput(input, intakeSnapshot);
    const draft = await this.adminService.createTransitionShadowStudyDraft(adminDraftInput, actor);
    await this.repository.writeAuditEvent({
      version: "1.0",
      id: `${draft.study.id}:genuine_intake_reviewed:${input.createdAt.toISOString()}`,
      studyId: draft.study.id,
      studyKey: draft.study.studyKey,
      actorId: actor.actorId,
      actorRole: actor.roleCodes[0],
      capability: "transition_shadow_study_create",
      action: "study_eligibility_reviewed",
      metadata: {
        genuineIntakeVersion: "1.0",
        acknowledgementVersion: input.participationAcknowledgement.version,
        evidenceClassification: "genuine_internal_observation",
        equipmentVerificationCompleted: true,
        noRecommendationImpactAcknowledged: input.participationAcknowledgement.noRecommendationImpactAcknowledged
      },
      createdAt: input.createdAt
    });
    return { eligibility, intakeSnapshot, adminDraftInput, studyId: draft.study.id };
  }

  async genuineIntakeDryRun(input: TransitionGenuineStudyCreateInput, actor: TransitionShadowInternalActor) {
    const eligibility = await this.evaluateGenuineStudyEligibility(input, actor, input.createdAt);
    return dryRunResult(eligibility);
  }
}

export function createIntakeSnapshot(input: TransitionGenuineStudyCreateInput, actorId: string): TransitionGenuineStudyIntakeSnapshot {
  return {
    version: "1.0",
    playerId: input.playerId,
    currentEquipmentVerification: input.currentEquipmentVerification,
    proposedEquipmentVerification: input.proposedEquipmentVerification,
    familiarity: evaluateCurrentEquipmentFamiliarity(input.familiarityInput),
    participationAcknowledgement: input.participationAcknowledgement,
    playerDNAProfileId: input.playerDNAProfileId,
    playerDNAVersion: input.playerDNAVersion,
    capturedByActorId: actorId,
    capturedAt: input.createdAt,
    evidenceClassification: "genuine_internal_observation"
  };
}

function toAdminDraftInput(input: TransitionGenuineStudyCreateInput, snapshot?: TransitionGenuineStudyIntakeSnapshot) {
  return {
    id: input.id,
    playerId: input.playerId,
    currentEquipmentId: input.currentEquipmentVerification.equipmentId,
    currentEquipmentVariantId: input.currentEquipmentVerification.equipmentVariantId,
    proposedEquipmentId: input.proposedEquipmentVerification.equipmentId,
    proposedEquipmentVariantId: input.proposedEquipmentVerification.equipmentVariantId,
    observationPeriodKey: input.observationPeriodKey,
    evidenceClassification: "genuine_internal_observation" as const,
    studyPurpose: "Genuine internal transition extended-shadow observation.",
    captureOrigin: input.captureOrigin,
    familiarityInput: input.familiarityInput,
    internalNote: input.internalNote,
    createdAt: input.createdAt,
    intendedObservationStartAt: input.createdAt,
    allowSameEquipmentStudy: false,
    ...(snapshot ? { intakeSnapshot: snapshot } : {})
  };
}
