import {
  CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION,
  evaluateCurrentEquipmentFamiliarity,
  type CurrentEquipmentFamiliarityResult
} from "../../../player-intelligence/src/index.ts";
import {
  TRANSITION_EXTENDED_SHADOW_POLICY_VERSION,
  TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
  compareTransitionShadowStudyOutcome,
  createTransitionPredictionSnapshot,
  evaluateTransitionCompatibilityV1_1,
  type TransitionAdjustmentObservation,
  type TransitionExtendedShadowStudy,
  type TransitionPredictionSnapshot
} from "../../../recommendation-intelligence/src/index.ts";
import { loadCanonicalDemoRecommendationRequest } from "../reports/canonical-demo-context.ts";
import { prisma } from "./client.ts";

const capturedAt = new Date("2026-08-05T00:00:00.000Z");
const startedAt = new Date("2026-08-06T00:00:00.000Z");
const completedAt = new Date("2026-08-20T00:00:00.000Z");

type DemoStudyScenario = {
  readonly keySuffix: string;
  readonly label: string;
  readonly proposedEquipmentName: string;
  readonly observations: readonly TransitionAdjustmentObservation[];
  readonly status: "observation_complete" | "observation_active" | "invalidated";
  readonly invalidationReason?: string;
};

const scenarios: readonly DemoStudyScenario[] = [
  {
    keySuffix: "broadly-aligned",
    label: "broadly aligned",
    proposedEquipmentName: "Louisville Slugger Atlas 2026",
    status: "observation_complete",
    observations: [
      observation("early_sessions", "mild", "parent_or_guardian", true),
      observation("acclimation_period", "minimal", "coach", true)
    ]
  },
  {
    keySuffix: "materially-different",
    label: "materially different",
    proposedEquipmentName: "Easton Hype Fire 2026",
    status: "observation_complete",
    observations: [
      observation("early_sessions", "very_substantial", "parent_or_guardian", true),
      observation("acclimation_period", "substantial", "coach", true)
    ]
  },
  {
    keySuffix: "conflicting-observation",
    label: "conflicting observation",
    proposedEquipmentName: "Louisville Slugger Atlas 2026",
    status: "observation_complete",
    observations: [
      observation("first_use", "minimal", "parent_or_guardian", true),
      { ...observation("early_sessions", "substantial", "coach", true), conflictsWithAnotherSource: true }
    ]
  },
  {
    keySuffix: "insufficient-observation",
    label: "insufficient observation",
    proposedEquipmentName: "Easton Hype Fire 2026",
    status: "observation_complete",
    observations: [
      { ...observation("first_use", "unknown", "parent_or_guardian", false), equipmentActuallyUsed: false, meaningfulUseOccurred: false, observationConfidence: "low" }
    ]
  },
  {
    keySuffix: "invalidated",
    label: "invalidated",
    proposedEquipmentName: "Louisville Slugger Atlas 2026",
    status: "invalidated",
    invalidationReason: "Development fixture invalidated because the proposed equipment identity was intentionally treated as unreliable.",
    observations: []
  }
];

