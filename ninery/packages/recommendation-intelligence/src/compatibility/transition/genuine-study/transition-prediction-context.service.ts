import type { CanonicalEquipmentDNAProfile, EquipmentDNAAttributeKey } from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult } from "@ninery/player-intelligence";
import { createTransitionPredictionSnapshot, stableHash } from "../extended-shadow/index.js";
import { normalizeCurrentEquipmentTransitionContext, normalizeProposedEquipmentTransitionContext } from "../transition-compatibility.normalization.js";
import type { TransitionCompatibilityInput } from "../transition-compatibility.types.js";
import { evaluateTransitionCompatibilityV1_1 } from "../v1_1/index.js";
import { classifyTransitionShadowStudy } from "../admin/index.js";
import {
  finding,
  isTransitionPredictionSupportedPlayerDNA,
  optionalEquipmentWarningCode,
  optionalPlayerDNAWarnings,
  requiredEquipmentInputKeys,
  requiredPlayerDNAFindings,
  transitionPredictionOptionalEquipmentAttributes
} from "./transition-prediction-context.policy.js";
import {
  TRANSITION_CONTEXT_LOADER_VERSION,
  TRANSITION_CONTEXT_PROVENANCE_VERSION,
  TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION,
  TRANSITION_PREDICTION_INPUT_REVIEW_VERSION,
  type TransitionPredictionContextBlockerCode,
  type TransitionPredictionContextDriftResult,
  type TransitionPredictionContextFinding,
  type TransitionPredictionContextProvenance,
  type TransitionPredictionContextLoaderRepository,
  type TransitionPredictionContextWarningCode,
  type TransitionPredictionDryRunResult,
  type TransitionPredictionInputAssemblyRequest,
  type TransitionPredictionInputAssemblyResult,
  type TransitionPredictionInputReview
} from "./transition-prediction-context.types.js";

export class TransitionPredictionContextLoaderError extends Error {}

export class TransitionPredictionContextLoaderService {
  constructor(private readonly repository: TransitionPredictionContextLoaderRepository) {}

