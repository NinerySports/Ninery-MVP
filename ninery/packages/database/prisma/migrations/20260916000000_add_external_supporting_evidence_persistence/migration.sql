CREATE TABLE "external_evidence_sources" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "stableKey" TEXT NOT NULL, "displayName" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL, "publisherIdentity" TEXT, "operatorIdentity" TEXT, "state" TEXT NOT NULL DEFAULT 'active',
  "sourceVersion" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_evidence_sources_stableKey_key" ON "external_evidence_sources"("stableKey");
CREATE INDEX "external_evidence_sources_sourceType_idx" ON "external_evidence_sources"("sourceType");
CREATE INDEX "external_evidence_sources_state_idx" ON "external_evidence_sources"("state");

CREATE TABLE "external_evidence_documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sourceId" UUID NOT NULL, "documentType" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL, "title" TEXT NOT NULL, "publishedAt" TIMESTAMP(3), "retrievedAt" TIMESTAMP(3) NOT NULL,
  "modelYear" INTEGER, "revision" TEXT NOT NULL DEFAULT 'unversioned', "contentFingerprint" TEXT, "availability" TEXT NOT NULL,
  "upstreamDocumentId" UUID, "supersedesDocumentId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_evidence_documents_no_self_upstream" CHECK ("upstreamDocumentId" IS NULL OR "upstreamDocumentId" <> "id"),
  CONSTRAINT "external_evidence_documents_no_self_supersession" CHECK ("supersedesDocumentId" IS NULL OR "supersedesDocumentId" <> "id")
);
CREATE UNIQUE INDEX "external_evidence_documents_sourceId_sourceReference_revision_key" ON "external_evidence_documents"("sourceId", "sourceReference", "revision");
CREATE INDEX "external_evidence_documents_sourceId_idx" ON "external_evidence_documents"("sourceId");
CREATE INDEX "external_evidence_documents_contentFingerprint_idx" ON "external_evidence_documents"("contentFingerprint");
CREATE INDEX "external_evidence_documents_supersedesDocumentId_idx" ON "external_evidence_documents"("supersedesDocumentId");

CREATE TABLE "external_evidence_extraction_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "method" TEXT NOT NULL, "extractorType" TEXT NOT NULL,
  "extractorId" TEXT NOT NULL, "extractorVersion" TEXT NOT NULL, "executedAt" TIMESTAMP(3) NOT NULL,
  "schemaVersion" TEXT NOT NULL, "reviewState" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_extraction_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "external_evidence_extraction_runs_method_idx" ON "external_evidence_extraction_runs"("method");
CREATE INDEX "external_evidence_extraction_runs_reviewState_idx" ON "external_evidence_extraction_runs"("reviewState");

CREATE TABLE "external_evidence_identity_assertions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "certainty" TEXT NOT NULL, "manufacturer" TEXT, "model" TEXT,
  "modelYear" INTEGER, "certification" TEXT, "constructionRevision" TEXT, "lengthInches" DECIMAL(5,2),
  "weightOunces" DECIMAL(5,2), "drop" INTEGER, "sku" TEXT, "manufacturerProductId" TEXT, "upc" TEXT,
  "equipmentId" UUID, "equipmentVariantId" UUID, "limitations" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_identity_assertions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "external_evidence_identity_assertions_certainty_idx" ON "external_evidence_identity_assertions"("certainty");
CREATE INDEX "external_evidence_identity_assertions_equipmentId_idx" ON "external_evidence_identity_assertions"("equipmentId");
CREATE INDEX "external_evidence_identity_assertions_equipmentVariantId_idx" ON "external_evidence_identity_assertions"("equipmentVariantId");
CREATE INDEX "external_evidence_identity_assertions_manufacturer_model_modelYear_idx" ON "external_evidence_identity_assertions"("manufacturer", "model", "modelYear");

CREATE TABLE "external_evidence_claims" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sourceId" UUID NOT NULL, "documentId" UUID NOT NULL,
  "identityAssertionId" UUID NOT NULL, "extractionRunId" UUID NOT NULL, "sourceLocation" TEXT, "rawText" TEXT,
  "rawStructuredValue" JSONB, "claimType" TEXT NOT NULL, "verificationState" TEXT NOT NULL, "reviewState" TEXT NOT NULL,
  "independenceGroupId" TEXT NOT NULL, "authority" TEXT NOT NULL, "authorityRationale" TEXT NOT NULL,
  "limitations" JSONB NOT NULL, "supersedesClaimId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_evidence_claims_no_self_supersession" CHECK ("supersedesClaimId" IS NULL OR "supersedesClaimId" <> "id")
);
CREATE INDEX "external_evidence_claims_documentId_idx" ON "external_evidence_claims"("documentId");
CREATE INDEX "external_evidence_claims_identityAssertionId_idx" ON "external_evidence_claims"("identityAssertionId");
CREATE INDEX "external_evidence_claims_independenceGroupId_idx" ON "external_evidence_claims"("independenceGroupId");
CREATE INDEX "external_evidence_claims_claimType_verificationState_reviewState_idx" ON "external_evidence_claims"("claimType", "verificationState", "reviewState");
CREATE INDEX "external_evidence_claims_supersedesClaimId_idx" ON "external_evidence_claims"("supersedesClaimId");

