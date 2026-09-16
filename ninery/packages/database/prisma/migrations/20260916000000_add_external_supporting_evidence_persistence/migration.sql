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
