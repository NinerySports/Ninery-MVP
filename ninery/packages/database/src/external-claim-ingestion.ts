import { createHash } from "node:crypto";
import {
  qualifyEquipmentClaim,
  type EquipmentClaimAuthority,
  type EquipmentClaimConstructRole,
  type EquipmentClaimDependencyType,
  type EquipmentClaimIdentityAssertion,
  type EquipmentClaimProvenanceGraph,
  type EquipmentClaimQualificationAssessment,
  type EquipmentClaimType,
  type EquipmentIdentityCertainty,
  type EquipmentSourceType,
  type MultiSourceEvidenceClass
} from "@ninery/equipment-intelligence";

export const EXTERNAL_CLAIM_INGESTION_VERSION = "1.0" as const;
export const EXTERNAL_CLAIM_SEMANTIC_FINGERPRINT_VERSION = "1.0" as const;
export const NORMALIZATION_VOCABULARY_VERSION = "1.0" as const;
export const CONSTRUCT_MAPPING_VERSION = "1.0" as const;
export const CONTAMINATED_ATLAS_EQUIPMENT_ID = "66f59356-029f-4df7-9177-0d0f36ef3e9c";
export const CONTAMINATED_ATLAS_VARIANT_ID = "a485a596-ea15-4622-ac2e-452b7fd9c934";

export type ExternalClaimIngestionInput = {
  readonly source: { readonly stableKey: string; readonly displayName: string; readonly sourceType: EquipmentSourceType; readonly publisherIdentity?: string; readonly sourceVersion: string };
  readonly document: { readonly sourceReference: string; readonly documentType: "product_page" | "specification_sheet" | "retailer_page" | "review_article" | "review_video_transcript" | "certification_listing"; readonly title: string; readonly capturedAt: Date; readonly publishedAt?: Date; readonly modelYear?: number; readonly availability: "available" | "unavailable" | "historical" | "unknown"; readonly boundedContent: string; readonly revisionLabel?: string };
  readonly extraction: { readonly method: "manual" | "deterministic_parser" | "ai_assisted"; readonly extractorType: "human" | "software" | "ai_model"; readonly extractorId: string; readonly extractorVersion: string; readonly schemaVersion: string; readonly providerModelId?: string; readonly executedAt: Date };
  readonly targetIdentity: EquipmentClaimIdentityAssertion;
  readonly claims: readonly ExternalClaimProposal[];
};

export type ExternalClaimProposal = {
  readonly externalClaimKey: string;
  readonly sourceLocation?: string;
  readonly rawText?: string;
  readonly rawStructuredValue?: unknown;
  readonly claimType: EquipmentClaimType;
  readonly authority: EquipmentClaimAuthority;
  readonly authorityRationale: string;
  readonly identity: EquipmentClaimIdentityAssertion;
  readonly normalization: { readonly claimKey: string; readonly value: unknown; readonly unit?: string; readonly originalValue?: unknown; readonly originalUnit?: string; readonly method: "identity" | "unit_conversion" | "controlled_vocabulary" | "manual_interpretation" | "model_output"; readonly version: string; readonly vocabularyKnown: boolean; readonly evidenceClass: MultiSourceEvidenceClass };
  readonly dependency: { readonly type: EquipmentClaimDependencyType | "suspected_dependency"; readonly rationale: string; readonly upstreamClaimId?: string };
  readonly construct?: { readonly proposedConstruct: string; readonly method: "manual_review" | "controlled_vocabulary" | "policy_mapping" | "keyword_candidate"; readonly confidence: "high" | "medium" | "low" | "unmapped"; readonly version: string; readonly rationale: string };
  readonly limitations?: readonly string[];
};

export type ExternalClaimIngestionRecord = {
  readonly idempotencyKey: string;
  readonly semanticFingerprint: string;
  readonly sourceId: string;
  readonly documentId: string;
  readonly extractionRunId: string;
  readonly identityAssertionId: string;
  readonly rawClaimId: string;
  readonly normalizedClaimId: string;
  readonly dependencyAssessmentId: string;
  readonly constructRelationshipId: string;
  readonly qualificationDecisionId: string;
  readonly qualification: EquipmentClaimQualificationAssessment;
  readonly reviewReady: ExternalClaimReviewReadyCase;
};

