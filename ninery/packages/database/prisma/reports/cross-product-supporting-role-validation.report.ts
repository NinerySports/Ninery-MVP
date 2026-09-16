import { buildCrossProductSupportingRoleValidationReport } from "@ninery/equipment-intelligence";

const report = buildCrossProductSupportingRoleValidationReport();
console.log("Cross-Product Supporting-Role Validation v1.0");
console.log(report.classification);
for (const item of report.comparison) console.log(`- ${item.construct}: ${item.pattern}; eligibility=${item.eligibility}; DeMarini=${item.demarini.observations}; Atlas=${item.atlas.observations}`);
console.log("\nPolicy proposal (not implemented)");
console.log(JSON.stringify(report.proposedPolicy, null, 2));
console.log(`\nTaxonomy: ${report.decisions.taxonomy}`);
console.log(`Qualification: ${report.decisions.qualification}`);
console.log(`Sufficiency: ${report.decisions.sufficiency}`);
console.log(`Global policy: ${report.decisions.globalPolicy}`);
console.log(`Next: ${report.nextTicket}`);
