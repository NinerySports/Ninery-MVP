import type { EquipmentDNAAttribute, EquipmentDNAEvidence, EquipmentDNAExplanation } from "../equipment-dna.types.js";
import { confidenceBand } from "../evidence-confidence.js";

export function buildEquipmentDNAExplanation(input: {
  attribute: EquipmentDNAAttribute;
  score?: number;
  characteristicCode: string;
  sourceProfileId: string;
  rationale?: string;
  evidence: EquipmentDNAEvidence[];
  sourceLevel: "model" | "variant_adjusted";
}): EquipmentDNAExplanation {
  const evidenceScore = input.evidence.length * 20 + input.evidence.filter((item) => item.status === "approved").length * 20;
  const confidence = confidenceBand(Math.min(94, evidenceScore || 35));

  return {
    attribute: input.attribute,
    score: input.score,
    confidence,
    summary:
      input.score === undefined
        ? `No mapped ${input.attribute} score is available for this DNA profile.`
        : `${input.attribute} is scored from the mapped ${input.characteristicCode} characteristic.`,
    rationale: input.rationale,
    evidence: input.evidence,
    characteristicCode: input.characteristicCode,
    sourceProfileId: input.sourceProfileId,
    sourceLevel: input.sourceLevel,
    missing: input.score === undefined
  };
}
