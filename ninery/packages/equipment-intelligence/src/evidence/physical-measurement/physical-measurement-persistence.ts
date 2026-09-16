import { buildPhysicalMeasurementEvidence } from "./physical-measurement-protocol.js";
import { reviewPhysicalMeasurementSession } from "./physical-measurement-validation.js";
import type { PhysicalMeasurementCatalogIdentity, PhysicalMeasurementPersistenceRepository, PhysicalMeasurementSession } from "./physical-measurement-protocol.types.js";

export async function persistPhysicalMeasurementSession(session: PhysicalMeasurementSession, repository: PhysicalMeasurementPersistenceRepository, confirmed: boolean, catalogIdentity?: PhysicalMeasurementCatalogIdentity) {
  const review = reviewPhysicalMeasurementSession(session, catalogIdentity);
  if (!confirmed) return { created: 0, unchanged: 0, writesPerformed: false as const, review };
  if (!review.persistenceEligible) throw new Error(`Physical measurement commit blocked: ${review.blockers.join(", ")}.`);
  const quality = new Map(review.blocks.map((block) => [block.measurementType, block.quality]));
  const records = session.measurementBlocks.map((block) => buildPhysicalMeasurementEvidence(session, block, quality.get(block.measurementType)!));
  const result = await repository.persistSessionAtomically(records);
  return { ...result, writesPerformed: true as const, review };
}

export function classifyPhysicalMeasurementIndependence(left: Pick<PhysicalMeasurementSession, "specimenReference" | "operatorId" | "measurementBlocks">, right: Pick<PhysicalMeasurementSession, "specimenReference" | "operatorId" | "measurementBlocks">) {
  if (left.specimenReference !== right.specimenReference) return "different_specimen" as const;
  const leftInstruments = left.measurementBlocks.map((block) => block.instrument.instrumentReference).sort().join("|");
  const rightInstruments = right.measurementBlocks.map((block) => block.instrument.instrumentReference).sort().join("|");
  const operator = left.operatorId === right.operatorId ? "same_operator" : "different_operator";
  const instrument = leftInstruments === rightInstruments ? "same_instrument" : "different_instrument";
  return `same_specimen_${operator}_${instrument}` as const;
}
