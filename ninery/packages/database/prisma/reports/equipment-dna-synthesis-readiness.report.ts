import { runGovernedOperationalEvidenceReport } from "../../src/governed-operational-evidence-report-cli.js";

await runGovernedOperationalEvidenceReport(process.argv.slice(2), "readiness").catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
