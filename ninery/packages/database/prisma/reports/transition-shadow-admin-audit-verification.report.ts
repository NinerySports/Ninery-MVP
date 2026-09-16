import {
  TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX,
  ticket040AuditEvents,
  ticket040FixtureStudies
} from "./transition-shadow-admin-workflow-fixtures.ts";
import { prisma } from "../seeds/client.ts";

const requiredActionsByTerminalStatus = {
  observation_complete: ["study_draft_created", "prediction_captured", "observation_started", "observation_added", "study_completed"],
  cancelled: ["study_draft_created", "prediction_captured", "study_cancelled"],
  invalidated: ["study_draft_created", "prediction_captured", "study_invalidated"]
} as const;

async function main() {
  const studies = await ticket040FixtureStudies(prisma);
  const events = await ticket040AuditEvents(prisma);
  const findings: string[] = [];
  const grouped = events.reduce<Record<string, number>>((counts, event) => {
    const action = String(event.payload.action ?? "unknown");
    counts[action] = (counts[action] ?? 0) + 1;
    return counts;
  }, {});

  for (const study of studies) {
    const studyEvents = events.filter((event) => event.entityId === study.id || event.payload.studyId === study.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (!studyEvents.length) findings.push(`MISSING_REQUIRED_AUDIT_EVENT:${study.studyKey}`);
    for (const event of studyEvents) {
      if (!event.entityId || event.entityId !== study.id) findings.push(`AUDIT_ENTITY_MISMATCH:${study.studyKey}`);
      if (!event.payload.actorId) findings.push(`AUDIT_ACTOR_MISSING:${study.studyKey}`);
      if (!event.createdAt) findings.push(`AUDIT_TIMESTAMP_MISSING:${study.studyKey}`);
      const payloadText = JSON.stringify(event.payload);
      if (/password|token|secret|diagnosis|medical|school|address/i.test(payloadText)) findings.push(`AUDIT_PAYLOAD_POLICY_VIOLATION:${study.studyKey}`);
    }
    const actions = new Set(studyEvents.map((event) => String(event.payload.action)));
    const required = requiredActionsByTerminalStatus[study.status as keyof typeof requiredActionsByTerminalStatus] ?? [];
    for (const action of required) if (!actions.has(action)) findings.push(`MISSING_REQUIRED_AUDIT_EVENT:${study.studyKey}:${action}`);
    if (!terminalActionValid(study.status, actions)) findings.push(`AUDIT_TERMINAL_STATE_MISMATCH:${study.studyKey}`);
    if (!sequenceValid(studyEvents.map((event) => String(event.payload.action)))) findings.push(`AUDIT_SEQUENCE_INVALID:${study.studyKey}`);
  }

  console.log("Transition Shadow Admin Audit Verification");
  console.log(`Workflow fixture prefix: ${TRANSITION_SHADOW_ADMIN_WORKFLOW_FIXTURE_PREFIX}`);
  console.log(`Workflow fixture studies checked: ${studies.length}`);
  console.log(`Audit events found: ${events.length}`);
  console.log("Events grouped by action:");
  for (const [action, count] of Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))) console.log(`- ${action}: ${count}`);
  console.log(`Actor attribution coverage: ${events.every((event) => !!event.payload.actorId) ? "yes" : "no"}`);
  console.log(`Entity linkage coverage: ${events.every((event) => !!event.entityId) ? "yes" : "no"}`);
  console.log(`Lifecycle coverage: ${findings.some((finding) => finding.startsWith("MISSING_REQUIRED_AUDIT_EVENT")) ? "no" : "yes"}`);
  console.log(`Ordering validity: ${findings.some((finding) => finding.startsWith("AUDIT_SEQUENCE_INVALID")) ? "no" : "yes"}`);
  console.log(`Terminal-state validity: ${findings.some((finding) => finding.startsWith("AUDIT_TERMINAL_STATE_MISMATCH")) ? "no" : "yes"}`);
  console.log(`Payload-policy validity: ${findings.some((finding) => finding.startsWith("AUDIT_PAYLOAD_POLICY_VIOLATION")) ? "no" : "yes"}`);
  console.log(`Reconstruction success: ${findings.length ? "no" : "yes"}`);
  if (findings.length) {
    console.log("Validation findings:");
    for (const finding of findings) console.log(`- ${finding}`);
  }
  console.log("");
  console.log("Audit verification:");
  console.log(findings.length ? "fail" : "pass");
}

function terminalActionValid(status: string, actions: Set<string>) {
  if (status === "observation_complete") return actions.has("study_completed");
  if (status === "cancelled") return actions.has("study_cancelled");
  if (status === "invalidated") return actions.has("study_invalidated");
  return true;
}

function sequenceValid(actions: readonly string[]) {
  const index = (action: string) => actions.indexOf(action);
  if (index("prediction_captured") >= 0 && index("study_draft_created") > index("prediction_captured")) return false;
  if (index("observation_started") >= 0 && index("prediction_captured") > index("observation_started")) return false;
  if (index("study_completed") >= 0 && index("observation_started") > index("study_completed")) return false;
  return true;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