CREATE TABLE "external_evidence_normalized_claims" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "rawClaimId" UUID NOT NULL, "claimKey" TEXT NOT NULL,
  "normalizedValue" JSONB NOT NULL, "normalizedUnit" TEXT, "originalValue" JSONB, "originalUnit" TEXT,
  "normalizationMethod" TEXT NOT NULL, "normalizationVersion" TEXT NOT NULL, "evidenceClass" TEXT NOT NULL,
  "verificationState" TEXT NOT NULL, "reviewState" TEXT NOT NULL, "limitations" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_normalized_claims_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_evidence_normalized_claims_rawClaimId_claimKey_normalizationVersion_key" ON "external_evidence_normalized_claims"("rawClaimId", "claimKey", "normalizationVersion");
CREATE INDEX "external_evidence_normalized_claims_claimKey_idx" ON "external_evidence_normalized_claims"("claimKey");
CREATE INDEX "external_evidence_normalized_claims_verificationState_reviewState_idx" ON "external_evidence_normalized_claims"("verificationState", "reviewState");

CREATE TABLE "external_evidence_claim_dependencies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "claimId" UUID NOT NULL, "upstreamClaimId" UUID,
  "dependencyType" TEXT NOT NULL, "dependencyRationale" TEXT NOT NULL, "reviewedState" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_claim_dependencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_evidence_dependencies_no_self_reference" CHECK ("upstreamClaimId" IS NULL OR "upstreamClaimId" <> "claimId")
);
CREATE UNIQUE INDEX "external_evidence_claim_dependencies_claimId_upstreamClaimId_dependencyType_key" ON "external_evidence_claim_dependencies"("claimId", "upstreamClaimId", "dependencyType");
CREATE INDEX "external_evidence_claim_dependencies_claimId_idx" ON "external_evidence_claim_dependencies"("claimId");
CREATE INDEX "external_evidence_claim_dependencies_upstreamClaimId_idx" ON "external_evidence_claim_dependencies"("upstreamClaimId");
CREATE INDEX "external_evidence_claim_dependencies_dependencyType_idx" ON "external_evidence_claim_dependencies"("dependencyType");

CREATE TABLE "external_evidence_qualification_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "normalizedClaimId" UUID NOT NULL, "contractVersion" TEXT NOT NULL,
  "state" TEXT NOT NULL, "proposedEvidenceClass" TEXT, "proposedTargetLevel" TEXT, "reasons" JSONB NOT NULL,
  "gaps" JSONB NOT NULL, "blockers" JSONB NOT NULL, "warnings" JSONB NOT NULL, "limitations" JSONB NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_qualification_decisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "external_evidence_qualification_decisions_normalizedClaimId_decidedAt_idx" ON "external_evidence_qualification_decisions"("normalizedClaimId", "decidedAt");
CREATE INDEX "external_evidence_qualification_decisions_contractVersion_state_idx" ON "external_evidence_qualification_decisions"("contractVersion", "state");

CREATE TABLE "external_evidence_review_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "targetType" TEXT NOT NULL, "targetId" UUID NOT NULL,
  "decision" TEXT NOT NULL, "reviewerType" TEXT NOT NULL, "reviewerReference" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "limitations" JSONB NOT NULL, "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_review_decisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "external_evidence_review_decisions_targetType_targetId_decidedAt_idx" ON "external_evidence_review_decisions"("targetType", "targetId", "decidedAt");
CREATE INDEX "external_evidence_review_decisions_reviewerReference_decidedAt_idx" ON "external_evidence_review_decisions"("reviewerReference", "decidedAt");

CREATE TABLE "external_evidence_conflict_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "claimKey" TEXT NOT NULL, "identityScopeKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open', "resolution" TEXT, "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3), CONSTRAINT "external_evidence_conflict_cases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "external_evidence_conflict_cases_claimKey_identityScopeKey_status_idx" ON "external_evidence_conflict_cases"("claimKey", "identityScopeKey", "status");

CREATE TABLE "external_evidence_conflict_members" (
  "conflictCaseId" UUID NOT NULL, "normalizedClaimId" UUID NOT NULL,
  CONSTRAINT "external_evidence_conflict_members_pkey" PRIMARY KEY ("conflictCaseId", "normalizedClaimId")
);
CREATE INDEX "external_evidence_conflict_members_normalizedClaimId_idx" ON "external_evidence_conflict_members"("normalizedClaimId");

