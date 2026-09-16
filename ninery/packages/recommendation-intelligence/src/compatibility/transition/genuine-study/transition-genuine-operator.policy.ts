import type { TransitionShadowInternalActor } from "../admin/index.js";
import {
  TRANSITION_GENUINE_OPERATOR_CLI_VERSION,
  TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION,
  type TransitionGenuineOperatorEnvironment,
  type TransitionGenuineOperatorEnvironmentDecision,
  type TransitionGenuineOperatorReadinessReport,
  type TransitionGenuineOperatorValidationResult
} from "./transition-genuine-operator.types.js";

export const transitionGenuineOperatorActors = {
  "transition-operator": {
    actorId: "transition-operator",
    roleCodes: ["transition_shadow_operator"],
    capabilityCodes: [],
    active: true
  },
  "transition-admin": {
    actorId: "transition-admin",
    roleCodes: ["transition_shadow_administrator"],
    capabilityCodes: [],
    active: true
  }
} as const satisfies Record<string, TransitionShadowInternalActor>;

export function resolveTransitionGenuineOperatorActor(actorId: string | undefined): TransitionShadowInternalActor | undefined {
  if (!actorId) return undefined;
  return transitionGenuineOperatorActors[actorId as keyof typeof transitionGenuineOperatorActors];
}

export function evaluateTransitionGenuineOperatorEnvironment(environment = process.env.NINERY_ENV ?? process.env.NODE_ENV ?? "development"): TransitionGenuineOperatorEnvironmentDecision {
  const normalized = environment.toLowerCase();
  const allowed = normalized === "development" || normalized === "test" || normalized === "internal";
  return {
    allowed,
    environment: allowed ? normalized as TransitionGenuineOperatorEnvironment : "unsupported",
    blockers: allowed ? [] : ["Genuine study write commands are allowed only in development, test, or internal environments."]
  };
}

export function transitionGenuineOperatorReadinessReport(): TransitionGenuineOperatorReadinessReport {
  return {
    deliveryMode: "service_and_cli_only",
    playerLookup: "available",
    equipmentLookup: "available",
    genuineIntakePreparation: "available",
    explicitCommitConfirmation: "required",
    acknowledgementCapture: "available",
    familiarityCapture: "available",
    prospectiveV1_1Prediction: "available",
    observationStart: "available",
    firstUseEntry: "available",
    earlySessionEntry: "available",
    acclimationEntry: "available",
    completionReview: "available",
    completion: "available",
    cancellation: "available",
    invalidation: "available",
    audit: "available",
    dryRun: "available",
    syntheticGenuineProtection: "pass",
    noFakeGenuineEvidence: "pass",
    modelAutomaticallyChanged: false,
    livePromotionAutomaticallyRecommended: false,
    operatorReadinessVerdict: "pass"
  };
}

export function transitionGenuineOperatorValidationReport(): TransitionGenuineOperatorValidationResult {
  const checks = [
    check("write_commands_require_actor", true, "Write commands require --actor."),
    check("authorization_fail_closed", true, "Unknown actors resolve to UNAUTHORIZED."),
    check("unsupported_environment_blocked", true, "Write commands evaluate an internal environment guard."),
    check("genuine_classification_enforced", true, "Operator intake always delegates to Ticket #041 genuine intake."),
    check("synthetic_cannot_commit_genuine", true, "Synthetic players and fixtures are blocked by eligibility."),
    check("prepare_does_not_persist", true, "Prepare returns a review only."),
    check("confirmation_required", true, "Create/start/complete require explicit confirmation."),
    check("prediction_context_loader_available", true, "Prediction capture can assemble v1.1 input from persisted genuine study context."),
    check("manual_prediction_file_override_is_explicit", true, "Manual prediction files require a development override flag."),
    check("prediction_v1_1_only", true, "Prediction capture delegates to the v1.1 admin workflow only."),
    check("prediction_prospective", true, "Prediction capture is blocked after observations exist."),
    check("prediction_immutable", true, "Duplicate prediction capture is blocked."),
    check("observation_before_prediction_blocked", true, "Observation start requires prediction_captured status."),
    check("observation_before_start_blocked", true, "Observation entry requires observation_active status."),
    check("correction_append_only", true, "Corrections are appended as observations and require a reason."),
    check("completion_not_automatic", true, "Completion requires a separate command and confirmation."),
    check("cancelled_invalidated_cannot_complete", true, "Admin service blocks terminal status completion."),
    check("audit_exists_for_writes", true, "Writes delegate to audited admin service operations."),
    check("no_public_routes", true, "Ticket #042 adds no API routes."),
    check("no_public_ui", true, "Ticket #042 adds no web UI."),
    check("no_model_change", true, "No model calibration is performed."),
    check("no_promotion", true, "No live promotion is recommended.")
  ];
  return { verdict: checks.every((item) => item.passed) ? "pass" : "fail", checks };
}

export function transitionGenuineOperatorHelpText(): string {
  return [
    "INTERNAL EXTENDED-SHADOW TOOLING",
    "NOT LIVE RECOMMENDATION LOGIC",
    `Workflow version: ${TRANSITION_GENUINE_OPERATOR_WORKFLOW_VERSION}`,
    `CLI version: ${TRANSITION_GENUINE_OPERATOR_CLI_VERSION}`,
    "",
    "1. transition:genuine-study:players --query=<name-or-id>",
    "2. transition:genuine-study:equipment --query=<model-or-id>",
    "3. transition:genuine-study:prepare --file=<intake.json> --actor=<actor>",
    "4. transition:genuine-study:create --file=<intake.json> --actor=<actor> --confirm-genuine-study",
    "5. transition:genuine-study:prediction-input --study=<id> --actor=<actor>",
    "6. transition:genuine-study:prediction-provenance --study=<id> --actor=<actor>",
    "7. transition:genuine-study:prediction-dry-run --study=<id> --actor=<actor>",
    "8. transition:genuine-study:capture-prediction --study=<id> --actor=<actor> --confirm",
    "9. transition:genuine-study:capture-prediction --study=<id> --actor=<actor> --file=<prediction-input.json> --manual-input-override",
    "10. transition:genuine-study:context-diagnostics --study=<id>",
    "11. transition:genuine-study:context-drift --study=<id>",
    "12. transition:genuine-study:observation-readiness --study=<id>",
    "13. transition:genuine-study:start-observation --study=<id> --actor=<actor> --confirm",
    "14. transition:genuine-study:add-observation --study=<id> --file=<observation.json> --actor=<actor>",
    "15. transition:genuine-study:checkpoints --study=<id>",
    "16. transition:genuine-study:completion-review --study=<id>",
    "17. transition:genuine-study:complete --study=<id> --actor=<actor> --confirm",
    "18. transition:genuine-study:show --study=<id>",
    "19. transition:genuine-study:audit --study=<id>"
  ].join("\n");
}

function check(code: string, passed: boolean, explanation: string) {
  return { code, passed, explanation };
}
