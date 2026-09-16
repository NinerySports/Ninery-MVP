import {
  EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
  validateEquipmentDNAAttributeValue,
  type EquipmentDNAAttributeKey
} from "../../../equipment-intelligence/src/attributes/index.ts";
import {
  EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION,
  mapEquipmentScoreToSupportOrdinal,
  mapSwingWeightScoreToSwingEffort
} from "../../../equipment-intelligence/src/evaluations/index.ts";
import {
  BALANCE_PROFILE_NUMERIC_DIRECTION,
  BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION,
  LEGACY_BALANCE_SEMANTIC_AUDIT_VERSION,
  createLegacyDerivedBalanceNumericReference
} from "../../../equipment-intelligence/src/balance/index.ts";
import {
  PREDICTABILITY_SUPPORT_COMPOSITE_VERSION,
  PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
  evaluatePredictabilitySupport,
  predictabilityExcludedComponentRationales,
  predictabilitySupportCompositePolicy
} from "../../../equipment-intelligence/src/predictability/index.ts";
import {
  assessEquipmentAttributeConfidence,
  assessEquipmentDNARecommendationReadiness,
  assessEquipmentDNAMaturity,
  detectEquipmentEvidenceConflict,
  type EquipmentAttributeConfidence,
  type EquipmentDNAAttributeEvaluation,
  type EquipmentDNAEvidenceRecord,
  type EquipmentJsonValue
} from "../../../equipment-intelligence/src/evidence/index.ts";
import { prisma } from "./client.ts";

const evaluatedAt = new Date("2026-07-15T12:00:00.000Z");
const seedVersion = "ninery-demo-equipment-dna-v1";

const demoTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;

const requiredBehaviorMappings = [
  {
    attributeKey: "swing_effort",
    characteristicCode: "swing-weight",
    sourceCharacteristicCode: "SWING_WEIGHT",
    mapScore: mapSwingWeightScoreToSwingEffort,
    rationaleLabel: "swing effort"
  },
  {
    attributeKey: "forgiveness",
    characteristicCode: "barrel-forgiveness",
    sourceCharacteristicCode: "BARREL_FORGIVENESS",
    mapScore: mapEquipmentScoreToSupportOrdinal,
    rationaleLabel: "forgiveness"
  },
  {
    attributeKey: "sweet_spot_support",
    characteristicCode: "sweet-spot-size",
    sourceCharacteristicCode: "SWEET_SPOT_SIZE",
    mapScore: mapEquipmentScoreToSupportOrdinal,
    rationaleLabel: "sweet spot support"
  },
  {
    attributeKey: "bat_control_support",
    characteristicCode: "bat-control",
    sourceCharacteristicCode: "BAT_CONTROL",
    mapScore: mapEquipmentScoreToSupportOrdinal,
    rationaleLabel: "bat control support"
  },
  {
    attributeKey: "power_potential",
    characteristicCode: "power-potential",
    sourceCharacteristicCode: "POWER_POTENTIAL",
    mapScore: mapEquipmentScoreToSupportOrdinal,
    rationaleLabel: "power potential",
    optional: true
  }
] as const;

const balanceProfileExpectations = new Map([
  ["Rawlings:ICON:2026", 89],
  ["Louisville Slugger:Atlas:2026", 84],
  ["Easton:Hype Fire:2026", 74]
] as const);

export type EquipmentDNAEvaluationSeedSummary = {
  createdEvidence: number;
  updatedEvidence: number;
  createdEvaluations: number;
  updatedEvaluations: number;
  readyProfiles: number;
  notReadyProfiles: number;
  createdBalanceEvidence: number;
  updatedBalanceEvidence: number;
  createdBalanceEvaluations: number;
  updatedBalanceEvaluations: number;
  skippedBalanceEvaluations: number;
  createdPredictabilityEvidence: number;
  updatedPredictabilityEvidence: number;
  createdPredictabilityEvaluations: number;
  updatedPredictabilityEvaluations: number;
  skippedPredictabilityEvaluations: number;
  profiles: Array<{
    equipmentName: string;
    variantSku: string;
    ready: boolean;
    maturity: string;
    requiredAttributes: string;
    confidenceConcerns: string[];
  }>;
};