CREATE TABLE "external_supporting_role_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "normalizedClaimId" UUID NOT NULL, "qualificationDecisionId" UUID NOT NULL,
  "reviewDecisionId" UUID, "policy" TEXT NOT NULL, "policyVersion" TEXT NOT NULL, "policyStatus" TEXT NOT NULL,
  "eligible" BOOLEAN NOT NULL, "role" TEXT NOT NULL, "construct" TEXT, "identityScope" TEXT NOT NULL,
  "independenceGroupId" TEXT NOT NULL, "direction" TEXT NOT NULL, "comparisonTarget" TEXT,
  "reasons" JSONB NOT NULL, "blockers" JSONB NOT NULL, "directEvidenceContribution" INTEGER NOT NULL DEFAULT 0,
  "structuredContribution" INTEGER NOT NULL DEFAULT 0, "physicalContribution" INTEGER NOT NULL DEFAULT 0,
  "controlledContribution" INTEGER NOT NULL DEFAULT 0, "canonicalValueCreated" BOOLEAN NOT NULL DEFAULT false,
  "numericValueCreated" BOOLEAN NOT NULL DEFAULT false, "synthesisEligibilityGranted" BOOLEAN NOT NULL DEFAULT false,
  "compatibilityAuthorityGranted" BOOLEAN NOT NULL DEFAULT false, "recommendationAuthorityGranted" BOOLEAN NOT NULL DEFAULT false,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_supporting_role_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_supporting_role_zero_authority" CHECK (
    "directEvidenceContribution" = 0 AND "structuredContribution" = 0 AND "physicalContribution" = 0 AND
    "controlledContribution" = 0 AND "canonicalValueCreated" = false AND "numericValueCreated" = false AND
    "synthesisEligibilityGranted" = false AND "compatibilityAuthorityGranted" = false AND "recommendationAuthorityGranted" = false
  ),
  CONSTRAINT "external_supporting_role_requires_human_review" CHECK (NOT "eligible" OR "reviewDecisionId" IS NOT NULL),
  CONSTRAINT "external_supporting_role_is_context_only" CHECK (("eligible" AND "role" = 'supporting_context') OR (NOT "eligible" AND "role" = 'not_applicable'))
);
CREATE INDEX "external_supporting_role_decisions_normalizedClaimId_decidedAt_idx" ON "external_supporting_role_decisions"("normalizedClaimId", "decidedAt");
CREATE INDEX "external_supporting_role_decisions_policy_policyVersion_eligible_idx" ON "external_supporting_role_decisions"("policy", "policyVersion", "eligible");
CREATE INDEX "external_supporting_role_decisions_independenceGroupId_idx" ON "external_supporting_role_decisions"("independenceGroupId");

ALTER TABLE "external_evidence_documents" ADD CONSTRAINT "external_evidence_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "external_evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_documents" ADD CONSTRAINT "external_evidence_documents_upstreamDocumentId_fkey" FOREIGN KEY ("upstreamDocumentId") REFERENCES "external_evidence_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_documents" ADD CONSTRAINT "external_evidence_documents_supersedesDocumentId_fkey" FOREIGN KEY ("supersedesDocumentId") REFERENCES "external_evidence_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_identity_assertions" ADD CONSTRAINT "external_evidence_identity_assertions_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_identity_assertions" ADD CONSTRAINT "external_evidence_identity_assertions_equipmentVariantId_fkey" FOREIGN KEY ("equipmentVariantId") REFERENCES "equipment_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_claims" ADD CONSTRAINT "external_evidence_claims_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "external_evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_claims" ADD CONSTRAINT "external_evidence_claims_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "external_evidence_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_claims" ADD CONSTRAINT "external_evidence_claims_identityAssertionId_fkey" FOREIGN KEY ("identityAssertionId") REFERENCES "external_evidence_identity_assertions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_claims" ADD CONSTRAINT "external_evidence_claims_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "external_evidence_extraction_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_claims" ADD CONSTRAINT "external_evidence_claims_supersedesClaimId_fkey" FOREIGN KEY ("supersedesClaimId") REFERENCES "external_evidence_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_normalized_claims" ADD CONSTRAINT "external_evidence_normalized_claims_rawClaimId_fkey" FOREIGN KEY ("rawClaimId") REFERENCES "external_evidence_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_claim_dependencies" ADD CONSTRAINT "external_evidence_claim_dependencies_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "external_evidence_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_claim_dependencies" ADD CONSTRAINT "external_evidence_claim_dependencies_upstreamClaimId_fkey" FOREIGN KEY ("upstreamClaimId") REFERENCES "external_evidence_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_qualification_decisions" ADD CONSTRAINT "external_evidence_qualification_decisions_normalizedClaimId_fkey" FOREIGN KEY ("normalizedClaimId") REFERENCES "external_evidence_normalized_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_conflict_members" ADD CONSTRAINT "external_evidence_conflict_members_conflictCaseId_fkey" FOREIGN KEY ("conflictCaseId") REFERENCES "external_evidence_conflict_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_conflict_members" ADD CONSTRAINT "external_evidence_conflict_members_normalizedClaimId_fkey" FOREIGN KEY ("normalizedClaimId") REFERENCES "external_evidence_normalized_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_supporting_role_decisions_normalizedClaimId_fkey" FOREIGN KEY ("normalizedClaimId") REFERENCES "external_evidence_normalized_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_supporting_role_decisions_qualificationDecisionId_fkey" FOREIGN KEY ("qualificationDecisionId") REFERENCES "external_evidence_qualification_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_supporting_role_decisions_reviewDecisionId_fkey" FOREIGN KEY ("reviewDecisionId") REFERENCES "external_evidence_review_decisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PR #1 review repair: strengthen the pending migration before it is applied.
CREATE TYPE "ExternalEvidenceSourceType" AS ENUM ('manufacturer_primary','certification_authority','official_product_documentation','retailer','independent_expert_review','structured_testing_publication','user_review','community_discussion','ninery_internal_measurement','ninery_internal_evaluation','ninery_controlled_test','ninery_structured_field_observation','derived_model_output');
CREATE TYPE "ExternalEvidenceClaimType" AS ENUM ('factual_specification','subjective_observation','comparative_observation','marketing_claim','field_observation','measurement_observation','test_observation','modeled_output','certification_claim','identity_claim');
CREATE TYPE "ExternalEvidenceVerificationState" AS ENUM ('unverified_extracted','source_confirmed','corroborated','conflicting','review_required','superseded');
CREATE TYPE "ExternalEvidenceReviewState" AS ENUM ('not_reviewed','review_not_required','review_pending','reviewed_accepted','reviewed_with_limitations','reviewed_rejected');
CREATE TYPE "ExternalEvidenceDependencyType" AS ENUM ('original','syndicated_from','derived_from','copied_from','shared_upstream','independent_observation','unknown_dependency');
CREATE TYPE "ExternalEvidenceIdentityCertainty" AS ENUM ('exact_variant_match','equipment_model_match','family_only','ambiguous','conflicting','unresolved');
CREATE TYPE "ExternalEvidenceConstructRole" AS ENUM ('direct_construct_evidence','supporting_context','calibration_evidence','not_applicable','candidate_only');
CREATE TYPE "ExternalEvidenceMappingMethod" AS ENUM ('manual_review','controlled_vocabulary','policy_mapping','keyword_candidate');
CREATE TYPE "ExternalEvidenceQualificationState" AS ENUM ('qualified','context_only','review_required','not_eligible');
CREATE TYPE "ExternalEvidenceReviewerType" AS ENUM ('human','ai','system');
CREATE TYPE "ExternalEvidenceConflictResolutionOutcome" AS ENUM ('resolved_no_material_conflict','resolved_claim_superseded','resolved_with_limitations','unresolved');

