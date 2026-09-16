import { buildAtlasExternalExpertCalibrationReport } from "@ninery/equipment-intelligence";

const report = buildAtlasExternalExpertCalibrationReport();
console.log("Atlas External Expert Calibration v1.0");
console.log(report.classification);
console.log(`Target: ${report.target.identity}`);
console.log(`Kind: ${report.calibrationKind}`);
console.log(`Sources: ${report.counts.sources}; observations: ${report.counts.observations} (${report.counts.reused} reused, ${report.counts.added} new)`);
console.log(`Independent lineages: ${report.counts.knownIndependentLineages}; unknown-dependency sources: ${report.counts.unknownDependencySources}`);
console.log(`Database audit: ${report.catalogOnlyExpectation.databaseAuditStatus}`);
console.log("\nConstruct eligibility");
for (const item of report.constructCoverage) console.log(`- ${item.construct}: ${item.eligibility}; observations=${item.observations}; high=${item.high}; independent=${item.independentLineages}`);
console.log("\nPolicy simulations");
for (const policy of report.policies) console.log(`- ${policy.id}: support=${policy.supportCount}; ${policy.rule}; risk=${policy.risk}`);
console.log(`\n#070 baseline: ${report.current070Baseline.state}; runtime changed=${report.current070Baseline.runtimeChanged}`);
console.log(`Firewalls: ${JSON.stringify(report.firewalls)}`);
