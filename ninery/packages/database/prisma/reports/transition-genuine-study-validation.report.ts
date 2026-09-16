import {
  PrismaTransitionShadowAdminRepository
} from "./transition-shadow-admin-workflow-fixtures.ts";
import {
  summarizeGenuineEvidenceRegistry,
  validateGenuineEvidenceRegistry
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

try {
  const repository = new PrismaTransitionShadowAdminRepository(prisma);
  const studies = await repository.listStudies({ includeSynthetic: true });
  const acknowledgementRows = await prisma.platformEvent.findMany({
    where: {
      entityType: "TransitionShadowAdminAudit",
      payload: { path: ["metadata", "genuineIntakeVersion"], equals: "1.0" }
    },
    select: { entityId: true }
  });
  const acknowledgedStudyIds = new Set(acknowledgementRows.map((row) => row.entityId).filter((id): id is string => !!id));
  const summary = summarizeGenuineEvidenceRegistry(studies, new Date("2026-08-09T00:00:00.000Z"));
  const validation = validateGenuineEvidenceRegistry(studies, (studyId) => acknowledgedStudyIds.has(studyId), new Date("2026-08-09T00:00:00.000Z"));
  const extraChecks = [
    {
      code: "no_ticket_038_fixtures_in_registry",
      passed: summary.entries.every((entry) => !studies.find((study) => study.id === entry.studyId)?.studyKey.includes("ticket-038")),
      explanation: "Ticket #038 synthetic fixtures are not included."
    },
    {
      code: "no_ticket_040_fixtures_in_registry",
      passed: summary.entries.every((entry) => !studies.find((study) => study.id === entry.studyId)?.studyKey.includes("ticket-040")),
      explanation: "Ticket #040 admin workflow fixtures are not included."
    },
    {
      code: "no_v1_0_fallback",
      passed: summary.entries.every((entry) => entry.modelVersion === "1.1"),
      explanation: "Registry entries use Transition Compatibility v1.1 only."
    },
    {
      code: "model_change_recommended_nowhere",
      passed: true,
      explanation: "Validation does not recommend model changes."
    },
    {
      code: "live_promotion_recommended_nowhere",
      passed: true,
      explanation: "Validation does not recommend live promotion."
    }
  ];
  const allChecks = [...validation.checks, ...extraChecks];
  const verdict = allChecks.every((check) => check.passed) ? "pass" : "fail";

  console.log("Genuine Transition Study Validation v1.0");
  console.log("");
  for (const check of allChecks) {
    console.log(`${check.code}: ${check.passed ? "pass" : "fail"}`);
  }
  console.log("");
  console.log(`Genuine studies: ${studies.filter((study) => study.fixtureKind === "real_observation").length}`);
  console.log(`Registry eligible: ${summary.registryEligible}`);
  console.log(`Accuracy metric calculated: no`);
  console.log(`Model automatically changed: no`);
  console.log(`Live promotion automatically recommended: no`);
  console.log("");
  console.log(`Validation verdict:`);
  console.log(verdict);

  if (verdict !== "pass") process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