ALTER TABLE "external_evidence_sources" ALTER COLUMN "sourceType" TYPE "ExternalEvidenceSourceType" USING "sourceType"::"ExternalEvidenceSourceType";
ALTER TABLE "external_evidence_extraction_runs" ALTER COLUMN "reviewState" TYPE "ExternalEvidenceReviewState" USING "reviewState"::"ExternalEvidenceReviewState";
ALTER TABLE "external_evidence_identity_assertions" ALTER COLUMN "certainty" TYPE "ExternalEvidenceIdentityCertainty" USING "certainty"::"ExternalEvidenceIdentityCertainty";
ALTER TABLE "external_evidence_claims" ALTER COLUMN "claimType" TYPE "ExternalEvidenceClaimType" USING "claimType"::"ExternalEvidenceClaimType";
ALTER TABLE "external_evidence_claims" ALTER COLUMN "verificationState" TYPE "ExternalEvidenceVerificationState" USING "verificationState"::"ExternalEvidenceVerificationState";
ALTER TABLE "external_evidence_claims" ALTER COLUMN "reviewState" TYPE "ExternalEvidenceReviewState" USING "reviewState"::"ExternalEvidenceReviewState";
ALTER TABLE "external_evidence_normalized_claims" ALTER COLUMN "verificationState" TYPE "ExternalEvidenceVerificationState" USING "verificationState"::"ExternalEvidenceVerificationState";
ALTER TABLE "external_evidence_normalized_claims" ALTER COLUMN "reviewState" TYPE "ExternalEvidenceReviewState" USING "reviewState"::"ExternalEvidenceReviewState";

-- A claim derives its source through its document; independently assignable source IDs are forbidden.
ALTER TABLE "external_evidence_claims" DROP CONSTRAINT "external_evidence_claims_sourceId_fkey";
DROP INDEX "external_evidence_claims_independenceGroupId_idx";
ALTER TABLE "external_evidence_claims" DROP COLUMN "sourceId", DROP COLUMN "independenceGroupId";

CREATE UNIQUE INDEX "external_evidence_normalized_claims_id_rawClaimId_key" ON "external_evidence_normalized_claims"("id","rawClaimId");