export async function seed(): Promise<EquipmentDNAEvaluationSeedSummary> {
  const summary: EquipmentDNAEvaluationSeedSummary = {
    createdEvidence: 0,
    updatedEvidence: 0,
    createdEvaluations: 0,
    updatedEvaluations: 0,
    readyProfiles: 0,
    notReadyProfiles: 0,
    createdBalanceEvidence: 0,
    updatedBalanceEvidence: 0,
    createdBalanceEvaluations: 0,
    updatedBalanceEvaluations: 0,
    skippedBalanceEvaluations: 0,
    createdPredictabilityEvidence: 0,
    updatedPredictabilityEvidence: 0,
    createdPredictabilityEvaluations: 0,
    updatedPredictabilityEvaluations: 0,
    skippedPredictabilityEvaluations: 0,
    profiles: []
  };

  for (const target of demoTargets) {
    const equipment = await findDemoEquipment(target);
    const variant = equipment.variants.find((candidate) => candidate.sku === target.selectedSku);
    if (!variant) {
      throw new Error(`Demo variant ${target.selectedSku} was not found for ${target.manufacturer} ${target.model}.`);
    }

    const profile = equipment.dnaProfiles[0];
    if (!profile) {
      throw new Error(`Active Equipment DNA profile was not found for ${target.manufacturer} ${target.model}.`);
    }

    const evaluationRecords: EquipmentDNAAttributeEvaluation[] = [];

    const equipmentSpecs = [
      spec("certification", equipment.certification, equipment.certification, undefined),
      spec("barrel_diameter", decimalToNumber(equipment.barrelDiameter), decimalToNumber(equipment.barrelDiameter), "inches"),
      spec("construction", equipment.construction, normalizeConstruction(equipment.construction), undefined, true),
      spec("material", equipment.material, normalizeMaterial(equipment.material), undefined, true)
    ];

    for (const item of equipmentSpecs) {
      if (item.normalizedValue === undefined || item.rawValue === undefined) continue;
      validateCanonicalValue(item.attributeKey, item.normalizedValue);
      const evidenceRecords = [
        await upsertEvidence(
          {
            equipmentId: equipment.id,
            targetLevel: "equipment",
            attributeKey: item.attributeKey,
            sourceType: "manufacturer_specification",
            sourceName: "Ninery seeded catalog fixture",
            sourceReference: `${seedVersion}:catalog:${slug(target)}:${item.attributeKey}`,
            method: "direct_specification",
            rawValue: item.rawValue,
            normalizedValue: item.normalizedValue,
            unit: item.unit,
            notes: "Existing seeded catalog value used as development manufacturer-specification evidence; no public manufacturer URL is asserted.",
            status: "active"
          },
          summary
        )
      ];
      evaluationRecords.push(
        await upsertEvaluation(
          {
            equipmentId: equipment.id,
            targetLevel: "equipment",
            attributeKey: item.attributeKey,
            value: item.normalizedValue,
            evaluationMethod: "direct_specification",
            confidence: "high",
            rationale: `The ${item.attributeKey} value is recorded in the seeded catalog for ${equipment.manufacturer} ${equipment.model}.`
          },
          evidenceRecords,
          summary
        )
      );
    }

    const variantSpecs = [
      spec("length", decimalToNumber(variant.lengthInches), decimalToNumber(variant.lengthInches), "inches"),
      spec("weight", decimalToNumber(variant.weightOunces), decimalToNumber(variant.weightOunces), "ounces"),
      spec("drop", variant.dropWeight, variant.dropWeight, "drop")
    ];

    for (const item of variantSpecs) {
      if (item.normalizedValue === undefined || item.rawValue === undefined) continue;
      validateCanonicalValue(item.attributeKey, item.normalizedValue);
      const evidenceRecords = [
        await upsertEvidence(
          {
            equipmentVariantId: variant.id,
            targetLevel: "variant",
            attributeKey: item.attributeKey,
            sourceType: "manufacturer_specification",
            sourceName: "Ninery seeded catalog fixture",
            sourceReference: `${seedVersion}:variant:${variant.sku}:${item.attributeKey}`,
            method: "direct_specification",
            rawValue: item.rawValue,
            normalizedValue: item.normalizedValue,
            unit: item.unit,
            notes: "Existing seeded variant catalog value used as development manufacturer-specification evidence; no public manufacturer URL is asserted.",
            status: "active"
          },
          summary
        )
      ];
      evaluationRecords.push(
        await upsertEvaluation(
          {
            equipmentVariantId: variant.id,
            targetLevel: "variant",
            attributeKey: item.attributeKey,
            value: item.normalizedValue,
            evaluationMethod: "direct_specification",
            confidence: "high",
            rationale: `The ${item.normalizedValue} ${item.unit ?? ""}`.trim() + ` ${item.attributeKey} value is recorded in the seeded catalog for variant ${variant.sku}.`
          },
          evidenceRecords,
          summary
        )
      );
    }

    for (const mapping of requiredBehaviorMappings) {
      const score = profile.scores.find((candidate) => candidate.characteristic.code === mapping.characteristicCode);
      if (!score) {
        if (mapping.optional) continue;
        throw new Error(`${mapping.characteristicCode} score was not found for ${equipment.manufacturer} ${equipment.model}.`);
      }

      const sourceScore = decimalToNumber(score.score);
      const mapped = mapping.mapScore(sourceScore, "one_to_ten");
      validateCanonicalValue(mapping.attributeKey, mapped.ordinal);
      const mappingMetadata = {
        sourceCharacteristicCode: mapping.sourceCharacteristicCode,
        seededCharacteristicCode: mapping.characteristicCode,
        sourceScore,
        normalizedScore: mapped.normalizedScore,
        mappingFunction: mapped.mappingFunction,
        mappingVersion: mapped.mappingVersion,
        resultingCanonicalValue: mapped.ordinal,
        note: "Derived from existing internal seed intelligence. This is not objective laboratory measurement and does not change recommendation behavior."
      };

      const evidenceRecords = [
        await upsertEvidence(
          {
            equipmentId: equipment.id,
            targetLevel: "equipment",
            attributeKey: mapping.attributeKey,
            sourceType: "internal_derived",
            sourceName: "Existing seeded Equipment DNA score",
            sourceReference: `${seedVersion}:score:${slug(target)}:${mapping.sourceCharacteristicCode}`,
            method: "derived_mapping",
            rawValue: mappingMetadata,
            normalizedValue: mapped.ordinal,
            notes: "Existing 0-100 compatible Equipment DNA score preserved as internal-derived evidence through score-to-ordinal mapping v1.0.",
            status: "active"
          },
          summary
        ),
        await upsertEvidence(
          {
            equipmentId: equipment.id,
            targetLevel: "equipment",
            attributeKey: mapping.attributeKey,
            sourceType: "other",
            sourceName: "Ninery deterministic score-to-ordinal rubric",
            sourceReference: `${seedVersion}:rubric:${slug(target)}:${mapping.sourceCharacteristicCode}`,
            method: "standardized_rubric",
            rawValue: {
              mappingVersion: EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION,
              bands: mapped.mappingFunction === "swing_weight_to_swing_effort"
                ? "0-19 very_easy; 20-39 easy; 40-59 moderate; 60-79 demanding; 80-100 very_demanding"
                : "0-19 very_low; 20-39 low; 40-59 moderate; 60-79 high; 80-100 very_high",
              sourceCharacteristicCode: mapping.sourceCharacteristicCode,
              sourceScore,
              normalizedScore: mapped.normalizedScore
            },
            normalizedValue: mapped.ordinal,
            notes: "Deterministic internal rubric applied to existing seeded Equipment DNA score. This is not expert review or external validation.",
            status: "active"
          },
          summary
        )
      ];
      const confidence = capDerivedConfidence(
        assessEquipmentAttributeConfidence({
          evidenceRecords,
          evaluation: {
            equipmentId: equipment.id,
            targetLevel: "equipment",
            attributeKey: mapping.attributeKey,
            attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
            value: mapped.ordinal,
            confidence: "estimated",
            evaluationMethod: "derived_mapping",
            evaluationVersion: 1,
            status: "active",
            rationale: "Pending confidence assessment."
          }
        }).confidence
      );
      evaluationRecords.push(
        await upsertEvaluation(
          {
            equipmentId: equipment.id,
            targetLevel: "equipment",
            attributeKey: mapping.attributeKey,
            value: mapped.ordinal,
            evaluationMethod: "derived_mapping",
            confidence,
            rationale: `The ${mapped.ordinal} ${mapping.rationaleLabel} evaluation is derived from the existing ${mapping.sourceCharacteristicCode} score using Equipment Score-to-Ordinal Mapping v${EQUIPMENT_SCORE_TO_ORDINAL_MAPPING_VERSION}. It should be treated as internal evaluated intelligence rather than independent laboratory validation.`
          },
          evidenceRecords,
          summary
        )
      );
    }

    const balanceEvaluation = await seedBalanceProfileEvaluation({ equipment, profile, target, summary });
    if (balanceEvaluation) evaluationRecords.push(balanceEvaluation);
    const predictabilityEvaluation = await seedPredictabilitySupportEvaluation({ equipment, evaluationRecords, target, summary });
    if (predictabilityEvaluation) evaluationRecords.push(predictabilityEvaluation);

    const readiness = assessEquipmentDNARecommendationReadiness({ evaluations: evaluationRecords });
    const maturity = assessEquipmentDNAMaturity({ evaluations: evaluationRecords });
    if (readiness.ready) summary.readyProfiles += 1;
    else summary.notReadyProfiles += 1;
    summary.profiles.push({
      equipmentName: `${equipment.manufacturer} ${equipment.model}`,
      variantSku: variant.sku ?? "unknown",
      ready: readiness.ready,
      maturity: maturity.maturity,
      requiredAttributes: `${9 - readiness.missingRequiredAttributes.length - readiness.invalidAttributes.length}/${9}`,
      confidenceConcerns: readiness.insufficientConfidenceAttributes
    });
  }

  return summary;
}

