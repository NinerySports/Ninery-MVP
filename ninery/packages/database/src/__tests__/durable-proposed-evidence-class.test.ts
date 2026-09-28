import assert from "node:assert/strict";
import test from "node:test";
import { multiSourceEvidenceClassValues } from "@ninery/equipment-intelligence";
import { DurableProposedEvidenceClassError, requireDurableProposedEvidenceClass } from "../durable-proposed-evidence-class.js";

test("durable proposals use the existing six-class contract", () => {
  for (const value of multiSourceEvidenceClassValues) assert.equal(requireDurableProposedEvidenceClass(value), value);
});

test("legacy null and unclassified never become inferred qualification inputs", () => {
  for (const [value, code] of [[null, "missing_durable_proposed_evidence_class"], ["unclassified", "invalid_durable_proposed_evidence_class"]] as const) {
    assert.throws(() => requireDurableProposedEvidenceClass(value),
      (error: unknown) => error instanceof DurableProposedEvidenceClassError && error.code === code);
  }
});