export type ExternalClaimReviewReadyCase = {
  readonly normalizedClaimId: string;
  readonly equipmentId?: string;
  readonly equipmentVariantId?: string;
  readonly sourceName: string;
  readonly documentReference: string;
  readonly rawSourceWording?: string;
  readonly normalizedProposal: { readonly claimKey: string; readonly value: unknown; readonly unit?: string };
  readonly extraction: { readonly method: string; readonly extractorId: string; readonly extractorVersion: string; readonly providerModelId?: string };
  readonly identityCertainty: EquipmentIdentityCertainty;
  readonly dependencyState: EquipmentClaimDependencyType;
  readonly suspectedSyndication: boolean;
  readonly proposedConstruct?: string;
  readonly mappingConfidence?: string;
  readonly qualificationState: EquipmentClaimQualificationAssessment["state"];
  readonly historicalQualificationState: EquipmentClaimQualificationAssessment["state"];
  readonly current: boolean;
  readonly supersededByExtractionRunId?: string;
  readonly unresolvedConflictIds: readonly string[];
  readonly reasons: readonly string[];
  readonly blockers: readonly string[];
  readonly quarantineReasons: readonly string[];
  readonly nextDecision: "human_identity_review" | "human_dependency_review" | "human_normalization_review" | "human_construct_review" | "human_qualification_review" | "none_required_for_catalog_fact";
  readonly authority: { readonly humanApproved: false; readonly independenceEstablished: false; readonly supportingRoleCreated: false; readonly canonicalValueCreated: false; readonly numericValueCreated: false; readonly synthesisGranted: false; readonly recommendationGranted: false };
};

export type ExternalClaimIngestionBatchResult = { readonly succeeded: readonly ExternalClaimIngestionRecord[]; readonly failed: readonly { externalClaimKey: string; readonly code: string; readonly message: string }[] };
export type ExternalClaimTrustedResolution = {
  readonly source: ExternalClaimIngestionInput["source"];
  readonly identity: EquipmentClaimIdentityAssertion;
  readonly authority: EquipmentClaimAuthority;
  readonly blockers: readonly string[];
};

export type ExternalClaimPersistenceUnit = ReturnType<typeof buildPersistenceUnit>;

export interface ExternalClaimIngestionRepository {
  transaction<T>(operation: (repository: ExternalClaimIngestionRepository) => Promise<T>): Promise<T>;
  resolveTrustedContext(input: ExternalClaimIngestionInput, claim: ExternalClaimProposal): Promise<ExternalClaimTrustedResolution>;
  findByIdempotencyKey(idempotencyKey: string, semanticFingerprint: string): Promise<ExternalClaimIngestionRecord | undefined>;
  persist(unit: ExternalClaimPersistenceUnit): Promise<ExternalClaimIngestionRecord>;
  isRecognizedConcurrencyError(error: unknown): boolean;
}

export class ExternalClaimIngestionError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "ExternalClaimIngestionError"; }
}

export class GovernedExternalClaimIngestionService {
  constructor(private readonly repository: ExternalClaimIngestionRepository) {}

  async ingest(input: ExternalClaimIngestionInput): Promise<ExternalClaimIngestionBatchResult> {
    validateInput(input);
    const succeeded: ExternalClaimIngestionRecord[] = [];
    const failed: Array<{ externalClaimKey: string; code: string; message: string }> = [];
    for (const claim of input.claims) {
      try {
        const trusted = await this.repository.resolveTrustedContext(input, claim);
        const unit = buildPersistenceUnit(input, claim, trusted);
        let record: ExternalClaimIngestionRecord | undefined;
        for (let attempt = 0; attempt < 3 && !record; attempt += 1) {
          try {
            record = await this.repository.transaction(async (repository) => {
              const existing = await repository.findByIdempotencyKey(unit.idempotencyKey, unit.semanticFingerprint);
              return existing ?? repository.persist(unit);
            });
          } catch (error) {
            if (attempt === 2 || !this.repository.isRecognizedConcurrencyError(error)) throw error;
          }
        }
        if (!record) throw new ExternalClaimIngestionError("CONCURRENCY_RETRY_EXHAUSTED", "Concurrent ingestion did not converge within the bounded retry policy.");
        succeeded.push(record);
      } catch (error) {
        const known = error instanceof ExternalClaimIngestionError ? error : new ExternalClaimIngestionError("CLAIM_PIPELINE_FAILED", error instanceof Error ? error.message : "Unknown claim ingestion failure");
        failed.push({ externalClaimKey: claim.externalClaimKey, code: known.code, message: known.message });
      }
    }
    return { succeeded, failed };
  }
}