export async function seedBalanceProfiles(): Promise<EquipmentDNAEvaluationSeedSummary> {
  const summary: EquipmentDNAEvaluationSeedSummary = {
    createdEvidence: 0,
    updatedEvidence: 0,
    createdEvaluations: 0,
    updatedEvaluations: 0,
    readyProfiles: 0,
    notReadyProfiles: 0,
    createdBalanceEvidence: 0,
    updatedBalanceEvidence: 0,
    createdBalanceEvaluations: 0,
    updatedBalanceEvaluations: 0,
    skippedBalanceEvaluations: 0,
    createdPredictabilityEvidence: 0,
    updatedPredictabilityEvidence: 0,
    createdPredictabilityEvaluations: 0,
    updatedPredictabilityEvaluations: 0,
    skippedPredictabilityEvaluations: 0,
    profiles: []
  };

  for (const target of demoTargets) {
    const equipment = await findDemoEquipment(target);
    const variant = equipment.variants.find((candidate) => candidate.sku === target.selectedSku);
    if (!variant) {
      throw new Error(`Demo variant ${target.selectedSku} was not found for ${target.manufacturer} ${target.model}.`);
    }
    const profile = equipment.dnaProfiles[0];
    if (!profile) {
      throw new Error(`Active Equipment DNA profile was not found for ${target.manufacturer} ${target.model}.`);
    }

    await seedBalanceProfileEvaluation({ equipment, profile, target, summary });
    const activeEvaluations = await prisma.equipmentDNAAttributeEvaluation.findMany({
      where: {
        OR: [{ equipmentId: equipment.id }, { equipmentVariantId: variant.id }],
        status: "active"
      },
      include: { evidenceLinks: { include: { evidenceRecord: true } } }
    });
    const readiness = assessEquipmentDNARecommendationReadiness({
      evaluations: activeEvaluations.map((row) => ({
        id: row.id,
        equipmentId: row.equipmentId ?? undefined,
        equipmentVariantId: row.equipmentVariantId ?? undefined,
        targetLevel: row.targetLevel,
        attributeKey: row.attributeKey,
        attributeDefinitionVersion: row.attributeDefinitionVersion,
        value: scalarJson(row.value),
        confidence: row.confidence,
        evaluationMethod: row.evaluationMethod,
        evaluationVersion: row.evaluationVersion,
        status: row.status,
        rationale: row.rationale ?? undefined,
        evaluatedAt: row.evaluatedAt ?? undefined,
        evidenceRecords: row.evidenceLinks.map((link) => ({
          id: link.evidenceRecord.id,
          equipmentId: link.evidenceRecord.equipmentId ?? undefined,
          equipmentVariantId: link.evidenceRecord.equipmentVariantId ?? undefined,
          targetLevel: link.evidenceRecord.targetLevel,
          attributeKey: link.evidenceRecord.attributeKey,
          attributeDefinitionVersion: link.evidenceRecord.attributeDefinitionVersion,
          sourceType: link.evidenceRecord.sourceType,
          sourceName: link.evidenceRecord.sourceName,
          sourceReference: link.evidenceRecord.sourceReference ?? undefined,
          method: link.evidenceRecord.method,
          rawValue: link.evidenceRecord.rawValue ?? undefined,
          normalizedValue: link.evidenceRecord.normalizedValue ?? undefined,
          unit: link.evidenceRecord.unit ?? undefined,
          notes: link.evidenceRecord.notes ?? undefined,
          status: link.evidenceRecord.status
        }))
      }))
    });
    const maturity = assessEquipmentDNAMaturity({
      evaluations: activeEvaluations.map((row) => ({
        equipmentId: row.equipmentId ?? undefined,
        equipmentVariantId: row.equipmentVariantId ?? undefined,
        targetLevel: row.targetLevel,
        attributeKey: row.attributeKey,
        attributeDefinitionVersion: row.attributeDefinitionVersion,
        value: scalarJson(row.value),
        confidence: row.confidence,
        evaluationMethod: row.evaluationMethod,
        evaluationVersion: row.evaluationVersion,
        status: row.status,
        rationale: row.rationale ?? undefined,
        evidenceRecords: []
      }))
    });
    if (readiness.ready) summary.readyProfiles += 1;
    else summary.notReadyProfiles += 1;
    summary.profiles.push({
      equipmentName: `${equipment.manufacturer} ${equipment.model}`,
      variantSku: variant.sku ?? "unknown",
      ready: readiness.ready,
      maturity: maturity.maturity,
      requiredAttributes: `${9 - readiness.missingRequiredAttributes.length - readiness.invalidAttributes.length}/${9}`,
      confidenceConcerns: readiness.insufficientConfidenceAttributes
    });
  }

  return summary;
}

