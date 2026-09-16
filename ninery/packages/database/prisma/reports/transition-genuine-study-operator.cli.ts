import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  PrismaTransitionShadowAdminRepository
} from "./transition-shadow-admin-workflow-fixtures.ts";
import {
  createPrismaFirstGenuineStudyReadinessRepository,
  createPrismaTransitionPredictionContextLoaderRepository
} from "./transition-prediction-context-loader.ts";
import {
  FirstGenuineStudyReadinessService,
  TransitionGenuineOperatorError,
  TransitionGenuineOperatorService,
  TransitionPredictionContextLoaderService,
  resolveTransitionGenuineOperatorActor,
  transitionGenuineOperatorHelpText,
  type TransitionAdjustmentObservation
} from "../../../recommendation-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

const action = process.argv[2] ?? "help";
const args = parseArgs(process.argv.slice(3));

try {
  await run(action, args);
} catch (error) {
  printError(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function run(command: string, options: Record<string, string | boolean>) {
  const repository = new PrismaTransitionShadowAdminRepository(prisma);
  const contextLoader = new TransitionPredictionContextLoaderService(createPrismaTransitionPredictionContextLoaderRepository(prisma, repository));
  const service = new TransitionGenuineOperatorService(repository, { contextLoader });
  const firstStudyReadiness = new FirstGenuineStudyReadinessService(createPrismaFirstGenuineStudyReadinessRepository(prisma, repository));
  if (command === "help") {
    console.log(transitionGenuineOperatorHelpText());
    return;
  }
  if (command === "players") {
    const query = stringArg(options, "query");
    const rows = await prisma.player.findMany({
      where: query ? { OR: [...(isUuid(query) ? [{ id: query }] : []), { firstName: { contains: query, mode: "insensitive" } }, { lastName: { contains: query, mode: "insensitive" } }] } : {},
      select: { id: true, firstName: true, lastName: true, status: true, dnaProfiles: { select: { id: true }, take: 1, orderBy: { generatedAt: "desc" } } },
      take: 20,
      orderBy: [{ updatedAt: "desc" }]
    });
    console.log("Genuine Transition Study Player Lookup");
    for (const row of rows) console.log(`- ${row.id} | ${row.firstName} ${row.lastName} | status=${row.status} | playerDNA=${row.dnaProfiles.length ? "available" : "missing"} | fixture=no`);
    return;
  }
  if (command === "equipment") {
    const query = stringArg(options, "query");
    const rows = await prisma.equipment.findMany({
      where: query ? { OR: [...(isUuid(query) ? [{ id: query }] : []), { manufacturer: { contains: query, mode: "insensitive" } }, { model: { contains: query, mode: "insensitive" } }] } : {},
      include: { variants: { orderBy: [{ lengthInches: "asc" }, { weightOunces: "asc" }] }, dnaProfiles: { where: { status: "active" }, take: 1 } },
      take: 20,
      orderBy: [{ manufacturer: "asc" }, { model: "asc" }]
    });
    console.log("Genuine Transition Study Equipment Lookup");
    for (const row of rows) {
      console.log(`- ${row.id} | ${row.manufacturer} ${row.model} ${row.modelYear ?? ""} | certification=${row.certification} | status=${row.status} | canonicalReadiness=${row.dnaProfiles.length ? "available" : "unknown"}`);
      for (const variant of row.variants) console.log(`  - ${variant.id} | sku=${variant.sku ?? "none"} | ${variant.lengthInches}/${variant.weightOunces} | drop=${variant.dropWeight}`);
    }
    return;
  }
  if (command === "prepare") {
    const input = readJsonArg(options);
    assertKnownKeys(input, intakeKeys(), "intake");
    const prepared = await service.prepareIntake(input, { actorId: actor(options), environment: env(options) });
    printReview(prepared.review);
    console.log("Persistence: none");
    return;
  }
  if (command === "create") {
    const input = readJsonArg(options);
    assertKnownKeys(input, intakeKeys(), "intake");
    const result = await service.createGenuineStudyFromOperatorIntake(input, { actorId: actor(options), environment: env(options), confirmGenuineStudy: hasFlag(options, "confirm-genuine-study"), dryRun: hasFlag(options, "dry-run") });
    printReview(result.review);
    console.log(`Persisted: ${result.persisted ? "yes" : "no"}`);
    if (result.studyId) console.log(`Study ID: ${result.studyId}`);
    return;
  }
  if (command === "first-study-readiness") {
    const inferred = await inferReadinessInput(options);
    const result = await firstStudyReadiness.preflight({
      actor: serviceActor(options),
      studyId: stringArg(options, "study"),
      playerId: inferred.playerId,
      currentEquipmentId: inferred.currentEquipmentId,
      currentVariantId: inferred.currentVariantId,
      proposedEquipmentId: inferred.proposedEquipmentId,
      proposedVariantId: inferred.proposedVariantId
    });
    if (hasFlag(options, "json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printFirstStudyReadiness(result);
    }
    return;
  }
  if (command === "capture-prediction") {
    const result = await service.capturePrediction({
      studyId: required(options, "study"),
      actorId: actor(options),
      compatibilityInput: stringArg(options, "file") ? readJsonArg(options) : undefined,
      predictedAt: dateArg(options, "predicted-at") ?? new Date(),
      confirm: hasFlag(options, "confirm"),
      manualInputOverride: hasFlag(options, "manual-input-override")
    }, { actorId: actor(options), environment: env(options) });
    console.log("Transition v1.1 Prediction Captured");
    console.log(`Input source: ${result.manualInputOverride ? "manual development override" : "assembled from study context"}`);
    console.log(`Score: ${result.score}`);
    console.log(`Band: ${result.band}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Model version: ${result.modelVersion}`);
    console.log(`Input hash: ${result.inputAssembly?.semanticInputHash ?? "manual-input-override"}`);
    console.log(`Prediction hash: ${result.predictionHash ?? "none"}`);
    return;
  }
  if (command === "prediction-input") {
    const result = await contextLoader.assemblePredictionInput({ studyId: required(options, "study"), mode: "diagnostic", assembledAt: dateArg(options, "assembled-at") ?? new Date() });
    const review = contextLoader.reviewAssembly(result);
    console.log("Transition Prediction Input Review");
    console.log(`Ready: ${review.ready ? "yes" : "no"}`);
    console.log(`Semantic input hash: ${review.semanticInputHash ?? "none"}`);
    console.log(`Player DNA: ${review.playerDNA}`);
    console.log(`Current equipment DNA: ${review.currentEquipmentDNA}`);
    console.log(`Proposed equipment DNA: ${review.proposedEquipmentDNA}`);
    console.log(`Familiarity: ${review.familiarity}`);
    printList("blockers", result.blockers.map((item) => `${item.code}: ${item.message}`));
    printList("warnings", result.warnings.map((item) => `${item.code}: ${item.message}`));
    return;
  }
  if (command === "prediction-provenance") {
    const result = await contextLoader.assemblePredictionInput({ studyId: required(options, "study"), mode: "diagnostic", assembledAt: dateArg(options, "assembled-at") ?? new Date() });
    console.log("Transition Prediction Context Provenance");
    if (!result.provenance) {
      console.log("Provenance unavailable.");
      printList("blockers", result.blockers.map((item) => `${item.code}: ${item.message}`));
      return;
    }
    console.log(`Study: ${result.provenance.studyId}`);
    console.log(`Player: ${result.provenance.playerId}`);
    console.log(`Player DNA: ${result.provenance.playerDNAProfileId ?? "missing"} (${result.provenance.playerDNAVersion ?? "unknown"})`);
    console.log(`Current equipment: ${result.provenance.currentEquipmentId} / ${result.provenance.currentEquipmentVariantId ?? "missing"}`);
    console.log(`Proposed equipment: ${result.provenance.proposedEquipmentId} / ${result.provenance.proposedEquipmentVariantId ?? "missing"}`);
    console.log(`Familiarity: ${result.provenance.familiarityLevel ?? "unknown"} (${result.provenance.familiarityConfidence ?? "unknown"})`);
    console.log(`Audit sources: ${result.provenance.sourceAuditEventIds.length}`);
    console.log(`Semantic input hash: ${result.semanticInputHash ?? "none"}`);
    return;
  }
  if (command === "prediction-dry-run") {
    const result = await contextLoader.dryRunPrediction({ studyId: required(options, "study"), mode: "diagnostic", assembledAt: dateArg(options, "predicted-at") ?? new Date() });
    console.log("Transition v1.1 Prediction Dry Run");
    console.log(`Ready: ${result.review.ready ? "yes" : "no"}`);
    console.log(`Would persist: ${result.wouldPersist ? "yes" : "no"}`);
    console.log(`Score: ${result.prediction?.score ?? "none"}`);
    console.log(`Band: ${result.prediction?.band ?? "none"}`);
    console.log(`Status: ${result.prediction?.status ?? "blocked"}`);
    printList("blockers", result.review.blockerCodes);
    printList("warnings", result.review.warningCodes);
    return;
  }
  if (command === "context-diagnostics") {
    const result = await contextLoader.assemblePredictionInput({ studyId: required(options, "study"), mode: "diagnostic", assembledAt: dateArg(options, "assembled-at") ?? new Date() });
    console.log("Transition Context Diagnostics");
    console.log(`Study status: ${result.study?.status ?? "missing"}`);
    console.log(`Player DNA profile: ${result.playerDNA?.profileId ?? "missing"}`);
    console.log(`Current profile ready: ${result.currentEquipmentProfile?.readiness.ready ? "yes" : "no"}`);
    console.log(`Proposed profile ready: ${result.proposedEquipmentProfile?.readiness.ready ? "yes" : "no"}`);
    console.log(`Familiarity: ${result.familiarity?.level ?? "missing"}`);
    console.log(`Semantic input hash: ${result.semanticInputHash ?? "none"}`);
    printList("blockers", result.blockers.map((item) => `${item.code}: ${item.message}`));
    printList("warnings", result.warnings.map((item) => `${item.code}: ${item.message}`));
    return;
  }
  if (command === "context-drift") {
    const result = await contextLoader.evaluateContextDrift(required(options, "study"), dateArg(options, "evaluated-at") ?? new Date());
    console.log("Transition Context Drift");
    console.log(`Drift detected: ${result.driftDetected ? "yes" : "no"}`);
    console.log(`Captured hash: ${result.capturedInputHash ?? "none"}`);
    console.log(`Current hash: ${result.currentSemanticInputHash ?? "none"}`);
    printList("changed areas", result.changedAreas);
    printList("blockers", result.blockers.map((item) => `${item.code}: ${item.message}`));
    printList("warnings", result.warnings.map((item) => `${item.code}: ${item.message}`));
    return;
  }
  if (command === "observation-readiness") {
    const result = await service.observationReadiness(required(options, "study"), !hasFlag(options, "observer-plan-missing"));
    console.log("Genuine Observation Readiness");
    console.log(`ready to begin: ${result.ready ? "yes" : "no"}`);
    printList("blockers", result.blockers);
    printList("warnings", result.warnings);
    return;
  }
  if (command === "start-observation") {
    const result = await service.startObservation(required(options, "study"), actor(options), { confirm: hasFlag(options, "confirm"), startedAt: dateArg(options, "started-at") ?? new Date() }, { actorId: actor(options), environment: env(options) });
    console.log(`Observation window started: ${result.id} | status=${result.status}`);
    return;
  }
  if (command === "add-observation" || command === "correct-observation") {
    const observation = readJsonArg(options) as TransitionAdjustmentObservation;
    assertKnownKeys(observation, observationKeys(), "observation");
    const input = { studyId: required(options, "study"), actorId: actor(options), observation, correctionReason: stringArg(options, "reason") };
    const result = command === "correct-observation" ? await service.correctObservation(input, { actorId: actor(options), environment: env(options) }) : await service.addObservation(input, { actorId: actor(options), environment: env(options) });
    console.log(`Observation recorded: ${result.studyId}`);
    console.log(`Checkpoint: ${result.checkpoint}`);
    console.log(`Observation count: ${result.observationCount}`);
    console.log("Append-only: yes");
    return;
  }
  if (command === "checkpoints") {
    const rows = await service.checkpoints(required(options, "study"));
    console.log("Genuine Study Checkpoints");
    for (const row of rows) console.log(`- ${row.checkpoint}: ${row.status} (${row.observationCount})`);
    return;
  }
  if (command === "completion-review") {
    const result = await service.completionReview(required(options, "study"), stringArg(options, "actor") ?? "transition-operator");
    console.log("Genuine Study Completion Review");
    console.log(`completion eligible: ${result.review.completionEligible ? "yes" : "no"}`);
    console.log(`evidence quality: ${result.evidenceQuality.quality}`);
    console.log(`registry eligible if completed: ${result.registryEligible ? "yes" : "no"}`);
    printList("blockers", result.review.blockers);
    printList("warnings", result.review.warnings);
    return;
  }
  if (command === "complete") {
    const result = await service.completeStudy(required(options, "study"), { actorId: actor(options), confirm: hasFlag(options, "confirm"), completedAt: dateArg(options, "completed-at") ?? new Date(), overrideReason: stringArg(options, "override-reason") }, { actorId: actor(options), environment: env(options) });
    console.log(`Completed: ${result.completed ? "yes" : "no"}`);
    console.log(`Study ID: ${result.studyId}`);
    return;
  }
  if (command === "cancel") {
    const result = await service.cancelStudy({ studyId: required(options, "study"), actorId: actor(options), reason: required(options, "reason"), cancelledAt: new Date() }, { actorId: actor(options), environment: env(options) });
    console.log(`Cancelled: ${result.id} | status=${result.status}`);
    return;
  }
  if (command === "invalidate") {
    const result = await service.invalidateStudy({ studyId: required(options, "study"), actorId: actor(options), reasonCode: required(options, "reason-code") as never, reason: required(options, "reason"), invalidatedAt: new Date() }, { actorId: actor(options), environment: env(options) });
    console.log(`Invalidated: ${result.id} | status=${result.status}`);
    return;
  }
  if (command === "show") {
    const view = await service.showStudy(required(options, "study"), stringArg(options, "actor") ?? "transition-operator");
    console.log(`Study: ${view.study.id}`);
    console.log(`Status: ${view.study.status}`);
    console.log(`Evidence classification: ${view.evidenceClassification}`);
    console.log(`Player: ${view.playerSummary.displayLabel ?? view.playerSummary.playerId}`);
    console.log(`Acknowledgement: ${view.acknowledgementPresent ? "present" : "missing"}`);
    console.log(`Prediction: ${view.predictionSummary ? `${view.predictionSummary.modelVersion} ${view.predictionSummary.score} ${view.predictionSummary.band}` : "missing"}`);
    console.log(`Observation count: ${view.observationSummary.total}`);
    console.log(`Registry eligible: ${view.registryEligible ? "yes" : "no"}`);
    console.log(`Audit events: ${view.auditSummary.eventCount}`);
    return;
  }
  if (command === "list") {
    const rows = await service.listStudies();
    console.log("Genuine Transition Studies");
    for (const row of rows) console.log(`- ${row.id} | ${row.status} | player=${row.playerId} | current=${row.currentEquipmentId} | proposed=${row.proposedEquipmentId}`);
    return;
  }
  if (command === "audit") {
    const events = await service.audit(required(options, "study"));
    console.log("Genuine Study Audit");
    for (const event of events) console.log(`- ${event.createdAt.toISOString()} | ${event.action} | actor=${event.actorId} | capability=${event.capability}${event.reason ? ` | reason=${event.reason}` : ""}`);
    return;
  }
  throw new Error(`Unknown transition genuine-study command: ${command}`);
}

function intakeKeys() {
  return [
    "id", "actorId", "playerId", "observationPeriodKey", "studyPurpose", "currentEquipmentVerification", "proposedEquipmentVerification",
    "familiarityInput", "participationAcknowledgement", "playerDNAProfileId", "playerDNAVersion", "captureOrigin", "internalNote",
    "createdAt", "intendedObservationStartAt", "observerPlan", "outcomeAlreadyKnownBeforePrediction"
  ];
}

function observationKeys() {
  return [
    "version", "checkpoint", "observedAt", "equipmentActuallyUsed", "meaningfulUseOccurred", "observedAdjustmentDemand",
    "swingEffortAdjustment", "timingAdjustment", "barrelControlAdjustment", "balanceFeelAdjustment", "continuedUsingProposedEquipment",
    "returnedToPriorEquipment", "additionalAcclimationNeeded", "observationConfidence", "notes", "source", "directlyWitnessed",
    "sourceReference", "conflictsWithAnotherSource", "sessionContext"
  ];
}

function assertKnownKeys(value: unknown, allowedKeys: readonly string[], label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TransitionGenuineOperatorError("INPUT_VALIDATION_FAILED", `${label} input must be a JSON object.`);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.includes(key));
  if (unknown.length) throw new TransitionGenuineOperatorError("INPUT_VALIDATION_FAILED", `Unknown ${label} field(s): ${unknown.join(", ")}.`);
}

function parseArgs(argv: readonly string[]) {
  const result: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) result[body] = true;
    else result[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return result;
}

function readJsonArg(options: Record<string, string | boolean>) {
  const file = required(options, "file");
  const resolved = existsSync(file) ? file : resolve(process.cwd(), "../..", file);
  return reviveDates(JSON.parse(readFileSync(resolved, "utf8")));
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      /At$|Date$/.test(key) && typeof item === "string" ? new Date(item) : reviveDates(item)
    ]));
  }
  return value;
}

