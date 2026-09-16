import { createHash } from "node:crypto";
import { evaluateExternalExpertSupportingRole, type ExternalExpertSupportingRoleDecision, type ExternalExpertSupportingRoleInput } from "@ninery/equipment-intelligence";

export const EXTERNAL_SUPPORTING_PERSISTENCE_VERSION = "1.0" as const;
export const EXTERNAL_SUPPORTING_POLICY = "external_expert_supporting_role" as const;
export const EXTERNAL_SUPPORTING_POLICY_VERSION = "1.0-provisional" as const;

export type ExternalSupportingPersistenceContext = {
  readonly rawClaim: { readonly id: string; readonly claimType: string; readonly verificationState: string; readonly supersededByCount: number; readonly document: { readonly sourceId: string; readonly source: { readonly id: string; readonly sourceType: string } }; readonly identity: { readonly certainty: string; readonly equipmentId?: string; readonly equipmentVariantId?: string; readonly variantEquipmentId?: string; readonly manufacturerMatches: boolean; readonly modelMatches: boolean; readonly modelYearMatches: boolean; readonly certificationMatches: boolean; readonly productFamilyMatches: boolean; readonly dropMatches?: boolean; readonly sizeMatches?: boolean; readonly variantMatches?: boolean } };
  readonly normalizedClaim: { readonly id: string; readonly rawClaimId: string; readonly verificationState: string };
  readonly dependencyAssessment: { readonly id: string; readonly claimId: string; readonly dependencyType: string; readonly independenceGroupId?: string; readonly reviewedState: string; readonly supersededByCount: number };
  readonly constructRelationship: { readonly id: string; readonly normalizedClaimId: string; readonly proposedConstruct: string; readonly mappingConfidence: string; readonly mappingVersion: string; readonly policyVersion: string; readonly role: string; readonly reviewState: string; readonly constructValueCreated: boolean; readonly supersededByCount: number };
  readonly qualification: { readonly id: string; readonly normalizedClaimId: string; readonly constructRelationshipId: string; readonly contractVersion: string; readonly state: string };
  readonly review: { readonly id: string; readonly normalizedClaimId: string; readonly constructRelationshipId: string; readonly decision: string; readonly reviewerType: string; readonly reviewerReference: string };
  readonly unresolvedConflictCount: number;
};

export type ExternalSupportingPersistenceCommand = {
  readonly rawClaimId: string; readonly normalizedClaimId: string; readonly dependencyAssessmentId: string; readonly constructRelationshipId: string;
  readonly qualificationDecisionId: string; readonly reviewDecisionId: string; readonly identityScope: "equipment_family" | "certification_family" | "drop_family" | "size_family" | "exact_variant";
  readonly direction: "lower" | "moderate_or_neutral" | "higher" | "comparative_only" | "unspecified"; readonly comparisonTarget?: string; readonly idempotencyKey: string;
};

export type PersistedExternalSupportingDecision = { readonly id: string; readonly idempotencyKey: string; readonly decisionFingerprint: string; readonly eligible: boolean; readonly role: string };
export type ExternalSupportingDecisionInsert = ExternalSupportingPersistenceCommand & {
  readonly policy: typeof EXTERNAL_SUPPORTING_POLICY; readonly policyVersion: typeof EXTERNAL_SUPPORTING_POLICY_VERSION; readonly policyStatus: "PROVISIONAL_CONSTRUCT_SPECIFIC_POLICY";
  readonly eligible: true; readonly role: "supporting_context"; readonly reasons: readonly string[]; readonly blockers: readonly string[]; readonly decisionFingerprint: string;
  readonly directEvidenceContribution: 0; readonly structuredContribution: 0; readonly physicalContribution: 0; readonly controlledContribution: 0;
  readonly canonicalValueCreated: false; readonly numericValueCreated: false; readonly synthesisEligibilityGranted: false; readonly compatibilityAuthorityGranted: false;
  readonly recommendationAuthorityGranted: false; readonly decisionBookAuthorityGranted: false;
};

export interface ExternalSupportingPersistenceRepository {
  transaction<T>(operation: (repository: ExternalSupportingPersistenceRepository) => Promise<T>): Promise<T>;
  loadContext(command: ExternalSupportingPersistenceCommand): Promise<ExternalSupportingPersistenceContext | undefined>;
  findDecisionByIdempotencyKey(idempotencyKey: string): Promise<PersistedExternalSupportingDecision | undefined>;
  createDecision(data: ExternalSupportingDecisionInsert): Promise<PersistedExternalSupportingDecision>;
}