async function main() {
  const request = await loadCanonicalDemoRecommendationRequest();
  const currentProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === "Rawlings ICON 2026");
  if (!currentProfile) throw new Error("Rawlings ICON 2026 canonical profile was not found. Run pnpm equipment:dna:evaluations:seed first.");

  const currentEquipment = await equipmentById(currentProfile.equipmentId);
  const currentVariant = currentProfile.equipmentVariantId ? await variantById(currentProfile.equipmentVariantId) : undefined;
  const playerId = request.playerInput.playerId;
  const familiarityInput = {
    playerId,
    equipmentId: currentProfile.equipmentId,
    equipmentVariantId: currentProfile.equipmentVariantId,
    estimatedSessionsUsed: 30,
    estimatedWeeksUsed: 12,
    regularUseFrequency: "multiple_times_weekly" as const,
    usageContexts: ["practice", "games", "batting_cage"] as const,
    currentlyPrimaryEquipment: true,
    directlyReportedFamiliarity: "familiar" as const,
    source: "combined" as const,
    capturedAt
  };
  const familiarity = evaluateCurrentEquipmentFamiliarity(familiarityInput);
  const familiarityRecord = await upsertFamiliarityRecord(familiarity, familiarityInput);

  let created = 0;
  let updated = 0;
  let observationsWritten = 0;
  const outcomes: string[] = [];

  for (const scenario of scenarios) {
    const proposedProfile = request.canonicalProfiles.find((profile) => profile.equipmentName === scenario.proposedEquipmentName);
    if (!proposedProfile) throw new Error(`Canonical profile ${scenario.proposedEquipmentName} was not found.`);
    const proposedEquipment = await equipmentById(proposedProfile.equipmentId);
    const proposedVariant = proposedProfile.equipmentVariantId ? await variantById(proposedProfile.equipmentVariantId) : undefined;
    const predictionResult = evaluateTransitionCompatibilityV1_1({
      playerDNA: request.playerInput,
      currentEquipmentProfile: currentProfile,
      proposedEquipmentProfile: proposedProfile,
      evaluatedAt: capturedAt
    });
    if (predictionResult.status !== "completed") throw new Error(`Transition v1.1 prediction did not complete for ${scenario.label}.`);
    const prediction = createTransitionPredictionSnapshot(predictionResult, familiarity, capturedAt);
    const studyKey = [
      playerId,
      currentProfile.equipmentVariantId ?? currentProfile.equipmentId,
      proposedProfile.equipmentVariantId ?? proposedProfile.equipmentId,
      `ticket-038-${scenario.keySuffix}`
    ].join(":");

    const existing = await prisma.transitionExtendedShadowStudy.findUnique({ where: { studyKey } });
    const study = await prisma.transitionExtendedShadowStudy.upsert({
      where: { studyKey },
      update: {
        status: scenario.status,
        studyVersion: TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
        policyVersion: TRANSITION_EXTENDED_SHADOW_POLICY_VERSION,
        familiarityRecordId: familiarityRecord.id,
        predictionSnapshot: json(prediction),
        predictionInputHash: prediction.inputHash,
        predictionHash: prediction.predictionHash,
        transitionModelVersion: prediction.transitionModelVersion,
        transitionPolicyVersion: prediction.transitionPolicyVersion,
        interpolationVersion: prediction.interpolationVersion,
        predictedAt: prediction.predictedAt,
        observationWindowStartedAt: startedAt,
        observationWindowCompletedAt: scenario.status === "observation_complete" ? completedAt : null,
        cancellationReason: null,
        invalidationReason: scenario.invalidationReason ?? null,
        fixtureKind: "development_fixture"
      },
      create: {
        studyKey,
        playerId,
        currentEquipmentId: currentEquipment.id,
        currentEquipmentVariantId: currentVariant?.id,
        proposedEquipmentId: proposedEquipment.id,
        proposedEquipmentVariantId: proposedVariant?.id,
        status: scenario.status,
        studyVersion: TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
        policyVersion: TRANSITION_EXTENDED_SHADOW_POLICY_VERSION,
        familiarityRecordId: familiarityRecord.id,
        predictionSnapshot: json(prediction),
        predictionInputHash: prediction.inputHash,
        predictionHash: prediction.predictionHash,
        transitionModelVersion: prediction.transitionModelVersion,
        transitionPolicyVersion: prediction.transitionPolicyVersion,
        interpolationVersion: prediction.interpolationVersion,
        predictedAt: prediction.predictedAt,
        observationWindowStartedAt: startedAt,
        observationWindowCompletedAt: scenario.status === "observation_complete" ? completedAt : null,
        invalidationReason: scenario.invalidationReason ?? null,
        fixtureKind: "development_fixture"
      }
    });
    existing ? updated++ : created++;
    await prisma.transitionExtendedShadowObservation.deleteMany({ where: { studyId: study.id } });
    if (scenario.observations.length) {
      await prisma.transitionExtendedShadowObservation.createMany({
        data: scenario.observations.map((item) => ({
          studyId: study.id,
          checkpoint: item.checkpoint,
          observedAt: item.observedAt,
          source: item.source,
          directlyWitnessed: item.directlyWitnessed,
          observationConfidence: item.observationConfidence,
          equipmentActuallyUsed: item.equipmentActuallyUsed,
          meaningfulUseOccurred: item.meaningfulUseOccurred,
          adjustmentObservation: json({
            ...item,
            fixtureKind: "development_fixture",
            syntheticObservation: true,
            notRealWorldEvidence: true,
            observedAt: item.observedAt.toISOString()
          }),
          sessionContext: item.sessionContext ? json(item.sessionContext) : undefined,
          notes: item.notes
        }))
      });
      observationsWritten += scenario.observations.length;
    }
    outcomes.push(`${scenario.label}: ${compareTransitionShadowStudyOutcome(toDomainStudy(study, prediction, familiarity, scenario.observations)).comparisonStatus}`);
  }

  console.log("Transition Extended Shadow Seed");
  console.log(`Familiarity records: 1 upserted (${familiarity.level}, ${familiarity.confidence})`);
  console.log(`Studies created: ${created}`);
  console.log(`Studies updated: ${updated}`);
  console.log(`Synthetic observations written: ${observationsWritten}`);
  for (const outcome of outcomes) console.log(`- ${outcome}`);
  console.log("Fixture label: development_fixture, synthetic_observation, not_real_world_evidence");
}