  async assemblePredictionInput(request: TransitionPredictionInputAssemblyRequest): Promise<TransitionPredictionInputAssemblyResult> {
    const assembledAt = request.assembledAt ?? new Date();
    const mode = request.mode ?? "capture";
    const blockers: TransitionPredictionContextFinding[] = [];
    const warnings: TransitionPredictionContextFinding[] = [];
    const study = await this.repository.getStudy(request.studyId);

    if (!study) {
      blockers.push(finding("MISSING_STUDY", "study", `Study ${request.studyId} was not found.`));
      return emptyResult(mode, assembledAt, blockers, warnings);
    }
    if (classifyTransitionShadowStudy(study) !== "genuine_internal_observation") blockers.push(finding("STUDY_NOT_GENUINE", "study", "Study is not classified as genuine_internal_observation."));
    if (mode === "capture" && study.status !== "draft") blockers.push(finding("STUDY_STATUS_INVALID", "study", "Prediction capture assembly requires a draft study."));
    if (mode === "capture" && study.observations.length) blockers.push(finding("OBSERVATIONS_ALREADY_STARTED", "study", "Prediction capture must happen before observations are recorded."));

    const player = await this.repository.getPlayer(study.playerId);
    if (!player) blockers.push(finding("MISSING_PLAYER", "player", `Player ${study.playerId} was not found.`));
    if (player?.synthetic) blockers.push(finding("SYNTHETIC_PLAYER", "player", "Genuine prediction context cannot use a synthetic player."));

    const [currentEquipment, proposedEquipment] = await Promise.all([
      this.repository.getEquipment(study.currentEquipmentId),
      this.repository.getEquipment(study.proposedEquipmentId)
    ]);
    if (!currentEquipment) blockers.push(finding("MISSING_CURRENT_EQUIPMENT", "current_equipment", `Current equipment ${study.currentEquipmentId} was not found.`));
    if (!proposedEquipment) blockers.push(finding("MISSING_PROPOSED_EQUIPMENT", "proposed_equipment", `Proposed equipment ${study.proposedEquipmentId} was not found.`));

    if (study.currentEquipmentVariantId) {
      const variant = await this.repository.getEquipmentVariant(study.currentEquipmentVariantId);
      if (!variant || variant.equipmentId !== study.currentEquipmentId) blockers.push(finding("MISSING_CURRENT_VARIANT", "current_equipment", `Current variant ${study.currentEquipmentVariantId} was not found for the current equipment.`));
    } else {
      blockers.push(finding("MISSING_CURRENT_VARIANT", "current_equipment", "Current equipment variant is required for transition prediction context."));
    }
    if (study.proposedEquipmentVariantId) {
      const variant = await this.repository.getEquipmentVariant(study.proposedEquipmentVariantId);
      if (!variant || variant.equipmentId !== study.proposedEquipmentId) blockers.push(finding("MISSING_PROPOSED_VARIANT", "proposed_equipment", `Proposed variant ${study.proposedEquipmentVariantId} was not found for the proposed equipment.`));
    } else {
      blockers.push(finding("MISSING_PROPOSED_VARIANT", "proposed_equipment", "Proposed equipment variant is required for transition prediction context."));
    }

    const playerDNA = await this.resolvePlayerDNA(study.playerId, warnings, blockers);
    if (playerDNA) {
      if (!isTransitionPredictionSupportedPlayerDNA(playerDNA)) blockers.push(finding("UNSUPPORTED_PLAYER_DNA_VERSION", "player_dna", `Player DNA version ${playerDNA.version} is not supported by transition v1.1.`));
      blockers.push(...requiredPlayerDNAFindings(playerDNA));
      warnings.push(...optionalPlayerDNAWarnings(playerDNA));
    }

    const currentEquipmentProfile = await this.loadEquipmentProfile("current", study.currentEquipmentId, study.currentEquipmentVariantId, assembledAt, blockers, warnings);
    const proposedEquipmentProfile = await this.loadEquipmentProfile("proposed", study.proposedEquipmentId, study.proposedEquipmentVariantId, assembledAt, blockers, warnings);

    if (study.familiarity.level === "unknown") blockers.push(finding("MISSING_FAMILIARITY", "familiarity", "Current-equipment familiarity must be captured before prediction assembly."));

    const auditEvents = await this.repository.listAuditEvents?.(study.id) ?? [];
    const provenance: TransitionPredictionContextProvenance = {
      version: TRANSITION_CONTEXT_PROVENANCE_VERSION,
      studyId: study.id,
      studyKey: study.studyKey,
      playerId: study.playerId,
      playerDNAProfileId: playerDNA?.profileId,
      playerDNAVersion: playerDNA?.version,
      currentEquipmentId: study.currentEquipmentId,
      currentEquipmentVariantId: study.currentEquipmentVariantId,
      currentEquipmentDNAProfileVersion: currentEquipmentProfile?.version,
      proposedEquipmentId: study.proposedEquipmentId,
      proposedEquipmentVariantId: study.proposedEquipmentVariantId,
      proposedEquipmentDNAProfileVersion: proposedEquipmentProfile?.version,
      familiarityLevel: study.familiarity.level,
      familiarityConfidence: study.familiarity.confidence,
      sourceAuditEventIds: auditEvents.map((event) => event.id).sort(),
      assembledAt
    };

    const ready = blockers.length === 0 && !!playerDNA && !!proposedEquipmentProfile && !!currentEquipmentProfile;
    const input = ready ? {
      playerDNA,
      currentEquipmentProfile,
      proposedEquipmentProfile,
      evaluatedAt: assembledAt
    } satisfies TransitionCompatibilityInput : undefined;
    const semanticInputHash = input ? hashTransitionPredictionInput(input, provenance) : undefined;

    return {
      version: TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION,
      loaderVersion: TRANSITION_CONTEXT_LOADER_VERSION,
      mode,
      study,
      input,
      playerDNA,
      currentEquipmentProfile,
      proposedEquipmentProfile,
      familiarity: study.familiarity,
      provenance,
      semanticInputHash,
      blockers,
      warnings,
      ready,
      assembledAt
    };
  }

  reviewAssembly(result: TransitionPredictionInputAssemblyResult): TransitionPredictionInputReview {
    return {
      version: TRANSITION_PREDICTION_INPUT_REVIEW_VERSION,
      studyId: result.study?.id ?? "unknown",
      ready: result.ready,
      semanticInputHash: result.semanticInputHash,
      blockerCodes: result.blockers.map((item) => item.code).filter(isBlockerCode),
      warningCodes: result.warnings.map((item) => item.code).filter(isWarningCode),
      playerDNA: result.playerDNA && !result.blockers.some((item) => item.sourceArea === "player_dna" || item.sourceArea === "player") ? "ready" : "blocked",
      currentEquipmentDNA: result.currentEquipmentProfile && !result.blockers.some((item) => item.sourceArea === "current_equipment") ? "ready" : "blocked",
      proposedEquipmentDNA: result.proposedEquipmentProfile && !result.blockers.some((item) => item.sourceArea === "proposed_equipment") ? "ready" : "blocked",
      familiarity: result.familiarity && !result.blockers.some((item) => item.sourceArea === "familiarity") ? "ready" : "blocked",
      predictionInput: result.ready ? "ready" : "blocked",
      reviewedAt: result.assembledAt
    };
  }