function buildPersistenceUnit(input: ExternalClaimIngestionInput, claim: ExternalClaimProposal, trusted: ExternalClaimTrustedResolution) {
  rejectCallerReviewShortcuts(claim);
  const evidenceClassUnclassified = requiresUnclassifiedEvidenceProposal(claim);
  const persistedEvidenceClass = evidenceClassUnclassified ? "unclassified" as const : claim.normalization.evidenceClass;
  const contentFingerprint = hash(input.document.boundedContent);
  const sourceId = uuid(`source:${trusted.source.stableKey}`);
  const documentId = uuid(`document:${sourceId}:${input.document.sourceReference}:${contentFingerprint}:${input.document.availability}`);
  const extractionRunId = uuid(`extraction:${documentId}:${input.extraction.method}:${input.extraction.extractorId}:${input.extraction.extractorVersion}:${input.extraction.schemaVersion}:${input.extraction.providerModelId ?? "none"}`);
  const identityAssertionId = uuid(`identity:${stable(trusted.identity)}`);
  const rawClaimId = uuid(`raw:${stable({ extractionRunId, externalClaimKey: claim.externalClaimKey, rawText: claim.rawText, rawStructuredValue: claim.rawStructuredValue, claimType: claim.claimType, sourceLocation: claim.sourceLocation, identity: claim.identity, limitations: [...new Set(claim.limitations ?? [])].sort() })}`);
  const normalizedClaimId = uuid(`normalized:${stable({ rawClaimId, claimKey: claim.normalization.claimKey, value: claim.normalization.value, unit: claim.normalization.unit, originalValue: claim.normalization.originalValue, originalUnit: claim.normalization.originalUnit, method: claim.normalization.method, version: claim.normalization.version, vocabularyKnown: claim.normalization.vocabularyKnown, evidenceClass: persistedEvidenceClass, limitations: [...new Set(claim.limitations ?? [])].sort() })}`);
  const dependencyAssessmentId = uuid(`dependency:${stable({ rawClaimId, type: claim.dependency.type, upstreamClaimId: claim.dependency.upstreamClaimId, rationale: claim.dependency.rationale, version: "1.0" })}`);
  const constructName = claim.construct?.proposedConstruct ?? `not_applicable:${claim.normalization.claimKey}`;
  const constructRelationshipId = uuid(`construct:${stable({ normalizedClaimId, constructName, method: claim.construct?.method ?? "keyword_candidate", confidence: claim.construct?.confidence ?? "unmapped", version: claim.construct?.version ?? CONSTRUCT_MAPPING_VERSION, rationale: claim.construct?.rationale, role: claim.claimType === "marketing_claim" ? "not_applicable" : "candidate_only" })}`);
  const qualificationDecisionId = uuid(`qualification:${stable({ normalizedClaimId, identityAssertionId, dependencyAssessmentId, constructRelationshipId, contractVersion: "1.0" })}`);
  const idempotencyKey = `ingestion:${qualificationDecisionId}`;
  const semanticFingerprint = hash(stable({ version: EXTERNAL_CLAIM_SEMANTIC_FINGERPRINT_VERSION, sourceId, documentId, extractionRunId, identityAssertionId, rawClaimId, normalizedClaimId, dependencyAssessmentId, constructRelationshipId, qualificationDecisionId }));
  const ai = input.extraction.method === "ai_assisted" || input.extraction.extractorType === "ai_model";
  const dependency = governedDependency(claim, ai);
  const identity = governedIdentity(trusted.identity, input.targetIdentity);
  const unknownVocabulary = !claim.normalization.vocabularyKnown;
  const marketing = claim.claimType === "marketing_claim";
  const rawReview = ai ? "review_pending" as const : "review_not_required" as const;
  const verification = ai ? "unverified_extracted" as const : unknownVocabulary ? "review_required" as const : "source_confirmed" as const;
  const constructRole: EquipmentClaimConstructRole = marketing ? "not_applicable" : "candidate_only";
  const graph: EquipmentClaimProvenanceGraph = {
    version: "1.0",
    sources: [{ id: sourceId, displayName: trusted.source.displayName, sourceType: trusted.source.sourceType, publisherIdentity: trusted.source.publisherIdentity, state: "active", version: trusted.source.sourceVersion }],
    documents: [{ id: documentId, sourceId, documentType: input.document.documentType, sourceReference: input.document.sourceReference, title: input.document.title, publishedAt: input.document.publishedAt?.toISOString(), retrievedAt: input.document.capturedAt.toISOString(), modelYear: input.document.modelYear, revision: revision(input.document.revisionLabel, contentFingerprint), contentFingerprint, availability: input.document.availability }],
    extractionRuns: [{ id: extractionRunId, method: input.extraction.method, extractorType: input.extraction.extractorType, extractorId: extractionIdentity(input.extraction), extractorVersion: input.extraction.extractorVersion, executedAt: input.extraction.executedAt.toISOString(), schemaVersion: input.extraction.schemaVersion, reviewState: rawReview }],
    identities: [{ ...identity, id: identityAssertionId }],
    rawClaims: [{ id: rawClaimId, sourceId, documentId, sourceLocation: claim.sourceLocation ?? `external-claim:${claim.externalClaimKey}`, rawText: claim.rawText, rawStructuredValue: claim.rawStructuredValue, claimType: claim.claimType, identityAssertionId, extractionRunId, verificationState: verification, reviewState: rawReview, independenceGroupId: dependency.independenceGroupId ?? `document:${documentId}`, authority: trusted.authority, authorityRationale: trusted.blockers.length ? "Authority remains unresolved; caller assertions were not trusted." : claim.authorityRationale, limitations: [...(claim.limitations ?? []), ...trusted.blockers] }],
    normalizedClaims: [{ id: normalizedClaimId, rawClaimId, claimKey: claim.normalization.claimKey, normalizedValue: claim.normalization.value, normalizedUnit: claim.normalization.unit, originalValue: claim.normalization.originalValue, originalUnit: claim.normalization.originalUnit, normalizationMethod: claim.normalization.method, normalizationVersion: claim.normalization.version, evidenceClass: governedEvidenceClass(claim), verificationState: verification, reviewState: rawReview, identityAssertionId, limitations: [...(claim.limitations ?? []), ...(unknownVocabulary ? ["Unknown normalization vocabulary requires review."] : [])] }],
    dependencies: [{ id: dependencyAssessmentId, claimId: rawClaimId, upstreamClaimId: dependency.upstreamClaimId, dependencyType: dependency.type, dependencyRationale: dependency.rationale, reviewedState: "review_pending" }],
    constructRelationships: [{ id: constructRelationshipId, normalizedClaimId, construct: constructName, role: constructRole, mappingMethod: claim.construct?.method ?? "keyword_candidate", mappingVersion: claim.construct?.version ?? CONSTRUCT_MAPPING_VERSION, reviewState: "review_pending", rationale: claim.construct?.rationale ?? "No behavioral construct relationship proposed.", limitations: ["Proposal only; no construct value or authority is created."], constructValueCreated: false }],
    modeledLineages: []
  };
  const qualification = qualifyEquipmentClaim({ graph, normalizedClaimId, targetIdentity: identity });
  const governedQualification: EquipmentClaimQualificationAssessment = trusted.blockers.length || (evidenceClassUnclassified && claim.claimType !== "marketing_claim") ? { ...qualification, state: "review_required", proposedEvidenceClass: undefined, proposedEvidenceInput: undefined } : qualification;
  const quarantineReasons = [...new Set([...quarantine(input, claim, identity, dependency, governedQualification), ...trusted.blockers, ...(evidenceClassUnclassified ? ["evidence_class_unclassified"] : [])])].sort();
  const reviewReady = projection({ ...input, source: trusted.source }, claim, normalizedClaimId, identity, dependency, governedQualification, quarantineReasons);
  return { idempotencyKey, semanticFingerprint, persistedEvidenceClass, contentFingerprint, sourceId, documentId, extractionRunId, identityAssertionId, rawClaimId, normalizedClaimId, dependencyAssessmentId, constructRelationshipId, qualificationDecisionId, input: { ...input, source: trusted.source }, claim, graph, qualification: governedQualification, reviewReady, dependency, identity } as const;
}