export async function seedPredictabilitySupport(): Promise<EquipmentDNAEvaluationSeedSummary> {
  const summary: EquipmentDNAEvaluationSeedSummary = {
    createdEvidence: 0,
    updatedEvidence: 0,
    createdEvaluations: 0,
    updatedEvaluations: 0,
    readyProfiles: 0,
    notReadyProfiles: 0,
    createdBalanceEvidence: 0,
    updatedBalanceEvidence: 0,
    createdBalanceEvaluations: 0,
    updatedBalanceEvaluations: 0,
    skippedBalanceEvaluations: 0,
    createdPredictabilityEvidence: 0,
    updatedPredictabilityEvidence: 0,
    createdPredictabilityEvaluations: 0,
    updatedPredictabilityEvaluations: 0,
    skippedPredictabilityEvaluations: 0,
    profiles: []
  };

  for (const target of demoTargets) {
    const equipment = await findDemoEquipment(target);
    const variant = equipment.variants.find((candidate) => candidate.sku === target.selectedSku);
    if (!variant) {
      throw new Error(`Demo variant ${target.selectedSku} was not found for ${target.manufacturer} ${target.model}.`);
    }
    const rows = await prisma.equipmentDNAAttributeEvaluation.findMany({
      where: {
        OR: [{ equipmentId: equipment.id }, { equipmentVariantId: variant.id }],
        status: "active"
      },
      include: { evidenceLinks: { include: { evidenceRecord: true } } }
    });
    const evaluations = rows.map(rowToEvaluation);
    const predictabilityEvaluation = await seedPredictabilitySupportEvaluation({ equipment, evaluationRecords: evaluations, target, summary });
    if (predictabilityEvaluation) evaluations.push(predictabilityEvaluation);
    const readiness = assessEquipmentDNARecommendationReadiness({ evaluations });
    const maturity = assessEquipmentDNAMaturity({ evaluations });
    if (readiness.ready) summary.readyProfiles += 1;
    else summary.notReadyProfiles += 1;
    summary.profiles.push({
      equipmentName: `${equipment.manufacturer} ${equipment.model}`,
      variantSku: variant.sku ?? "unknown",
      ready: readiness.ready,
      maturity: maturity.maturity,
      requiredAttributes: `${9 - readiness.missingRequiredAttributes.length - readiness.invalidAttributes.length}/${9}`,
      confidenceConcerns: readiness.insufficientConfidenceAttributes
    });
  }

  return summary;
}

