import { COMPATIBILITY_SCORING_CONFIG_VERSION } from "../compatibility.types.js";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import { compareCanonicalCandidateRecommendationRuns } from "./canonical-candidate.comparison.js";
import {
  adaptCanonicalEquipmentDNAForRecommendation,
  CanonicalCandidateAdmissionError,
  CanonicalCandidateMappingError,
  enforceCanonicalCandidateAdmission
} from "./canonical-equipment-input.adapter.js";
import {
  CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION,
  CANONICAL_CANDIDATE_DUAL_RUN_VERSION,
  CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION,
  type CanonicalCandidateAdmissionFailure,
  type CanonicalCandidateDualRunResult,
  type CanonicalCandidateMappedAttribute,
  type CanonicalCandidateMappingFailure,
  type CanonicalCandidateRecommendationRequest
} from "./canonical-candidate.types.js";

export async function runCanonicalCandidateRecommendationDualRun(
  input: CanonicalCandidateRecommendationRequest
): Promise<CanonicalCandidateDualRunResult> {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const engine = new CompatibilityScoringEngine();
  const legacyAuthoritative = engine.score({
    playerDNA: input.playerInput,
    equipment: [...input.legacyEquipmentInputs],
    context: input.requestContext
  });

  const admissionFailures: CanonicalCandidateAdmissionFailure[] = [];
  const mappingFailures: CanonicalCandidateMappingFailure[] = [];
  const mappedAttributes: CanonicalCandidateMappedAttribute[] = [];
  const warnings: string[] = [];
  const candidateEquipment = [];
  const approvedEquipmentIds: string[] = [];

  for (const profile of input.canonicalProfiles) {
    const admission = input.admissionDecisions.find(
      (decision) => decision.equipmentId === profile.equipmentId && decision.equipmentVariantId === profile.equipmentVariantId
    );
    const failures = enforceCanonicalCandidateAdmission({ canonicalProfile: profile, admissionDecision: admission });
    admissionFailures.push(...failures);
    if (failures.length > 0 || !admission) continue;

    const legacyBaseline = input.legacyEquipmentInputs.find(
      (equipment) => equipment.equipmentId === profile.equipmentId && equipment.variantId === profile.equipmentVariantId
    );
    if (!legacyBaseline) {
      mappingFailures.push({
        equipmentId: profile.equipmentId,
        equipmentVariantId: profile.equipmentVariantId,
        canonicalKey: "length",
        targetRecommendationField: "legacyBaseline",
        reason: `Missing legacy baseline equipment input for ${profile.equipmentId}.`
      });
      continue;
    }

    try {
      const adapted = adaptCanonicalEquipmentDNAForRecommendation({
        canonicalProfile: profile,
        admissionDecision: admission,
        legacyBaseline
      });
      candidateEquipment.push(adapted.equipment);
      approvedEquipmentIds.push(profile.equipmentId);
      mappedAttributes.push(...adapted.mappedAttributes);
      warnings.push(...adapted.warnings);
    } catch (error) {
      if (error instanceof CanonicalCandidateAdmissionError) admissionFailures.push(...error.failures);
      else if (error instanceof CanonicalCandidateMappingError) mappingFailures.push(...error.failures);
      else {
        mappingFailures.push({
          equipmentId: profile.equipmentId,
          equipmentVariantId: profile.equipmentVariantId,
          canonicalKey: "length",
          targetRecommendationField: "candidateInput",
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  if (admissionFailures.length > 0) {
    return buildResult({
      legacyAuthoritative,
      status: "blocked_by_admission",
      admissionFailures,
      mappingFailures,
      mappedAttributes,
      warnings,
      approvedEquipmentIds,
      evaluatedAt
    });
  }

  if (mappingFailures.length > 0 || candidateEquipment.length !== input.canonicalProfiles.length) {
    return buildResult({
      legacyAuthoritative,
      status: "blocked_missing_mapping",
      admissionFailures,
      mappingFailures,
      mappedAttributes,
      warnings,
      approvedEquipmentIds,
      evaluatedAt
    });
  }

  try {
    const canonicalCandidate = engine.score({
      playerDNA: input.playerInput,
      equipment: candidateEquipment,
      context: input.requestContext
    });
    return buildResult({
      legacyAuthoritative,
      canonicalCandidate,
      status: "completed",
      admissionFailures,
      mappingFailures,
      mappedAttributes,
      warnings,
      approvedEquipmentIds,
      evaluatedAt
    });
  } catch (error) {
    return buildResult({
      legacyAuthoritative,
      status: "candidate_failed",
      admissionFailures,
      mappingFailures: [{
        equipmentId: "candidate-run",
        canonicalKey: "length",
        targetRecommendationField: "engine",
        reason: error instanceof Error ? error.message : String(error)
      }],
      mappedAttributes,
      warnings,
      approvedEquipmentIds,
      evaluatedAt
    });
  }
}

function buildResult(input: {
  readonly legacyAuthoritative: CanonicalCandidateDualRunResult["legacyAuthoritative"];
  readonly canonicalCandidate?: CanonicalCandidateDualRunResult["canonicalCandidate"];
  readonly status: CanonicalCandidateDualRunResult["candidateExecutionStatus"];
  readonly admissionFailures: readonly CanonicalCandidateAdmissionFailure[];
  readonly mappingFailures: readonly CanonicalCandidateMappingFailure[];
  readonly mappedAttributes: readonly CanonicalCandidateMappedAttribute[];
  readonly warnings: readonly string[];
  readonly approvedEquipmentIds: readonly string[];
  readonly evaluatedAt: Date;
}): CanonicalCandidateDualRunResult {
  const variance = compareCanonicalCandidateRecommendationRuns({
    legacy: input.legacyAuthoritative,
    candidate: input.canonicalCandidate,
    candidateFailed: input.status !== "completed"
  });
  return {
    version: CANONICAL_CANDIDATE_DUAL_RUN_VERSION,
    comparisonVersion: CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION,
    candidateInputMappingVersion: CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION,
    legacyAuthoritative: input.legacyAuthoritative,
    canonicalCandidate: input.canonicalCandidate,
    candidateExecutionStatus: input.status,
    variance,
    admissionSummary: {
      approvedEquipmentIds: [...new Set(input.approvedEquipmentIds)].sort(),
      rejectedEquipmentIds: [...new Set(input.admissionFailures.map((failure) => failure.equipmentId))],
      reasons: input.admissionFailures.map((failure) => failure.reason)
    },
    mappingSummary: {
      mappedAttributes: input.mappedAttributes,
      warnings: [...new Set(input.warnings)].sort(),
      failures: input.mappingFailures
    },
    liveRecommendationSource: "legacy",
    candidateAffectsLiveResult: false,
    versions: {
      recommendationEngine: COMPATIBILITY_SCORING_CONFIG_VERSION,
      admissionPolicy: "1.0",
      canonicalProfile: "1.0",
      candidateInputMapping: CANONICAL_CANDIDATE_INPUT_MAPPING_VERSION,
      dualRunComparison: CANONICAL_CANDIDATE_DUAL_RUN_COMPARISON_VERSION
    },
    evaluatedAt: input.evaluatedAt
  };
}
