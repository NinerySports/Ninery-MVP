import type { EquipmentDNACatalogFactInput, EquipmentDNAEvidenceIdentity } from "./read-model/index.js";
import type { StrongerEvidenceAdmissibility, StrongerEvidenceCandidate, StrongerEvidenceRequest } from "./stronger-construct-evidence-admissibility.js";
import type { StrongerEvidenceDependenceResult } from "./dependence/index.js";

/** A structural view of #081 output, not a second readiness policy. */
export type OperationalConstructProjection = {
  readonly directEvidenceRecordCount: number;
  readonly descriptiveState: "no_direct_evidence" | "direct_evidence_present" | "review_required";
  readonly gaps: readonly string[];
  readonly blockers: readonly string[];
  readonly currentSupportingContext: readonly { readonly decisionId: string }[];
  readonly historicalSupportingContext: readonly { readonly decisionId: string }[];
};
export type GovernedOperationalConstructInput = {
  readonly request: StrongerEvidenceRequest;
  readonly projection: OperationalConstructProjection;
  readonly admissibility: readonly StrongerEvidenceAdmissibility[];
  readonly dependence: StrongerEvidenceDependenceResult;
};
export type GovernedOperationalEvidenceInput = {
  readonly identity: EquipmentDNAEvidenceIdentity;
  readonly catalogFacts: readonly EquipmentDNACatalogFactInput[];
  readonly inventory: readonly StrongerEvidenceCandidate[];
  readonly constructs: readonly GovernedOperationalConstructInput[];
};

/** Compose existing decisions only. Raw inventory and actor identities grant no authority. */
export function composeGovernedOperationalEvidenceReport(input: GovernedOperationalEvidenceInput) {
  const inventory = [...input.inventory].sort((a, b) => a.id.localeCompare(b.id));
  const constructs = [...input.constructs].sort((a, b) => a.request.construct.localeCompare(b.request.construct)).map(item => {
    const decisions = [...item.admissibility].sort((a, b) => a.evidenceRecordId.localeCompare(b.evidenceRecordId));
    const admitted = decisions.filter(decision => decision.disposition === "admissible" || decision.disposition === "admissible_with_restrictions");
    return {
      construct: item.request.construct,
      applicableCalibrationObservations: admitted.filter(decision => decision.permittedAssessment === "calibration_only"),
      admissibleConstructEvidence: admitted.filter(decision => decision.permittedAssessment === "construct_evidence"),
      excludedObservations: decisions.filter(decision => decision.disposition === "excluded"),
      unresolvedObservations: decisions.filter(decision => decision.disposition === "unresolved"),
      directEvidenceRecordCount: item.projection.directEvidenceRecordCount,
      descriptiveState: item.projection.descriptiveState,
      gaps: [...item.projection.gaps], blockers: [...item.projection.blockers],
      readiness: "synthesis_not_permitted" as const,
      sourceIndependence: "not_established" as const,
      knownIndependentStrongerGroups: [] as const,
      dependence: item.dependence,
      supportingContext: {
        currentDecisionIds: item.projection.currentSupportingContext.map(entry => entry.decisionId),
        historicalDecisionIds: item.projection.historicalSupportingContext.map(entry => entry.decisionId),
        directEvidenceContribution: 0 as const
      }
    };
  });
  const assessedIds = new Set(input.constructs.flatMap(item => item.admissibility.map(decision => decision.evidenceRecordId)));
  return {
    version: "1.0" as const, interpretation: "governed_operational_evidence" as const,
    semantics: "snapshot_at_read_time_not_historical_as_of" as const,
    identity: input.identity, catalogFacts: [...input.catalogFacts],
    inventory, inventoryAuthority: "diagnostic_only" as const,
    unassessedInventoryIds: inventory.filter(record => !assessedIds.has(record.id)).map(record => record.id),
    constructs,
    authority: {
      independenceEstablished: false as const, comparabilityGranted: false as const, sufficiencyGranted: false as const,
      synthesisGranted: false as const, canonicalValueCreated: false as const, numericValueCreated: false as const,
      compatibilityGranted: false as const, recommendationGranted: false as const, decisionBookGranted: false as const,
      writesPerformed: false as const
    }
  };
}
export type GovernedOperationalEvidenceReport = ReturnType<typeof composeGovernedOperationalEvidenceReport>;

