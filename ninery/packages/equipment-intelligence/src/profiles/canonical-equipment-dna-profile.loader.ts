import {
  CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION,
  type CanonicalEquipmentDNAAttributeValue,
  type CanonicalEquipmentDNAConflict,
  type CanonicalEquipmentDNAEvidenceSummary,
  type CanonicalEquipmentDNAProfile
} from "./canonical-equipment-dna-profile.types.js";
import {
  EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
  getEquipmentDNAAttributeDefinition,
  isEquipmentDNAAttributeKey,
  validateEquipmentDNAAttributeValue,
  type EquipmentDNAAttributeKey,
  type EquipmentDNAAttributeNormalizedValue
} from "../attributes/index.js";
import { EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION } from "../evaluations/index.js";
import {
  EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION,
  EQUIPMENT_DNA_READINESS_MODEL_VERSION,
  assessEquipmentDNARecommendationReadiness,
  assessEquipmentDNAMaturity,
  detectEquipmentEvidenceConflict,
  validateEquipmentDNAAttributeEvaluation,
  type EquipmentDNAAttributeEvaluation,
  type EquipmentDNAEvidenceRecord,
  type EquipmentDNATargetLevel
} from "../evidence/index.js";

export class CanonicalEquipmentDNAProfileError extends Error {}
export class CanonicalEquipmentDNAEquipmentNotFoundError extends CanonicalEquipmentDNAProfileError {}
export class CanonicalEquipmentDNAVariantNotFoundError extends CanonicalEquipmentDNAProfileError {}
export class CanonicalEquipmentDNADuplicateActiveEvaluationError extends CanonicalEquipmentDNAProfileError {}
export class CanonicalEquipmentDNAInvalidEvaluationError extends CanonicalEquipmentDNAProfileError {}

export type CanonicalEquipmentDNAEquipmentRow = {
  readonly id: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly modelYear?: number | null;
};

export type CanonicalEquipmentDNAVariantRow = {
  readonly id: string;
  readonly equipmentId: string;
  readonly sku?: string | null;
};

export type CanonicalEquipmentDNALoaderEvidenceRow = EquipmentDNAEvidenceRecord & {
  readonly id: string;
};

export type CanonicalEquipmentDNALoaderEvaluationRow = EquipmentDNAAttributeEvaluation & {
  readonly id: string;
  readonly evidenceRecords: readonly CanonicalEquipmentDNALoaderEvidenceRow[];
};

export type CanonicalEquipmentDNAProfileLoaderRepository = {
  getEquipmentForCanonicalProfile(equipmentId: string): Promise<CanonicalEquipmentDNAEquipmentRow | null>;
  getVariantForCanonicalProfile(equipmentVariantId: string): Promise<CanonicalEquipmentDNAVariantRow | null>;
  listActiveCanonicalEvaluations(input: {
    equipmentId: string;
    equipmentVariantId?: string;
  }): Promise<readonly CanonicalEquipmentDNALoaderEvaluationRow[]>;
};

export type LoadCanonicalEquipmentDNAProfileInput = {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly generatedAt?: Date;
};

export class CanonicalEquipmentDNAProfileLoader {
  constructor(private readonly repository: CanonicalEquipmentDNAProfileLoaderRepository) {}