async function seedBalanceProfileEvaluation(input: {
  equipment: Awaited<ReturnType<typeof findDemoEquipment>>;
  profile: Awaited<ReturnType<typeof findDemoEquipment>>["dnaProfiles"][number];
  target: (typeof demoTargets)[number];
  summary: EquipmentDNAEvaluationSeedSummary;
}): Promise<EquipmentDNAAttributeEvaluation | undefined> {
  const score = input.profile.scores.find((candidate) => candidate.characteristic.code === "swing-balance");
  if (!score) {
    input.summary.skippedBalanceEvaluations += 1;
    return undefined;
  }

  const storedScore = decimalToNumber(score.score);
  if (storedScore === undefined) {
    input.summary.skippedBalanceEvaluations += 1;
    return undefined;
  }
  const sourceScore = normalizeLegacyHundredPointScore(storedScore);
  const expected = balanceProfileExpectations.get(expectationKey(input.target));
  if (expected !== undefined && sourceScore !== expected) {
    console.warn(`${input.equipment.manufacturer} ${input.equipment.model} balance source score changed from expected ${expected} to ${sourceScore}; balance_profile activation skipped for this item.`);
    input.summary.skippedBalanceEvaluations += 1;
    return undefined;
  }

  const reference = createLegacyDerivedBalanceNumericReference({
    sourceValue: sourceScore,
    equipmentId: input.equipment.id,
    sourceReference: `${seedVersion}:score:${input.equipment.id}:SWING_BALANCE:balance-profile:legacy-balance:v1`
  });
  validateCanonicalValue("balance_profile", reference.ordinal);
  const rawValue = {
    legacyField: reference.sourceField,
    legacyCharacteristicCode: reference.sourceCharacteristicCode,
    sourceEquipmentDNAProfileId: input.profile.id,
    sourceScore,
    normalizedScore: reference.canonicalValue,
    legacyMeaning: "higher means more balanced/light-feel support",
    semanticAuditVersion: LEGACY_BALANCE_SEMANTIC_AUDIT_VERSION,
    conversionStrategy: reference.conversionStrategy,
    conversionMappingVersion: reference.mappingVersion,
    numericReferenceVersion: BALANCE_PROFILE_NUMERIC_REFERENCE_VERSION,
    canonicalDirection: BALANCE_PROFILE_NUMERIC_DIRECTION,
    canonicalNumericValue: reference.canonicalValue,
    canonicalOrdinalValue: reference.ordinal,
    formula: "100 - legacyValue",
    note: "Derived from existing internal seed intelligence. This is not an objective balance-point measurement and does not change recommendation behavior."
  };
  const evidenceBefore = input.summary.updatedEvidence;
  const createdBefore = input.summary.createdEvidence;
  const evidenceRecords = [
    await upsertEvidence(
      {
        equipmentId: input.equipment.id,
        targetLevel: "equipment",
        attributeKey: "balance_profile",
        sourceType: "internal_derived",
        sourceName: "Existing seeded Equipment DNA balance score",
        sourceReference: reference.sourceReference,
        method: "derived_mapping",
        rawValue,
        normalizedValue: reference.ordinal,
        notes: "Legacy balance-support score preserved as internal-derived balance_profile evidence through inverse mapping v1.0. This is not an objective measurement.",
        status: "active"
      },
      input.summary
    )
  ];
  input.summary.createdBalanceEvidence += input.summary.createdEvidence - createdBefore;
  input.summary.updatedBalanceEvidence += input.summary.updatedEvidence - evidenceBefore;

  const confidence = capDerivedConfidence(
    assessEquipmentAttributeConfidence({
      evidenceRecords,
      evaluation: {
        equipmentId: input.equipment.id,
        targetLevel: "equipment",
        attributeKey: "balance_profile",
        attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
        value: reference.ordinal,
        confidence: "estimated",
        evaluationMethod: "derived_mapping",
        evaluationVersion: 1,
        status: "active",
        rationale: "Pending confidence assessment."
      }
    }).confidence
  );
  const evaluationBefore = input.summary.updatedEvaluations;
  const createdEvaluationBefore = input.summary.createdEvaluations;
  const evaluation = await upsertEvaluation(
    {
      equipmentId: input.equipment.id,
      targetLevel: "equipment",
      attributeKey: "balance_profile",
      value: reference.ordinal,
      evaluationMethod: "derived_mapping",
      confidence: confidence === "estimated" ? "moderate" : confidence,
      rationale: `The balance profile is derived from the existing legacy balance-support score using Legacy Balance to Canonical Mapping v${reference.mappingVersion}. The canonical direction is 0 for most balanced and 100 for most end-loaded. This is internal evaluated intelligence, not an objective balance-point measurement.`
    },
    evidenceRecords,
    input.summary
  );
  input.summary.createdBalanceEvaluations += input.summary.createdEvaluations - createdEvaluationBefore;
  input.summary.updatedBalanceEvaluations += input.summary.updatedEvaluations - evaluationBefore;
  return evaluation;
}

