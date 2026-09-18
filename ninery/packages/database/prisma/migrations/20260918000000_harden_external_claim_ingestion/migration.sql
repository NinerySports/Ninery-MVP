-- Ticket #076 remediation is additive. Existing evidence and qualification rows
-- remain immutable and readable; new ingestion rows populate the nullable links.
CREATE TABLE "external_evidence_source_governance_revisions" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "governanceVersion" TEXT NOT NULL,
    "sourceType" "ExternalEvidenceSourceType" NOT NULL,
    "publisherIdentity" TEXT,
    "authorityScope" JSONB NOT NULL,
    "dependencyKnowledge" JSONB NOT NULL,
    "state" TEXT NOT NULL,
    "reviewerType" "ExternalEvidenceReviewerType" NOT NULL,
    "reviewerReference" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "supersedesRevisionId" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_evidence_source_governance_revisions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "external_evidence_claims" ADD COLUMN "claimSlotKey" TEXT;
ALTER TABLE "external_evidence_qualification_decisions" ADD COLUMN "sourceGovernanceRevisionId" UUID;
ALTER TABLE "external_evidence_qualification_decisions" ADD COLUMN "semanticFingerprint" TEXT;
ALTER TABLE "external_evidence_qualification_decisions" ADD COLUMN "proposedEvidenceInput" JSONB;

CREATE UNIQUE INDEX "external_evidence_source_governance_revisions_sourceId_revisionNumber_key" ON "external_evidence_source_governance_revisions"("sourceId", "revisionNumber");
CREATE UNIQUE INDEX "external_evidence_source_governance_revisions_supersedesRevisionId_key" ON "external_evidence_source_governance_revisions"("supersedesRevisionId");
CREATE UNIQUE INDEX "external_evidence_source_governance_revisions_idempotencyKey_key" ON "external_evidence_source_governance_revisions"("idempotencyKey");
CREATE INDEX "external_evidence_source_governance_revisions_sourceId_effectiveAt_idx" ON "external_evidence_source_governance_revisions"("sourceId", "effectiveAt");
CREATE INDEX "external_evidence_source_governance_revisions_sourceType_state_idx" ON "external_evidence_source_governance_revisions"("sourceType", "state");
CREATE INDEX "external_evidence_claims_claimSlotKey_idx" ON "external_evidence_claims"("claimSlotKey");
CREATE INDEX "external_evidence_qualification_decisions_sourceGovernanceRevisionId_idx" ON "external_evidence_qualification_decisions"("sourceGovernanceRevisionId");

ALTER TABLE "external_evidence_source_governance_revisions" ADD CONSTRAINT "external_evidence_source_governance_revisions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "external_evidence_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_source_governance_revisions" ADD CONSTRAINT "external_evidence_source_governance_revisions_supersedesRevisionId_fkey" FOREIGN KEY ("supersedesRevisionId") REFERENCES "external_evidence_source_governance_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "external_evidence_qualification_decisions" ADD CONSTRAINT "external_evidence_qualification_decisions_sourceGovernanceRevisionId_fkey" FOREIGN KEY ("sourceGovernanceRevisionId") REFERENCES "external_evidence_source_governance_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "external_source_governance_revision_append_only" BEFORE UPDATE OR DELETE ON "external_evidence_source_governance_revisions" FOR EACH ROW EXECUTE FUNCTION prevent_external_evidence_mutation();