ALTER TABLE "external_evidence_claim_dependencies" RENAME TO "external_evidence_dependency_assessments";
ALTER TABLE "external_evidence_dependency_assessments" RENAME CONSTRAINT "external_evidence_claim_dependencies_pkey" TO "external_evidence_dependency_assessments_pkey";
ALTER TABLE "external_evidence_dependency_assessments" ALTER COLUMN "dependencyType" TYPE "ExternalEvidenceDependencyType" USING "dependencyType"::"ExternalEvidenceDependencyType";
ALTER TABLE "external_evidence_dependency_assessments" ALTER COLUMN "reviewedState" TYPE "ExternalEvidenceReviewState" USING "reviewedState"::"ExternalEvidenceReviewState";
ALTER TABLE "external_evidence_dependency_assessments" ADD COLUMN "independenceGroupId" TEXT, ADD COLUMN "assessmentVersion" TEXT NOT NULL, ADD COLUMN "supersedesAssessmentId" UUID, ADD COLUMN "idempotencyKey" TEXT NOT NULL, ADD COLUMN "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "external_evidence_dependency_assessments" DROP COLUMN "createdAt";
DROP INDEX "external_evidence_claim_dependencies_claimId_upstreamClaimId_dependencyType_key";
ALTER TABLE "external_evidence_dependency_assessments" ADD CONSTRAINT "external_dependency_semantics" CHECK (("dependencyType"='independent_observation' AND "upstreamClaimId" IS NULL AND "independenceGroupId" IS NOT NULL) OR ("dependencyType"='unknown_dependency' AND "independenceGroupId" IS NULL) OR ("dependencyType"='original' AND "upstreamClaimId" IS NULL) OR ("dependencyType" IN ('syndicated_from','derived_from','copied_from','shared_upstream') AND "upstreamClaimId" IS NOT NULL));
CREATE UNIQUE INDEX "external_evidence_dependency_assessments_idempotencyKey_key" ON "external_evidence_dependency_assessments"("idempotencyKey");
CREATE UNIQUE INDEX "external_evidence_dependency_assessments_id_claimId_key" ON "external_evidence_dependency_assessments"("id","claimId");
CREATE INDEX "external_evidence_dependency_assessments_independenceGroupId_idx" ON "external_evidence_dependency_assessments"("independenceGroupId");
CREATE INDEX "external_evidence_dependency_assessments_supersedesAssessmentId_idx" ON "external_evidence_dependency_assessments"("supersedesAssessmentId");
ALTER TABLE "external_evidence_dependency_assessments" ADD CONSTRAINT "external_dependency_supersedes_fkey" FOREIGN KEY ("supersedesAssessmentId") REFERENCES "external_evidence_dependency_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "external_evidence_construct_relationships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "normalizedClaimId" UUID NOT NULL, "proposedConstruct" TEXT NOT NULL,
  "mappingMethod" "ExternalEvidenceMappingMethod" NOT NULL, "mappingConfidence" TEXT NOT NULL, "mappingVersion" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL, "role" "ExternalEvidenceConstructRole" NOT NULL, "reviewState" "ExternalEvidenceReviewState" NOT NULL,
  "rationale" TEXT NOT NULL, "limitations" JSONB NOT NULL, "constructValueCreated" BOOLEAN NOT NULL DEFAULT false,
  "supersedesRelationshipId" UUID, "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_construct_relationships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "external_construct_no_value" CHECK ("constructValueCreated"=false),
  CONSTRAINT "external_construct_no_self_supersession" CHECK ("supersedesRelationshipId" IS NULL OR "supersedesRelationshipId"<>"id")
);
CREATE UNIQUE INDEX "external_evidence_construct_relationships_idempotencyKey_key" ON "external_evidence_construct_relationships"("idempotencyKey");
CREATE UNIQUE INDEX "external_evidence_construct_relationships_id_normalizedClaimId_key" ON "external_evidence_construct_relationships"("id","normalizedClaimId");
CREATE INDEX "external_evidence_construct_relationships_normalizedClaimId_proposedConstruct_idx" ON "external_evidence_construct_relationships"("normalizedClaimId","proposedConstruct");
CREATE INDEX "external_evidence_construct_relationships_role_reviewState_idx" ON "external_evidence_construct_relationships"("role","reviewState");
CREATE INDEX "external_evidence_construct_relationships_supersedesRelationshipId_idx" ON "external_evidence_construct_relationships"("supersedesRelationshipId");
ALTER TABLE "external_evidence_construct_relationships" ADD CONSTRAINT "external_construct_normalized_fkey" FOREIGN KEY ("normalizedClaimId") REFERENCES "external_evidence_normalized_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_construct_relationships" ADD CONSTRAINT "external_construct_supersedes_fkey" FOREIGN KEY ("supersedesRelationshipId") REFERENCES "external_evidence_construct_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "external_evidence_qualification_decisions" ALTER COLUMN "state" TYPE "ExternalEvidenceQualificationState" USING "state"::"ExternalEvidenceQualificationState";
ALTER TABLE "external_evidence_qualification_decisions" ADD COLUMN "constructRelationshipId" UUID NOT NULL, ADD COLUMN "idempotencyKey" TEXT NOT NULL;
CREATE UNIQUE INDEX "external_evidence_qualification_decisions_idempotencyKey_key" ON "external_evidence_qualification_decisions"("idempotencyKey");
CREATE UNIQUE INDEX "external_qualification_id_claim_relationship_key" ON "external_evidence_qualification_decisions"("id","normalizedClaimId","constructRelationshipId");
CREATE INDEX "external_evidence_qualification_decisions_constructRelationshipId_idx" ON "external_evidence_qualification_decisions"("constructRelationshipId");
ALTER TABLE "external_evidence_qualification_decisions" ADD CONSTRAINT "external_qualification_relationship_fkey" FOREIGN KEY ("constructRelationshipId","normalizedClaimId") REFERENCES "external_evidence_construct_relationships"("id","normalizedClaimId") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "external_evidence_review_decisions_targetType_targetId_decidedAt_idx";
ALTER TABLE "external_evidence_review_decisions" DROP COLUMN "targetType", DROP COLUMN "targetId";
ALTER TABLE "external_evidence_review_decisions" ADD COLUMN "normalizedClaimId" UUID NOT NULL, ADD COLUMN "constructRelationshipId" UUID NOT NULL, ADD COLUMN "idempotencyKey" TEXT NOT NULL;
ALTER TABLE "external_evidence_review_decisions" ALTER COLUMN "decision" TYPE "ExternalEvidenceReviewState" USING "decision"::"ExternalEvidenceReviewState";
ALTER TABLE "external_evidence_review_decisions" ALTER COLUMN "reviewerType" TYPE "ExternalEvidenceReviewerType" USING "reviewerType"::"ExternalEvidenceReviewerType";
CREATE UNIQUE INDEX "external_evidence_review_decisions_idempotencyKey_key" ON "external_evidence_review_decisions"("idempotencyKey");
CREATE UNIQUE INDEX "external_review_id_claim_relationship_key" ON "external_evidence_review_decisions"("id","normalizedClaimId","constructRelationshipId");
CREATE INDEX "external_review_claim_relationship_decided_idx" ON "external_evidence_review_decisions"("normalizedClaimId","constructRelationshipId","decidedAt");
ALTER TABLE "external_evidence_review_decisions" ADD CONSTRAINT "external_review_normalized_fkey" FOREIGN KEY ("normalizedClaimId") REFERENCES "external_evidence_normalized_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_review_decisions" ADD CONSTRAINT "external_review_relationship_fkey" FOREIGN KEY ("constructRelationshipId","normalizedClaimId") REFERENCES "external_evidence_construct_relationships"("id","normalizedClaimId") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "external_evidence_conflict_cases_claimKey_identityScopeKey_status_idx";
ALTER TABLE "external_evidence_conflict_cases" DROP COLUMN "status", DROP COLUMN "resolution", DROP COLUMN "resolvedAt", ADD COLUMN "idempotencyKey" TEXT NOT NULL;
CREATE UNIQUE INDEX "external_evidence_conflict_cases_idempotencyKey_key" ON "external_evidence_conflict_cases"("idempotencyKey");
CREATE INDEX "external_evidence_conflict_cases_claimKey_identityScopeKey_idx" ON "external_evidence_conflict_cases"("claimKey","identityScopeKey");
CREATE TABLE "external_evidence_conflict_resolutions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "conflictCaseId" UUID NOT NULL, "outcome" "ExternalEvidenceConflictResolutionOutcome" NOT NULL,
  "reviewerType" "ExternalEvidenceReviewerType" NOT NULL, "reviewerReference" TEXT NOT NULL, "rationale" TEXT NOT NULL,
  "limitations" JSONB NOT NULL, "idempotencyKey" TEXT NOT NULL, "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "external_evidence_conflict_resolutions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_evidence_conflict_resolutions_idempotencyKey_key" ON "external_evidence_conflict_resolutions"("idempotencyKey");
