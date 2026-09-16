import { buildPhysicalMeasurementFeasibilityReport } from "../../../equipment-intelligence/src/index.ts";

const report = buildPhysicalMeasurementFeasibilityReport();
console.log("PHYSICAL MEASUREMENT FEASIBILITY");
console.log(`Version: ${report.version}`);
for (const measurement of report.measurements) {
  console.log("");
  console.log(measurement.key.toUpperCase());
  console.log(`Evidence class: ${measurement.evidenceClass}`);
  console.log(`Feasibility: ${measurement.feasibility}`);
  console.log(`Potential equipment: ${measurement.equipment.join(", ")}`);
  console.log(`Raw units: ${measurement.supportedRawUnits.join(", ") || "deferred until method definition"}`);
  console.log(`Normalized unit: ${measurement.normalizedUnit ?? "deferred until method definition"}`);
  console.log(`Repeated trials: ${measurement.repeatedTrials}`);
  console.log(`Method status: ${measurement.methodStatus}`);
  console.log(`Potential claim: ${measurement.potentialClaim}`);
  console.log("Behavioral inference allowed: no");
}
console.log("");
console.log("LOW-COST NINERY MEASUREMENT KIT");
for (const item of report.lowCostKit) console.log(`- ${item.item}: ${item.supports.join(", ")} | resolution: ${item.resolution} | calibration: ${item.calibration} | complexity: ${item.complexity}`);
console.log(`Canonical promotion: ${report.canonicalPromotion}`);
console.log(`Writes performed: ${report.writesPerformed ? "yes" : "no"}`);

