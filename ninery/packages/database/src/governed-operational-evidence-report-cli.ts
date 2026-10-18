import { PrismaClient } from "@prisma/client";
import { formatGovernedOperationalEvidenceReport } from "@ninery/equipment-intelligence";
import { GovernedOperationalEvidenceReportService } from "./governed-operational-evidence-report.js";
import { PrismaGovernedConstructEvidenceProjectionRepository } from "./prisma-governed-construct-evidence-projection-repository.js";

export function parseGovernedEvidenceReportOptions(args: readonly string[], mode: "evidence" | "readiness") {
  const options = new Map<string, string>();
  const allowed = mode === "evidence" ? ["equipment", "variant", "construct", "specimen"] : ["equipment", "variant", "construct"];
  // pnpm package scripts forward one leading separator; later separators remain invalid.
  const optionsArgs = args[0] === "--" ? args.slice(1) : args;
  for (const arg of optionsArgs) {
    const match = /^--([^=]+)=(.+)$/.exec(arg);
    if (!match || !allowed.includes(match[1]!) || options.has(match[1]!)) throw new Error("Unknown, empty or duplicate report option: " + arg);
    options.set(match[1]!, match[2]!);
  }
  if (!options.get("equipment")?.trim()) throw new Error("--equipment=<uuid> is required.");
  if (mode === "readiness" && !options.get("variant")?.trim()) throw new Error("--variant=<uuid> is required for readiness.");
  return { equipmentId: options.get("equipment")!, equipmentVariantId: options.get("variant"),
    construct: options.get("construct"), specimenReference: options.get("specimen") };
}

/** Both runnable reports use this loader; there are no pre-snapshot database reads. */
export async function runGovernedOperationalEvidenceReport(args: readonly string[], mode: "evidence" | "readiness", dependencies: { readonly client?: PrismaClient; readonly write?: (text: string) => void } = {}) {
  const options = parseGovernedEvidenceReportOptions(args, mode);
  const db = dependencies.client ?? new PrismaClient();
  try {
    const report = await new GovernedOperationalEvidenceReportService(new PrismaGovernedConstructEvidenceProjectionRepository(db)).load(options);
    const output = formatGovernedOperationalEvidenceReport(report, options);
    (dependencies.write ?? console.log)(output);
    return report;
  } finally {
    if (!dependencies.client) await db.$disconnect();
  }
}
