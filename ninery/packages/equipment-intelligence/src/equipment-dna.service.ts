import type { EquipmentDNAProfile, EquipmentDNAAttribute, EquipmentDNAFilters, EquipmentDNAComparison, EquipmentDNAEligibility } from "./equipment-dna.types.js";
import { equipmentDNAAttributes } from "./equipment-dna.types.js";
import { attributeToCharacteristicCode, mapCharacteristicCode } from "./mapping/characteristic-mapping.js";
import { decimalToNumber, normalizeEquipmentDNAScore } from "./normalization/score-normalization.js";
import { calculateEvidenceConfidence } from "./evidence-confidence.js";
import { EquipmentDNARepository, type PrismaLike } from "./equipment-dna.repository.js";
import { buildEquipmentDNAExplanation } from "./explainability/equipment-explanation-builder.js";

export class EquipmentDNANotFoundError extends Error {}
export class EquipmentDNAValidationError extends Error {}

export class EquipmentDNAService {
  constructor(private readonly repository: EquipmentDNARepository) {}

  static fromPrisma(prisma: PrismaLike) {
    return new EquipmentDNAService(new EquipmentDNARepository(prisma));
  }

  async getEquipmentDNA(equipmentId: string, options: { includeDraft?: boolean } = {}): Promise<EquipmentDNAProfile> {
    const equipment = await this.repository.getEquipmentById(equipmentId);
    if (!equipment) throw new EquipmentDNANotFoundError("Equipment was not found.");
    const profile = await this.repository.getActiveDNAProfile(equipmentId, options);
    if (!profile) return this.emptyProfile(equipment as never, ["No active DNA profile"]);

    return this.buildProfile(equipment as never, profile as never, undefined, options);
  }

  async getEquipmentVariantDNA(variantId: string, options: { includeDraft?: boolean } = {}): Promise<EquipmentDNAProfile> {
    const variant = await this.repository.getVariantById(variantId);
    if (!variant) throw new EquipmentDNANotFoundError("Equipment variant was not found.");
    const profile = await this.getEquipmentDNA(variant.equipmentId, options);
    return {
      ...profile,
      variantId,
      selectedVariant: mapVariant(variant as never),
      sourceLevel: "model"
    };
  }

  async listRecommendationEligibleEquipment(filters: EquipmentDNAFilters = {}): Promise<EquipmentDNAProfile[]> {
    const equipmentRows = (await this.repository.listEligibleEquipment(filters)) as Array<EquipmentRow & { variants?: VariantRow[] }>;
    const profiles = await Promise.all(
      equipmentRows.map((item: EquipmentRow) => this.getEquipmentDNA(item.id, { includeDraft: filters.includeDraft }))
    );

    return profiles.filter(
      (profile: EquipmentDNAProfile) =>
        profile.eligibility.eligible &&
        profile.profileCompleteness >= (filters.minimumCompleteness ?? 0) &&
        profile.evidenceConfidence.score >= (filters.minimumEvidenceConfidence ?? 0) &&
        (!filters.variantLength || profile.availableVariants.some((variant: { lengthInches?: number }) => variant.lengthInches === filters.variantLength)) &&
        (!filters.dropWeight || profile.availableVariants.some((variant: { dropWeight?: number }) => variant.dropWeight === filters.dropWeight))
    );
  }

  async getEquipmentDNAExplanation(equipmentId: string, attribute: EquipmentDNAAttribute) {
    const profile = await this.getEquipmentDNA(equipmentId);
    return profile.explanations.find((explanation) => explanation.attribute === attribute) ?? null;
  }

  async compareEquipmentDNA(sourceEquipmentId: string, targetEquipmentId: string): Promise<EquipmentDNAComparison> {
    const [source, target] = await Promise.all([this.getEquipmentDNA(sourceEquipmentId), this.getEquipmentDNA(targetEquipmentId)]);
    const differences = equipmentDNAAttributes
      .map((attribute) => {
        const sourceScore = source.scores[attribute];
        const targetScore = target.scores[attribute];
        return {
          attribute,
          sourceScore,
          targetScore,
          delta: sourceScore === undefined || targetScore === undefined ? 100 : Math.abs(sourceScore - targetScore)
        };
      })
      .sort((a, b) => b.delta - a.delta);
    const comparable = differences.filter((item) => item.sourceScore !== undefined && item.targetScore !== undefined);
    const averageDelta = comparable.length === 0 ? 100 : comparable.reduce((sum, item) => sum + item.delta, 0) / comparable.length;

    return {
      sourceEquipmentId,
      targetEquipmentId,
      similarityScore: Math.round(100 - averageDelta),
      sharedStrengths: comparable
        .filter((item) => item.delta <= 10 && (item.sourceScore ?? 0) >= 70 && (item.targetScore ?? 0) >= 70)
        .map((item) => item.attribute),
      primaryDifferences: differences.slice(0, 4),
      confidence: source.evidenceConfidence.score >= 75 && target.evidenceConfidence.score >= 75 ? "high" : "medium",
      version: 1
    };
  }

