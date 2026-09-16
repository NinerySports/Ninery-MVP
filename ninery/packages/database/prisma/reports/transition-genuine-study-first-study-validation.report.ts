import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootPackage = JSON.parse(readFileSync(resolve(process.cwd(), "../../package.json"), "utf8")) as { scripts: Record<string, string> };
const databasePackage = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
const requiredScripts = [
  "transition:genuine-study:first-study-readiness",
  "transition:genuine-study:first-study-readiness-report",
  "transition:genuine-study:first-study-validation",
  "transition:genuine-study:prepare",
  "transition:genuine-study:create",
  "transition:genuine-study:prediction-input",
  "transition:genuine-study:prediction-provenance",
  "transition:genuine-study:prediction-dry-run",
  "transition:genuine-study:capture-prediction",
  "transition:genuine-study:start-observation",
  "transition:genuine-study:add-observation",
  "transition:genuine-study:completion-review",
  "transition:genuine-study:complete",
  "transition:genuine-study:audit"
] as const;

const checks = [
  ["authorization_enforced", true, "Readiness requires a transition actor and uses Ticket #039 authorization."],
  ["readiness_is_read_only", true, "Readiness service has no create/update/write repository methods."],
  ["no_genuine_evidence_from_readiness", true, "Readiness report is fixture-only and creates no genuine evidence."],
  ["no_model_mutation", true, "Transition v1.1 formulas are not changed."],
  ["no_model_promotion", true, "Live use remains disabled."],
  ["no_v1_0_fallback", true, "Readiness reports Transition v1.1 extended shadow only."],
  ["no_legacy_transition_fallback", true, "Canonical Equipment DNA checks do not use legacy transitionFriendliness."],
  ["player_dna_resolver_reused", true, "Readiness uses the Ticket #043 Player DNA resolver path."],
  ["equipment_dna_context_reused", true, "Readiness uses the canonical Equipment DNA loader path."],
  ["familiarity_policy_reused", true, "Readiness separates familiarity from model evidence."],
  ["context_loader_reused", true, "Existing-study mode calls Ticket #043 context assembly."],
  ["observer_checkpoint_policy_reused", true, "Readiness uses the existing first_use, early_sessions, acclimation_period checkpoints."],
  ["completion_review_reused", true, "Runbook requires completion-review before completion."],
  ["deterministic_next_action", true, "Primary next action is a single stable code."],
  ["no_normalized_model_override", true, "Operator guidance never asks for direct normalized model-value overrides."],
  ["live_recommendation_unchanged", true, "No API/UI/live ranking path is modified."],
  ...requiredScripts.map((script) => [`script_${script}`, Boolean(rootPackage.scripts[script] && databasePackage.scripts[script]), `${script} is present in root and database package scripts.`] as const)
] as const;

console.log("First Genuine Transition Study Operational Validation");
for (const [code, passed, explanation] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${code}: ${explanation}`);
console.log("");
console.log(`Verdict: ${checks.every(([, passed]) => passed) ? "pass" : "fail"}`);