async function seedPredictabilitySupportEvaluation(input: {
  equipment: Awaited<ReturnType<typeof findDemoEquipment>>;
  evaluationRecords: readonly EquipmentDNAAttributeEvaluation[];
  target: (typeof demoTargets)[number];
  summary: EquipmentDNAEvaluationSeedSummary;
}): Promise<EquipmentDNAAttributeEvaluation | undefined> {
  const components = predictabilitySupportCompositePolicy.components.map((component) => {
    const evaluation = input.evaluationRecords.find((candidate) => candidate.attributeKey === component.attributeKey && candidate.targetLevel === "equipment" && candidate.status === "active");
    if (!evaluation) return undefined;
    return {
      attributeKey: component.attributeKey,
      sourceValue: evaluation.value,
      numericValue: numericReferenceFromEvaluation(evaluation),
      confidence: evaluation.confidence
    };
  }).filter((component): component is NonNullable<typeof component> => Boolean(component));
  const result = evaluatePredictabilitySupport({
    components,
    generatedAt: evaluatedAt,
    sourceReference: `${seedVersion}:composite:${input.equipment.id}:predictability-support:v1`
  });
  if (result.findings.includes("COMPOSITE_INVALID") || !result.numericReference) {
    console.warn(`${input.equipment.manufacturer} ${input.equipment.model} predictability_support skipped: ${result.warnings.join(" ")}`);
    input.summary.skippedPredictabilityEvaluations += 1;
    return undefined;
  }
  validateCanonicalValue("predictability_support", result.ordinalValue);
  const rawValue = {
    sourceScore: result.numericReference.numericValue,
    normalizedScore: result.numericReference.numericValue,
    referenceMethod: "derived_from_evaluation",
    compositeVersion: PREDICTABILITY_SUPPORT_COMPOSITE_VERSION,
    evaluationVersion: PREDICTABILITY_SUPPORT_EVALUATION_VERSION,
    componentCoverage: result.componentCoverage,
    components: result.componentResults,
    excludedComponents: predictabilityExcludedComponentRationales,
    recommendationUsePolicy: predictabilitySupportCompositePolicy.recommendationUsePolicy,
    bridgeStrategy: predictabilitySupportCompositePolicy.bridgeStrategy,
    doubleCountingPolicy: "profile-only/shadow diagnostic unless a future weight review approves replacement use",
    legacyConfidenceBuildingMigration: "blocked; source legacy value is not copied into predictability_support",
    parentCopyAllowed: "The bat tends to provide a consistent and understandable response.",
    parentCopyDisallowed: "This bat will make the player confident."
  };
  const createdEvidenceBefore = input.summary.createdEvidence;
  const updatedEvidenceBefore = input.summary.updatedEvidence;
  const evidenceRecords = [
    await upsertEvidence(
      {
        equipmentId: input.equipment.id,
        targetLevel: "equipment",
        attributeKey: "predictability_support",
        sourceType: "internal_derived",
        sourceName: "Ninery predictability support composite",
        sourceReference: `${seedVersion}:composite:${input.equipment.id}:predictability-support:v1`,
        method: "derived_mapping",
        rawValue,
        normalizedValue: result.ordinalValue,
        notes: "Structured composite of active Equipment DNA component evaluations. This is not a player confidence claim and does not copy legacy confidenceBuilding.",
        status: "active"
      },
      input.summary
    )
  ];
  input.summary.createdPredictabilityEvidence += input.summary.createdEvidence - createdEvidenceBefore;
  input.summary.updatedPredictabilityEvidence += input.summary.updatedEvidence - updatedEvidenceBefore;

  const createdEvaluationBefore = input.summary.createdEvaluations;
  const updatedEvaluationBefore = input.summary.updatedEvaluations;
  const evaluation = await upsertEvaluation(
    {
      equipmentId: input.equipment.id,
      targetLevel: "equipment",
      attributeKey: "predictability_support",
      value: result.ordinalValue,
      evaluationMethod: "derived_mapping",
      confidence: result.confidence,
      rationale: result.rationale
    },
    evidenceRecords,
    input.summary
  );
  input.summary.createdPredictabilityEvaluations += input.summary.createdEvaluations - createdEvaluationBefore;
  input.summary.updatedPredictabilityEvaluations += input.summary.updatedEvaluations - updatedEvaluationBefore;
  return evaluation;
}

export async function clear() {
  const evidence = await prisma.equipmentDNAEvidenceRecord.findMany({
    where: { sourceReference: { startsWith: seedVersion } },
    select: { id: true, evaluationLinks: { select: { evaluationId: true } } }
  });
  const evidenceIds = evidence.map((record) => record.id);
  const evaluationIds = [...new Set(evidence.flatMap((record) => record.evaluationLinks.map((link) => link.evaluationId)))];
  await prisma.equipmentDNAAttributeEvaluationEvidence.deleteMany({
    where: { OR: [{ evidenceRecordId: { in: evidenceIds } }, { evaluationId: { in: evaluationIds } }] }
  });
  await prisma.equipmentDNAAttributeEvaluation.deleteMany({ where: { id: { in: evaluationIds } } });
  await prisma.equipmentDNAEvidenceRecord.deleteMany({ where: { id: { in: evidenceIds } } });
}

async function findDemoEquipment(target: (typeof demoTargets)[number]) {
  const equipment = await prisma.equipment.findFirst({
    where: {
      manufacturer: target.manufacturer,
      model: target.model,
      modelYear: target.modelYear
    },
    include: {
      variants: true,
      dnaProfiles: {
        where: { status: "active" },
        orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
        take: 1,
        include: { scores: { include: { characteristic: true } } }
      }
    }
  });
  if (!equipment) {
    throw new Error(`Demo equipment ${target.manufacturer} ${target.model} ${target.modelYear} was not found. Run pnpm seed:equipment first.`);
  }
  return equipment;
}

async function upsertEvidence(
  input: {
    equipmentId?: string;
    equipmentVariantId?: string;
    targetLevel: "equipment" | "variant";
    attributeKey: EquipmentDNAAttributeKey;
    sourceType: "manufacturer_specification" | "internal_derived" | "other";
    sourceName: string;
    sourceReference: string;
    method: "direct_specification" | "derived_mapping" | "standardized_rubric";
    rawValue: EquipmentJsonValue;
    normalizedValue: EquipmentJsonValue;
    unit?: string;
    notes: string;
    status: "active";
  },
  summary: EquipmentDNAEvaluationSeedSummary
): Promise<EquipmentDNAEvidenceRecord> {
  const existing = await prisma.equipmentDNAEvidenceRecord.findFirst({
    where: {
      equipmentId: input.equipmentId,
      equipmentVariantId: input.equipmentVariantId,
      attributeKey: input.attributeKey,
      attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
      sourceReference: input.sourceReference,
      method: input.method
    }
  });
  const data = {
    equipmentId: input.equipmentId,
    equipmentVariantId: input.equipmentVariantId,
    targetLevel: input.targetLevel,
    attributeKey: input.attributeKey,
    attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    sourceReference: input.sourceReference,
    method: input.method,
    rawValue: input.rawValue,
    normalizedValue: input.normalizedValue,
    unit: input.unit,
    notes: input.notes,
    status: input.status,
    evaluatorType: "system",
    evaluatorReference: `seed:${seedVersion}`
  };
  const row = existing
    ? await prisma.equipmentDNAEvidenceRecord.update({ where: { id: existing.id }, data })
    : await prisma.equipmentDNAEvidenceRecord.create({ data });
  if (existing) summary.updatedEvidence += 1;
  else summary.createdEvidence += 1;
  return {
    id: row.id,
    equipmentId: row.equipmentId ?? undefined,
    equipmentVariantId: row.equipmentVariantId ?? undefined,
    targetLevel: row.targetLevel,
    attributeKey: row.attributeKey,
    attributeDefinitionVersion: row.attributeDefinitionVersion,
    sourceType: row.sourceType,
    sourceName: row.sourceName,
    sourceReference: row.sourceReference ?? undefined,
    method: row.method,
    rawValue: row.rawValue ?? undefined,
    normalizedValue: row.normalizedValue ?? undefined,
    unit: row.unit ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status
  };
}