CREATE INDEX "external_evidence_conflict_resolutions_conflictCaseId_decidedAt_idx" ON "external_evidence_conflict_resolutions"("conflictCaseId","decidedAt");
ALTER TABLE "external_evidence_conflict_resolutions" ADD CONSTRAINT "external_conflict_resolution_case_fkey" FOREIGN KEY ("conflictCaseId") REFERENCES "external_evidence_conflict_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "external_supporting_role_decisions" DROP CONSTRAINT "external_supporting_role_decisions_normalizedClaimId_fkey", DROP CONSTRAINT "external_supporting_role_decisions_qualificationDecisionId_fkey", DROP CONSTRAINT "external_supporting_role_decisions_reviewDecisionId_fkey", DROP CONSTRAINT "external_supporting_role_requires_human_review", DROP CONSTRAINT "external_supporting_role_is_context_only", DROP CONSTRAINT "external_supporting_role_zero_authority";
DROP INDEX "external_supporting_role_decisions_independenceGroupId_idx";
ALTER TABLE "external_supporting_role_decisions" DROP COLUMN "construct", DROP COLUMN "identityScope", DROP COLUMN "independenceGroupId";
ALTER TABLE "external_supporting_role_decisions" ADD COLUMN "rawClaimId" UUID NOT NULL, ADD COLUMN "dependencyAssessmentId" UUID NOT NULL, ADD COLUMN "constructRelationshipId" UUID NOT NULL, ADD COLUMN "decisionBookAuthorityGranted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "idempotencyKey" TEXT NOT NULL, ADD COLUMN "decisionFingerprint" TEXT NOT NULL;
ALTER TABLE "external_supporting_role_decisions" ALTER COLUMN "reviewDecisionId" SET NOT NULL;
ALTER TABLE "external_supporting_role_decisions" ALTER COLUMN "role" TYPE "ExternalEvidenceConstructRole" USING "role"::"ExternalEvidenceConstructRole";
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_supporting_authority_firewall" CHECK ("directEvidenceContribution"=0 AND "structuredContribution"=0 AND "physicalContribution"=0 AND "controlledContribution"=0 AND "canonicalValueCreated"=false AND "numericValueCreated"=false AND "synthesisEligibilityGranted"=false AND "compatibilityAuthorityGranted"=false AND "recommendationAuthorityGranted"=false AND "decisionBookAuthorityGranted"=false);
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_supporting_bounded_role" CHECK ("eligible"=true AND "role"='supporting_context' AND "policy"='external_expert_supporting_role' AND "policyVersion"='1.0-provisional' AND "policyStatus"='PROVISIONAL_CONSTRUCT_SPECIFIC_POLICY');
CREATE UNIQUE INDEX "external_supporting_role_decisions_idempotencyKey_key" ON "external_supporting_role_decisions"("idempotencyKey");
CREATE INDEX "external_supporting_role_decisions_dependencyAssessmentId_idx" ON "external_supporting_role_decisions"("dependencyAssessmentId");
CREATE INDEX "external_supporting_role_decisions_constructRelationshipId_idx" ON "external_supporting_role_decisions"("constructRelationshipId");
CREATE INDEX "external_supporting_role_decisions_qualificationDecisionId_idx" ON "external_supporting_role_decisions"("qualificationDecisionId");
CREATE INDEX "external_supporting_role_decisions_reviewDecisionId_idx" ON "external_supporting_role_decisions"("reviewDecisionId");
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_support_normalized_raw_fkey" FOREIGN KEY ("normalizedClaimId","rawClaimId") REFERENCES "external_evidence_normalized_claims"("id","rawClaimId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_support_dependency_fkey" FOREIGN KEY ("dependencyAssessmentId","rawClaimId") REFERENCES "external_evidence_dependency_assessments"("id","claimId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_support_relationship_fkey" FOREIGN KEY ("constructRelationshipId","normalizedClaimId") REFERENCES "external_evidence_construct_relationships"("id","normalizedClaimId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_support_qualification_fkey" FOREIGN KEY ("qualificationDecisionId","normalizedClaimId","constructRelationshipId") REFERENCES "external_evidence_qualification_decisions"("id","normalizedClaimId","constructRelationshipId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_supporting_role_decisions" ADD CONSTRAINT "external_support_review_fkey" FOREIGN KEY ("reviewDecisionId","normalizedClaimId","constructRelationshipId") REFERENCES "external_evidence_review_decisions"("id","normalizedClaimId","constructRelationshipId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION prevent_external_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'external evidence decision history is append-only'; END $$;
CREATE FUNCTION validate_external_identity_variant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."equipmentVariantId" IS NOT NULL AND (NEW."equipmentId" IS NULL OR NOT EXISTS (SELECT 1 FROM "equipment_variants" v WHERE v."id"=NEW."equipmentVariantId" AND v."equipmentId"=NEW."equipmentId")) THEN RAISE EXCEPTION 'equipment variant does not belong to asserted equipment'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "external_identity_variant_consistency" BEFORE INSERT ON "external_evidence_identity_assertions" FOR EACH ROW EXECUTE FUNCTION validate_external_identity_variant();

