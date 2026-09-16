import { pathToFileURL } from "node:url";
import {
  compareTransitionShadowStudyOutcome,
  type TransitionAdjustmentObservation,
  type TransitionExtendedShadowStudy,
  type TransitionPredictionSnapshot
} from "../../../recommendation-intelligence/src/index.ts";
import type { CurrentEquipmentFamiliarityResult } from "../../../player-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const rows = await prisma.transitionExtendedShadowStudy.findMany({
    where: { fixtureKind: "development_fixture", studyKey: { contains: "ticket-038-" } },
    include: {
      player: true,
      currentEquipment: true,
      currentEquipmentVariant: true,
      proposedEquipment: true,
      proposedEquipmentVariant: true,
      familiarityRecord: true,
      observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }] }
    },
    orderBy: { studyKey: "asc" }
  });

  console.log("Transition Extended Shadow Report");
  console.log("");
  if (!rows.length) {
    console.log("No development fixture studies found. Run pnpm transition:extended-shadow:seed first.");
    return;
  }

  for (const row of rows) {
    const study = toDomainStudy(row);
    const comparison = compareTransitionShadowStudyOutcome(study);
    console.log(`${row.player.firstName} ${row.player.lastName}: ${label(row.currentEquipment)} -> ${label(row.proposedEquipment)}`);
    console.log(`Study key: ${row.studyKey}`);
    console.log(`Status: ${row.status}`);
    console.log(`Fixture labels: development_fixture, synthetic_observation, not_real_world_evidence`);
    console.log(`Prediction: ${comparison.predictedScore} (${comparison.predictedBand}, ${comparison.predictedAdjustmentCategory})`);
    console.log(`Observations: ${row.observations.length}`);
    for (const observation of row.observations) {
      const payload = observation.adjustmentObservation as { readonly observedAdjustmentDemand?: string; readonly notRealWorldEvidence?: boolean };
      console.log(`- ${observation.checkpoint}: ${payload.observedAdjustmentDemand ?? "unknown"} via ${observation.source}; synthetic=${payload.notRealWorldEvidence === true ? "yes" : "unknown"}`);
    }
    console.log(`Outcome comparison: ${comparison.comparisonStatus}`);
    console.log(`Observer agreement: ${comparison.observerAgreement}`);
    console.log(`Outcome confidence: ${comparison.outcomeConfidence}`);
    console.log(`Model change recommended: ${comparison.modelChangeRecommended ? "yes" : "no"}`);
    console.log(`Live promotion recommended: ${comparison.livePromotionRecommended ? "yes" : "no"}`);
    if (comparison.warnings.length) {
      console.log("Warnings:");
      for (const warning of comparison.warnings) console.log(`- ${warning.code}: ${warning.message}`);
    }
    console.log("");
  }
}

export function toDomainStudy(row: {
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
  if (!row.predictionSnapshot) throw new Error(`Study ${row.studyKey} does not have a prediction snapshot.`);
  if (!row.familiarityRecord) throw new Error(`Study ${row.studyKey} does not have a familiarity record.`);
  const prediction = row.predictionSnapshot as TransitionPredictionSnapshot;
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
    prediction: { ...prediction, predictedAt: row.predictedAt ?? new Date(String(prediction.predictedAt)) },
    observationWindowStartedAt: row.observationWindowStartedAt ?? undefined,
    observationWindowCompletedAt: row.observationWindowCompletedAt ?? undefined,
    observations: row.observations.map((observation) => {
      const payload = observation.adjustmentObservation as Partial<TransitionAdjustmentObservation> & { readonly observedAt?: string };
      return {
        version: "1.0",
        checkpoint: observation.checkpoint,
        observedAt: new Date(payload.observedAt ?? observation.observedAt),
        equipmentActuallyUsed: observation.equipmentActuallyUsed,
        meaningfulUseOccurred: observation.meaningfulUseOccurred,
        observedAdjustmentDemand: payload.observedAdjustmentDemand,
        swingEffortAdjustment: payload.swingEffortAdjustment,
        timingAdjustment: payload.timingAdjustment,
        barrelControlAdjustment: payload.barrelControlAdjustment,
        balanceFeelAdjustment: payload.balanceFeelAdjustment,
        continuedUsingProposedEquipment: payload.continuedUsingProposedEquipment,
        returnedToPriorEquipment: payload.returnedToPriorEquipment,
        additionalAcclimationNeeded: payload.additionalAcclimationNeeded,
        observationConfidence: observation.observationConfidence,
        notes: observation.notes ?? payload.notes,
        source: observation.source,
        directlyWitnessed: observation.directlyWitnessed,
        sourceReference: payload.sourceReference,
        conflictsWithAnotherSource: payload.conflictsWithAnotherSource,
        sessionContext: observation.sessionContext as TransitionAdjustmentObservation["sessionContext"]
      };
    }),
    cancellationReason: row.cancellationReason ?? undefined,
    invalidationReason: row.invalidationReason ?? undefined,
    fixtureKind: row.fixtureKind === "real_observation" ? "real_observation" : "development_fixture",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function label(equipment: { readonly manufacturer: string; readonly model: string; readonly modelYear: number | null }) {
  return `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}`;
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => prisma.$disconnect());
}
