import {
  loadEquipmentDNANumericReferenceProfile
} from "@ninery/equipment-intelligence";
import { CompatibilityScoringEngine } from "../scoring/compatibility-scoring-engine.js";
import { compareCanonicalCandidateRecommendationRuns } from "../candidate/canonical-candidate.comparison.js";
import {
  runCanonicalCandidateRecommendationDualRun,
  type CanonicalCandidateRecommendationRequest
} from "../candidate/index.js";
import {
  THREE_PATH_RECOMMENDATION_COMPARISON_VERSION,
  type CanonicalCandidateAttributeSourceSelectionResult,
  type CanonicalCandidateThreePathResult
} from "./canonical-attribute-source-selection.types.js";
import { selectCanonicalCandidateAttributeSources } from "./canonical-attribute-source-selection.evaluator.js";
import {
  NumericReferenceCandidateAdapterError,
  adaptCanonicalEquipmentDNAUsingSelectedSources
} from "./numeric-reference-candidate.adapter.js";
import { analyzePrecisionRestoration } from "./canonical-source-selection.comparison.js";

export async function runCanonicalCandidateThreePathComparison(
  input: CanonicalCandidateRecommendationRequest
): Promise<CanonicalCandidateThreePathResult> {
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const ordinalRun = await runCanonicalCandidateRecommendationDualRun(input);
  const legacyAuthoritative = ordinalRun.legacyAuthoritative;
  const sourceSelection: CanonicalCandidateAttributeSourceSelectionResult[] = [];
  const numericEquipment = [];
  let numericReferenceExecutionStatus: CanonicalCandidateThreePathResult["numericReferenceExecutionStatus"] = "completed";

  for (const profile of input.canonicalProfiles) {
    const admission = input.admissionDecisions.find((decision) => decision.equipmentId === profile.equipmentId && decision.equipmentVariantId === profile.equipmentVariantId);
    const baseline = input.legacyEquipmentInputs.find((equipment) => equipment.equipmentId === profile.equipmentId && equipment.variantId === profile.equipmentVariantId);
    if (!admission || !baseline) {
      numericReferenceExecutionStatus = "blocked";
      continue;
    }
    const numericProfile = loadEquipmentDNANumericReferenceProfile(profile);
    const selection = selectCanonicalCandidateAttributeSources({
      canonicalProfile: profile,
      admissionDecision: admission,
      numericReferences: numericProfile.references.map((reference) => reference.numericReference).filter((reference): reference is NonNullable<typeof reference> => Boolean(reference)),
      evaluatedAt
    });
    sourceSelection.push(selection);
    if (!selection.candidateInputAllowed) {
      numericReferenceExecutionStatus = "blocked";
      continue;
    }
    try {
      numericEquipment.push(adaptCanonicalEquipmentDNAUsingSelectedSources({
        canonicalProfile: profile,
        sourceSelection: selection,
        legacyBaseline: baseline
      }).equipment);
    } catch (error) {
      if (error instanceof NumericReferenceCandidateAdapterError) numericReferenceExecutionStatus = "blocked";
      else numericReferenceExecutionStatus = "failed";
    }
  }

  let numericReferenceCandidate;
  if (numericReferenceExecutionStatus === "completed" && numericEquipment.length === input.canonicalProfiles.length) {
    try {
      numericReferenceCandidate = new CompatibilityScoringEngine().score({
        playerDNA: input.playerInput,
        equipment: numericEquipment,
        context: input.requestContext
      });
    } catch {
      numericReferenceExecutionStatus = "failed";
    }
  } else if (numericReferenceExecutionStatus === "completed") {
    numericReferenceExecutionStatus = "blocked";
  }

  const ordinalVariance = ordinalRun.variance;
  const numericReferenceVariance = compareCanonicalCandidateRecommendationRuns({
    legacy: legacyAuthoritative,
    candidate: numericReferenceCandidate,
    candidateFailed: numericReferenceExecutionStatus !== "completed"
  });

  return {
    version: "1.0",
    comparisonVersion: THREE_PATH_RECOMMENDATION_COMPARISON_VERSION,
    legacyAuthoritative,
    ordinalCandidate: ordinalRun.canonicalCandidate,
    numericReferenceCandidate,
    ordinalExecutionStatus: ordinalRun.candidateExecutionStatus === "completed" ? "completed" : ordinalRun.candidateExecutionStatus === "candidate_failed" ? "failed" : "blocked",
    numericReferenceExecutionStatus,
    ordinalVariance,
    numericReferenceVariance,
    sourceSelection,
    precisionRestoration: analyzePrecisionRestoration({
      legacy: legacyAuthoritative,
      ordinalCandidate: ordinalRun.canonicalCandidate,
      numericReferenceCandidate
    }),
    liveRecommendationSource: "legacy",
    candidateAffectsLiveResult: false,
    evaluatedAt
  };
}