function rejectCallerReviewShortcuts(claim: ExternalClaimProposal) {
  const dependency = claim.dependency as unknown as Record<string, unknown>;
  for (const key of ["humanReviewed", "reviewed", "reviewerReference", "reviewerIdentity", "reviewedAt", "independenceGroupId"]) {
    if (key in dependency) throw new ExternalClaimIngestionError("CALLER_REVIEW_PROVENANCE_FORBIDDEN", `Caller-controlled ${key} cannot establish dependency or independence review.`);
  }
}

function validateInput(input: ExternalClaimIngestionInput) {
  if (!input.source.stableKey.trim() || !input.document.sourceReference.trim() || !input.document.boundedContent.trim()) throw new ExternalClaimIngestionError("SOURCE_DOCUMENT_INCOMPLETE", "Stable source identity, external reference, and bounded captured content are required.");
  if (input.targetIdentity.equipmentId === CONTAMINATED_ATLAS_EQUIPMENT_ID || input.targetIdentity.equipmentVariantId === CONTAMINATED_ATLAS_VARIANT_ID) throw new ExternalClaimIngestionError("CONTAMINATED_ATLAS_IDENTITY_BLOCKED", "Ticket #076 may not attach records to the contaminated Atlas USA identity.");
  if (input.extraction.extractorType === "ai_model" && !input.extraction.providerModelId?.trim()) throw new ExternalClaimIngestionError("AI_PROVENANCE_INCOMPLETE", "AI-assisted extraction requires provider/model provenance.");
}

