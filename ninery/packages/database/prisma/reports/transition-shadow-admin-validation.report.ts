import {
  classifyTransitionShadowStudy,
  compareTransitionShadowStudyOutcome
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";
import { toDomainStudy } from "./transition-extended-shadow.report.ts";

async function main() {
  const [studyRows, auditEvents] = await Promise.all([
    prisma.transitionExtendedShadowStudy.findMany({
      include: { familiarityRecord: true, observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }] } },
      orderBy: [{ createdAt: "desc" }, { studyKey: "asc" }]
    }),
    prisma.platformEvent.findMany({ where: { entityType: "TransitionShadowAdminAudit" } })
  ]);
  const studies = studyRows.map((row) => toDomainStudy(row));
  const findings: string[] = [];
  for (const study of studies) {
    const classification = classifyTransitionShadowStudy(study);
    if (!classification) findings.push(`${study.studyKey}: missing classification`);
    if (study.prediction) {
      if (study.prediction.transitionModelVersion !== "1.1") findings.push(`${study.studyKey}: prediction is not v1.1`);
      if (!study.prediction.predictionHash || !study.prediction.inputHash) findings.push(`${study.studyKey}: prediction hashes missing`);
    }
    for (const observation of study.observations) {
      if (!observation.source) findings.push(`${study.studyKey}: observation source missing`);
      if (!observation.observationConfidence) findings.push(`${study.studyKey}: observation confidence missing`);
    }
    if (study.status === "observation_complete" && study.prediction) {
      const comparison = compareTransitionShadowStudyOutcome(study);
      if (comparison.modelChangeRecommended || comparison.livePromotionRecommended) findings.push(`${study.studyKey}: comparison recommended model or live promotion`);
    }
    if (study.fixtureKind === "development_fixture" && classification !== "development_fixture") findings.push(`${study.studyKey}: fixture is not labeled`);
  }
  const genuineDefaultRows = studies.filter((study) => classifyTransitionShadowStudy(study) === "genuine_internal_observation");
  const cancelledOrInvalidated = studies.filter((study) => study.status === "cancelled" || study.status === "invalidated").length;

  console.log("Transition Shadow Admin Validation");
  console.log(`Studies checked: ${studies.length}`);
  console.log(`Admin audit events: ${auditEvents.length}`);
  console.log(`Genuine default-list studies: ${genuineDefaultRows.length}`);
  console.log(`Cancelled/invalidated excluded from valid outcomes: ${cancelledOrInvalidated}`);
  console.log("Model change recommended: no");
  console.log("Live promotion recommended: no");
  if (findings.length) {
    console.log("Findings:");
    for (const finding of findings) console.log(`- ${finding}`);
  }
  console.log("");
  console.log("Validation verdict:");
  console.log(findings.length ? "fail" : "pass");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
