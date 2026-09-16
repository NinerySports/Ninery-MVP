import type { CurrentEquipmentFamiliarityResult } from "@ninery/player-intelligence";
import {
  evaluateTransitionCompatibilityV1_1,
  type TransitionCompatibilityV1_1Result
} from "../v1_1/index.js";
import type { TransitionCompatibilityInput } from "../transition-compatibility.types.js";
import { stableHash } from "./transition-shadow-study.hashing.js";
import { compareTransitionShadowStudyOutcome } from "./transition-shadow-study.comparison.js";
import {
  TRANSITION_EXTENDED_SHADOW_POLICY_VERSION,
  TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
  type TransitionAdjustmentObservation,
  type TransitionExtendedShadowStudy,
  type TransitionOutcomeComparison,
  type TransitionPredictionSnapshot,
  type TransitionShadowStudyStatus
} from "./transition-shadow-study.types.js";

export type TransitionShadowStudyRepository = {
  readonly createStudy: (study: TransitionExtendedShadowStudy) => Promise<TransitionExtendedShadowStudy>;
  readonly updateStudy: (study: TransitionExtendedShadowStudy) => Promise<TransitionExtendedShadowStudy>;
  readonly getStudy: (id: string) => Promise<TransitionExtendedShadowStudy | undefined>;
  readonly listStudies: () => Promise<readonly TransitionExtendedShadowStudy[]>;
};

export class InMemoryTransitionShadowStudyRepository implements TransitionShadowStudyRepository {
  private readonly studies = new Map<string, TransitionExtendedShadowStudy>();

  async createStudy(study: TransitionExtendedShadowStudy): Promise<TransitionExtendedShadowStudy> {
    if ([...this.studies.values()].some((candidate) => candidate.studyKey === study.studyKey && active(candidate.status))) {
      throw new Error("An active transition extended-shadow study already exists for this study key.");
    }
    this.studies.set(study.id, study);
    return study;
  }

  async updateStudy(study: TransitionExtendedShadowStudy): Promise<TransitionExtendedShadowStudy> {
    this.studies.set(study.id, study);
    return study;
  }

  async getStudy(id: string): Promise<TransitionExtendedShadowStudy | undefined> {
    return this.studies.get(id);
  }

  async listStudies(): Promise<readonly TransitionExtendedShadowStudy[]> {
    return [...this.studies.values()].sort((a, b) => a.studyKey.localeCompare(b.studyKey));
  }
}

export class TransitionShadowStudyService {
  constructor(private readonly repository: TransitionShadowStudyRepository) {}

  async createDraftStudy(input: {
    readonly id: string;
    readonly playerId: string;
    readonly currentEquipmentId: string;
    readonly currentEquipmentVariantId?: string;
    readonly proposedEquipmentId: string;
    readonly proposedEquipmentVariantId?: string;
    readonly familiarity: CurrentEquipmentFamiliarityResult;
    readonly observationPeriodKey: string;
    readonly createdAt: Date;
    readonly fixtureKind?: TransitionExtendedShadowStudy["fixtureKind"];
  }): Promise<TransitionExtendedShadowStudy> {
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
      familiarity: input.familiarity,
      observations: [],
      fixtureKind: input.fixtureKind,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
    return this.repository.createStudy(study);
  }

  async capturePrediction(studyId: string, input: TransitionCompatibilityInput, familiarity: CurrentEquipmentFamiliarityResult, predictedAt: Date): Promise<TransitionExtendedShadowStudy> {
    const study = await requiredStudy(this.repository, studyId);
    requireStatus(study, ["draft"]);
    const result = evaluateTransitionCompatibilityV1_1({ ...input, evaluatedAt: predictedAt });
    if (result.status !== "completed" || result.score === undefined || result.band === undefined) {
      throw new Error(`Transition v1.1 prediction cannot be captured because result status is ${result.status}.`);
    }
    const prediction = createTransitionPredictionSnapshot(result, familiarity, predictedAt);
    return this.repository.updateStudy({
      ...study,
      status: "prediction_captured",
      prediction,
      updatedAt: predictedAt
    });
  }

  async startObservation(studyId: string, startedAt: Date): Promise<TransitionExtendedShadowStudy> {
    const study = await requiredStudy(this.repository, studyId);
    requireStatus(study, ["prediction_captured"]);
    return this.repository.updateStudy({ ...study, status: "observation_active", observationWindowStartedAt: startedAt, updatedAt: startedAt });
  }

  async addObservation(studyId: string, observation: TransitionAdjustmentObservation): Promise<TransitionExtendedShadowStudy> {
    const study = await requiredStudy(this.repository, studyId);
    if (!study.prediction) throw new Error("Observation requires a captured prediction.");
    requireStatus(study, ["observation_active"]);
    validateObservation(study, observation);
    return this.repository.updateStudy({ ...study, observations: [...study.observations, observation], updatedAt: observation.observedAt });
  }

  async completeStudy(studyId: string, completedAt: Date, options: { readonly allowInsufficientObservation?: boolean } = {}): Promise<TransitionExtendedShadowStudy> {
    const study = await requiredStudy(this.repository, studyId);
    requireStatus(study, ["observation_active"]);
    const meaningful = study.observations.filter((observation) => observation.meaningfulUseOccurred && observation.equipmentActuallyUsed);
    if (!options.allowInsufficientObservation && !meaningful.length) throw new Error("Completion requires at least one meaningful-use observation.");
    return this.repository.updateStudy({ ...study, status: "observation_complete", observationWindowCompletedAt: completedAt, updatedAt: completedAt });
  }