function actor(options: Record<string, string | boolean>) {
  return required(options, "actor");
}

function env(options: Record<string, string | boolean>) {
  return stringArg(options, "env") ?? process.env.NINERY_ENV ?? process.env.NODE_ENV ?? "development";
}

function required(options: Record<string, string | boolean>, key: string) {
  const value = options[key];
  if (typeof value !== "string" || !value.trim()) throw new TransitionGenuineOperatorError("INPUT_VALIDATION_FAILED", `Missing required --${key}.`);
  return value;
}

function stringArg(options: Record<string, string | boolean>, key: string) {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function hasFlag(options: Record<string, string | boolean>, key: string) {
  return options[key] === true;
}

function dateArg(options: Record<string, string | boolean>, key: string) {
  const value = stringArg(options, key);
  return value ? new Date(value) : undefined;
}

function serviceActor(options: Record<string, string | boolean>) {
  return resolveTransitionGenuineOperatorActor(actor(options));
}

async function inferReadinessInput(options: Record<string, string | boolean>) {
  const currentVariantId = stringArg(options, "current-variant") ?? stringArg(options, "currentVariantId");
  const proposedVariantId = stringArg(options, "proposed-variant") ?? stringArg(options, "proposedVariantId");
  const [currentVariant, proposedVariant] = await Promise.all([
    currentVariantId ? prisma.equipmentVariant.findUnique({ where: { id: currentVariantId }, select: { id: true, equipmentId: true } }) : undefined,
    proposedVariantId ? prisma.equipmentVariant.findUnique({ where: { id: proposedVariantId }, select: { id: true, equipmentId: true } }) : undefined
  ]);
  return {
    playerId: stringArg(options, "player"),
    currentVariantId,
    proposedVariantId,
    currentEquipmentId: stringArg(options, "current-equipment") ?? currentVariant?.equipmentId,
    proposedEquipmentId: stringArg(options, "proposed-equipment") ?? proposedVariant?.equipmentId
  };
}

function printFirstStudyReadiness(result: {
  readonly status: string;
  readonly checks: readonly { readonly code: string; readonly status: string; readonly summary: string }[];
  readonly blockers: readonly { readonly code: string; readonly message: string; readonly nextAction: string }[];
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
  readonly observerPlan: { readonly status: string };
  readonly nextAction: { readonly code: string; readonly summary: string; readonly command?: string };
  readonly model: { readonly version: string; readonly mode: string; readonly liveUseAllowed: boolean };
  readonly lifecycle?: { readonly checkpoints: readonly { readonly checkpoint: string; readonly status: string; readonly observationCount: number }[] };
}) {
  console.log("FIRST GENUINE TRANSITION STUDY READINESS");
  console.log("");
  printSection("Player", result.checks, ["player_eligibility", "player_dna_supported", "experience_readiness", "bat_control_readiness", "development_readiness"]);
  printSection("Current Equipment", result.checks, ["current_equipment_identity", "current_variant_identity", "current_equipment_specifications", "current_equipment_dna"]);
  printSection("Proposed Equipment", result.checks, ["proposed_equipment_identity", "proposed_variant_identity", "proposed_equipment_specifications", "proposed_equipment_dna", "equipment_dna_admission"]);
  printSection("Familiarity", result.checks, ["familiarity_availability", "familiarity_confidence"]);
  printSection("Study Operations", result.checks, ["acknowledgement_readiness", "observer_plan_readiness", "duplicate_active_study", "lifecycle_creation_readiness"]);
  printSection("Prediction Context", result.checks, ["context_loader_readiness", "transition_v1_1_input_readiness"]);
  if (result.lifecycle) {
    console.log("Checkpoint Progress");
    console.log("-------------------");
    for (const row of result.lifecycle.checkpoints) console.log(`${row.checkpoint}: ${row.status} (${row.observationCount})`);
    console.log("");
  }
  console.log("Transition Model");
  console.log("----------------");
  console.log(`Version: ${result.model.version}`);
  console.log(`Mode: ${result.model.mode}`);
  console.log(`Live use: ${result.model.liveUseAllowed ? "yes" : "no"}`);
  console.log("");
  printList("Blockers", result.blockers.map((item) => `${item.code}: ${item.message} Next: ${item.nextAction}`));
  printList("Warnings", result.warnings.map((item) => `${item.code}: ${item.message}`));
  console.log("OVERALL STATUS");
  console.log("--------------");
  console.log(result.status);
  console.log("");
  console.log("NEXT ACTION");
  console.log("-----------");
  console.log(`${result.nextAction.code}: ${result.nextAction.summary}`);
  if (result.nextAction.command) console.log(result.nextAction.command);
  console.log("");
  console.log("No writes performed.");
  console.log("No genuine evidence created.");
}

function printSection(title: string, checks: readonly { readonly code: string; readonly status: string; readonly summary: string }[], codes: readonly string[]) {
  console.log(title);
  console.log("-".repeat(title.length));
  for (const code of codes) {
    const row = checks.find((check) => check.code === code);
    if (row) console.log(`${code}: ${row.status} - ${row.summary}`);
  }
  console.log("");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function printReview(review: { readonly readyToCommit: boolean; readonly blockers: readonly string[]; readonly warnings: readonly string[]; readonly familiarity: { readonly level: string; readonly confidence: string }; readonly duplicateActiveStudy: string; readonly prospectiveStudy: string; readonly syntheticFixture: string }) {
  console.log("Transition Genuine Operator Review v1.0");
  console.log("Evidence classification: genuine_internal_observation");
  console.log(`Familiarity: ${review.familiarity.level} (${review.familiarity.confidence})`);
  console.log(`Duplicate active study: ${review.duplicateActiveStudy}`);
  console.log(`Prospective study: ${review.prospectiveStudy}`);
  console.log(`Synthetic fixture: ${review.syntheticFixture}`);
  printList("blockers", review.blockers);
  printList("warnings", review.warnings);
  console.log(`Ready to commit: ${review.readyToCommit ? "yes" : "no"}`);
}

function printList(label: string, rows: readonly string[]) {
  console.log(`${label}:`);
  if (!rows.length) console.log("- none");
  for (const row of rows) console.log(`- ${row}`);
}

function printError(error: unknown) {
  if (error instanceof TransitionGenuineOperatorError) {
    console.error(`${error.code}: ${error.message}`);
    for (const blocker of error.blockers) console.error(`- ${blocker}`);
    return;
  }
  if (error instanceof Error) {
    console.error(error.message);
    if (process.env.DEBUG_TRANSITION_SHADOW === "true") console.error(error.stack);
    return;
  }
  console.error("Unknown transition genuine-study operator error.");
}
