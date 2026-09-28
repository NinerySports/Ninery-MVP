-- Preserve qualification input separately from governed evidence classification.
-- Existing rows deliberately remain NULL; no inferred backfill is permitted.
ALTER TABLE "external_evidence_normalized_claims" ADD COLUMN "proposedEvidenceClass" TEXT;
