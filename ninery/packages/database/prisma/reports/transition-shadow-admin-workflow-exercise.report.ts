import { prisma } from "../seeds/client.ts";
import {
  TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION,
  authorizedOperator,
  elevatedOperator,
  runTransitionShadowAdminWorkflowExercise,
  unauthorizedActor
} from "./transition-shadow-admin-workflow-fixtures.ts";

async function main() {
  const result = await runTransitionShadowAdminWorkflowExercise(prisma);
  console.log(`Transition Shadow Admin Workflow Exercise v${TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_VERSION}`);
  console.log("");
  console.log("Actor fixtures:");
  console.log(`- authorized_operator: ${authorizedOperator.actorId}`);
  console.log(`- elevated_operator: ${elevatedOperator.actorId}`);
  console.log(`- unauthorized_actor: ${unauthorizedActor.actorId}`);
  console.log("");
  console.log(`Workflow fixtures: ${result.workflowsAttempted}`);
  console.log("");
  console.log("Happy path:");
  console.log(result.happyPathStatus === "observation_complete" ? "completed" : result.happyPathStatus);
  console.log("");
  console.log("Cancellation:");
  console.log(result.cancellationStatus);
  console.log("");
  console.log("Invalidation:");
  console.log(result.invalidationStatus);
  console.log("");
  console.log("Unauthorized mutation:");
  console.log(result.unauthorizedMutationBlocked ? `blocked (${result.unauthorizedErrorCode})` : "not blocked");
  console.log("");
  console.log("Observation correction:");
  console.log(result.observationCorrectionAppendOnly ? "append-only verified" : "not verified");
  console.log("");
  console.log("Prediction immutable after capture:");
  console.log(result.predictionImmutable ? "yes" : "no");
  console.log("");
  console.log("Transition prediction version:");
  console.log(result.transitionPredictionVersion ? `v${result.transitionPredictionVersion}` : "missing");
  console.log("");
  console.log("Duplicate study protection:");
  console.log(result.duplicateProtectionVerified ? "verified" : "not verified");
  console.log("");
  console.log("Workflow fixtures classified as genuine evidence:");
  console.log(result.workflowFixturesClassifiedAsGenuineEvidence ? "yes" : "no");
  console.log("");
  console.log("Audit events created:");
  console.log(result.auditEventsCreated);
  console.log("");
  console.log("Model automatically changed:");
  console.log(result.modelAutomaticallyChanged ? "yes" : "no");
  console.log("");
  console.log("Live promotion automatically recommended:");
  console.log(result.livePromotionAutomaticallyRecommended ? "yes" : "no");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
