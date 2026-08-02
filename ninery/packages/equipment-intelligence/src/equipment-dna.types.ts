export const equipmentDNAAttributes = [
  "batControl",
  "balance",
  "swingWeight",
  "barrelForgiveness",
  "sweetSpotSize",
  "powerPotential",
  "confidenceBuilding",
  "transitionFriendliness"
] as const;

export type EquipmentDNAAttribute = (typeof equipmentDNAAttributes)[number];
export type ConfidenceBand = "low" | "medium" | "high" | "validated";
export type EquipmentDNASourceLevel = "model" | "variant_adjusted";

export type EquipmentDNAScores = Partial<Record<EquipmentDNAAttribute, number>>;

export const equipmentCertificationValues = ["USA", "USSSA", "BBCOR", "none", "unknown"] as const;
export type EquipmentCertificationFilter = (typeof equipmentCertificationValues)[number];

export const equipmentCategoryValues = ["bat", "glove", "cleat", "helmet", "catcher_gear"] as const;
export type EquipmentCategoryFilter = (typeof equipmentCategoryValues)[number];

export const equipmentStatusValues = ["active", "coming_soon", "legacy", "archived"] as const;
export type EquipmentStatusFilter = (typeof equipmentStatusValues)[number];

export type EquipmentDNAVariant = {
  id: string;
  lengthInches?: number;
  weightOunces?: number;
  dropWeight?: number;
  msrp?: number;
  sku?: string;
};

export type EquipmentDNASpecification = {
  specificationCode: string;
  valueText?: string;
  valueNumber?: number;
  unit?: string;
  source?: string;
  verifiedAt?: string;
};

export type EquipmentDNAEvidence = {
  id: string;
  dnaScoreId?: string;
  evidenceType: string;
  title: string;
  summary: string;
  sourceReference?: string;
  reliability: string;
  status: string;
};

export type EquipmentDNAFitProfile = {
  fitType: string;
  fitCode: string;
  strength: number;
  confidence: ConfidenceBand;
  rationale: string;
  version: number;
};

export type EquipmentDNAPersonality = {
  personalityCode: string;
  personalityName: string;
  isPrimary: boolean;
  confidence: ConfidenceBand;
  derivationVersion: string;
  rationale: string;
};

export type EquipmentDNAExplanation = {
  attribute: EquipmentDNAAttribute;
  score?: number;
  confidence: ConfidenceBand;
  summary: string;
  rationale?: string;
  evidence: EquipmentDNAEvidence[];
  characteristicCode: string;
  sourceProfileId: string;
  sourceLevel: EquipmentDNASourceLevel;
  missing: boolean;
};

export type EquipmentDNAEligibility = {
  eligible: boolean;
  reasons: string[];
};

export type EquipmentDNAProfile = {
  equipmentId: string;
  variantId?: string;
  sourceLevel: EquipmentDNASourceLevel;
  manufacturer: string;
  model: string;
  modelYear?: number;
  certification: string;
  category: string;
  construction?: string;
  material?: string;
  barrelDiameter?: number;
  status: string;
  profileVersion: number;
  evidenceConfidence: {
    score: number;
    band: ConfidenceBand;
  };
  certificationLevel: string;
  primaryPersonality?: EquipmentDNAPersonality;
  secondaryPersonalities: EquipmentDNAPersonality[];
  fitProfiles: EquipmentDNAFitProfile[];
  specifications: EquipmentDNASpecification[];
  availableVariants: EquipmentDNAVariant[];
  selectedVariant?: EquipmentDNAVariant;
  sourceProfileId: string;
  profileCompleteness: number;
  publishedAt?: string;
  scores: EquipmentDNAScores;
  missingCharacteristics: EquipmentDNAAttribute[];
  explanations: EquipmentDNAExplanation[];
  eligibility: EquipmentDNAEligibility;
};

export type EquipmentDNAFilters = {
  certification?: EquipmentCertificationFilter;
  category?: EquipmentCategoryFilter;
  status?: EquipmentStatusFilter;
  minimumCompleteness?: number;
  minimumEvidenceConfidence?: number;
  modelYear?: number;
  variantLength?: number;
  dropWeight?: number;
  includeDraft?: boolean;
};

export type EquipmentDNAComparison = {
  sourceEquipmentId: string;
  targetEquipmentId: string;
  similarityScore: number;
  sharedStrengths: EquipmentDNAAttribute[];
  primaryDifferences: Array<{
    attribute: EquipmentDNAAttribute;
    sourceScore?: number;
    targetScore?: number;
    delta: number;
  }>;
  sourceBestFor?: string;
  targetBestFor?: string;
  confidence: ConfidenceBand;
  version: number;
};
