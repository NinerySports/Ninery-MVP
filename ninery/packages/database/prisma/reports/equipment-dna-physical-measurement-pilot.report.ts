import { buildPhysicalMeasurementPilotPlan } from "../../../equipment-intelligence/src/index.ts";

const args = Object.fromEntries(process.argv.slice(2).filter((value) => value.startsWith("--") && value.includes("=")).map((value) => value.slice(2).split("=", 2)));
const baselineEquipmentId = args.equipment ?? "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c";
const comparisonEquipmentId = args.compare ?? "66f59356-029f-4df7-9177-0d0f36ef3e9c";
const report = buildPhysicalMeasurementPilotPlan({ baselineEquipmentId, comparisonEquipmentId });

console.log("EQUIPMENT DNA PHYSICAL MEASUREMENT PILOT PLAN");
console.log("BASELINE");
console.log(`2023 DeMarini The Goods USA / ${report.baselineEquipmentId}`);
console.log("30 in / 20 oz / -10 / hybrid (nominal catalog facts)");
console.log("");
console.log("COMPARISON");
console.log(`2026 Louisville Slugger Atlas USA / ${report.comparisonEquipmentId}`);
console.log("30 in / 20 oz / -10 / one_piece_alloy (nominal catalog facts)");
console.log("");
console.log("FIRST-WAVE MEASUREMENTS");
for (const key of report.firstWave) console.log(`- ${key}: ${report.firstWaveTrials[key as keyof typeof report.firstWaveTrials]} trials; value not collected`);
console.log("SECOND-WAVE CANDIDATES");
for (const key of report.secondWave) console.log(`- ${key}: method/protocol work required before collection`);
console.log("QUALITY CONTROLS");
for (const control of report.qualityControls) console.log(`- ${control}`);
console.log(`Expected evidence class: ${report.expectedEvidenceClass}`);
console.log(`Atlas next step: ${report.atlasNextStep}`);
console.log(`Reason: ${report.atlasNextStepReason}`);
console.log(`Physical measurements fabricated: ${report.fabricatedMeasurements}`);
console.log(`Atlas human session created: ${report.atlasHumanSessionCreated ? "yes" : "no"}`);
console.log(`Atlas evidence created: ${report.atlasEvidenceCreated}`);
console.log(`Writes performed: ${report.writesPerformed ? "yes" : "no"}`);

