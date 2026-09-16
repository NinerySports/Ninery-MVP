export const physicalMeasurementTypes = ["actual_mass", "overall_length", "balance_point", "barrel_diameter", "handle_diameter"] as const;
export type PhysicalMeasurementType = (typeof physicalMeasurementTypes)[number];
export type MeasurementQuality = "complete_repeatable" | "complete_variation_observed" | "incomplete" | "instrument_uncertain" | "method_deviation" | "physical_identity_uncertain" | "blocked";
export type EquipmentCondition = "new_or_near_new" | "normal_used_condition" | "materially_worn" | "damaged" | "modified" | "unknown";
export type InstrumentCalibrationStatus = "verified" | "operator_checked" | "unknown" | "not_applicable";
export type PhysicalVerificationConfidence = "confident" | "uncertain";
export type PhysicalObservedQuantity = "mass" | "length" | "balance_point_distance" | "diameter" | "circumference";
export type DiameterMethodSelection = "direct_caliper" | "circumference_derived";

export type PhysicalMeasurementInstrument = {
  readonly instrumentType: string;
  readonly instrumentReference: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly resolution?: number;
  readonly resolutionUnit?: string;
  readonly calibrationStatus: InstrumentCalibrationStatus;
  readonly calibrationDate?: string;
  readonly operatorNotes?: string;
};

export type PhysicalMeasurementTrial = { readonly trialNumber: number; readonly value?: number; readonly repositioned: boolean; readonly notes?: string };

export type PhysicalMeasurementBlock = {
  readonly measurementType: PhysicalMeasurementType;
  readonly method: string;
  readonly methodVersion: "1.0";
  readonly observedQuantity?: PhysicalObservedQuantity;
  readonly referencePoints: string;
  readonly rawUnit: string;
  readonly measuredSurface?: "bare_handle" | "factory_grip_outer_diameter" | "aftermarket_grip_outer_diameter";
  readonly locationFromKnobMm?: number;
  readonly instrument: PhysicalMeasurementInstrument;
  readonly trials: readonly PhysicalMeasurementTrial[];
  readonly aggregationMethod: "median";
  readonly methodCompliant: boolean;
  readonly deviations: readonly string[];
  readonly limitations: readonly string[];
};

export type PhysicalMeasurementSession = {
  readonly measurementSessionId: string;
  readonly protocol: "ninery_physical_measurement";
  readonly protocolVersion: "1.0";
  readonly provenanceClassification: "real_physical_measurement";
  readonly equipmentId: string;
  readonly equipmentVariantId: string;
  readonly specimenReference: string;
  readonly measurementDate: string;
  readonly operatorId: string;
  readonly physicalVerification: {
    readonly equipmentId: string; readonly equipmentVariantId: string; readonly manufacturer: string; readonly model: string;
    readonly modelYear: number; readonly certification: string; readonly nominalLengthInches: number; readonly nominalWeightOunces: number;
    readonly nominalDrop: number; readonly verifiedAt: string; readonly verifiedBy: string; readonly confidence: PhysicalVerificationConfidence;
  };
  readonly equipmentCondition: EquipmentCondition;
  readonly modifications: readonly string[];
  readonly environmentNotes?: string;
  readonly measurementBlocks: readonly PhysicalMeasurementBlock[];
  readonly sessionLimitations: readonly string[];
};

export type RepeatabilitySummary = { readonly trialCount: number; readonly minimum?: number; readonly maximum?: number; readonly range?: number; readonly mean?: number; readonly median?: number; readonly standardDeviation?: number; readonly threshold: "calibration_pending" };
export type PhysicalMeasurementBlockReview = { readonly measurementType: PhysicalMeasurementType; readonly method: string; readonly observedQuantity: PhysicalObservedQuantity; readonly complete: boolean; readonly blockers: readonly string[]; readonly warnings: readonly string[]; readonly aggregate?: number; readonly aggregateUnit: string; readonly normalizedAggregate?: number; readonly normalizedUnit?: string; readonly derivationMethod?: "diameter_equals_circumference_divided_by_pi"; readonly repeatability: RepeatabilitySummary; readonly quality: MeasurementQuality };
export type PhysicalMeasurementSessionReview = { readonly sessionId: string; readonly valid: boolean; readonly persistenceEligible: boolean; readonly blockers: readonly string[]; readonly warnings: readonly string[]; readonly blocks: readonly PhysicalMeasurementBlockReview[]; readonly writesPerformed: false; readonly behavioralEvaluationsPlanned: 0; readonly numericReferencesPlanned: 0; readonly recommendationImpact: "none" };
export type PhysicalMeasurementCatalogIdentity = { readonly equipmentId: string; readonly equipmentVariantId: string; readonly manufacturer: string; readonly model: string; readonly modelYear: number; readonly certification: string; readonly nominalLengthInches: number; readonly nominalWeightOunces: number; readonly nominalDrop: number };

export type PhysicalMeasurementEvidenceRecord = { readonly id: string; readonly sourceReference: string; readonly equipmentId: string; readonly equipmentVariantId: string; readonly attributeKey: PhysicalMeasurementType; readonly sourceDate: string; readonly operatorId: string; readonly rawValue: object; readonly normalizedValue: object; readonly unit: string };
export type PhysicalMeasurementPersistenceRepository = { persistSessionAtomically(records: readonly PhysicalMeasurementEvidenceRecord[]): Promise<{ readonly created: number; readonly unchanged: number }> };