async function upsertFamiliarityRecord(result: CurrentEquipmentFamiliarityResult, inputSnapshot: object) {
  const existing = await prisma.currentEquipmentFamiliarityRecord.findFirst({
    where: {
      playerId: result.playerId,
      equipmentId: result.equipmentId,
      equipmentVariantId: result.equipmentVariantId,
      modelVersion: CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION,
      capturedAt
    }
  });
  const data = {
    level: result.level,
    numericReference: result.numericReference,
    confidence: result.confidence,
    source: "combined" as const,
    inputSnapshot: json(inputSnapshot),
    evaluationReasons: json(result.reasons),
    evaluationWarnings: json(result.warnings),
    modelVersion: CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION,
    capturedAt
  };
  if (existing) return prisma.currentEquipmentFamiliarityRecord.update({ where: { id: existing.id }, data });
  return prisma.currentEquipmentFamiliarityRecord.create({
    data: {
      playerId: result.playerId,
      equipmentId: result.equipmentId,
      equipmentVariantId: result.equipmentVariantId,
      ...data
    }
  });
}

function observation(
  checkpoint: TransitionAdjustmentObservation["checkpoint"],
  observedAdjustmentDemand: TransitionAdjustmentObservation["observedAdjustmentDemand"],
  source: TransitionAdjustmentObservation["source"],
  directlyWitnessed: boolean
): TransitionAdjustmentObservation {
  return {
    version: "1.0",
    checkpoint,
    observedAt: checkpoint === "acclimation_period" ? completedAt : startedAt,
    equipmentActuallyUsed: true,
    meaningfulUseOccurred: true,
    observedAdjustmentDemand,
    observationConfidence: "moderate",
    source,
    directlyWitnessed,
    sessionContext: {
      context: "practice",
      approximateSwingCount: "26_to_50",
      instructionOccurred: false,
      unusualFatigueReported: false,
      equipmentConfigurationChanged: false
    },
    notes: "Synthetic development fixture for extended-shadow validation only."
  };
}

function toDomainStudy(
  study: { readonly id: string; readonly studyKey: string; readonly playerId: string; readonly currentEquipmentId: string; readonly currentEquipmentVariantId: string | null; readonly proposedEquipmentId: string; readonly proposedEquipmentVariantId: string | null; readonly status: TransitionExtendedShadowStudy["status"]; readonly fixtureKind: string | null; readonly createdAt: Date; readonly updatedAt: Date; readonly invalidationReason: string | null },
  prediction: TransitionPredictionSnapshot,
  familiarity: CurrentEquipmentFamiliarityResult,
  observations: readonly TransitionAdjustmentObservation[]
): TransitionExtendedShadowStudy {
  return {
    version: "1.0",
    id: study.id,
    studyKey: study.studyKey,
    playerId: study.playerId,
    currentEquipmentId: study.currentEquipmentId,
    currentEquipmentVariantId: study.currentEquipmentVariantId ?? undefined,
    proposedEquipmentId: study.proposedEquipmentId,
    proposedEquipmentVariantId: study.proposedEquipmentVariantId ?? undefined,
    status: study.status,
    familiarity,
    prediction,
    observations,
    invalidationReason: study.invalidationReason ?? undefined,
    fixtureKind: study.fixtureKind === "real_observation" ? "real_observation" : "development_fixture",
    createdAt: study.createdAt,
    updatedAt: study.updatedAt
  };
}

async function equipmentById(id: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id } });
  if (!equipment) throw new Error(`Equipment ${id} was not found.`);
  return equipment;
}

async function variantById(id: string) {
  const variant = await prisma.equipmentVariant.findUnique({ where: { id } });
  if (!variant) throw new Error(`Equipment variant ${id} was not found.`);
  return variant;
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
