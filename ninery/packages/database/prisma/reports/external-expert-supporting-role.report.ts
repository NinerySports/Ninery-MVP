import { buildExternalExpertSupportingRoleSimulation } from "@ninery/equipment-intelligence";

const report = buildExternalExpertSupportingRoleSimulation();
console.log("External Expert Supporting-Evidence Role v1.0");
console.log(`Policy: ${report.policyStatus} (${report.policyVersion})`);
console.log(`Approval mode: ${report.approvalMode}`);
for (const [name, simulation] of [["Atlas", report.atlas], ["DeMarini", report.demarini]] as const) {
  console.log(`\n${name}`);
  console.log(`Observations: ${simulation.totalExternalObservations}`);
  console.log(`Candidates: startup=${simulation.startupDemandCandidates}; rotational=${simulation.rotationalDemandCandidates}; high-confidence=${simulation.highConfidenceCandidates}; known-independent=${simulation.knownIndependentCandidates}`);
  console.log(`Eligible before human approval: ${simulation.eligibleBeforeHumanApproval}; pending approval: ${simulation.pendingApproval}; would support if hypothetically approved: ${simulation.wouldSupportIfApproved}`);
  console.log(`Blocked: dependency=${simulation.blockedByDependency}; confidence=${simulation.blockedByMappingConfidence}; construct=${simulation.blockedByConstruct}; identity=${simulation.blockedByIdentity}; marketing=${simulation.blockedByMarketing}`);
}
console.log("\nFirewalls");
console.log(`Persisted: ${report.firewalls.persisted}; real approval created: ${report.firewalls.realApprovalCreated}; canonical: ${report.firewalls.canonicalValueCreated}; numeric: ${report.firewalls.numericValueCreated}; synthesis: ${report.firewalls.synthesisEligibilityGranted}; recommendation: ${report.firewalls.recommendationInputCreated}`);
