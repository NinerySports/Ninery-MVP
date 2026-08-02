import type { EquipmentDNAProfile } from "@ninery/equipment-intelligence";
import type { CompatibilityRequestContext, EligibilityCheckResult, HardFilterReason } from "../compatibility.types.js";
import type { ScoringConfig } from "../scoring/scoring-config.types.js";

export function evaluateHardFilters(input: {
  equipment: EquipmentDNAProfile;
  context: CompatibilityRequestContext;
  config: ScoringConfig;
}): EligibilityCheckResult {
  const reasons: HardFilterReason[] = [];
  const equipment = input.equipment;
  const context = input.context;
  const minimumEvidence = context.minimumEvidenceConfidence ?? input.config.minimumEvidenceConfidence;

  if (equipment.certification !== context.certification) {
    reasons.push({
      code: "CERTIFICATION_MISMATCH",
      message: `This equipment is ${equipment.certification}-certified but the player requires ${context.certification} certification.`,
      sourceCodes: ["request.certification", "equipment.certification"]
    });
  }

  if (equipment.category !== context.category) {
    reasons.push({
      code: "CATEGORY_MISMATCH",
      message: `This equipment is category ${equipment.category} but the request requires ${context.category}.`,
      sourceCodes: ["request.category", "equipment.category"]
    });
  }

  if (equipment.status !== "active") {
    reasons.push({
      code: "EQUIPMENT_NOT_ACTIVE",
      message: "This equipment is not active.",
      sourceCodes: ["equipment.status"]
    });
  }

  if (!equipment.eligibility.eligible || (!equipment.publishedAt && !context.includeInternalDraftProfiles)) {
    reasons.push({
      code: "DNA_PROFILE_NOT_PUBLIC",
      message: "The equipment DNA profile is not public recommendation-ready.",
      sourceCodes: ["equipment.eligibility", "equipment.publishedAt"]
    });
  }

  if (context.variantPreferences && !variantMatches(equipment, context.variantPreferences)) {
    reasons.push({
      code: "VARIANT_NOT_AVAILABLE",
      message: "The requested length/drop variant is not available.",
      sourceCodes: ["request.variantPreferences", "equipment.availableVariants"]
    });
  }

  if (equipment.profileCompleteness < input.config.minimumProfileCompleteness) {
    reasons.push({
      code: "PROFILE_COMPLETENESS_TOO_LOW",
      message: `Equipment DNA completeness is ${equipment.profileCompleteness}, below the ${input.config.minimumProfileCompleteness} threshold.`,
      sourceCodes: ["equipment.profileCompleteness"]
    });
  }

  if (equipment.evidenceConfidence.score < minimumEvidence) {
    reasons.push({
      code: "EVIDENCE_CONFIDENCE_TOO_LOW",
      message: `Equipment evidence confidence is ${equipment.evidenceConfidence.score}, below the ${minimumEvidence} threshold.`,
      sourceCodes: ["equipment.evidenceConfidence"]
    });
  }

  const scoredCharacteristicCount = Object.values(equipment.scores).filter((score) => score !== undefined).length;
  if (scoredCharacteristicCount < input.config.minimumRequiredCharacteristics) {
    reasons.push({
      code: "INSUFFICIENT_REQUIRED_CHARACTERISTICS",
      message: `Only ${scoredCharacteristicCount} Equipment DNA characteristics are present.`,
      sourceCodes: ["equipment.scores"]
    });
  }

  return { equipmentId: equipment.equipmentId, eligible: reasons.length === 0, reasons };
}

function variantMatches(equipment: EquipmentDNAProfile, preferences: { length?: number; drop?: number }): boolean {
  return equipment.availableVariants.some((variant) => {
    const lengthMatches = preferences.length === undefined || variant.lengthInches === preferences.length;
    const dropMatches = preferences.drop === undefined || variant.dropWeight === preferences.drop;
    return lengthMatches && dropMatches;
  });
}