  async dryRunPrediction(request: TransitionPredictionInputAssemblyRequest): Promise<TransitionPredictionDryRunResult> {
    const assembly = await this.assemblePredictionInput({ ...request, mode: "diagnostic" });
    const review = this.reviewAssembly(assembly);
    return {
      review,
      prediction: assembly.input ? evaluateTransitionCompatibilityV1_1(assembly.input) : undefined,
      wouldPersist: false,
      liveRecommendationUseAllowed: false,
      modelAutomaticallyChanged: false
    };
  }

  async evaluateContextDrift(studyId: string, evaluatedAt = new Date()): Promise<TransitionPredictionContextDriftResult> {
    const assembly = await this.assemblePredictionInput({ studyId, mode: "diagnostic", assembledAt: evaluatedAt });
    const capturedInputHash = assembly.study?.prediction?.inputHash;
    const currentSnapshotInputHash = assembly.input && assembly.familiarity
      ? createTransitionPredictionSnapshot(evaluateTransitionCompatibilityV1_1(assembly.input), assembly.familiarity, assembly.input.evaluatedAt ?? evaluatedAt).inputHash
      : undefined;
    const currentSemanticInputHash = assembly.semanticInputHash;
    return {
      studyId,
      capturedInputHash,
      currentSemanticInputHash,
      driftDetected: !!capturedInputHash && !!currentSnapshotInputHash && capturedInputHash !== currentSnapshotInputHash,
      changedAreas: capturedInputHash && currentSnapshotInputHash && capturedInputHash !== currentSnapshotInputHash ? ["semantic_prediction_context"] : [],
      blockers: assembly.blockers,
      warnings: assembly.warnings,
      evaluatedAt
    };
  }

  private async resolvePlayerDNA(playerId: string, warnings: TransitionPredictionContextFinding[], blockers: TransitionPredictionContextFinding[]): Promise<PlayerDNAProfileResult | undefined> {
    const profiles = [...await this.repository.listPlayerDNAProfiles(playerId)]
      .filter((profile) => profile.status !== "archived")
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime() || b.profileId.localeCompare(a.profileId));
    if (!profiles.length) {
      blockers.push(finding("MISSING_PLAYER_DNA", "player_dna", "No generated Player DNA profile was found for the study player."));
      return undefined;
    }
    if (profiles.length > 1) warnings.push(finding("MULTIPLE_PLAYER_DNA_PROFILES", "player_dna", "Multiple Player DNA profiles exist; the newest non-archived profile was selected deterministically."));
    return profiles[0];
  }

  private async loadEquipmentProfile(target: "current" | "proposed", equipmentId: string, equipmentVariantId: string | undefined, generatedAt: Date, blockers: TransitionPredictionContextFinding[], warnings: TransitionPredictionContextFinding[]): Promise<CanonicalEquipmentDNAProfile | undefined> {
    if (!equipmentVariantId) return undefined;
    try {
      const profile = await this.repository.loadCanonicalEquipmentDNAProfile({ equipmentId, equipmentVariantId, generatedAt });
      if (!profile) {
        blockers.push(finding(target === "current" ? "MISSING_CURRENT_EQUIPMENT_DNA" : "MISSING_PROPOSED_EQUIPMENT_DNA", target === "current" ? "current_equipment" : "proposed_equipment", `${target} canonical Equipment DNA profile was not found.`));
        return undefined;
      }
      const context = target === "current" ? normalizeCurrentEquipmentTransitionContext(profile) : normalizeProposedEquipmentTransitionContext(profile);
      const requiredKeys = requiredEquipmentInputKeys(target);
      for (const key of requiredKeys) {
        if (context[key] === undefined) blockers.push(finding(target === "current" ? "MISSING_CURRENT_SPEC" : "MISSING_PROPOSED_SPEC", target === "current" ? "current_equipment" : "proposed_equipment", `${target} equipment is missing required ${key} context.`));
      }
      for (const key of transitionPredictionOptionalEquipmentAttributes) {
        const warningCode = optionalEquipmentWarningCode(target, key);
        if (warningCode && !hasAttribute(profile, key)) warnings.push(finding(warningCode, target === "current" ? "current_equipment" : "proposed_equipment", `${target} equipment is missing optional ${key} context.`));
      }
      return profile;
    } catch (error) {
      blockers.push(finding(target === "current" ? "MISSING_CURRENT_EQUIPMENT_DNA" : "MISSING_PROPOSED_EQUIPMENT_DNA", target === "current" ? "current_equipment" : "proposed_equipment", error instanceof Error ? error.message : `${target} canonical Equipment DNA profile could not be loaded.`));
      return undefined;
    }
  }
}

