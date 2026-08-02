import type { ConfidenceBand, EquipmentDNAEvidence } from "./equipment-dna.types.js";

export type EvidenceConfidenceInput = {
  scoreCount: number;
  scoresWithEvidence: number;
  evidence: EquipmentDNAEvidence[];
  certificationLevel: string;
  profileCompleteness: number;
  published: boolean;
};

const reliabilityWeight: Record<string, number> = {
  low: 30,
  medium: 60,
  high: 82,
  verified: 95
};

const statusWeight: Record<string, number> = {
  collected: 45,
  in_review: 60,
  approved: 85,
  rejected: 10,
  archived: 25
};

const certificationWeight: Record<string, number> = {
  bronze: 55,
  silver: 70,
  gold: 82,
  platinum: 92
};

export function calculateEvidenceConfidence(input: EvidenceConfidenceInput): { score: number; band: ConfidenceBand } {
  const coverage = input.scoreCount === 0 ? 0 : (input.scoresWithEvidence / input.scoreCount) * 100;
  const evidenceQuality =
    input.evidence.length === 0
      ? 20
      : input.evidence.reduce((sum, item) => sum + ((reliabilityWeight[item.reliability] ?? 45) + (statusWeight[item.status] ?? 45)) / 2, 0) /
        input.evidence.length;
  const certification = certificationWeight[input.certificationLevel] ?? 50;
  const publication = input.published ? 85 : 40;
  const score = Math.round(
    coverage * 0.28 + evidenceQuality * 0.28 + input.profileCompleteness * 0.22 + certification * 0.12 + publication * 0.1
  );
  const cappedScore = input.certificationLevel === "platinum" && input.evidence.some((item) => item.reliability === "verified") ? score : Math.min(score, 94);

  return {
    score: cappedScore,
    band: confidenceBand(cappedScore)
  };
}

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 95) return "validated";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}
