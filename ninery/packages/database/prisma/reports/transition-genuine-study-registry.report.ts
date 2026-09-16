import {
  PrismaTransitionShadowAdminRepository
} from "./transition-shadow-admin-workflow-fixtures.ts";
import {
  summarizeGenuineEvidenceRegistry
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

try {
  const repository = new PrismaTransitionShadowAdminRepository(prisma);
  const studies = await repository.listStudies({ includeSynthetic: true });
  const summary = summarizeGenuineEvidenceRegistry(studies, new Date("2026-08-09T00:00:00.000Z"));

  console.log("Genuine Transition Evidence Registry v1.0");
  console.log("");
  console.log(`Genuine completed studies: ${summary.genuineCompletedStudies}`);
  console.log(`Registry eligible: ${summary.registryEligible}`);
  console.log(`Insufficient evidence: ${summary.insufficientEvidence}`);
  console.log(`Cancelled: ${summary.cancelled}`);
  console.log(`Invalidated: ${summary.invalidated}`);
  console.log("");
  console.log("Evidence quality:");
  console.log(`- strong: ${summary.evidenceQualityCounts.strong}`);
  console.log(`- usable: ${summary.evidenceQualityCounts.usable}`);
  console.log(`- limited: ${summary.evidenceQualityCounts.limited}`);
  console.log(`- insufficient: ${summary.evidenceQualityCounts.insufficient}`);
  console.log("");
  console.log("Comparison statuses:");
  for (const status of ["broadly_aligned", "partially_aligned", "materially_different", "conflicting_observations", "insufficient_observation"]) {
    console.log(`- ${status}: ${summary.comparisonStatusCounts[status] ?? 0}`);
  }
  console.log("");
  console.log("Model versions represented:");
  const versions = Object.entries(summary.modelVersionsRepresented).sort(([a], [b]) => a.localeCompare(b));
  if (!versions.length) console.log("- none");
  for (const [version, count] of versions) console.log(`- ${version}: ${count}`);
  console.log("");
  console.log("Accuracy metric:");
  console.log("not calculated");
} finally {
  await prisma.$disconnect();
}