export function hashTransitionPredictionInput(input: TransitionCompatibilityInput, provenance: { readonly assembledAt?: Date; readonly sourceAuditEventIds?: readonly string[] } & Record<string, unknown>): string {
  return stableHash({
    assemblyVersion: TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION,
    playerDNA: {
      profileId: input.playerDNA.profileId,
      playerId: input.playerDNA.playerId,
      version: input.playerDNA.version,
      scores: input.playerDNA.scores,
      categories: input.playerDNA.categories,
      inputSnapshot: {
        playerProfile: input.playerDNA.inputSnapshot.playerProfile,
        growthMeasurements: input.playerDNA.inputSnapshot.growthMeasurements
      }
    },
    currentEquipmentProfile: semanticProfile(input.currentEquipmentProfile),
    proposedEquipmentProfile: semanticProfile(input.proposedEquipmentProfile),
    provenance: {
      version: provenance.version,
      studyId: provenance.studyId,
      playerId: provenance.playerId,
      currentEquipmentId: provenance.currentEquipmentId,
      currentEquipmentVariantId: provenance.currentEquipmentVariantId,
      proposedEquipmentId: provenance.proposedEquipmentId,
      proposedEquipmentVariantId: provenance.proposedEquipmentVariantId,
      familiarityLevel: provenance.familiarityLevel,
      familiarityConfidence: provenance.familiarityConfidence
    }
  });
}

function semanticProfile(profile: CanonicalEquipmentDNAProfile | undefined) {
  if (!profile) return undefined;
  return {
    version: profile.version,
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    readiness: profile.readiness.ready,
    maturity: profile.maturity,
    attributes: profile.attributes.map((attribute) => ({
      key: attribute.key,
      definitionVersion: attribute.definitionVersion,
      targetLevel: attribute.targetLevel,
      value: attribute.value,
      confidence: attribute.confidence,
      evaluationMethod: attribute.evaluationMethod,
      evidenceIds: attribute.evidence.map((evidence) => evidence.evidenceRecordId).sort()
    })).sort((a, b) => a.key.localeCompare(b.key) || a.targetLevel.localeCompare(b.targetLevel))
  };
}

function hasAttribute(profile: CanonicalEquipmentDNAProfile, key: EquipmentDNAAttributeKey): boolean {
  return profile.attributes.some((attribute) => attribute.key === key);
}

function emptyResult(mode: TransitionPredictionInputAssemblyResult["mode"], assembledAt: Date, blockers: readonly TransitionPredictionContextFinding[], warnings: readonly TransitionPredictionContextFinding[]): TransitionPredictionInputAssemblyResult {
  return {
    version: TRANSITION_PREDICTION_INPUT_ASSEMBLY_VERSION,
    loaderVersion: TRANSITION_CONTEXT_LOADER_VERSION,
    mode,
    blockers,
    warnings,
    ready: false,
    assembledAt
  };
}

function isBlockerCode(code: string): code is TransitionPredictionContextBlockerCode {
  return [
    "MISSING_STUDY", "STUDY_NOT_GENUINE", "STUDY_STATUS_INVALID", "OBSERVATIONS_ALREADY_STARTED", "MISSING_PLAYER", "SYNTHETIC_PLAYER",
    "MISSING_PLAYER_DNA", "AMBIGUOUS_PLAYER_DNA", "UNSUPPORTED_PLAYER_DNA_VERSION", "MISSING_CURRENT_EQUIPMENT", "MISSING_CURRENT_VARIANT",
    "MISSING_CURRENT_SPEC", "MISSING_PROPOSED_EQUIPMENT", "MISSING_PROPOSED_VARIANT", "MISSING_PROPOSED_SPEC", "MISSING_CURRENT_EQUIPMENT_DNA",
    "MISSING_PROPOSED_EQUIPMENT_DNA", "MISSING_EXPERIENCE_READINESS", "MISSING_BAT_CONTROL_READINESS", "MISSING_DEVELOPMENT_READINESS",
    "MISSING_FAMILIARITY", "AMBIGUOUS_FAMILIARITY", "SOURCE_TEMPORALLY_INVALID", "UNSUPPORTED_CONTEXT_VERSION"
  ].includes(code);
}

function isWarningCode(code: string): code is TransitionPredictionContextWarningCode {
  return [
    "MULTIPLE_PLAYER_DNA_PROFILES", "MISSING_OPTIONAL_GROWTH_CONTEXT", "MISSING_OPTIONAL_SWING_FEEL_CONTEXT", "MISSING_OPTIONAL_CURRENT_BALANCE",
    "MISSING_OPTIONAL_CURRENT_SWING_EFFORT", "MISSING_OPTIONAL_PROPOSED_BALANCE", "MISSING_OPTIONAL_PROPOSED_SWING_EFFORT", "PLAYER_DNA_GENERATED_AFTER_CAPTURE",
    "EQUIPMENT_DNA_GENERATED_AFTER_CAPTURE"
  ].includes(code);
}