async function upsertEvaluation(
  input: {
    equipmentId?: string;
    equipmentVariantId?: string;
    targetLevel: "equipment" | "variant";
    attributeKey: EquipmentDNAAttributeKey;
    value: string | number | boolean;
    evaluationMethod: "direct_specification" | "derived_mapping";
    confidence: EquipmentAttributeConfidence;
    rationale: string;
  },
  evidenceRecords: EquipmentDNAEvidenceRecord[],
  summary: EquipmentDNAEvaluationSeedSummary
): Promise<EquipmentDNAAttributeEvaluation> {
  const conflict = detectEquipmentEvidenceConflict({
    attributeKey: input.attributeKey,
    evidenceRecords,
    proposedValue: input.value
  });
  if (conflict.severity === "material") {
    throw new Error(`${input.attributeKey} has material evidence conflict: ${conflict.reasons.join(" ")}`);
  }
  const existing = await prisma.equipmentDNAAttributeEvaluation.findFirst({
    where: {
      equipmentId: input.equipmentId,
      equipmentVariantId: input.equipmentVariantId,
      attributeKey: input.attributeKey,
      attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
      status: "active"
    }
  });
  const data = {
    equipmentId: input.equipmentId,
    equipmentVariantId: input.equipmentVariantId,
    targetLevel: input.targetLevel,
    attributeKey: input.attributeKey,
    attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    value: input.value,
    confidence: input.confidence,
    evaluationMethod: input.evaluationMethod,
    evaluationVersion: existing?.evaluationVersion ?? 1,
    status: "active" as const,
    rationale: input.rationale,
    evaluatedAt
  };
  const row = existing
    ? await prisma.equipmentDNAAttributeEvaluation.update({ where: { id: existing.id }, data })
    : await prisma.equipmentDNAAttributeEvaluation.create({ data });
  if (existing) summary.updatedEvaluations += 1;
  else summary.createdEvaluations += 1;

  for (const evidence of evidenceRecords) {
    if (!evidence.id) continue;
    await prisma.equipmentDNAAttributeEvaluationEvidence.upsert({
      where: { evaluationId_evidenceRecordId: { evaluationId: row.id, evidenceRecordId: evidence.id } },
      update: {},
      create: { evaluationId: row.id, evidenceRecordId: evidence.id }
    });
  }

  return {
    id: row.id,
    equipmentId: row.equipmentId ?? undefined,
    equipmentVariantId: row.equipmentVariantId ?? undefined,
    targetLevel: row.targetLevel,
    attributeKey: row.attributeKey,
    attributeDefinitionVersion: row.attributeDefinitionVersion,
    value: input.value,
    confidence: row.confidence,
    evaluationMethod: row.evaluationMethod,
    evaluationVersion: row.evaluationVersion,
    status: row.status,
    rationale: row.rationale ?? undefined,
    evaluatedAt: row.evaluatedAt ?? undefined,
    evidenceRecords
  };
}

function spec(
  attributeKey: EquipmentDNAAttributeKey,
  rawValue: EquipmentJsonValue | undefined,
  normalizedValue: EquipmentJsonValue | undefined,
  unit?: string,
  optional = false
) {
  return { attributeKey, rawValue, normalizedValue, unit, optional };
}

function validateCanonicalValue(attributeKey: EquipmentDNAAttributeKey, value: string | number | boolean) {
  const result = validateEquipmentDNAAttributeValue(attributeKey, value);
  if (!result.valid) {
    throw new Error(`${attributeKey} value is invalid: ${result.errors.join(" ")}`);
  }
}

function decimalToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

function normalizeLegacyHundredPointScore(value: number): number {
  return value <= 10 ? Math.round(value * 10 * 100) / 100 : value;
}

function scalarJson(value: unknown): string | number | boolean {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  throw new Error("Seeded Equipment DNA evaluation value must be scalar.");
}

function numericReferenceFromEvaluation(evaluation: EquipmentDNAAttributeEvaluation): number | undefined {
  for (const evidence of evaluation.evidenceRecords ?? []) {
    const raw = evidence.rawValue;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const candidate = raw as { readonly normalizedScore?: unknown; readonly sourceScore?: unknown };
    if (typeof candidate.normalizedScore === "number") return candidate.normalizedScore;
    if (typeof candidate.sourceScore === "number") return candidate.sourceScore;
  }
  return undefined;
}

