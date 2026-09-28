import { multiSourceEvidenceClassValues, type MultiSourceEvidenceClass } from "@ninery/equipment-intelligence";

export class DurableProposedEvidenceClassError extends Error {
  constructor(readonly code: "missing_durable_proposed_evidence_class" | "invalid_durable_proposed_evidence_class") {
    super(code);
    this.name = "DurableProposedEvidenceClassError";
  }
}

export function requireDurableProposedEvidenceClass(value: string | null): MultiSourceEvidenceClass {
  if (value === null) throw new DurableProposedEvidenceClassError("missing_durable_proposed_evidence_class");
  const proposal = multiSourceEvidenceClassValues.find((candidate) => candidate === value);
  if (!proposal) throw new DurableProposedEvidenceClassError("invalid_durable_proposed_evidence_class");
  return proposal;
}