export class ExternalSupportingPersistenceError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "ExternalSupportingPersistenceError"; }
}

export class ExternalSupportingEvidencePersistenceService {
  constructor(private readonly repository: ExternalSupportingPersistenceRepository) {}

  async persist(command: ExternalSupportingPersistenceCommand): Promise<PersistedExternalSupportingDecision> {
    const decisionFingerprint = fingerprintCommand(command);
    return this.repository.transaction(async (repository) => {
      const existing = await repository.findDecisionByIdempotencyKey(command.idempotencyKey);
      if (existing) {
        if (existing.decisionFingerprint !== decisionFingerprint) throw new ExternalSupportingPersistenceError("IDEMPOTENCY_CONFLICT", "The idempotency key belongs to a different immutable decision.");
        return existing;
      }
      const context = await repository.loadContext(command);
      if (!context) throw new ExternalSupportingPersistenceError("PERSISTENCE_CONTEXT_NOT_FOUND", "The complete claim-bound persistence context was not found.");
      validateBindings(command, context);
      const decision = evaluateContext(command, context);
      if (!decision.eligible) throw new ExternalSupportingPersistenceError("SUPPORTING_ROLE_INELIGIBLE", `Supporting role blocked: ${decision.blockers.join(", ")}`);
      return repository.createDecision({ ...command, policy: EXTERNAL_SUPPORTING_POLICY, policyVersion: EXTERNAL_SUPPORTING_POLICY_VERSION,
        policyStatus: "PROVISIONAL_CONSTRUCT_SPECIFIC_POLICY", eligible: true, role: "supporting_context", reasons: decision.reasons, blockers: decision.blockers,
        decisionFingerprint, directEvidenceContribution: 0, structuredContribution: 0, physicalContribution: 0, controlledContribution: 0,
        canonicalValueCreated: false, numericValueCreated: false, synthesisEligibilityGranted: false, compatibilityAuthorityGranted: false,
        recommendationAuthorityGranted: false, decisionBookAuthorityGranted: false });
    });
  }

  assessCurrentEligibility(command: ExternalSupportingPersistenceCommand, context: ExternalSupportingPersistenceContext): ExternalExpertSupportingRoleDecision {
    validateBindings(command, context); return evaluateContext(command, context);
  }
}

function validateBindings(command: ExternalSupportingPersistenceCommand, context: ExternalSupportingPersistenceContext) {
  const mismatch = command.rawClaimId !== context.rawClaim.id || command.normalizedClaimId !== context.normalizedClaim.id || context.normalizedClaim.rawClaimId !== context.rawClaim.id ||
    command.dependencyAssessmentId !== context.dependencyAssessment.id || context.dependencyAssessment.claimId !== context.rawClaim.id || command.constructRelationshipId !== context.constructRelationship.id ||
    context.constructRelationship.normalizedClaimId !== context.normalizedClaim.id || command.qualificationDecisionId !== context.qualification.id || context.qualification.normalizedClaimId !== context.normalizedClaim.id ||
    context.qualification.constructRelationshipId !== context.constructRelationship.id || command.reviewDecisionId !== context.review.id || context.review.normalizedClaimId !== context.normalizedClaim.id || context.review.constructRelationshipId !== context.constructRelationship.id;
  if (mismatch) throw new ExternalSupportingPersistenceError("CROSS_LINEAGE_REFERENCE", "Every decision must bind to the same raw claim, normalized claim, and construct relationship.");
  if (context.rawClaim.document.sourceId !== context.rawClaim.document.source.id) throw new ExternalSupportingPersistenceError("SOURCE_DOCUMENT_MISMATCH", "The claim document does not belong to its resolved source.");
  const identity = context.rawClaim.identity;
  if (identity.equipmentVariantId && (!identity.equipmentId || identity.variantEquipmentId !== identity.equipmentId)) throw new ExternalSupportingPersistenceError("EQUIPMENT_VARIANT_MISMATCH", "The identity variant does not belong to the asserted equipment.");
}

