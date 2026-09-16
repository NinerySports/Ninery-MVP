import { buildEquipmentDNAMultiSourceStrategyReport } from "../../../equipment-intelligence/src/index.ts";

const report = buildEquipmentDNAMultiSourceStrategyReport();
console.log("EQUIPMENT DNA MULTI-SOURCE EVIDENCE STRATEGY");
console.log(`Version: ${report.version}`);
console.log("");
console.log("SOURCE TAXONOMY");
for (const source of report.taxonomy) {
  console.log(`${source.sourceClass.toUpperCase()}`);
  console.log(`Claim kind: ${source.claimKind}`);
  console.log(`Supports: ${source.supports}`);
  console.log(`Trust label: ${source.trustLabel}`);
  console.log(`Independence: ${source.independenceSemantics}`);
  console.log(`Uncertainty: ${source.uncertainty}`);
  console.log(`Canonical eligibility: ${source.canonicalEligibility}`);
  console.log("");
}
console.log("CONSTRUCT EVIDENCE MAP");
for (const construct of report.constructs) {
  console.log(construct.construct.toUpperCase());
  for (const [source, role] of Object.entries(construct.sourceRoles)) console.log(`${source}: ${role}`);
  console.log(`Current evidence: ${construct.currentEvidence}`);
  console.log(`Canonical readiness: ${construct.canonicalReadiness}`);
  if (construct.causalityWarning) console.log(`Causality: ${construct.causalityWarning}`);
  console.log("");
}
console.log(`Conflict policy: ${report.conflictPolicy}`);
console.log(`Construct lifecycle: ${report.constructLifecycle.join(", ")}`);
console.log(`Constructs retired: ${report.constructsRetired}`);
console.log(`Canonical evaluations created: ${report.canonicalEvaluationsCreated}`);
console.log(`Canonical evaluations modified: ${report.canonicalEvaluationsModified}`);
console.log(`Numeric references created: ${report.numericReferencesCreated}`);
console.log(`Recommendation behavior changed: ${report.recommendationChanged ? "yes" : "no"}`);
console.log(`Writes performed: ${report.writesPerformed ? "yes" : "no"}`);