CREATE FUNCTION prevent_external_claim_supersession_cycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."supersedesClaimId" IS NOT NULL AND EXISTS (WITH RECURSIVE chain("id","supersedesClaimId") AS (SELECT c."id",c."supersedesClaimId" FROM "external_evidence_claims" c WHERE c."id"=NEW."supersedesClaimId" UNION ALL SELECT c."id",c."supersedesClaimId" FROM "external_evidence_claims" c JOIN chain x ON c."id"=x."supersedesClaimId") SELECT 1 FROM chain WHERE "id"=NEW."id") THEN RAISE EXCEPTION 'claim supersession cycle'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "external_claim_supersession_cycle" BEFORE INSERT OR UPDATE OF "supersedesClaimId" ON "external_evidence_claims" FOR EACH ROW EXECUTE FUNCTION prevent_external_claim_supersession_cycle();
CREATE FUNCTION prevent_external_document_supersession_cycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."supersedesDocumentId" IS NOT NULL AND EXISTS (WITH RECURSIVE chain("id","supersedesDocumentId") AS (SELECT d."id",d."supersedesDocumentId" FROM "external_evidence_documents" d WHERE d."id"=NEW."supersedesDocumentId" UNION ALL SELECT d."id",d."supersedesDocumentId" FROM "external_evidence_documents" d JOIN chain x ON d."id"=x."supersedesDocumentId") SELECT 1 FROM chain WHERE "id"=NEW."id") THEN RAISE EXCEPTION 'document supersession cycle'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "external_document_supersession_cycle" BEFORE INSERT OR UPDATE OF "supersedesDocumentId" ON "external_evidence_documents" FOR EACH ROW EXECUTE FUNCTION prevent_external_document_supersession_cycle();

CREATE FUNCTION prevent_external_dependency_supersession_cycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."supersedesAssessmentId" IS NOT NULL AND EXISTS (WITH RECURSIVE chain("id","supersedesAssessmentId") AS (SELECT d."id",d."supersedesAssessmentId" FROM "external_evidence_dependency_assessments" d WHERE d."id"=NEW."supersedesAssessmentId" UNION ALL SELECT d."id",d."supersedesAssessmentId" FROM "external_evidence_dependency_assessments" d JOIN chain x ON d."id"=x."supersedesAssessmentId") SELECT 1 FROM chain WHERE "id"=NEW."id") THEN RAISE EXCEPTION 'dependency assessment supersession cycle'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "external_dependency_supersession_cycle" BEFORE INSERT ON "external_evidence_dependency_assessments" FOR EACH ROW EXECUTE FUNCTION prevent_external_dependency_supersession_cycle();
CREATE FUNCTION prevent_external_construct_supersession_cycle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."supersedesRelationshipId" IS NOT NULL AND EXISTS (WITH RECURSIVE chain("id","supersedesRelationshipId") AS (SELECT r."id",r."supersedesRelationshipId" FROM "external_evidence_construct_relationships" r WHERE r."id"=NEW."supersedesRelationshipId" UNION ALL SELECT r."id",r."supersedesRelationshipId" FROM "external_evidence_construct_relationships" r JOIN chain x ON r."id"=x."supersedesRelationshipId") SELECT 1 FROM chain WHERE "id"=NEW."id") THEN RAISE EXCEPTION 'construct relationship supersession cycle'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "external_construct_supersession_cycle" BEFORE INSERT ON "external_evidence_construct_relationships" FOR EACH ROW EXECUTE FUNCTION prevent_external_construct_supersession_cycle();