  private async buildProfile(equipment: EquipmentRow, profile: DNAProfileRow, selectedVariant?: VariantRow, options: { includeDraft?: boolean } = {}): Promise<EquipmentDNAProfile> {
    const [scores, specifications, evidence, fitProfiles, personalities, variants] = await Promise.all([
      this.repository.getDNAScores(profile.id),
      this.repository.getSpecifications(equipment.id),
      this.repository.getEvidence(equipment.id, profile.id),
      this.repository.getFitProfiles(equipment.id, profile.id),
      this.repository.getPersonalities(equipment.id, profile.id),
      this.repository.getAvailableVariants(equipment.id)
    ]);
    const mappedScores: EquipmentDNAProfile["scores"] = {};
    const rationales = new Map<string, string | undefined>();
    const evidenceByScore = new Map<string, ReturnType<typeof mapEvidence>[]>();

    for (const score of scores as DNAScoreRow[]) {
      const attribute = mapCharacteristicCode(score.characteristic.code);
      if (!attribute) continue;
      mappedScores[attribute] = normalizeEquipmentDNAScore(decimalToNumber(score.score) ?? 0);
      rationales.set(attribute, score.rationale ?? undefined);
      evidenceByScore.set(attribute, (score.evidence ?? []).map(mapEvidence));
    }

    const missingCharacteristics = equipmentDNAAttributes.filter((attribute) => mappedScores[attribute] === undefined);
    const profileCompleteness = Math.round(((equipmentDNAAttributes.length - missingCharacteristics.length) / equipmentDNAAttributes.length) * 100);
    const allEvidence = (evidence as EvidenceRow[]).map(mapEvidence);
    const scoreEvidenceCount = [...evidenceByScore.values()].filter((items) => items.length > 0).length;
    const evidenceConfidence = calculateEvidenceConfidence({
      scoreCount: equipmentDNAAttributes.length,
      scoresWithEvidence: scoreEvidenceCount,
      evidence: allEvidence,
      certificationLevel: profile.certificationLevel,
      profileCompleteness,
      published: Boolean(profile.publishedAt)
    });
    const explanations = equipmentDNAAttributes.map((attribute) =>
      buildEquipmentDNAExplanation({
        attribute,
        score: mappedScores[attribute],
        characteristicCode: attributeToCharacteristicCode[attribute],
        sourceProfileId: profile.id,
        rationale: rationales.get(attribute),
        evidence: evidenceByScore.get(attribute) ?? allEvidence.filter((item) => item.dnaScoreId === undefined),
        sourceLevel: "model"
      })
    );
    const eligibility = calculateEligibility({
      equipmentStatus: equipment.status,
      profileStatus: profile.status,
      published: Boolean(profile.publishedAt),
      profileCompleteness,
      evidenceConfidence: evidenceConfidence.score,
      variantCount: variants.length,
      missingCharacteristics,
      includeDraft: options.includeDraft
    });
    const primaryPersonality = (personalities as PersonalityRow[]).find((item) => item.isPrimary);

    return {
      equipmentId: equipment.id,
      variantId: selectedVariant?.id,
      sourceLevel: "model",
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      modelYear: equipment.modelYear ?? undefined,
      certification: equipment.certification,
      category: equipment.category,
      construction: equipment.construction ?? undefined,
      material: equipment.material ?? undefined,
      barrelDiameter: decimalToNumber(equipment.barrelDiameter),
      status: equipment.status,
      profileVersion: profile.version,
      evidenceConfidence,
      certificationLevel: profile.certificationLevel,
      primaryPersonality: primaryPersonality ? mapPersonality(primaryPersonality) : undefined,
      secondaryPersonalities: (personalities as PersonalityRow[]).filter((item) => !item.isPrimary).map(mapPersonality),
      fitProfiles: (fitProfiles as FitProfileRow[]).map(mapFitProfile),
      specifications: (specifications as SpecificationRow[]).map(mapSpecification),
      availableVariants: (variants as VariantRow[]).map(mapVariant),
      selectedVariant: selectedVariant ? mapVariant(selectedVariant) : undefined,
      sourceProfileId: profile.id,
      profileCompleteness,
      publishedAt: profile.publishedAt?.toISOString(),
      scores: mappedScores,
      missingCharacteristics,
      explanations,
      eligibility
    };
  }

