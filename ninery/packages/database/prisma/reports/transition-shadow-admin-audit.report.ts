import { TRANSITION_SHADOW_AUDIT_EVENT_VERSION } from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

async function main() {
  const events = await prisma.platformEvent.findMany({
    where: { entityType: "TransitionShadowAdminAudit" },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }]
  });

  console.log("Transition Extended-Shadow Administration Audit");
  console.log(`Audit event version: ${TRANSITION_SHADOW_AUDIT_EVENT_VERSION}`);
  console.log("");
  if (!events.length) {
    console.log("No transition shadow admin audit events found.");
    return;
  }
  for (const event of events) {
    const payload = event.payload as {
      readonly studyKey?: string;
      readonly evidenceClassification?: string;
      readonly action?: string;
      readonly actorId?: string;
      readonly actorRole?: string;
      readonly capability?: string;
      readonly reason?: string;
      readonly syntheticLabel?: string;
    } | null;
    console.log(payload?.studyKey ?? event.entityId ?? "unknown study");
    console.log(`- classification: ${payload?.evidenceClassification ?? "unknown"}`);
    console.log(`- action: ${payload?.action ?? event.eventType}`);
    console.log(`- actor: ${payload?.actorId ?? "unknown"}${payload?.actorRole ? ` (${payload.actorRole})` : ""}`);
    console.log(`- capability: ${payload?.capability ?? "unknown"}`);
    console.log(`- timestamp: ${event.createdAt.toISOString()}`);
    if (payload?.reason) console.log(`- reason: ${payload.reason}`);
    if (payload?.syntheticLabel) console.log(`- synthetic label: ${payload.syntheticLabel}`);
    console.log("");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