function governedIdentity(identity: EquipmentClaimIdentityAssertion, target: EquipmentClaimIdentityAssertion): EquipmentClaimIdentityAssertion {
  if (identity.equipmentVariantId && identity.equipmentVariantId !== target.equipmentVariantId) return { ...identity, certainty: "conflicting", equipmentId: undefined, equipmentVariantId: undefined, limitations: [...identity.limitations, "Variant does not match the ingestion target."] };
  if (identity.equipmentId && identity.equipmentId !== target.equipmentId) return { ...identity, certainty: "conflicting", equipmentId: undefined, equipmentVariantId: undefined, limitations: [...identity.limitations, "Equipment does not match the ingestion target."] };
  if (identity.certainty === "family_only" && identity.equipmentVariantId) return { ...identity, equipmentVariantId: undefined, limitations: [...identity.limitations, "Family-only identity cannot bind an exact variant."] };
  return identity;
}

function governedDependency(claim: ExternalClaimProposal, ai: boolean) {
  if (claim.dependency.type === "suspected_dependency") return { type: "unknown_dependency" as const, upstreamClaimId: claim.dependency.upstreamClaimId, independenceGroupId: undefined, suspected: true, rationale: `Suspected syndication; unresolved: ${claim.dependency.rationale}` };
  if (claim.dependency.type === "independent_observation") return { type: "unknown_dependency" as const, upstreamClaimId: undefined, independenceGroupId: undefined, suspected: false, rationale: ai ? "Automated processing cannot establish independence." : "Ingestion cannot establish independence without a persisted governed human review." };
  return { type: claim.dependency.type, upstreamClaimId: claim.dependency.upstreamClaimId, independenceGroupId: undefined, suspected: false, rationale: claim.dependency.rationale };
}