function rowToEvaluation(row: {
  id: string;
  equipmentId: string | null;
  equipmentVariantId: string | null;
  targetLevel: "equipment" | "variant";
  attributeKey: string;
  attributeDefinitionVersion: string;
  value: unknown;
  confidence: EquipmentAttributeConfidence;
  evaluationMethod: "direct_specification" | "instrument_measurement" | "standardized_rubric" | "multi_evaluator_consensus" | "structured_feedback" | "derived_mapping" | "manual_review";
  evaluationVersion: number;
  status: "draft" | "active" | "superseded" | "rejected";
  rationale: string | null;
  evaluatedAt: Date | null;
  evidenceLinks: Array<{ evidenceRecord: {
    id: string;
    equipmentId: string | null;
    equipmentVariantId: string | null;
    targetLevel: "equipment" | "variant";
    attributeKey: string;
    attributeDefinitionVersion: string;
    sourceType: "manufacturer_specification" | "objective_measurement" | "structured_expert_evaluation" | "player_feedback" | "parent_feedback" | "coach_feedback" | "field_observation" | "historical_outcome" | "internal_derived" | "other";
    sourceName: string;
    sourceReference: string | null;
    method: "direct_specification" | "instrument_measurement" | "standardized_rubric" | "multi_evaluator_consensus" | "structured_feedback" | "derived_mapping" | "manual_review";
    rawValue: unknown;
    normalizedValue: unknown;
    unit: string | null;
    notes: string | null;
    status: "active" | "superseded" | "disputed" | "withdrawn";
  } }>;
}): EquipmentDNAAttributeEvaluation {
  return {
    id: row.id,
    equipmentId: row.equipmentId ?? undefined,
    equipmentVariantId: row.equipmentVariantId ?? undefined,
    targetLevel: row.targetLevel,
    attributeKey: row.attributeKey,
    attributeDefinitionVersion: row.attributeDefinitionVersion,
    value: scalarJson(row.value),
    confidence: row.confidence,
    evaluationMethod: row.evaluationMethod,
    evaluationVersion: row.evaluationVersion,
    status: row.status,
    rationale: row.rationale ?? undefined,
    evaluatedAt: row.evaluatedAt ?? undefined,
    evidenceRecords: row.evidenceLinks.map((link) => ({
      id: link.evidenceRecord.id,
      equipmentId: link.evidenceRecord.equipmentId ?? undefined,
      equipmentVariantId: link.evidenceRecord.equipmentVariantId ?? undefined,
      targetLevel: link.evidenceRecord.targetLevel,
      attributeKey: link.evidenceRecord.attributeKey,
      attributeDefinitionVersion: link.evidenceRecord.attributeDefinitionVersion,
      sourceType: link.evidenceRecord.sourceType,
      sourceName: link.evidenceRecord.sourceName,
      sourceReference: link.evidenceRecord.sourceReference ?? undefined,
      method: link.evidenceRecord.method,
      rawValue: link.evidenceRecord.rawValue as EquipmentJsonValue,
      normalizedValue: link.evidenceRecord.normalizedValue as EquipmentJsonValue,
      unit: link.evidenceRecord.unit ?? undefined,
      notes: link.evidenceRecord.notes ?? undefined,
      status: link.evidenceRecord.status
    }))
  };
}

function normalizeConstruction(value: string | null): "one_piece" | "two_piece" | "hybrid" | undefined {
  if (value === "one-piece" || value === "one_piece") return "one_piece";
  if (value === "two-piece" || value === "two_piece") return "two_piece";
  if (value === "hybrid") return "hybrid";
  return undefined;
}

function normalizeMaterial(value: string | null): "alloy" | "composite" | "hybrid" | "wood" | undefined {
  if (value === "alloy" || value === "composite" || value === "hybrid" || value === "wood") return value;
  return undefined;
}

function capDerivedConfidence(confidence: EquipmentAttributeConfidence): EquipmentAttributeConfidence {
  return confidence === "validated" ? "high" : confidence;
}

function slug(target: (typeof demoTargets)[number]) {
  return `${target.manufacturer}-${target.model}-${target.modelYear}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function expectationKey(target: (typeof demoTargets)[number]) {
  return `${target.manufacturer}:${target.model}:${target.modelYear}`;
}

if (process.argv[1]?.endsWith("equipment-dna-evaluations.seed.ts")) {
  const run = process.argv[2] === "balance"
    ? seedBalanceProfiles
    : process.argv[2] === "predictability"
      ? seedPredictabilitySupport
      : seed;
  run()
    .then((summary) => {
      console.log(`Equipment DNA evaluations seeded: ${summary.createdEvaluations} created, ${summary.updatedEvaluations} updated.`);
      console.log(`Evidence records: ${summary.createdEvidence} created, ${summary.updatedEvidence} updated.`);
      console.log(`Balance profile evidence: ${summary.createdBalanceEvidence} created, ${summary.updatedBalanceEvidence} updated.`);
      console.log(`Balance profile evaluations: ${summary.createdBalanceEvaluations} created, ${summary.updatedBalanceEvaluations} updated.`);
      if (summary.skippedBalanceEvaluations) console.log(`Balance profile skipped: ${summary.skippedBalanceEvaluations}.`);
      console.log(`Predictability support evidence: ${summary.createdPredictabilityEvidence} created, ${summary.updatedPredictabilityEvidence} updated.`);
      console.log(`Predictability support evaluations: ${summary.createdPredictabilityEvaluations} created, ${summary.updatedPredictabilityEvaluations} updated.`);
      if (summary.skippedPredictabilityEvaluations) console.log(`Predictability support skipped: ${summary.skippedPredictabilityEvaluations}.`);
      for (const profile of summary.profiles) {
        console.log(`${profile.equipmentName} ${profile.variantSku}: ${profile.ready ? "ready" : "not ready"} (${profile.maturity})`);
      }
    })
    .finally(async () => prisma.$disconnect());
}
