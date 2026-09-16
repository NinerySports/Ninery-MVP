import { buildDemariniExternalExpertCalibrationReport } from "@ninery/equipment-intelligence";

const report = buildDemariniExternalExpertCalibrationReport();
console.log("External Expert Observation Calibration v1.0");
console.log(report.classification);
console.log(`Target: ${report.target.identity}`);
console.log(`Sources: ${report.sources.length}; observations: ${report.observations.length}`);
console.log(`Persisted reference: ${report.persistedReference.directPhysicalMeasurements} physical, ${report.persistedReference.structuredHumanRecords} human, ${report.persistedReference.sessions} sessions, ${report.persistedReference.evaluatorGroups} evaluator groups`);
console.log("\nConstruct calibration");
for (const item of report.constructCalibration) console.log(`- ${item.construct}: observations=${item.observationCount}, lineages=${item.independentLineageCount}, suitability=${item.suitability}, outcomes=${JSON.stringify(item.outcomes)}`);
console.log("\nPolicy simulation");
for (const policy of report.policies) console.log(`- ${policy.id}: ${policy.rule}; supporting=${policy.supportingObservations}; risk=${policy.risk}`);
console.log("\nAtlas simulation");
for (const [claim, result] of report.atlasSimulation) console.log(`- ${claim}: ${result}`);
console.log(`\nTaxonomy: ${report.decisions.taxonomy}`);
console.log(`Qualification: ${report.decisions.qualification}`);
console.log(`Sufficiency: ${report.decisions.sufficiency}`);
console.log(`Next: ${report.recommendation}`);
console.log(`Firewalls: ${JSON.stringify(report.firewalls)}`);