function evaluateContext(command: ExternalSupportingPersistenceCommand, context: ExternalSupportingPersistenceContext) {
  const rawInvalid = context.rawClaim.verificationState === "superseded" || context.rawClaim.supersededByCount > 0;
  const normalizedInvalid = context.normalizedClaim.verificationState === "superseded";
  const conflicting = context.rawClaim.verificationState === "conflicting" || context.normalizedClaim.verificationState === "conflicting" || context.unresolvedConflictCount > 0;
  const identity = context.rawClaim.identity;
  return evaluateExternalExpertSupportingRole({ observationId: context.normalizedClaim.id, sourceType: requireMember("source type", context.rawClaim.document.source.sourceType, SOURCE_TYPES), claimType: requireMember("claim type", context.rawClaim.claimType, CLAIM_TYPES),
    dependencyType: requireMember("dependency type", context.dependencyAssessment.supersededByCount === 0 ? context.dependencyAssessment.dependencyType : "unknown_dependency", DEPENDENCY_TYPES),
    independenceGroupId: context.dependencyAssessment.independenceGroupId ?? "unknown", identityCertainty: requireMember("identity certainty", identity.certainty, IDENTITY_CERTAINTIES), identityScope: command.identityScope,
    identityApplicable: context.constructRelationship.supersededByCount === 0 && !context.constructRelationship.constructValueCreated,
    identityChecks: { manufacturer: identity.manufacturerMatches, model: identity.modelMatches, modelYear: identity.modelYearMatches, certification: identity.certificationMatches,
      productFamily: identity.productFamilyMatches, drop: identity.dropMatches, size: identity.sizeMatches, variant: identity.variantMatches },
    construct: context.constructRelationship.proposedConstruct, mappingConfidence: requireMember("mapping confidence", context.constructRelationship.mappingConfidence, MAPPING_CONFIDENCES), qualificationState: requireMember("qualification state", context.qualification.state, QUALIFICATION_STATES),
    verificationState: rawInvalid || normalizedInvalid ? "superseded" : conflicting ? "conflicting" : "active", reviewState: requireMember("review state", context.review.decision, REVIEW_STATES),
    approvalActor: requireMember("approval actor", context.review.reviewerType, APPROVAL_ACTORS), direction: command.direction, comparisonTarget: command.comparisonTarget });
}

type RoleInput = ExternalExpertSupportingRoleInput;
const SOURCE_TYPES = ["manufacturer_primary", "certification_authority", "official_product_documentation", "retailer", "independent_expert_review", "structured_testing_publication", "user_review", "community_discussion", "ninery_internal_measurement", "ninery_internal_evaluation", "ninery_controlled_test", "ninery_structured_field_observation", "derived_model_output"] as const satisfies readonly RoleInput["sourceType"][];
const CLAIM_TYPES = ["factual_specification", "subjective_observation", "comparative_observation", "marketing_claim", "field_observation", "measurement_observation", "test_observation", "modeled_output", "certification_claim", "identity_claim"] as const satisfies readonly RoleInput["claimType"][];
const DEPENDENCY_TYPES = ["original", "syndicated_from", "derived_from", "copied_from", "shared_upstream", "independent_observation", "unknown_dependency"] as const satisfies readonly RoleInput["dependencyType"][];
const IDENTITY_CERTAINTIES = ["exact_variant_match", "equipment_model_match", "family_only", "ambiguous", "conflicting", "unresolved"] as const satisfies readonly RoleInput["identityCertainty"][];
const MAPPING_CONFIDENCES = ["low", "medium", "high", "unmapped"] as const satisfies readonly RoleInput["mappingConfidence"][];
const QUALIFICATION_STATES = ["qualified", "context_only", "review_required", "not_eligible"] as const satisfies readonly RoleInput["qualificationState"][];
const REVIEW_STATES = ["not_reviewed", "review_not_required", "review_pending", "reviewed_accepted", "reviewed_with_limitations", "reviewed_rejected"] as const satisfies readonly RoleInput["reviewState"][];
const APPROVAL_ACTORS = ["human", "ai", "system"] as const satisfies readonly RoleInput["approvalActor"][];

function requireMember<const T extends readonly string[]>(label: string, value: string, allowed: T): T[number] {
  if (!allowed.includes(value)) throw new ExternalSupportingPersistenceError("UNSUPPORTED_PERSISTED_ENUM", `Unsupported ${label}: ${value}`);
  return value as T[number];
}

function fingerprintCommand(command: ExternalSupportingPersistenceCommand) {
  return createHash("sha256").update(JSON.stringify(Object.fromEntries(Object.entries(command).sort(([a], [b]) => a.localeCompare(b))))).digest("hex");
}
