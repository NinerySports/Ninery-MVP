ALTER TYPE "ExternalEvidenceReviewState" ADD VALUE IF NOT EXISTS 'reviewed_returned';

ALTER TABLE "external_evidence_construct_relationships"
  ADD COLUMN "reviewerReference" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedStateFingerprint" TEXT,
  ADD COLUMN "decisionFingerprint" TEXT;

ALTER TABLE "external_evidence_dependency_assessments"
  ADD COLUMN "reviewedStateFingerprint" TEXT,
  ADD COLUMN "decisionFingerprint" TEXT,
  ADD COLUMN "limitations" JSONB;

ALTER TABLE "external_evidence_review_decisions"
  ADD COLUMN "governedReviewVersion" TEXT,
  ADD COLUMN "reviewedBinding" JSONB,
  ADD COLUMN "reviewedStateFingerprint" TEXT,
  ADD COLUMN "decisionFingerprint" TEXT,
  ADD COLUMN "supersedesDecisionId" UUID;

ALTER TABLE "external_evidence_review_decisions"
  ADD CONSTRAINT "external_review_governed_binding" CHECK (
    "governedReviewVersion" IS NULL OR (
      "governedReviewVersion" = '1.0'
      AND "reviewedBinding" IS NOT NULL
      AND jsonb_typeof("reviewedBinding") = 'object'
      AND length("reviewedStateFingerprint") = 64
      AND length("decisionFingerprint") = 64
      AND "reviewerType" = 'human'
      AND length(trim("reviewerReference")) > 0
      AND length(trim("reason")) > 0
    )
  );

ALTER TABLE "external_evidence_review_decisions"
  ADD CONSTRAINT "external_review_supersedes_same_lineage" FOREIGN KEY ("supersedesDecisionId", "normalizedClaimId", "constructRelationshipId")
  REFERENCES "external_evidence_review_decisions"("id", "normalizedClaimId", "constructRelationshipId") ON DELETE RESTRICT;

CREATE UNIQUE INDEX "external_evidence_review_decisions_supersedesDecisionId_key"
  ON "external_evidence_review_decisions"("supersedesDecisionId");
CREATE INDEX "external_evidence_review_decisions_reviewedStateFingerprint_idx"
  ON "external_evidence_review_decisions"("reviewedStateFingerprint");
CREATE UNIQUE INDEX "external_review_one_root_per_state"
  ON "external_evidence_review_decisions"("normalizedClaimId", "constructRelationshipId", "reviewedStateFingerprint")
  WHERE "governedReviewVersion" = '1.0' AND "supersedesDecisionId" IS NULL;

CREATE FUNCTION validate_governed_external_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  binding JSONB;
  normalized RECORD;
  raw RECORD;
  identity RECORD;
  document RECORD;
  qualification RECORD;
  dependency RECORD;
BEGIN
  IF NEW."governedReviewVersion" IS NULL THEN RETURN NEW; END IF;
  binding := NEW."reviewedBinding";
  SELECT * INTO normalized FROM "external_evidence_normalized_claims" WHERE "id" = NEW."normalizedClaimId";
  SELECT * INTO raw FROM "external_evidence_claims" WHERE "id" = normalized."rawClaimId";
  SELECT * INTO document FROM "external_evidence_documents" WHERE "id" = raw."documentId";
  SELECT * INTO identity FROM "external_evidence_identity_assertions" WHERE "id" = raw."identityAssertionId";
  SELECT * INTO qualification FROM "external_evidence_qualification_decisions"
    WHERE "id" = (binding->>'qualificationDecisionId')::uuid;
  SELECT * INTO dependency FROM "external_evidence_dependency_assessments"
    WHERE "id" = (binding->>'dependencyAssessmentId')::uuid;
  IF normalized."id" IS NULL OR raw."id" IS NULL OR document."id" IS NULL OR identity."id" IS NULL OR qualification."id" IS NULL OR dependency."id" IS NULL
    OR qualification."semanticFingerprint" IS NULL OR qualification."sourceGovernanceRevisionId" IS NULL
    OR binding->>'version' IS DISTINCT FROM '1.0'
    OR binding->>'normalizedClaimId' IS DISTINCT FROM NEW."normalizedClaimId"::text
    OR binding->>'constructRelationshipId' IS DISTINCT FROM NEW."constructRelationshipId"::text
    OR binding->>'rawClaimId' IS DISTINCT FROM raw."id"::text
    OR binding->>'identityAssertionId' IS DISTINCT FROM raw."identityAssertionId"::text
    OR binding->>'documentId' IS DISTINCT FROM raw."documentId"::text
    OR binding->>'extractionRunId' IS DISTINCT FROM raw."extractionRunId"::text
    OR binding->>'claimSlotKey' IS DISTINCT FROM raw."claimSlotKey"
    OR binding->>'sourceId' IS DISTINCT FROM document."sourceId"::text
    OR binding->>'dependencyAssessmentId' IS DISTINCT FROM dependency."id"::text
    OR dependency."claimId" IS DISTINCT FROM raw."id"
    OR binding->>'dependencyType' IS DISTINCT FROM dependency."dependencyType"::text
    OR binding->>'qualificationDecisionId' IS DISTINCT FROM qualification."id"::text
    OR qualification."normalizedClaimId" IS DISTINCT FROM normalized."id"
    OR binding->>'qualificationState' IS DISTINCT FROM qualification."state"::text
    OR binding->>'qualificationSemanticFingerprint' IS DISTINCT FROM qualification."semanticFingerprint"
    OR binding->>'sourceGovernanceRevisionId' IS DISTINCT FROM qualification."sourceGovernanceRevisionId"::text
    OR binding->>'equipmentId' IS DISTINCT FROM identity."equipmentId"::text
    OR binding->>'equipmentVariantId' IS DISTINCT FROM identity."equipmentVariantId"::text
    OR binding->>'identityCertainty' IS DISTINCT FROM identity."certainty"::text
    OR binding->>'policyVersion' IS DISTINCT FROM '1.0-provisional'
  THEN RAISE EXCEPTION 'governed review binding does not match immutable claim lineage'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "external_governed_review_binding"
  BEFORE INSERT ON "external_evidence_review_decisions"
  FOR EACH ROW EXECUTE FUNCTION validate_governed_external_review();
