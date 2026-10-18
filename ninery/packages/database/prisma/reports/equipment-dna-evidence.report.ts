import { runGovernedOperationalEvidenceReport } from "../../src/governed-operational-evidence-report-cli.js";

await runGovernedOperationalEvidenceReport(process.argv.slice(2), "evidence").catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
