import { Prisma, type PrismaClient } from "@prisma/client";
import type { CurrentEquipmentFamiliarityResult } from "../../../player-intelligence/src/index.ts";
import {
  TRANSITION_SHADOW_AUDIT_EVENT_VERSION,
  TransitionShadowAdminError,
  TransitionShadowAdminService,
  classifyTransitionShadowStudy,
  compareTransitionShadowStudyOutcome,
  createTransitionShadowStudyKey,
  type TransitionAdjustmentObservation,
  type TransitionExtendedShadowStudy,
  type TransitionPredictionSnapshot,
  type TransitionShadowAdminRepository,
  type TransitionShadowAuditEvent,
  type TransitionShadowCreateDraftInput,
  type TransitionShadowInternalActor,
  type TransitionShadowStudyListFilters
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "./canonical-demo-context.ts";

export const TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION = "1.0";
export const TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX = "ticket-040-admin-workflow";
export const workflowBaseDate = new Date("2026-08-08T00:00:00.000Z");

export const authorizedOperator: TransitionShadowInternalActor = {
  actorId: "ticket-040-authorized-operator",
  roleCodes: ["transition_shadow_operator"],
  capabilityCodes: [],
  active: true
};

export const elevatedOperator: TransitionShadowInternalActor = {
  actorId: "ticket-040-elevated-operator",
  roleCodes: ["transition_shadow_administrator"],
  capabilityCodes: [],
  active: true
};

export const unauthorizedActor: TransitionShadowInternalActor = {
  actorId: "ticket-040-unauthorized-actor",
  roleCodes: [],
  capabilityCodes: [],
  active: true
};

export type TransitionShadowAdminWorkflowExerciseResult = {
  readonly fixtureVersion: typeof TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION;
  readonly workflowsAttempted: number;
  readonly workflowsCompleted: number;
  readonly happyPathStatus: string;
  readonly cancellationStatus: string;
  readonly invalidationStatus: string;
  readonly unauthorizedMutationBlocked: boolean;
  readonly unauthorizedErrorCode?: string;
  readonly observationCorrectionAppendOnly: boolean;
  readonly predictionImmutable: boolean;
  readonly transitionPredictionVersion?: string;
  readonly duplicateProtectionVerified: boolean;
  readonly workflowFixturesClassifiedAsGenuineEvidence: boolean;
  readonly auditEventsCreated: number;
  readonly modelAutomaticallyChanged: false;
  readonly livePromotionAutomaticallyRecommended: false;
};

export class PrismaTransitionShadowAdminRepository implements TransitionShadowAdminRepository {
  constructor(private readonly prismaClient: PrismaClient) {}

  async getPlayer(playerId: string) {
    const player = await this.prismaClient.player.findUnique({ where: { id: playerId } });
    return player ? { id: player.id, status: player.status, label: `${player.firstName} ${player.lastName}`, synthetic: false } : undefined;
  }

  async hasPlayerDNA(playerId: string) {
    return !!(await this.prismaClient.playerDNAProfile.findFirst({ where: { playerId }, select: { id: true } }));
  }

  async getEquipment(equipmentId: string) {
    const equipment = await this.prismaClient.equipment.findUnique({ where: { id: equipmentId } });
    return equipment ? { id: equipment.id, label: `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}`, synthetic: false } : undefined;
  }

  async getEquipmentVariant(variantId: string) {
    const variant = await this.prismaClient.equipmentVariant.findUnique({ where: { id: variantId } });
    return variant ? { id: variant.id, equipmentId: variant.equipmentId, label: variant.sku ?? `${variant.lengthInches}/${variant.weightOunces}`, synthetic: false } : undefined;
  }

  async getStudy(studyId: string) {
    const row = await this.prismaClient.transitionExtendedShadowStudy.findUnique({
      where: { id: studyId },
      include: { familiarityRecord: true, observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }, { createdAt: "asc" }] } }
    });
    return row ? toDomainStudyAllowingDraft(row) : undefined;
  }

  async listStudies(filters: TransitionShadowStudyListFilters = {}) {
    const rows = await this.prismaClient.transitionExtendedShadowStudy.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.playerId ? { playerId: filters.playerId } : {}),
        ...(filters.currentEquipmentId ? { currentEquipmentId: filters.currentEquipmentId } : {}),
        ...(filters.proposedEquipmentId ? { proposedEquipmentId: filters.proposedEquipmentId } : {}),
        ...(filters.modelVersion ? { transitionModelVersion: filters.modelVersion } : {}),
        ...(filters.createdFrom || filters.createdTo ? { createdAt: { gte: filters.createdFrom, lte: filters.createdTo } } : {})
      },
      include: { familiarityRecord: true, observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }, { createdAt: "asc" }] } },
      orderBy: [{ createdAt: "desc" }, { studyKey: "asc" }],
      skip: filters.offset,
      take: filters.limit
    });
    return rows
      .map((row) => toDomainStudyAllowingDraft(row))
      .filter((study) => filters.includeSynthetic || classifyTransitionShadowStudy(study) === "genuine_internal_observation")
      .filter((study) => !filters.evidenceClassification || classifyTransitionShadowStudy(study) === filters.evidenceClassification);
  }

  async findActiveStudyByKey(studyKey: string) {
    const row = await this.prismaClient.transitionExtendedShadowStudy.findFirst({
      where: { studyKey, status: { in: ["draft", "prediction_captured", "observation_active"] } },
      include: { familiarityRecord: true, observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }, { createdAt: "asc" }] } }
    });
    return row ? toDomainStudyAllowingDraft(row) : undefined;
  }

  async createStudy(study: TransitionExtendedShadowStudy) {
    const familiarityRecord = await this.prismaClient.currentEquipmentFamiliarityRecord.create({
      data: familiarityRecordData(study.familiarity)
    });
    const row = await this.prismaClient.transitionExtendedShadowStudy.create({
      data: {
        id: study.id,
        studyKey: study.studyKey,
        playerId: study.playerId,
        currentEquipmentId: study.currentEquipmentId,
        currentEquipmentVariantId: study.currentEquipmentVariantId,
        proposedEquipmentId: study.proposedEquipmentId,
        proposedEquipmentVariantId: study.proposedEquipmentVariantId,
        status: study.status,
        studyVersion: study.version,
        policyVersion: "1.0",
        familiarityRecordId: familiarityRecord.id,
        fixtureKind: study.fixtureKind === "real_observation" ? "real_observation" : "development_fixture",
        createdAt: study.createdAt,
        updatedAt: study.updatedAt
      },
      include: { familiarityRecord: true, observations: true }
    });
    return toDomainStudyAllowingDraft(row);
  }

  async updateStudy(study: TransitionExtendedShadowStudy, expectedUpdatedAt?: Date) {
    const existing = await this.getStudy(study.id);
    if (!existing) throw new TransitionShadowAdminError("STUDY_NOT_FOUND", `Study ${study.id} was not found.`);
    if (expectedUpdatedAt && existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      throw new TransitionShadowAdminError("CONCURRENCY_CONFLICT", "Study changed before the requested operation completed.");
    }
    await this.prismaClient.transitionExtendedShadowStudy.update({
      where: { id: study.id },
      data: {
        status: study.status,
        predictionSnapshot: study.prediction ? json(study.prediction) : undefined,
        predictionInputHash: study.prediction?.inputHash,
        predictionHash: study.prediction?.predictionHash,
        transitionModelVersion: study.prediction?.transitionModelVersion,
        transitionPolicyVersion: study.prediction?.transitionPolicyVersion,
        interpolationVersion: study.prediction?.interpolationVersion,
        predictedAt: study.prediction?.predictedAt,
        observationWindowStartedAt: study.observationWindowStartedAt,
        observationWindowCompletedAt: study.observationWindowCompletedAt,
        cancellationReason: study.cancellationReason,
        invalidationReason: study.invalidationReason,
        updatedAt: study.updatedAt
      }
    });
    const existingCount = existing.observations.length;
    const additions = study.observations.slice(existingCount);
    for (const observation of additions) {
      const isDevelopmentFixture = study.fixtureKind !== "real_observation";
      await this.prismaClient.transitionExtendedShadowObservation.create({
        data: {
          studyId: study.id,
          checkpoint: observation.checkpoint,
          observedAt: observation.observedAt,
          source: observation.source,
          directlyWitnessed: observation.directlyWitnessed,
          observationConfidence: observation.observationConfidence,
          equipmentActuallyUsed: observation.equipmentActuallyUsed,
          meaningfulUseOccurred: observation.meaningfulUseOccurred,
          adjustmentObservation: json(isDevelopmentFixture
            ? {
                ...observation,
                fixtureKind: "development_fixture",
                adminWorkflowFixture: true,
                notRealWorldEvidence: true,
                observedAt: observation.observedAt.toISOString()
              }
            : {
                ...observation,
                fixtureKind: "real_observation",
                evidenceClassification: "genuine_internal_observation",
                observedAt: observation.observedAt.toISOString()
              }),
          sessionContext: observation.sessionContext ? json(observation.sessionContext) : undefined,
          notes: observation.notes
        }
      });
    }
    const updated = await this.getStudy(study.id);
    if (!updated) throw new TransitionShadowAdminError("STUDY_NOT_FOUND", `Study ${study.id} was not found after update.`);
    return updated;
  }

  async writeAuditEvent(event: TransitionShadowAuditEvent) {
    const genuineIntakeVersion = typeof event.metadata?.genuineIntakeVersion === "string" ? event.metadata.genuineIntakeVersion : undefined;
    await this.prismaClient.platformEvent.create({
      data: {
        eventType: "outcome_recorded",
        entityType: "TransitionShadowAdminAudit",
        entityId: event.studyId,
        payload: {
          version: TRANSITION_SHADOW_AUDIT_EVENT_VERSION,
          ...(genuineIntakeVersion ? { genuineIntakeVersion } : { fixtureVersion: TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION }),
          studyId: event.studyId,
          studyKey: event.studyKey,
          evidenceClassification: genuineIntakeVersion ? "genuine_internal_observation" : "development_fixture",
          syntheticLabel: genuineIntakeVersion ? undefined : "admin_workflow_fixture, not_real_world_evidence",
          actorId: event.actorId,
          actorRole: event.actorRole,
          capability: event.capability,
          action: event.action,
          reason: event.reason,
          beforeSummary: minimized(event.beforeSummary),
          afterSummary: minimized(event.afterSummary),
          metadata: minimized(event.metadata)
        }
      }
    });
  }

  async listAuditEvents(studyId?: string) {
    const rows = await this.prismaClient.platformEvent.findMany({
      where: { entityType: "TransitionShadowAdminAudit", ...(studyId ? { entityId: studyId } : {}) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return rows.map((row) => {
      const payload = row.payload as Partial<TransitionShadowAuditEvent> & { readonly version?: "1.0" };
      return {
        version: payload.version ?? "1.0",
        id: row.id,
        studyId: payload.studyId,
        studyKey: payload.studyKey,
        actorId: payload.actorId ?? "unknown",
        actorRole: payload.actorRole,
        capability: payload.capability ?? "transition_shadow_study_view",
        action: payload.action ?? "study_viewed",
        reason: payload.reason,
        beforeSummary: payload.beforeSummary,
        afterSummary: payload.afterSummary,
        metadata: payload.metadata,
        createdAt: row.createdAt
      } satisfies TransitionShadowAuditEvent;
    });
  }
}

export async function resetTicket040WorkflowFixtures(prismaClient: PrismaClient) {
  const studies = await prismaClient.transitionExtendedShadowStudy.findMany({
    where: { studyKey: { contains: TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX }, fixtureKind: "development_fixture" },
    select: { id: true, familiarityRecordId: true }
  });
  const studyIds = studies.map((study) => study.id);
  await prismaClient.platformEvent.deleteMany({
    where: {
      entityType: "TransitionShadowAdminAudit",
      OR: [
        { entityId: { in: studyIds } },
        { payload: { path: ["fixtureVersion"], equals: TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION } }
      ]
    }
  });
  await prismaClient.transitionExtendedShadowObservation.deleteMany({ where: { studyId: { in: studyIds } } });
  await prismaClient.transitionExtendedShadowStudy.deleteMany({ where: { id: { in: studyIds } } });
  await prismaClient.currentEquipmentFamiliarityRecord.deleteMany({ where: { id: { in: studies.map((study) => study.familiarityRecordId).filter((id): id is string => !!id) } } });
}

export async function runTransitionShadowAdminWorkflowExercise(prismaClient: PrismaClient): Promise<TransitionShadowAdminWorkflowExerciseResult> {
  await resetTicket040WorkflowFixtures(prismaClient);
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Rawlings ICON 2026");
  const atlasProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Louisville Slugger Atlas 2026");
  const hypeProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Easton Hype Fire 2026");
  if (!currentProfile || !atlasProfile || !hypeProfile) throw new Error("Required canonical demo profiles were not found.");
  const repository = new PrismaTransitionShadowAdminRepository(prismaClient);
  const service = new TransitionShadowAdminService(repository);
  const happyInput = draftInput("happy-path", request.playerInput.playerId, currentProfile, atlasProfile, 0);
  await service.evaluateEligibility(happyInput, authorizedOperator, workflowBaseDate);
  const happyDraft = await service.createTransitionShadowStudyDraft(happyInput, authorizedOperator);
  const duplicateResult = await service.createTransitionShadowStudyDraft({ ...happyInput, id: deterministicUuid("ticket-040-duplicate") }, authorizedOperator)
    .then(() => false)
    .catch((error) => error instanceof TransitionShadowAdminError && error.code === "ACTIVE_STUDY_EXISTS");
  const happyPrediction = await service.captureTransitionShadowPrediction({
    studyId: happyDraft.study.id,
    compatibilityInput: { playerDNA: request.playerInput, currentEquipmentProfile: currentProfile, proposedEquipmentProfile: atlasProfile, evaluatedAt: date(1) },
    familiarity: happyDraft.study.familiarity,
    predictedAt: date(1)
  }, authorizedOperator);
  const predictionHash = happyPrediction.study.prediction?.predictionHash;
  const activeHappy = await service.startTransitionShadowObservation(happyDraft.study.id, { startedAt: date(2) }, authorizedOperator);
  const observedHappy = await service.addTransitionShadowObservation(activeHappy.id, observation("first_use", "minimal", date(3), "ticket-040-original"), authorizedOperator);
  const correctedHappy = await service.addTransitionShadowObservation(observedHappy.id, { ...observation("first_use", "mild", date(4), "ticket-040-correction"), sourceReference: "correction:ticket-040-original", notes: "Correction to equipment-specific adjustment label." }, authorizedOperator);
  const correctionAppendOnly = correctedHappy.observations.length === 2 && correctedHappy.observations[0]?.sourceReference === "ticket-040-original" && correctedHappy.observations[1]?.sourceReference === "correction:ticket-040-original";
  await service.addTransitionShadowObservation(correctedHappy.id, observation("early_sessions", "mild", date(8), "ticket-040-early"), authorizedOperator);
  await service.reviewTransitionShadowStudyForCompletion(happyDraft.study.id, authorizedOperator, date(20));
  const completedHappy = await service.completeTransitionShadowStudy(happyDraft.study.id, { completedAt: date(20) }, authorizedOperator);
  const immutableAttempt = await service.captureTransitionShadowPrediction({
    studyId: happyDraft.study.id,
    compatibilityInput: { playerDNA: request.playerInput, currentEquipmentProfile: currentProfile, proposedEquipmentProfile: atlasProfile, evaluatedAt: date(21) },
    familiarity: happyDraft.study.familiarity,
    predictedAt: date(21)
  }, authorizedOperator).then(() => false).catch(() => true);
  const reloadedHappy = await repository.getStudy(happyDraft.study.id);
  const predictionImmutable = immutableAttempt && !!predictionHash && reloadedHappy?.prediction?.predictionHash === predictionHash;

  const cancellationDraft = await service.createTransitionShadowStudyDraft(draftInput("cancellation", request.playerInput.playerId, currentProfile, hypeProfile, 30), authorizedOperator);
  await service.captureTransitionShadowPrediction({
    studyId: cancellationDraft.study.id,
    compatibilityInput: { playerDNA: request.playerInput, currentEquipmentProfile: currentProfile, proposedEquipmentProfile: hypeProfile, evaluatedAt: date(31) },
    familiarity: cancellationDraft.study.familiarity,
    predictedAt: date(31)
  }, authorizedOperator);
  const cancellationStatus = (await service.cancelTransitionShadowStudy(cancellationDraft.study.id, "Ticket #040 cancellation workflow fixture.", elevatedOperator, date(32))).status;
  const cancelledCannotContinue = await service.startTransitionShadowObservation(cancellationDraft.study.id, { startedAt: date(33) }, authorizedOperator).then(() => false).catch(() => true);

  const invalidationDraft = await service.createTransitionShadowStudyDraft(draftInput("invalidation", request.playerInput.playerId, currentProfile, atlasProfile, 60), authorizedOperator);
  await service.captureTransitionShadowPrediction({
    studyId: invalidationDraft.study.id,
    compatibilityInput: { playerDNA: request.playerInput, currentEquipmentProfile: currentProfile, proposedEquipmentProfile: atlasProfile, evaluatedAt: date(61) },
    familiarity: invalidationDraft.study.familiarity,
    predictedAt: date(61)
  }, authorizedOperator);
  const invalidationStatus = (await service.invalidateTransitionShadowStudy(invalidationDraft.study.id, { reasonCode: "incorrect_proposed_equipment", detail: "Ticket #040 invalidation workflow fixture.", invalidatedAt: date(62) }, elevatedOperator)).status;
  const invalidatedCannotComplete = await service.completeTransitionShadowStudy(invalidationDraft.study.id, { completedAt: date(63), overrideReason: "Should not complete." }, authorizedOperator).then(() => false).catch(() => true);

  const unauthorizedBefore = await repository.listAuditEvents();
  const unauthorizedResult = await service.createTransitionShadowStudyDraft(draftInput("unauthorized", request.playerInput.playerId, currentProfile, hypeProfile, 90), unauthorizedActor)
    .then(() => ({ blocked: false, code: undefined }))
    .catch((error) => ({ blocked: true, code: error instanceof TransitionShadowAdminError ? error.code : "INTERNAL_ERROR" }));
  const unauthorizedAfter = await repository.listAuditEvents();

  const allStudies = await service.listStudies({ includeSynthetic: true });
  const genuineStudies = await service.listStudies();
  const auditEvents = (await repository.listAuditEvents()).filter((event) => event.studyKey?.includes(TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX));
  const modelChanged = false;
  const livePromoted = false;
  return {
    fixtureVersion: TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION,
    workflowsAttempted: 3,
    workflowsCompleted: [completedHappy.status, cancellationStatus, invalidationStatus].filter(Boolean).length,
    happyPathStatus: completedHappy.status,
    cancellationStatus: cancelledCannotContinue ? cancellationStatus : "invalid",
    invalidationStatus: invalidatedCannotComplete ? invalidationStatus : "invalid",
    unauthorizedMutationBlocked: unauthorizedResult.blocked && unauthorizedAfter.length === unauthorizedBefore.length,
    unauthorizedErrorCode: unauthorizedResult.code,
    observationCorrectionAppendOnly: correctionAppendOnly,
    predictionImmutable,
    transitionPredictionVersion: reloadedHappy?.prediction?.transitionModelVersion,
    duplicateProtectionVerified: duplicateResult,
    workflowFixturesClassifiedAsGenuineEvidence: allStudies.some((study) => study.studyKey.includes(TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX) && classifyTransitionShadowStudy(study) === "genuine_internal_observation") || genuineStudies.some((study) => study.studyKey.includes(TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX)),
    auditEventsCreated: auditEvents.length,
    modelAutomaticallyChanged: modelChanged,
    livePromotionAutomaticallyRecommended: livePromoted
  };
}

export async function ticket040AuditEvents(prismaClient: PrismaClient) {
  const rows = await prismaClient.platformEvent.findMany({
    where: { entityType: "TransitionShadowAdminAudit", payload: { path: ["fixtureVersion"], equals: TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
  return rows.map((row) => ({
    id: row.id,
    entityId: row.entityId,
    createdAt: row.createdAt,
    payload: row.payload as Record<string, unknown>
  }));
}

export async function ticket040FixtureStudies(prismaClient: PrismaClient) {
  const rows = await prismaClient.transitionExtendedShadowStudy.findMany({
    where: { studyKey: { contains: TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX }, fixtureKind: "development_fixture" },
    include: { familiarityRecord: true, observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }, { createdAt: "asc" }] } },
    orderBy: [{ createdAt: "asc" }, { studyKey: "asc" }]
  });
  return rows.map((row) => toDomainStudyAllowingDraft(row));
}

function draftInput(key: string, playerId: string, currentProfile: { equipmentId: string; equipmentVariantId?: string }, proposedProfile: { equipmentId: string; equipmentVariantId?: string }, dayOffset: number): TransitionShadowCreateDraftInput {
  return {
    id: deterministicUuid(`ticket-040-${key}`),
    playerId,
    currentEquipmentId: currentProfile.equipmentId,
    currentEquipmentVariantId: currentProfile.equipmentVariantId,
    proposedEquipmentId: proposedProfile.equipmentId,
    proposedEquipmentVariantId: proposedProfile.equipmentVariantId,
    observationPeriodKey: `${TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX}-${key}`,
    evidenceClassification: "development_fixture",
    studyPurpose: "Ticket #040 deterministic admin workflow exercise fixture. Not real-world evidence.",
    familiarityInput: {
      playerId,
      equipmentId: currentProfile.equipmentId,
      equipmentVariantId: currentProfile.equipmentVariantId,
      estimatedSessionsUsed: 32,
      estimatedWeeksUsed: 12,
      regularUseFrequency: "multiple_times_weekly",
      usageContexts: ["practice", "games"],
      currentlyPrimaryEquipment: true,
      directlyReportedFamiliarity: "familiar",
      source: "combined",
      capturedAt: date(dayOffset)
    },
    internalNote: "Ticket #040 admin workflow fixture. Not real-world evidence.",
    createdAt: date(dayOffset)
  };
}

function observation(checkpoint: TransitionAdjustmentObservation["checkpoint"], demand: TransitionAdjustmentObservation["observedAdjustmentDemand"], observedAt: Date, sourceReference: string): TransitionAdjustmentObservation {
  return {
    version: "1.0",
    checkpoint,
    observedAt,
    equipmentActuallyUsed: true,
    meaningfulUseOccurred: true,
    observedAdjustmentDemand: demand,
    observationConfidence: "moderate",
    source: "parent_or_guardian",
    directlyWitnessed: true,
    sourceReference,
    sessionContext: { context: "practice", approximateSwingCount: "26_to_50", instructionOccurred: false },
    notes: "Ticket #040 equipment-specific workflow fixture."
  };
}

function toDomainStudyAllowingDraft(row: {
  readonly id: string;
  readonly studyKey: string;
  readonly playerId: string;
  readonly currentEquipmentId: string;
  readonly currentEquipmentVariantId: string | null;
  readonly proposedEquipmentId: string;
  readonly proposedEquipmentVariantId: string | null;
  readonly status: TransitionExtendedShadowStudy["status"];
  readonly predictionSnapshot: unknown;
  readonly predictedAt: Date | null;
  readonly observationWindowStartedAt: Date | null;
  readonly observationWindowCompletedAt: Date | null;
  readonly cancellationReason: string | null;
  readonly invalidationReason: string | null;
  readonly fixtureKind: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly familiarityRecord: {
    readonly playerId: string;
    readonly equipmentId: string;
    readonly equipmentVariantId: string | null;
    readonly level: CurrentEquipmentFamiliarityResult["level"];
    readonly numericReference: unknown;
    readonly confidence: CurrentEquipmentFamiliarityResult["confidence"];
    readonly evaluationReasons: unknown;
    readonly evaluationWarnings: unknown;
    readonly modelVersion: string;
    readonly capturedAt: Date;
  } | null;
  readonly observations: readonly {
    readonly checkpoint: TransitionAdjustmentObservation["checkpoint"];
    readonly observedAt: Date;
    readonly source: TransitionAdjustmentObservation["source"];
    readonly directlyWitnessed: boolean;
    readonly observationConfidence: TransitionAdjustmentObservation["observationConfidence"];
    readonly equipmentActuallyUsed: boolean;
    readonly meaningfulUseOccurred: boolean;
    readonly adjustmentObservation: unknown;
    readonly sessionContext: unknown;
    readonly notes: string | null;
  }[];
}): TransitionExtendedShadowStudy {
  if (!row.familiarityRecord) throw new Error(`Study ${row.studyKey} does not have a familiarity record.`);
  const prediction = row.predictionSnapshot ? row.predictionSnapshot as TransitionPredictionSnapshot : undefined;
  return {
    version: "1.0",
    id: row.id,
    studyKey: row.studyKey,
    playerId: row.playerId,
    currentEquipmentId: row.currentEquipmentId,
    currentEquipmentVariantId: row.currentEquipmentVariantId ?? undefined,
    proposedEquipmentId: row.proposedEquipmentId,
    proposedEquipmentVariantId: row.proposedEquipmentVariantId ?? undefined,
    status: row.status,
    familiarity: {
      version: "1.0",
      playerId: row.familiarityRecord.playerId,
      equipmentId: row.familiarityRecord.equipmentId,
      equipmentVariantId: row.familiarityRecord.equipmentVariantId ?? undefined,
      level: row.familiarityRecord.level,
      numericReference: decimalToNumber(row.familiarityRecord.numericReference),
      confidence: row.familiarityRecord.confidence,
      availableInputs: [],
      missingInputs: [],
      reasons: stringArray(row.familiarityRecord.evaluationReasons),
      warnings: stringArray(row.familiarityRecord.evaluationWarnings),
      evaluatedAt: row.familiarityRecord.capturedAt
    },
    prediction: prediction ? { ...prediction, predictedAt: row.predictedAt ?? new Date(String(prediction.predictedAt)) } : undefined,
    observationWindowStartedAt: row.observationWindowStartedAt ?? undefined,
    observationWindowCompletedAt: row.observationWindowCompletedAt ?? undefined,
    observations: row.observations.map((observationRow) => {
      const payload = observationRow.adjustmentObservation as Partial<TransitionAdjustmentObservation> & { readonly observedAt?: string };
      return {
        version: "1.0",
        checkpoint: observationRow.checkpoint,
        observedAt: new Date(payload.observedAt ?? observationRow.observedAt),
        equipmentActuallyUsed: observationRow.equipmentActuallyUsed,
        meaningfulUseOccurred: observationRow.meaningfulUseOccurred,
        observedAdjustmentDemand: payload.observedAdjustmentDemand,
        swingEffortAdjustment: payload.swingEffortAdjustment,
        timingAdjustment: payload.timingAdjustment,
        barrelControlAdjustment: payload.barrelControlAdjustment,
        balanceFeelAdjustment: payload.balanceFeelAdjustment,
        continuedUsingProposedEquipment: payload.continuedUsingProposedEquipment,
        returnedToPriorEquipment: payload.returnedToPriorEquipment,
        additionalAcclimationNeeded: payload.additionalAcclimationNeeded,
        observationConfidence: observationRow.observationConfidence,
        notes: observationRow.notes ?? payload.notes,
        source: observationRow.source,
        directlyWitnessed: observationRow.directlyWitnessed,
        sourceReference: payload.sourceReference,
        conflictsWithAnotherSource: payload.conflictsWithAnotherSource,
        sessionContext: observationRow.sessionContext as TransitionAdjustmentObservation["sessionContext"]
      };
    }),
    cancellationReason: row.cancellationReason ?? undefined,
    invalidationReason: row.invalidationReason ?? undefined,
    fixtureKind: row.fixtureKind === "real_observation" ? "real_observation" : "development_fixture",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function familiarityRecordData(result: CurrentEquipmentFamiliarityResult) {
  return {
    playerId: result.playerId,
    equipmentId: result.equipmentId,
    equipmentVariantId: result.equipmentVariantId,
    level: result.level,
    numericReference: result.numericReference,
    confidence: result.confidence,
    source: "combined" as const,
    inputSnapshot: json({ availableInputs: result.availableInputs, missingInputs: result.missingInputs }),
    evaluationReasons: json(result.reasons),
    evaluationWarnings: json(result.warnings),
    modelVersion: result.version,
    capturedAt: result.evaluatedAt
  };
}

function minimized(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  const forbidden = /password|token|secret|diagnosis|medical|school|address/i;
  return json(Object.fromEntries(Object.entries(value).filter(([key, item]) => !forbidden.test(key) && !forbidden.test(String(item)))));
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function decimalToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function date(days: number): Date {
  return new Date(workflowBaseDate.getTime() + days * 24 * 60 * 60 * 1000);
}

function deterministicUuid(label: string): string {
  const hex = Buffer.from(label).toString("hex").padEnd(32, "0").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
