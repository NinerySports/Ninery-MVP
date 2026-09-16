import type { EvidenceSupportRole, MultiSourceEvidenceClass } from "../equipment-multi-source-strategy.types.js";

export const equipmentDNAConstructSupportStateValues = ["no_evidence", "single_source_support", "multiple_source_support", "mixed_evidence", "review_required"] as const;
export type EquipmentDNAConstructSupportState = (typeof equipmentDNAConstructSupportStateValues)[number];
export type EquipmentDNAEvidenceKnowledgeLevel = "equipment" | "variant" | "specimen";
export type EquipmentDNAEvidenceDifferenceState = "no_comparable_evidence" | "consistent_or_no_material_difference" | "descriptive_difference" | "potential_conflict_requires_review";

export type EquipmentDNAEvidenceIdentity = {
  readonly equipmentId: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly modelYear?: number;
  readonly certification?: string;
  readonly variant?: { readonly id: string; readonly sku?: string; readonly lengthInches?: number; readonly weightOunces?: number; readonly dropWeight?: number };
};

export type EquipmentDNACatalogFactInput = {
  readonly key: string;
  readonly value: unknown;
  readonly unit?: string;
  readonly level: "equipment" | "variant";
  readonly sourceName: string;
  readonly sourceReference?: string;
  readonly verifiedAt?: Date | string;
};

export type EquipmentDNAEvidenceRecordInput = {
  readonly id: string;
  readonly equipmentId?: string;
  readonly equipmentVariantId?: string;
  readonly targetLevel: "equipment" | "variant";
  readonly attributeKey: string;
  readonly sourceType: string;
  readonly sourceName: string;
  readonly sourceReference?: string;
  readonly sourceDate?: Date | string;
  readonly method: string;
  readonly rawValue?: unknown;
  readonly normalizedValue?: unknown;
  readonly unit?: string;
  readonly notes?: string;
  readonly status: string;
  readonly evaluatorType?: string;
  readonly evaluatorReference?: string;
};

export type EquipmentDNAEvidenceItem = {
  readonly id: string;
  readonly evidenceClass: MultiSourceEvidenceClass;
  readonly claimKey: string;
  readonly recordAttributeKey: string;
  readonly knowledgeLevel: EquipmentDNAEvidenceKnowledgeLevel;
  readonly targetLevel: "equipment" | "variant";
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly specimenReference?: string;
  readonly sessionReference?: string;
  readonly protocolIdentity?: string;
  readonly protocolVersion?: string;
  readonly method: string;
  readonly unit?: string;
  readonly sourceName: string;
  readonly sourceReference?: string;
  readonly sourceDate?: string;
  readonly operatorOrEvaluatorReference?: string;
  readonly rawObservation?: unknown;
  readonly aggregate?: unknown;
  readonly normalizedRepresentation?: unknown;
  readonly derivation?: { readonly quantity?: string; readonly method?: string; readonly value?: unknown; readonly independentMeasurement: false };
  readonly limitations: readonly string[];
  readonly qualityState?: string;
  readonly independenceGroup?: string;
  readonly status: string;
};

export type EquipmentDNAConstructSupport = {
  readonly construct: string;
  readonly lifecycle: string;
  readonly canonicalAttribute: boolean;
  readonly relevantEvidenceClasses: readonly { readonly evidenceClass: MultiSourceEvidenceClass; readonly role: EvidenceSupportRole }[];
  readonly evidence: readonly EquipmentDNAEvidenceItem[];
  readonly missingRelevantEvidenceClasses: readonly MultiSourceEvidenceClass[];
  readonly sourceCount: number;
  readonly sessionCount: number;
  readonly specimenCount: number;
  readonly evidenceClassesRepresented: readonly MultiSourceEvidenceClass[];
  readonly supportState: EquipmentDNAConstructSupportState;
  readonly synthesisSufficient: false;
  readonly reviewReasons: readonly string[];
};

export type EquipmentDNAEvidenceReadModel = {
  readonly version: "1.0";
  readonly identity: EquipmentDNAEvidenceIdentity;
  readonly evidence: readonly EquipmentDNAEvidenceItem[];
  readonly evidenceByClass: Readonly<Record<MultiSourceEvidenceClass, readonly EquipmentDNAEvidenceItem[]>>;
  readonly evidenceClassCounts: Readonly<Record<MultiSourceEvidenceClass, number>>;
  readonly missingEvidenceClasses: readonly MultiSourceEvidenceClass[];
  readonly constructSupport: readonly EquipmentDNAConstructSupport[];
  readonly differences: readonly { readonly key: string; readonly state: EquipmentDNAEvidenceDifferenceState; readonly explanation: string; readonly catalogEvidenceIds: readonly string[]; readonly specimenEvidenceIds: readonly string[] }[];
  readonly firewalls: { readonly canonicalChanges: false; readonly numericReferenceChanges: false; readonly modeledEstimatesCreated: false; readonly recommendationImpact: "none"; readonly writesPerformed: false };
};