  async loadCanonicalEquipmentDNAProfile(
    input: LoadCanonicalEquipmentDNAProfileInput
  ): Promise<CanonicalEquipmentDNAProfile> {
    const equipment = await this.repository.getEquipmentForCanonicalProfile(input.equipmentId);
    if (!equipment) throw new CanonicalEquipmentDNAEquipmentNotFoundError(`Equipment ${input.equipmentId} was not found.`);

    const variant = input.equipmentVariantId
      ? await this.repository.getVariantForCanonicalProfile(input.equipmentVariantId)
      : undefined;
    if (input.equipmentVariantId && !variant) {
      throw new CanonicalEquipmentDNAVariantNotFoundError(`Variant ${input.equipmentVariantId} was not found.`);
    }
    if (variant && variant.equipmentId !== equipment.id) {
      throw new CanonicalEquipmentDNAVariantNotFoundError(`Variant ${variant.id} does not belong to equipment ${equipment.id}.`);
    }

    const evaluations = [...(await this.repository.listActiveCanonicalEvaluations({
      equipmentId: equipment.id,
      equipmentVariantId: variant?.id
    }))].sort(compareEvaluationRows);

    const duplicateErrors = findDuplicateActiveEvaluations(evaluations);
    if (duplicateErrors.length > 0) {
      throw new CanonicalEquipmentDNADuplicateActiveEvaluationError(duplicateErrors.join(" "));
    }

    const invalidAttributes: EquipmentDNAAttributeKey[] = [];
    const conflicts: CanonicalEquipmentDNAConflict[] = [];
    const readinessEvaluations: EquipmentDNAAttributeEvaluation[] = [];
    const attributes: CanonicalEquipmentDNAAttributeValue[] = [];

    for (const evaluation of evaluations) {
      const definition = getEquipmentDNAAttributeDefinition(evaluation.attributeKey);
      const evidenceRecords = [...evaluation.evidenceRecords];
      const validation = validateEquipmentDNAAttributeEvaluation(evaluation, evidenceRecords);
      const conflict = detectEquipmentEvidenceConflict({
        attributeKey: evaluation.attributeKey,
        evidenceRecords,
        proposedValue: evaluation.value
      });

      if (conflict.severity === "minor" || conflict.severity === "material") conflicts.push({ key: evaluation.attributeKey, severity: conflict.severity, reasons: conflict.reasons });
      if (!definition || !isEquipmentDNAAttributeKey(evaluation.attributeKey)) {
        throw new CanonicalEquipmentDNAInvalidEvaluationError(`Unsupported canonical attribute key: ${evaluation.attributeKey}.`);
      }
      if (!validation.valid || conflict.severity === "material" || definition.applicableLevel !== evaluation.targetLevel) {
        invalidAttributes.push(definition.key);
      }
      const valueValidation = validateEquipmentDNAAttributeValue(definition.key, evaluation.value);
      if (!valueValidation.valid) invalidAttributes.push(definition.key);

      readinessEvaluations.push({ ...evaluation, evidenceRecords });
      if (evaluation.status !== "active" || !valueValidation.valid) continue;

      attributes.push({
        key: definition.key,
        definitionVersion: evaluation.attributeDefinitionVersion,
        domain: definition.domain,
        targetLevel: evaluation.targetLevel,
        value: valueValidation.normalizedValue,
        confidence: evaluation.confidence,
        evaluationMethod: evaluation.evaluationMethod,
        evaluationVersion: evaluation.evaluationVersion,
        rationale: evaluation.rationale ?? "No rationale recorded.",
        evaluatedAt: evaluation.evaluatedAt ?? new Date(0),
        evidence: evidenceRecords.map(mapEvidenceSummary),
        status: "active"
      });
    }

    const readiness = assessEquipmentDNARecommendationReadiness({ evaluations: readinessEvaluations });
    const maturity = assessEquipmentDNAMaturity({ evaluations: readinessEvaluations }).maturity;
    const uniqueInvalidAttributes = uniqueAttributeKeys([...readiness.invalidAttributes, ...invalidAttributes]);

    return {
      version: CANONICAL_EQUIPMENT_DNA_PROFILE_VERSION,
      equipmentId: equipment.id,
      equipmentVariantId: variant?.id,
      equipmentName: `${equipment.manufacturer} ${equipment.model}${equipment.modelYear ? ` ${equipment.modelYear}` : ""}`,
      variantLabel: variant?.sku ?? variant?.id,
      registryVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
      confidenceModelVersion: EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION,
      readinessModelVersion: EQUIPMENT_DNA_READINESS_MODEL_VERSION,
      scoreMappingVersion: EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION,
      readiness: {
        ready: readiness.ready,
        missingRequiredAttributes: readiness.missingRequiredAttributes,
        insufficientConfidenceAttributes: readiness.insufficientConfidenceAttributes,
        invalidAttributes: uniqueInvalidAttributes,
        experimentalAttributesIgnored: readiness.experimentalAttributesIgnored,
        reasons: readiness.reasons
      },
      maturity,
      attributes: attributes.sort(compareCanonicalAttributes),
      missingAttributes: readiness.missingRequiredAttributes,
      invalidAttributes: uniqueInvalidAttributes,
      conflicts,
      generatedAt: input.generatedAt ?? new Date()
    };
  }
}

function mapEvidenceSummary(evidence: CanonicalEquipmentDNALoaderEvidenceRow): CanonicalEquipmentDNAEvidenceSummary {
  return {
    evidenceRecordId: evidence.id,
    sourceType: evidence.sourceType,
    sourceName: evidence.sourceName,
    method: evidence.method,
    status: evidence.status,
    sourceReference: evidence.sourceReference,
    rawValue: evidence.rawValue,
    normalizedValue: evidence.normalizedValue,
    evaluatorType: evidence.evaluatorType,
    evaluatorReference: evidence.evaluatorReference
  };
}

function findDuplicateActiveEvaluations(evaluations: readonly CanonicalEquipmentDNALoaderEvaluationRow[]): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const evaluation of evaluations) {
    if (evaluation.status !== "active") continue;
    const targetId = evaluation.targetLevel === "equipment" ? evaluation.equipmentId : evaluation.equipmentVariantId;
    const key = `${evaluation.targetLevel}:${targetId}:${evaluation.attributeKey}:${evaluation.attributeDefinitionVersion}`;
    if (seen.has(key)) duplicates.push(`Duplicate active evaluation for ${key}.`);
    seen.add(key);
  }
  return duplicates;
}

function compareEvaluationRows(a: CanonicalEquipmentDNALoaderEvaluationRow, b: CanonicalEquipmentDNALoaderEvaluationRow): number {
  return compareTargetLevel(a.targetLevel, b.targetLevel) || a.attributeKey.localeCompare(b.attributeKey) || a.id.localeCompare(b.id);
}

function compareCanonicalAttributes(a: CanonicalEquipmentDNAAttributeValue, b: CanonicalEquipmentDNAAttributeValue): number {
  const aDefinition = getEquipmentDNAAttributeDefinition(a.key);
  const bDefinition = getEquipmentDNAAttributeDefinition(b.key);
  return (aDefinition?.order ?? 999) - (bDefinition?.order ?? 999) || compareTargetLevel(a.targetLevel, b.targetLevel);
}

function compareTargetLevel(a: EquipmentDNATargetLevel, b: EquipmentDNATargetLevel): number {
  const rank: Record<EquipmentDNATargetLevel, number> = { equipment: 0, variant: 1 };
  return rank[a] - rank[b];
}

function uniqueAttributeKeys(values: readonly EquipmentDNAAttributeKey[]): EquipmentDNAAttributeKey[] {
  return [...new Set(values)];
}

export function scalarCanonicalValue(value: unknown): EquipmentDNAAttributeNormalizedValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  throw new CanonicalEquipmentDNAInvalidEvaluationError("Canonical Equipment DNA evaluation value must be scalar.");
}