  async cancelStudy(studyId: string, reason: string, cancelledAt: Date): Promise<TransitionExtendedShadowStudy> {
    const study = await requiredStudy(this.repository, studyId);
    requireStatus(study, ["draft", "prediction_captured", "observation_active"]);
    return this.repository.updateStudy({ ...study, status: "cancelled", cancellationReason: reason, updatedAt: cancelledAt });
  }

  async invalidateStudy(studyId: string, reason: string, invalidatedAt: Date): Promise<TransitionExtendedShadowStudy> {
    const study = await requiredStudy(this.repository, studyId);
    return this.repository.updateStudy({ ...study, status: "invalidated", invalidationReason: reason, updatedAt: invalidatedAt });
  }

  async compareStudyOutcome(studyId: string, comparedAt = new Date()): Promise<TransitionOutcomeComparison> {
    return compareTransitionShadowStudyOutcome(await requiredStudy(this.repository, studyId), comparedAt);
  }

  async getStudy(studyId: string): Promise<TransitionExtendedShadowStudy | undefined> {
    return this.repository.getStudy(studyId);
  }

  async listStudies(): Promise<readonly TransitionExtendedShadowStudy[]> {
    return this.repository.listStudies();
  }
}

export function createTransitionPredictionSnapshot(
  result: TransitionCompatibilityV1_1Result,
  familiarity: CurrentEquipmentFamiliarityResult,
  predictedAt: Date
): TransitionPredictionSnapshot {
  if (result.score === undefined || result.band === undefined) throw new Error("Completed score and band are required for prediction snapshot.");
  const inputSnapshot = {
    playerId: result.playerId,
    currentEquipmentId: result.currentEquipmentId,
    currentEquipmentVariantId: result.currentEquipmentVariantId,
    proposedEquipmentId: result.proposedEquipmentId,
    proposedEquipmentVariantId: result.proposedEquipmentVariantId,
    playerReadiness: result.playerReadiness,
    currentEquipment: result.currentEquipment,
    proposedEquipment: result.proposedEquipment,
    familiarity,
    versions: result.trace.versions
  };
  const inputHash = stableHash(inputSnapshot);
  const predictionPayload = {
    transitionModelVersion: result.modelVersion,
    transitionPolicyVersion: result.policyVersion,
    interpolationVersion: result.interpolationVersion,
    predictedScore: result.score,
    predictedBand: result.band,
    predictedConfidence: result.confidence,
    dimensionResults: result.dimensions,
    reasons: result.reasons,
    tradeoffs: result.tradeoffs,
    missingInformation: result.missingInformation,
    playerReadinessSnapshot: result.playerReadiness,
    currentEquipmentSnapshot: result.currentEquipment,
    proposedEquipmentSnapshot: result.proposedEquipment,
    familiaritySnapshot: familiarity,
    trace: result.trace,
    inputHash,
    predictedAt
  };
  return { ...predictionPayload, predictionHash: stableHash(predictionPayload) };
}

export function createTransitionShadowStudyKey(input: {
  readonly playerId: string;
  readonly currentEquipmentVariantId?: string;
  readonly currentEquipmentId: string;
  readonly proposedEquipmentVariantId?: string;
  readonly proposedEquipmentId: string;
  readonly observationPeriodKey: string;
}): string {
  return [
    input.playerId,
    input.currentEquipmentVariantId ?? input.currentEquipmentId,
    input.proposedEquipmentVariantId ?? input.proposedEquipmentId,
    input.observationPeriodKey
  ].join(":");
}

export function validateObservation(study: TransitionExtendedShadowStudy, observation: TransitionAdjustmentObservation): void {
  if (!["first_use", "early_sessions", "acclimation_period", "custom"].includes(observation.checkpoint)) throw new Error("Invalid observation checkpoint.");
  if (observation.observedAt < (study.prediction?.predictedAt ?? study.createdAt)) throw new Error("Observation date cannot predate prediction capture.");
  if (!observation.source || observation.directlyWitnessed === undefined) throw new Error("Observation source and direct-witness metadata are required.");
  if (!observation.equipmentActuallyUsed && hasAdjustmentValues(observation)) throw new Error("Observed adjustment values require actual equipment use.");
  if (observation.notes && /diagnosis|anxiety|medical|school|address|secret/i.test(observation.notes)) throw new Error("Observation notes contain prohibited sensitive content.");
}

function hasAdjustmentValues(observation: TransitionAdjustmentObservation): boolean {
  return [
    observation.observedAdjustmentDemand,
    observation.swingEffortAdjustment,
    observation.timingAdjustment,
    observation.barrelControlAdjustment,
    observation.balanceFeelAdjustment
  ].some((value) => value !== undefined && value !== "unknown");
}

function requireStatus(study: TransitionExtendedShadowStudy, allowed: readonly TransitionShadowStudyStatus[]): void {
  if (!allowed.includes(study.status)) throw new Error(`Study status ${study.status} does not allow this lifecycle transition.`);
}

async function requiredStudy(repository: TransitionShadowStudyRepository, studyId: string): Promise<TransitionExtendedShadowStudy> {
  const study = await repository.getStudy(studyId);
  if (!study) throw new Error(`Transition extended-shadow study ${studyId} was not found.`);
  return study;
}

function active(status: TransitionShadowStudyStatus): boolean {
  return status === "draft" || status === "prediction_captured" || status === "observation_active";
}