/** Shared formatter for both operational CLIs. Specimen filtering is inventory-only. */
export function formatGovernedOperationalEvidenceReport(report: GovernedOperationalEvidenceReport, options: { readonly specimenReference?: string } = {}): string {
  const lines = ["GOVERNED EQUIPMENT EVIDENCE AND READINESS", "Interpretation: governed_operational_evidence",
    "Equipment: " + report.identity.equipmentId + " (" + report.identity.manufacturer + " " + report.identity.model + ")",
    "Selected variant: " + (report.identity.variant?.id ?? "none; variant-specific observations cannot establish model-wide applicability"),
    "Source independence: not_established. Evaluator, session, specimen and instrument identities are descriptive provenance only.",
    "CATALOG FACTS — descriptive nominal inventory; not behavioral authority"];
  for (const fact of report.catalogFacts) lines.push("- " + fact.key + ": " + JSON.stringify(fact.value) + " " + (fact.unit ?? "") + "; " + fact.level + "; " + fact.sourceName);
  lines.push("RAW EQUIPMENT INVENTORY — diagnostic only; may include other variants and unsupported constructs");
  if (options.specimenReference) lines.push("Specimen filter: " + options.specimenReference + " (inventory display only; construct assessments retain their equipment/variant scope)");
  for (const record of report.inventory) {
    const raw = object(record.rawValue);
    if (options.specimenReference && raw.specimenReference !== options.specimenReference) continue;
    lines.push("- " + record.id + "; " + record.attributeKey + "; " + record.sourceType + "; " + record.status + "; declared target " + record.targetLevel + "; variant " + (record.equipmentVariantId ?? "none"),
      "  source " + (record.sourceReference ?? "unavailable") + "; date " + (record.sourceDate instanceof Date ? record.sourceDate.toISOString() : record.sourceDate ?? "unavailable") + "; method " + record.method + "; definition " + record.attributeDefinitionVersion,
      "  evaluator/operator " + (record.evaluatorReference ?? raw.operatorId ?? "unavailable") + "; session " + (raw.sessionId ?? raw.measurementSessionId ?? "unavailable") + "; specimen " + (raw.specimenReference ?? "unavailable") + "; instrument " + (object(raw.instrument).instrumentReference ?? "unavailable"),
      "  observed " + JSON.stringify(raw.observation ?? raw.trials ?? raw.aggregate ?? null) + "; normalized " + JSON.stringify(record.normalizedValue ?? null) + " " + (record.unit ?? "") + "; limitations " + JSON.stringify(raw.limitations ?? raw.testingLimitations ?? raw.sessionLimitations ?? []));
  }
  lines.push("Unassessed inventory IDs (diagnostic only): " + (report.unassessedInventoryIds.join(", ") || "none"));
  for (const item of report.constructs) {
    lines.push("CONSTRUCT " + item.construct, "State: " + item.descriptiveState + "; readiness: " + item.readiness,
      "Applicable calibration observations: " + item.applicableCalibrationObservations.length + "; admissible construct observations: " + item.admissibleConstructEvidence.length + "; primary direct evidence: " + item.directEvidenceRecordCount);
    for (const [label, decisions] of [["calibration_only", item.applicableCalibrationObservations], ["construct_evidence", item.admissibleConstructEvidence], ["excluded", item.excludedObservations], ["unresolved", item.unresolvedObservations]] as const) {
      for (const decision of decisions) lines.push("- " + label + ": " + decision.evidenceRecordId + "; " + decision.reasons.join(", ") + "; observed variant " + (decision.observedIdentity.equipmentVariantId ?? "none"));
    }
    lines.push("Supporting context: current " + (item.supportingContext.currentDecisionIds.join(", ") || "none") + "; historical " + (item.supportingContext.historicalDecisionIds.join(", ") || "none") + "; direct evidence contribution 0",
      "Gaps: " + (item.gaps.join(", ") || "none"), "Blockers: " + (item.blockers.join(", ") || "none"));
    for (const node of item.dependence.nodes) lines.push("- dependence node " + node.recordId + ": " + node.participation + "; " + node.reasons.join(", "));
    for (const edge of item.dependence.edges) lines.push("- dependence " + edge.from + " -> " + edge.to + ": " + edge.kind + "; " + edge.participation);
  }
  lines.push("Synthesis, canonical promotion, numeric values, compatibility, recommendation and Decision Book authority: not granted. Writes performed: no.");
  return lines.join("\n");
}
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