-- SOURCE_DOCUMENT integrity: a claim derives its source only through its referenced document.
CREATE FUNCTION validate_external_claim_provenance() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM "external_evidence_documents" d WHERE d."id"=NEW."documentId") THEN RAISE EXCEPTION 'claim document provenance is missing'; END IF; RETURN NEW; END $$;
CREATE TRIGGER "external_claim_provenance" BEFORE INSERT ON "external_evidence_claims" FOR EACH ROW EXECUTE FUNCTION validate_external_claim_provenance();

CREATE FUNCTION validate_external_supporting_role_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r RECORD; q RECORD; h RECORD; d RECORD; raw_state "ExternalEvidenceVerificationState"; normalized_state "ExternalEvidenceVerificationState";
BEGIN
  SELECT * INTO r FROM "external_evidence_construct_relationships" WHERE "id"=NEW."constructRelationshipId"; SELECT * INTO q FROM "external_evidence_qualification_decisions" WHERE "id"=NEW."qualificationDecisionId"; SELECT * INTO h FROM "external_evidence_review_decisions" WHERE "id"=NEW."reviewDecisionId"; SELECT * INTO d FROM "external_evidence_dependency_assessments" WHERE "id"=NEW."dependencyAssessmentId";
  SELECT "verificationState" INTO raw_state FROM "external_evidence_claims" WHERE "id"=NEW."rawClaimId"; SELECT "verificationState" INTO normalized_state FROM "external_evidence_normalized_claims" WHERE "id"=NEW."normalizedClaimId";
  IF r."proposedConstruct" NOT IN ('startup_demand','rotational_demand') OR r."mappingConfidence"<>'high' OR r."role"<>'supporting_context' OR r."reviewState" NOT IN ('reviewed_accepted','reviewed_with_limitations') OR r."constructValueCreated" THEN RAISE EXCEPTION 'construct relationship is not supporting eligible'; END IF;
  IF r."policyVersion"<>'1.0-provisional' OR NEW."policy"<>'external_expert_supporting_role' OR NEW."policyVersion"<>'1.0-provisional' THEN RAISE EXCEPTION 'unsupported policy version'; END IF;
  IF q."state" NOT IN ('context_only','qualified') OR q."contractVersion"<>'1.0' THEN RAISE EXCEPTION 'qualification is not eligible'; END IF;
  IF h."reviewerType"<>'human' OR h."decision" NOT IN ('reviewed_accepted','reviewed_with_limitations') THEN RAISE EXCEPTION 'genuine accepted human review required'; END IF;
  IF d."dependencyType"<>'independent_observation' OR d."independenceGroupId" IS NULL OR d."reviewedState" NOT IN ('reviewed_accepted','reviewed_with_limitations') THEN RAISE EXCEPTION 'known-independent reviewed dependency assessment required'; END IF;
  IF raw_state IN ('superseded','conflicting') OR normalized_state IN ('superseded','conflicting') OR EXISTS (SELECT 1 FROM "external_evidence_claims" c WHERE c."supersedesClaimId"=NEW."rawClaimId") THEN RAISE EXCEPTION 'superseded or conflicting claim cannot be active support'; END IF;
  IF EXISTS (SELECT 1 FROM "external_evidence_conflict_members" m WHERE m."normalizedClaimId"=NEW."normalizedClaimId" AND NOT EXISTS (SELECT 1 FROM "external_evidence_conflict_resolutions" x WHERE x."conflictCaseId"=m."conflictCaseId" AND x."outcome" IN ('resolved_no_material_conflict','resolved_claim_superseded','resolved_with_limitations'))) THEN RAISE EXCEPTION 'unresolved conflict blocks support'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "external_supporting_role_validate" BEFORE INSERT ON "external_supporting_role_decisions" FOR EACH ROW EXECUTE FUNCTION validate_external_supporting_role_decision();

CREATE TRIGGER "external_dependency_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_dependency_assessments" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_construct_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_construct_relationships" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_qualification_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_qualification_decisions" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_review_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_review_decisions" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_conflict_case_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_conflict_cases" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_conflict_member_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_conflict_members" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_conflict_resolution_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_conflict_resolutions" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_supporting_decision_append_only" BEFORE UPDATE OR DELETE ON "external_supporting_role_decisions" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_source_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_sources" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_document_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_documents" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_extraction_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_extraction_runs" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_identity_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_identity_assertions" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_claim_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_claims" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
CREATE TRIGGER "external_normalized_claim_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_normalized_claims" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
