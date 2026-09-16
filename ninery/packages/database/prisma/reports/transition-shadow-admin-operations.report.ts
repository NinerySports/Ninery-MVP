import {
  TRANSITION_SHADOW_ADMIN_DELIVERY_MODE,
  TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION,
  checkpointStatusesForStudy,
  classifyTransitionShadowStudy,
  compareTransitionShadowStudyOutcome
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";
import { toDomainStudy } from "./transition-extended-shadow.report.ts";

async function main() {
  const rows = await prisma.transitionExtendedShadowStudy.findMany({
    include: { familiarityRecord: true, observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }] } },
    orderBy: [{ createdAt: "desc" }, { studyKey: "asc" }]
  });
  const studies = rows.map((row) => toDomainStudy(row));
  const genuine = studies.filter((study) => classifyTransitionShadowStudy(study) === "genuine_internal_observation");
  const synthetic = studies.length - genuine.length;
  const comparisons = studies
    .filter((study) => study.prediction && ["observation_complete", "invalidated"].includes(study.status))
    .map((study) => compareTransitionShadowStudyOutcome(study));
  const checkpoints = studies.flatMap((study) => checkpointStatusesForStudy(study, new Date("2026-08-08T00:00:00.000Z")));
  const modelVersions = studies.reduce<Record<string, number>>((counts, study) => {
    const version = study.prediction?.transitionModelVersion ?? "none";
    counts[version] = (counts[version] ?? 0) + 1;
    return counts;
  }, {});

  console.log("Transition Extended-Shadow Operations");
  console.log(`Summary version: ${TRANSITION_SHADOW_OPERATIONAL_SUMMARY_VERSION}`);
  console.log(`Delivery mode: ${TRANSITION_SHADOW_ADMIN_DELIVERY_MODE}`);
  console.log("");
  console.log(`Genuine studies: ${genuine.length}`);
  console.log(`Synthetic fixtures: ${synthetic}`);
  console.log(`Draft: ${studies.filter((study) => study.status === "draft").length}`);
  console.log(`Prediction captured: ${studies.filter((study) => study.status === "prediction_captured").length}`);
  console.log(`Observation active: ${studies.filter((study) => study.status === "observation_active").length}`);
  console.log(`Observation complete: ${studies.filter((study) => study.status === "observation_complete").length}`);
  console.log(`Cancelled: ${studies.filter((study) => study.status === "cancelled").length}`);
  console.log(`Invalidated: ${studies.filter((study) => study.status === "invalidated").length}`);
  console.log("");
  console.log(`Checkpoints due: ${checkpoints.filter((checkpoint) => checkpoint.status === "due").length}`);
  console.log(`Checkpoints missing: ${checkpoints.filter((checkpoint) => checkpoint.status === "missing").length}`);
  console.log(`Conflicts: ${studies.filter((study) => study.observations.some((observation) => observation.conflictsWithAnotherSource)).length}`);
  console.log(`Insufficient observation: ${comparisons.filter((comparison) => comparison.comparisonStatus === "insufficient_observation").length}`);
  console.log("");
  console.log("Model versions:");
  for (const [version, count] of Object.entries(modelVersions).sort(([a], [b]) => a.localeCompare(b))) console.log(`v${version}: ${count}`);
  console.log("");
  console.log("Model automatically changed:");
  console.log("no");
  console.log("");
  console.log("Live promotion automatically recommended:");
  console.log("no");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
