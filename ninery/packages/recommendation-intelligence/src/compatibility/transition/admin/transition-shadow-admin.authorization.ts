import {
  TRANSITION_SHADOW_ADMIN_POLICY_VERSION,
  type TransitionShadowAdminCapability,
  type TransitionShadowAuthorizationDecision,
  type TransitionShadowInternalActor
} from "./transition-shadow-admin.types.js";

const roleCapabilities = {
  transition_shadow_viewer: ["transition_shadow_study_view", "transition_shadow_audit_view"],
  transition_shadow_operator: [
    "transition_shadow_study_view",
    "transition_shadow_study_create",
    "transition_shadow_prediction_capture",
    "transition_shadow_observation_add",
    "transition_shadow_study_complete",
    "transition_shadow_audit_view"
  ],
  transition_shadow_reviewer: [
    "transition_shadow_study_view",
    "transition_shadow_study_complete",
    "transition_shadow_study_cancel",
    "transition_shadow_audit_view",
    "transition_shadow_fixture_view"
  ],
  transition_shadow_administrator: [
    "transition_shadow_study_view",
    "transition_shadow_study_create",
    "transition_shadow_prediction_capture",
    "transition_shadow_observation_add",
    "transition_shadow_study_complete",
    "transition_shadow_study_cancel",
    "transition_shadow_study_invalidate",
    "transition_shadow_audit_view",
    "transition_shadow_fixture_view"
  ]
} as const satisfies Record<string, readonly TransitionShadowAdminCapability[]>;

export const transitionShadowKnownAdminRoles = Object.keys(roleCapabilities);

export function evaluateTransitionShadowAuthorization(input: {
  readonly actor?: TransitionShadowInternalActor;
  readonly capability: TransitionShadowAdminCapability;
  readonly requiresFixtureAccess?: boolean;
  readonly evaluatedAt?: Date;
}): TransitionShadowAuthorizationDecision {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const evaluatedAt = input.evaluatedAt ?? new Date();
  const actor = input.actor;
  if (!actor) blockers.push("Missing internal actor context.");
  if (actor && !actor.active) blockers.push("Internal actor is inactive.");
  const knownRoles = actor?.roleCodes.filter((role) => role in roleCapabilities) ?? [];
  if (actor && knownRoles.length === 0) blockers.push("No known transition-shadow administration role is present.");
  const roleGranted = knownRoles.flatMap((role) => roleCapabilities[role as keyof typeof roleCapabilities]);
  const directGranted = actor?.capabilityCodes.filter((capability): capability is TransitionShadowAdminCapability => isTransitionShadowAdminCapability(capability)) ?? [];
  const granted = new Set<TransitionShadowAdminCapability>([...roleGranted, ...directGranted]);
  if (!granted.has(input.capability)) blockers.push(`Capability ${input.capability} is required.`);
  if (input.requiresFixtureAccess && !granted.has("transition_shadow_fixture_view")) blockers.push("Fixture access capability is required.");
  if (!blockers.length) reasons.push(`Capability ${input.capability} granted by explicit role or capability mapping.`);
  return {
    allowed: blockers.length === 0,
    capability: input.capability,
    actorId: actor?.actorId,
    actorRole: knownRoles[0],
    reasons,
    blockers,
    policyVersion: TRANSITION_SHADOW_ADMIN_POLICY_VERSION,
    evaluatedAt
  };
}

export function isTransitionShadowAdminCapability(value: string): value is TransitionShadowAdminCapability {
  return [
    "transition_shadow_study_view",
    "transition_shadow_study_create",
    "transition_shadow_prediction_capture",
    "transition_shadow_observation_add",
    "transition_shadow_study_complete",
    "transition_shadow_study_cancel",
    "transition_shadow_study_invalidate",
    "transition_shadow_audit_view",
    "transition_shadow_fixture_view"
  ].includes(value);
}
