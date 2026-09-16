import {
  TRANSITION_EXTENDED_SHADOW_POLICY_VERSION,
  TRANSITION_EXTENDED_SHADOW_STUDY_VERSION,
  TRANSITION_OBSERVATION_SCHEMA_VERSION,
  TRANSITION_OUTCOME_COMPARISON_VERSION,
  compareTransitionShadowStudyOutcome
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";
import { toDomainStudy } from "./transition-extended-shadow.report.ts";

async function main() {
  const rows = await prisma.transitionExtendedShadowStudy.findMany({
    where: { fixtureKind: "development_fixture", studyKey: { contains: "ticket-038-" } },
    include: { familiarityRecord: true, observations: { orderBy: [{ observedAt: "asc" }, { checkpoint: "asc" }] } },
    orderBy: { studyKey: "asc" }
  });

  console.log("Transition Extended Shadow Validation");
  console.log(`Study version: ${TRANSITION_EXTENDED_SHADOW_STUDY_VERSION}`);
  console.log(`Policy version: ${TRANSITION_EXTENDED_SHADOW_POLICY_VERSION}`);
  console.log(`Observation schema version: ${TRANSITION_OBSERVATION_SCHEMA_VERSION}`);
  console.log(`Outcome comparison version: ${TRANSITION_OUTCOME_COMPARISON_VERSION}`);
  console.log("");

  if (!rows.length) {
    console.log("No development fixture studies found. Run pnpm transition:extended-shadow:seed first.");
    return;
  }

  const comparisons = rows.map((row) => compareTransitionShadowStudyOutcome(toDomainStudy(row)));
  const statusCounts = countBy(comparisons.map((comparison) => comparison.comparisonStatus));
  const studyStatusCounts = countBy(rows.map((row) => row.status));
  const checkpointCounts = countBy(rows.flatMap((row) => row.observations.map((observation) => observation.checkpoint)));
  const sourceCounts = countBy(rows.flatMap((row) => row.observations.map((observation) => observation.source)));
  const allPolicyFlagsPreserved = comparisons.every((comparison) => !comparison.modelChangeRecommended && !comparison.livePromotionRecommended);
  const allPredictionsV11 = rows.every((row) => row.transitionModelVersion === "1.1");
  const syntheticOnly = rows.every((row) => row.fixtureKind === "development_fixture" && row.observations.every((observation) => {
    const payload = observation.adjustmentObservation as { readonly syntheticObservation?: boolean; readonly notRealWorldEvidence?: boolean };
    return payload.syntheticObservation === true && payload.notRealWorldEvidence === true;
  }));

  console.log(`Studies: ${rows.length}`);
  console.log(`Observations: ${rows.reduce((sum, row) => sum + row.observations.length, 0)}`);
  console.log(`All predictions v1.1: ${allPredictionsV11 ? "yes" : "no"}`);
  console.log(`Synthetic-only fixture evidence: ${syntheticOnly ? "yes" : "no"}`);
  console.log(`Model change recommended anywhere: ${allPolicyFlagsPreserved ? "no" : "yes"}`);
  console.log(`Live promotion recommended anywhere: ${allPolicyFlagsPreserved ? "no" : "yes"}`);
  printCounts("Study statuses", studyStatusCounts);
  printCounts("Outcome comparisons", statusCounts);
  printCounts("Observation checkpoints", checkpointCounts);
  printCounts("Observation sources", sourceCounts);
  console.log("");
  console.log("Validation verdict:");
  console.log(allPredictionsV11 && syntheticOnly && allPolicyFlagsPreserved ? "pass" : "review_required");
}

function countBy(values: readonly string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function printCounts(label: string, counts: Record<string, number>) {
  console.log(label);
  for (const [key, value] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) console.log(`- ${key}: ${value}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
