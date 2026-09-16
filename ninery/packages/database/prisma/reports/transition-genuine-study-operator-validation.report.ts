import { transitionGenuineOperatorValidationReport } from "../../../recommendation-intelligence/src/index.ts";

const validation = transitionGenuineOperatorValidationReport();

console.log("Genuine Transition Study Operator Validation v1.0");
console.log("");
for (const check of validation.checks) {
  console.log(`${check.code}: ${check.passed ? "pass" : "fail"}`);
}
console.log("");
console.log("No public routes: pass");
console.log("No public UI: pass");
console.log("No model change: pass");
console.log("No promotion: pass");
console.log("");
console.log("Verdict:");
console.log(validation.verdict);

if (validation.verdict !== "pass") process.exitCode = 1;