function governedEvidenceClass(claim: ExternalClaimProposal): MultiSourceEvidenceClass {
  return claim.normalization.evidenceClass;
}

function requiresUnclassifiedEvidenceProposal(claim: ExternalClaimProposal) {
  return ["subjective_observation", "comparative_observation", "marketing_claim"].includes(claim.claimType);
}

function quarantine(input: ExternalClaimIngestionInput, claim: ExternalClaimProposal, identity: EquipmentClaimIdentityAssertion, dependency: ReturnType<typeof governedDependency>, qualification: EquipmentClaimQualificationAssessment) {
  const reasons: string[] = [];
  if (["ambiguous", "conflicting", "unresolved", "family_only"].includes(identity.certainty)) reasons.push(`identity_${identity.certainty}`);
  if (!claim.normalization.vocabularyKnown) reasons.push("unknown_normalization_vocabulary");
  if (dependency.type === "unknown_dependency") reasons.push(dependency.suspected ? "suspected_syndication" : "dependency_unknown");
  if (claim.construct && claim.construct.confidence !== "high") reasons.push("construct_mapping_uncertain");
  if (input.extraction.method === "ai_assisted") reasons.push("ai_extraction_requires_review");
  if (claim.claimType === "marketing_claim") reasons.push("marketing_not_behavioral_authority");
  if (qualification.state === "review_required" || qualification.state === "not_eligible") reasons.push(`qualification_${qualification.state}`);
  return [...new Set(reasons)].sort();
}

function projection(input: ExternalClaimIngestionInput, claim: ExternalClaimProposal, normalizedClaimId: string, identity: EquipmentClaimIdentityAssertion, dependency: ReturnType<typeof governedDependency>, qualification: EquipmentClaimQualificationAssessment, quarantineReasons: readonly string[]): ExternalClaimReviewReadyCase {
  const nextDecision = quarantineReasons.some((item) => item.startsWith("identity_")) ? "human_identity_review" : quarantineReasons.includes("unknown_normalization_vocabulary") ? "human_normalization_review" : quarantineReasons.some((item) => item.includes("dependency") || item.includes("syndication")) ? "human_dependency_review" : quarantineReasons.includes("construct_mapping_uncertain") ? "human_construct_review" : qualification.state === "qualified" && claim.claimType !== "marketing_claim" ? "none_required_for_catalog_fact" : "human_qualification_review";
  return { normalizedClaimId, equipmentId: identity.equipmentId, equipmentVariantId: identity.equipmentVariantId, sourceName: input.source.displayName, documentReference: input.document.sourceReference, rawSourceWording: claim.rawText, normalizedProposal: { claimKey: claim.normalization.claimKey, value: claim.normalization.value, unit: claim.normalization.unit }, extraction: { method: input.extraction.method, extractorId: input.extraction.extractorId, extractorVersion: input.extraction.extractorVersion, providerModelId: input.extraction.providerModelId }, identityCertainty: identity.certainty, dependencyState: dependency.type, suspectedSyndication: dependency.suspected, proposedConstruct: claim.construct?.proposedConstruct, mappingConfidence: claim.construct?.confidence, qualificationState: qualification.state, historicalQualificationState: qualification.state, current: true, unresolvedConflictIds: [], reasons: qualification.reasons, blockers: qualification.blockers, quarantineReasons, nextDecision, authority: { humanApproved: false, independenceEstablished: false, supportingRoleCreated: false, canonicalValueCreated: false, numericValueCreated: false, synthesisGranted: false, recommendationGranted: false } };
}

function extractionIdentity(extraction: ExternalClaimIngestionInput["extraction"]) { return extraction.providerModelId ? `${extraction.extractorId}:${extraction.providerModelId}` : extraction.extractorId; }
function revision(label: string | undefined, fingerprint: string) { return `${label ?? "captured"}-${fingerprint.slice(0, 16)}`; }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`; return JSON.stringify(value); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function uuid(seed: string) { const hex = hash(seed); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`; }