  private emptyProfile(equipment: EquipmentRow, reasons: string[]): EquipmentDNAProfile {
    return {
      equipmentId: equipment.id,
      sourceLevel: "model",
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      modelYear: equipment.modelYear ?? undefined,
      certification: equipment.certification,
      category: equipment.category,
      construction: equipment.construction ?? undefined,
      material: equipment.material ?? undefined,
      barrelDiameter: decimalToNumber(equipment.barrelDiameter),
      status: equipment.status,
      profileVersion: 0,
      evidenceConfidence: { score: 0, band: "low" },
      certificationLevel: "bronze",
      secondaryPersonalities: [],
      fitProfiles: [],
      specifications: [],
      availableVariants: [],
      sourceProfileId: "",
      profileCompleteness: 0,
      scores: {},
      missingCharacteristics: [...equipmentDNAAttributes],
      explanations: [],
      eligibility: { eligible: false, reasons }
    };
  }
}

function calculateEligibility(input: {
  equipmentStatus: string;
  profileStatus: string;
  published: boolean;
  profileCompleteness: number;
  evidenceConfidence: number;
  variantCount: number;
  missingCharacteristics: EquipmentDNAAttribute[];
  includeDraft?: boolean;
}): EquipmentDNAEligibility {
  const reasons = [];
  if (input.equipmentStatus !== "active") reasons.push("Equipment is not active");
  if (input.profileStatus !== "active") reasons.push("No active DNA profile");
  if (!input.published && !input.includeDraft) reasons.push("DNA profile is not published");
  if (input.variantCount === 0) reasons.push("No available variants");
  if (input.profileCompleteness < 75) reasons.push("Profile completeness is below recommendation threshold");
  if (input.evidenceConfidence < 50) reasons.push("Evidence confidence is below recommendation threshold");
  for (const attribute of input.missingCharacteristics) reasons.push(`Missing ${attribute} score`);
  return { eligible: reasons.length === 0, reasons };
}

type EquipmentRow = { id: string; manufacturer: string; model: string; modelYear: number | null; certification: string; category: string; construction: string | null; material: string | null; barrelDiameter: unknown; status: string };
type DNAProfileRow = { id: string; version: number; certificationLevel: string; status: string; publishedAt: Date | null };
type VariantRow = { id: string; lengthInches: unknown; weightOunces: unknown; dropWeight: number | null; msrp: unknown; sku: string | null; equipmentId?: string };
type SpecificationRow = { specificationCode: string; valueText: string | null; valueNumber: unknown; unit: string | null; source: string | null; verifiedAt: Date | null };
type EvidenceRow = { id: string; dnaScoreId?: string | null; evidenceType: string; title: string; summary: string; sourceReference: string | null; reliability: string; status: string };
type FitProfileRow = { fitType: string; fitCode: string; strength: number; confidence: string; rationale: string; version: number };
type PersonalityRow = { personalityCode: string; personalityName: string; isPrimary: boolean; confidence: string; derivationVersion: string; rationale: string };
type DNAScoreRow = { id: string; score: unknown; rationale: string | null; characteristic: { code: string }; evidence?: EvidenceRow[] };

function mapVariant(row: VariantRow) {
  return {
    id: row.id,
    lengthInches: decimalToNumber(row.lengthInches),
    weightOunces: decimalToNumber(row.weightOunces),
    dropWeight: row.dropWeight ?? undefined,
    msrp: decimalToNumber(row.msrp),
    sku: row.sku ?? undefined
  };
}

function mapSpecification(row: SpecificationRow) {
  return {
    specificationCode: row.specificationCode,
    valueText: row.valueText ?? undefined,
    valueNumber: decimalToNumber(row.valueNumber),
    unit: row.unit ?? undefined,
    source: row.source ?? undefined,
    verifiedAt: row.verifiedAt?.toISOString()
  };
}

function mapEvidence(row: EvidenceRow) {
  return {
    id: row.id,
    dnaScoreId: row.dnaScoreId ?? undefined,
    evidenceType: row.evidenceType,
    title: row.title,
    summary: row.summary,
    sourceReference: row.sourceReference ?? undefined,
    reliability: row.reliability,
    status: row.status
  };
}

function mapFitProfile(row: FitProfileRow) {
  return {
    fitType: row.fitType,
    fitCode: row.fitCode,
    strength: row.strength,
    confidence: row.confidence as "low" | "medium" | "high" | "validated",
    rationale: row.rationale,
    version: row.version
  };
}

function mapPersonality(row: PersonalityRow) {
  return {
    personalityCode: row.personalityCode,
    personalityName: row.personalityName,
    isPrimary: row.isPrimary,
    confidence: row.confidence as "low" | "medium" | "high" | "validated",
    derivationVersion: row.derivationVersion,
    rationale: row.rationale
  };
}
