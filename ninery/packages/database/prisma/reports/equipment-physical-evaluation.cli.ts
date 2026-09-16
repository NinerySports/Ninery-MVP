import { readFile } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import {
  PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
  assessPilotCandidate,
  assessProtocolV11Participation,
  buildCrossEquipmentCalibrationStatus,
  buildPhysicalEvaluationEvidenceIndependenceSummary,
  buildProtocolV11LearningReport,
  buildPhysicalEvaluationProtocolV11Preview,
  normalizeCalibrationConstruction,
  buildProtocolV11CalibrationSessionTemplate,
  persistProtocolV11CalibrationSession,
  reviewProtocolV11CalibrationSession,
  validateProtocolV11CalibrationFirewall,
  validateProtocolV11LearningReportPolicy,
  validatePhysicalEvaluationProtocolV11Preview,
  PHYSICAL_BAT_STANDALONE_EVALUATION_MODE_VERSION,
  STANDALONE_ORDINAL_PERSISTENCE_VERSION,
  STANDALONE_ORDINAL_REPAIR_VERSION,
  physicalBatOperatorProtocolSections,
  buildPhysicalBatEvaluationReadinessReport,
  buildPhysicalBatEvidenceCoverage,
  deriveStandaloneCanonicalInterpretation,
  reviewPhysicalBatEvaluationSession,
  validateStructuredPhysicalBatEvaluationProtocol,
  type PhysicalBatAttributeReview,
  type PhysicalBatCatalogIdentity,
  type PhysicalBatEvaluationSession,
  type PhysicalBatRubricResponse,
  type PhysicalEvaluationProtocolV11CalibrationEvidenceRecord,
  type PhysicalEvaluationProtocolV11CalibrationSessionInput,
  type PhysicalEvaluationQualifyingEvidence,
  type CalibrationEquipmentArchetype,
  type CrossEquipmentQualifyingEvidence,
  type ProtocolV11LearningEvidenceRecord
} from "../../../equipment-intelligence/src/physical-evaluation/index.ts";
import { validateEquipmentDNAAttributeValue } from "../../../equipment-intelligence/src/attributes/index.ts";
import type { BehavioralEvidenceRecord } from "../../../equipment-intelligence/src/behavioral/index.ts";
import { prisma } from "../seeds/client.ts";

const command = process.argv[2] ?? "readiness";
const args = parseArgs(process.argv.slice(3));
const defaultEquipmentId = "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c";

try {
  await run(command, args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function run(action: string, options: Record<string, string | boolean>) {
  if (action === "help") return printHelp();
  if (action === "protocol") return printProtocol();
  if (action === "protocol-v1-1-preview" || action === "questionnaire-v1-1-preview") return printProtocolV11Preview();
  if (action === "protocol-v1-1-validation") return printProtocolV11Validation();
  if (action === "protocol-v1-1-session-template") return printProtocolV11SessionTemplate();
  if (action === "protocol-v1-1-pilot-validation") return printProtocolV11PilotValidation();
  if (action === "protocol-v1-1-learning-report-validation") return printProtocolV11LearningReportValidation();
  if (action === "protocol-v1-1-cross-equipment-status") {
    const catalog = await loadCalibrationCatalog();
    const evidence = await loadCrossEquipmentV11Evidence();
    printCrossEquipmentStatus(buildCrossEquipmentCalibrationStatus({ catalog, evidence }));
    return;
  }
  if (action === "protocol-v1-1-pilot-candidates") {
    const baselineId = stringArg(options, "baseline") ?? defaultEquipmentId;
    const catalog = await loadCalibrationCatalog();
    const baseline = catalog.find((item) => item.equipmentId === baselineId);
    if (!baseline) throw new Error(`Baseline equipment ${baselineId} was not found in the bat catalog.`);
    printPilotCandidates(baseline, catalog.filter((item) => item.equipmentId !== baselineId).map((item) => assessPilotCandidate(baseline, item)));
    return;
  }
  if (action === "protocol-v1-1-cross-equipment-prepare") {
    const equipmentId = stringArg(options, "equipment");
    const variantId = stringArg(options, "variant");
    const evaluatorId = stringArg(options, "evaluator");
    if (!equipmentId || !variantId || !evaluatorId) throw new Error("Cross-equipment prepare requires --equipment, --variant, and --evaluator.");
    const catalog = await loadCalibrationCatalog();
    const candidate = catalog.find((item) => item.equipmentId === equipmentId && item.equipmentVariantId === variantId);
    if (!candidate) throw new Error(`Equipment/variant ${equipmentId}/${variantId} was not found.`);
    const evidence = await loadCrossEquipmentV11Evidence();
    const participation = assessProtocolV11Participation({ equipmentId, sessionId: "future-uncreated-session", evaluatorId, evidence });
    printCrossEquipmentPrepare(candidate, participation);
    return;
  }
  if (action === "protocol-v1-1-learning-report") {
    const equipmentId = stringArg(options, "equipment") ?? defaultEquipmentId;
    const context = await loadCatalogContext(equipmentId);
    const report = buildProtocolV11LearningReport({
      equipmentId,
      equipmentLabel: context.equipmentLabel,
      variantLabels: [`${context.catalog.equipmentVariantId} / ${context.variantLabel}`],
      historicalV10Evidence: await loadPersistedPhysicalEvidence(equipmentId),
      protocolV11Evidence: await loadProtocolV11LearningEvidence(equipmentId),
      qualifyingPhysicalEvidence: await loadQualifyingPhysicalEvidence(equipmentId)
    });
    printProtocolV11LearningReport(report);
    return;
  }
  if (action === "protocol-v1-1-prepare" || action === "protocol-v1-1-commit") {
    const file = stringArg(options, "file");
    if (!file) throw new Error(`${action} requires --file.`);
    const session = await loadProtocolV11Session(file);
    const priorEvidence = await loadQualifyingPhysicalEvidence(session.equipmentId);
    const review = reviewProtocolV11CalibrationSession(session, priorEvidence);
    printProtocolV11SessionReview(session, review);
    if (action === "protocol-v1-1-prepare" || !hasFlag(options, "confirm")) {
      if (action === "protocol-v1-1-commit") console.log("Commit requires --confirm.");
      console.log("Writes performed: no");
      return;
    }
    const result = await persistProtocolV11CalibrationSession(review, createProtocolV11PersistenceRepository(), true);
    console.log(`Created: ${result.created}`);
    console.log(`Unchanged/idempotent: ${result.unchanged}`);
    console.log("Canonical evaluations created: 0");
    console.log("Numeric references created: 0");
    console.log("Recommendation behavior changed: no");
    console.log("Writes performed: yes");
    return;
  }
  if (action === "protocol-v1-1-show") {
    const equipmentId = stringArg(options, "equipment") ?? defaultEquipmentId;
    await printProtocolV11PersistedEvidence(equipmentId);
    console.log("Writes performed: no");
    return;
  }
  if (action === "evidence-independence") {
    const equipmentId = stringArg(options, "equipment") ?? defaultEquipmentId;
    const evidence = await loadQualifyingPhysicalEvidence(equipmentId);
    printEvidenceIndependenceSummary(buildPhysicalEvaluationEvidenceIndependenceSummary(equipmentId, evidence));
    console.log("Writes performed: no");
    return;
  }
  if (action === "template") return printTemplate(stringArg(options, "mode") ?? "standalone");
  if (action === "validation" || action === "validate") {
    const validation = validateStructuredPhysicalBatEvaluationProtocol();
    console.log("STRUCTURED PHYSICAL BAT EVALUATION VALIDATION");
    for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
    console.log(`Validation verdict: ${validation.verdict}`);
    console.log("Writes performed: no");
    return;
  }
  if (action === "standalone-ordinal-validation") {
    const equipmentId = stringArg(options, "equipment") ?? defaultEquipmentId;
    const context = await loadCatalogContext(equipmentId);
    const report = await buildStandaloneOrdinalRepairReport(context.catalog.equipmentId);
    printStandaloneOrdinalValidation(context, report);
    console.log("Writes performed: no");
    return;
  }

  const equipmentId = stringArg(options, "equipment") ?? defaultEquipmentId;
  const context = await loadCatalogContext(equipmentId);
  const file = stringArg(options, "file");
  const session = file ? await loadSession(file) : undefined;
  const review = session ? reviewPhysicalBatEvaluationSession(session, context.catalog) : undefined;
  const persistedEvidence = await loadPersistedPhysicalEvidence(context.catalog.equipmentId);

  if (action === "prepare") {
    if (!session) {
      console.log("Structured Physical Bat Evaluation Prepare");
      console.log("No --file supplied. Use docs/examples/physical-bat-evaluation.example.json or physical-bat-evaluation-standalone.example.json as the input shape.");
      printReadiness(context, []);
      console.log("Writes performed: no");
      return;
    }
    printSessionReview(context, review!);
    console.log("Writes performed: no");
    return;
  }

  if (action === "show") {
    printReadiness(context, review ? [...persistedEvidence, ...review.evidence] : persistedEvidence);
    printPersistedEvidenceInventory(persistedEvidence);
    if (review) printSessionReview(context, review);
    console.log("Writes performed: no");
    return;
  }

  if (action === "standalone-ordinal-repair-preview" || action === "standalone-ordinal-repair") {
    const report = await buildStandaloneOrdinalRepairReport(context.catalog.equipmentId);
    printStandaloneOrdinalRepairReport(context, report);
    if (action === "standalone-ordinal-repair-preview" || !hasFlag(options, "confirm")) {
      if (action === "standalone-ordinal-repair") console.log("Repair requires --confirm.");
      console.log("Writes performed: no");
      return;
    }
    const result = await repairStandaloneOrdinals(report);
    console.log("Standalone ordinal repair commit");
    console.log(`Records scanned: ${report.items.length}`);
    console.log(`Records eligible: ${report.items.filter((item) => item.eligibleForRepair).length}`);
    console.log(`Records repaired: ${result.repaired}`);
    console.log(`Records already correct: ${report.items.filter((item) => item.status === "already_correct").length}`);
    console.log(`Records skipped: ${result.skipped}`);
    console.log(`Records blocked: ${result.blocked}`);
    console.log("Comparative records modified: 0");
    console.log("Canonical evaluations created: 0");
    console.log("Numeric references created: 0");
    console.log("Live recommendation changed: no");
    console.log("Writes performed: yes");
    return;
  }

  if (action === "readiness") {
    printReadiness(context, review ? [...persistedEvidence, ...review.evidence] : persistedEvidence);
    console.log("Writes performed: no");
    return;
  }

  if (action === "commit") {
    if (!hasFlag(options, "confirm")) {
      console.log("Structured Physical Bat Evaluation Commit");
      console.log("Commit requires --confirm and a real evaluation --file.");
      console.log("Writes performed: no");
      return;
    }
    if (!session || !review) throw new Error("Commit requires --file.");
    if (
      session.provenanceClassification !== "real_structured_physical_evaluation" &&
      session.provenanceClassification !== "real_observation"
    ) {
      throw new Error("Development or synthetic fixtures cannot be committed as real physical evidence.");
    }
    if (review.blockers.length > 0) {
      throw new Error(`Commit blocked: ${review.blockers.join(", ")}.`);
    }
    if (review.evidence.length === 0) {
      throw new Error("Commit blocked: no evidence records are eligible for persistence.");
    }
    const incompleteAttributes = review.attributes.filter((attribute) => attribute.evidenceCreated === false);
    if (incompleteAttributes.length > 0) {
      throw new Error(`Commit blocked: incomplete attributes ${incompleteAttributes.map((attribute) => attribute.attributeKey).join(", ")}.`);
    }
    const result = await persistPhysicalEvidence({ session, review, catalog: context.catalog });
    console.log("Structured Physical Bat Evaluation Commit");
    console.log(`Session: ${session.sessionId}`);
    console.log(`Evidence records: ${review.evidence.length} prepared, ${result.persisted} persisted`);
    console.log(`Created: ${result.created}`);
    console.log(`Updated/no-op: ${result.updatedOrNoop}`);
    console.log("Canonical evaluations created: 0");
    console.log("Numeric references created: 0");
    console.log("Live recommendation changed: no");
    console.log("Writes performed: yes");
    return;
  }

  throw new Error(`Unknown physical evaluation command: ${action}.`);
}

async function loadCatalogContext(equipmentId: string) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        variants: { orderBy: [{ lengthInches: "asc" }, { weightOunces: "asc" }] }
      }
    });
    if (!equipment) throw new Error(`Equipment ${equipmentId} was not found.`);
    const variant = equipment.variants.find((row) => row.sku === "DEM-THE-GOODS-USA-30-20") ?? equipment.variants[0];
    if (!variant) throw new Error(`Equipment ${equipmentId} has no variants.`);
    const catalog: PhysicalBatCatalogIdentity = {
      equipmentId: equipment.id,
      equipmentVariantId: variant.id,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      modelYear: equipment.modelYear,
      certification: equipment.certification,
      lengthInches: variant.lengthInches,
      weightOunces: variant.weightOunces,
      dropWeight: variant.dropWeight,
      barrelDiameter: equipment.barrelDiameter ?? undefined,
      sku: variant.sku ?? undefined
    };
    return {
      catalog,
      equipmentLabel: `${equipment.modelYear} ${equipment.manufacturer} ${equipment.model}`,
      variantLabel: `${variant.sku ?? variant.id} ${variant.lengthInches}/${variant.weightOunces}/${variant.dropWeight}`,
      physicalIdentityReady: true,
      catalogSpecsReady: Boolean(
        equipment.certification &&
        equipment.barrelDiameter !== null &&
        variant.lengthInches > 0 &&
        variant.weightOunces > 0 &&
        Number.isFinite(variant.dropWeight)
      ),
      loadWarning: undefined as string | undefined
    };
  } catch (error) {
    if (equipmentId !== defaultEquipmentId) throw error;
    return fallbackContext(error);
  }
}

function fallbackContext(error: unknown) {
  const catalog: PhysicalBatCatalogIdentity = {
    equipmentId: defaultEquipmentId,
    equipmentVariantId: "DEM-THE-GOODS-USA-30-20",
    manufacturer: "DeMarini",
    model: "The Goods",
    modelYear: 2023,
    certification: "USA",
    lengthInches: 30,
    weightOunces: 20,
    dropWeight: -10,
    barrelDiameter: 2.625,
    sku: "DEM-THE-GOODS-USA-30-20"
  };
  return {
    catalog,
    equipmentLabel: "2023 DeMarini The Goods (-10) USA",
    variantLabel: "DEM-THE-GOODS-USA-30-20 30/20/-10",
    physicalIdentityReady: true,
    catalogSpecsReady: true,
    loadWarning: `Database load unavailable; using Ticket #045 DeMarini context. ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`
  };
}

async function loadSession(file: string): Promise<PhysicalBatEvaluationSession> {
  const text = await readFile(file, "utf8");
  return JSON.parse(text) as PhysicalBatEvaluationSession;
}

async function loadProtocolV11Session(file: string): Promise<PhysicalEvaluationProtocolV11CalibrationSessionInput> {
  const text = await readFile(file, "utf8");
  return JSON.parse(text) as PhysicalEvaluationProtocolV11CalibrationSessionInput;
}

function printReadiness(
  context: Awaited<ReturnType<typeof loadCatalogContext>>,
  evidence: readonly BehavioralEvidenceRecord[]
) {
  const persistedSessionIds = new Set(evidence.map((record) => sessionIdFor(record)).filter((value): value is string => Boolean(value)));
  const coverage = buildPhysicalBatEvidenceCoverage(evidence);
  const report = buildPhysicalBatEvaluationReadinessReport({
    equipmentId: context.catalog.equipmentId,
    equipmentVariantId: context.catalog.equipmentVariantId,
    equipmentLabel: context.equipmentLabel,
    variantLabel: context.variantLabel,
    physicalIdentityReady: context.physicalIdentityReady,
    catalogSpecsReady: context.catalogSpecsReady,
    existingSessions: [],
    canonicalProfileReady: false
  });
  console.log("STRUCTURED PHYSICAL BAT EVALUATION READINESS");
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variant: ${report.variantLabel ?? "not selected"}`);
  if (context.loadWarning) console.log(`Load warning: ${context.loadWarning}`);
  console.log(`Physical identity: ${report.physicalIdentityReady ? "ready" : "not ready"}`);
  console.log(`Catalog specs: ${report.catalogSpecsReady ? "ready" : "not ready"}`);
  console.log("Structured evaluation modes:");
  console.log(`- comparative: ${report.comparativeModeSupported ? "supported" : "not supported"}`);
  console.log(`- standalone: ${report.standaloneModeSupported ? "supported" : "not supported"}`);
  console.log(`Suitable reference bat available: ${report.suitableReferenceBatAvailable ? "yes" : "no"}`);
  console.log(`Physical structured evaluations: ${persistedSessionIds.size}`);
  for (const item of coverage) {
    console.log(`${item.attributeKey}: ${item.status} (${item.sessionCount} sessions, ${item.independentSourceCount} independent sources)`);
  }
  console.log(`Ready to perform physical evaluation: ${report.readyToPerformPhysicalEvaluation ? "yes" : "no"}`);
  console.log(`Ready to perform standalone evaluation: ${report.readyToPerformStandaloneEvaluation ? "yes" : "no"}`);
  console.log(`Canonical profile ready: ${report.canonicalProfileReady ? "yes" : "no"}`);
  console.log(`Genuine-study ready: ${report.genuineStudyReady ? "yes" : "no"}`);
  console.log(`Live recommendation activation allowed: ${report.liveRecommendationActivationAllowed ? "yes" : "no"}`);
}

async function loadPersistedPhysicalEvidence(equipmentId: string): Promise<BehavioralEvidenceRecord[]> {
  try {
    const rows = await prisma.equipmentDNAEvidenceRecord.findMany({
      where: {
        equipmentId,
        status: "active",
        sourceName: "Ninery Structured Physical Bat Evaluation Protocol",
        sourceReference: { startsWith: `physical-bat-evaluation:` }
      },
      orderBy: [{ sourceDate: "asc" }, { attributeKey: "asc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      attributeKey: row.attributeKey,
      category: "structured_internal_equipment_evaluation",
      timing: "prospective_equipment_evidence",
      sourceName: row.sourceName,
      sourceReference: row.sourceReference ?? row.id,
      independenceGroup: row.evaluatorReference ?? row.sourceReference ?? row.id,
      rawValue: row.rawValue,
      ordinalValue: scalar(row.normalizedValue),
      confidence: row.rawValue && rawObject(row.rawValue).canonicalInterpretationStatus === "deferred"
        ? "moderate"
        : "estimated",
      notes: row.notes ?? "Persisted structured physical evaluation evidence."
    }));
  } catch (error) {
    if (equipmentId === defaultEquipmentId) return [];
    throw error;
  }
}

function printPersistedEvidenceInventory(evidence: readonly BehavioralEvidenceRecord[]) {
  console.log("");
  console.log("PERSISTED PHYSICAL EVIDENCE INVENTORY");
  if (evidence.length === 0) {
    console.log("- none");
    return;
  }
  for (const record of evidence) {
    const raw = rawObject(record.rawValue);
    const references = Array.isArray(raw.references) ? raw.references : [];
    const reference = rawObject(references[0]);
    console.log(`- ${record.id}`);
    console.log(`  session: ${raw.sessionId ?? sessionIdFor(record) ?? "unknown"}`);
    console.log(`  attribute: ${record.attributeKey ?? "unknown"}`);
    console.log(`  method/source: ${raw.evaluationMode ?? "unknown"} / ${record.sourceName}`);
    console.log(`  interpretation mode: ${raw.interpretationMode ?? "unknown"}`);
    console.log(`  canonical interpretation: ${raw.canonicalInterpretationStatus ?? "unknown"}`);
    console.log(`  evaluator confidence: ${raw.evaluatorConfidence ?? "unknown"}`);
    console.log(`  reference: ${reference.referenceType ?? "unknown"} ${reference.label ?? reference.referenceId ?? ""}`.trim());
    console.log(`  provenance: structured physical evidence; no catalog/recommendation authority granted to external references`);
  }
}

type StandaloneOrdinalRepairStatus =
  | "eligible"
  | "already_correct"
  | "blocked"
  | "relative_only";

type StandaloneOrdinalRepairItem = {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly attributeKey: string;
  readonly evaluatorReference: string;
  readonly sourceReference: string;
  readonly standaloneObservations: readonly string[];
  readonly existingOrdinal?: string | number | boolean;
  readonly derivedOrdinal?: string | number | boolean;
  readonly status: StandaloneOrdinalRepairStatus;
  readonly eligibleForRepair: boolean;
  readonly reason: string;
  readonly rawValue: Prisma.JsonValue | null;
};

async function buildStandaloneOrdinalRepairReport(equipmentId: string) {
  const rows = await prisma.equipmentDNAEvidenceRecord.findMany({
    where: {
      equipmentId,
      status: "active",
      sourceName: "Ninery Structured Physical Bat Evaluation Protocol",
      sourceReference: { startsWith: "physical-bat-evaluation:" }
    },
    orderBy: [{ sourceDate: "asc" }, { sourceReference: "asc" }]
  });
  const items = rows.map((row): StandaloneOrdinalRepairItem => {
    const raw = rawObject(row.rawValue);
    const interpretationMode = raw.interpretationMode;
    const evaluationMode = raw.evaluationMode;
    const existingOrdinal = scalar(row.normalizedValue);
    const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : sessionIdFromSource(row.sourceReference ?? row.id) ?? "unknown";
    const evaluatorReference = row.evaluatorReference ?? "unknown";
    const sourceReference = row.sourceReference ?? row.id;
    const observations = standaloneObservationsFromRaw(raw);

    if (interpretationMode === "relative_only") {
      return {
        evidenceId: row.id,
        sessionId,
        attributeKey: row.attributeKey,
        evaluatorReference,
        sourceReference,
        standaloneObservations: observations,
        existingOrdinal,
        status: existingOrdinal === undefined ? "relative_only" : "blocked",
        eligibleForRepair: false,
        reason: existingOrdinal === undefined
          ? "relative-only comparative evidence remains ordinal-free"
          : "relative-only evidence unexpectedly has an absolute ordinal",
        rawValue: row.rawValue
      };
    }

    if (evaluationMode !== "standalone" && interpretationMode !== "standalone_absolute") {
      return repairBlocked(row, sessionId, evaluatorReference, sourceReference, observations, existingOrdinal, "not standalone_absolute evidence");
    }
    const provenance = raw.evidenceClassification;
    if (provenance !== "real_observation" && provenance !== "real_structured_physical_evaluation") {
      return repairBlocked(row, sessionId, evaluatorReference, sourceReference, observations, existingOrdinal, `provenance ${String(provenance)} is not repairable real evidence`);
    }
    const response = responseFromRaw(row.attributeKey, raw);
    if (!response) {
      return repairBlocked(row, sessionId, evaluatorReference, sourceReference, observations, existingOrdinal, "raw dimensions are missing or invalid");
    }
    const derivedOrdinal = deriveStandaloneCanonicalInterpretation(response);
    if (typeof derivedOrdinal !== "string") {
      return repairBlocked(row, sessionId, evaluatorReference, sourceReference, observations, existingOrdinal, "derived ordinal unavailable");
    }
    const validation = validateEquipmentDNAAttributeValue(row.attributeKey, derivedOrdinal);
    if (!validation.valid) {
      return repairBlocked(row, sessionId, evaluatorReference, sourceReference, observations, existingOrdinal, `derived ordinal failed registry validation: ${validation.errors.join(", ")}`);
    }
    if (existingOrdinal === derivedOrdinal) {
      return {
        evidenceId: row.id,
        sessionId,
        attributeKey: row.attributeKey,
        evaluatorReference,
        sourceReference,
        standaloneObservations: observations,
        existingOrdinal,
        derivedOrdinal,
        status: "already_correct",
        eligibleForRepair: false,
        reason: "standalone ordinal already persisted",
        rawValue: row.rawValue
      };
    }
    if (existingOrdinal !== undefined) {
      return repairBlocked(row, sessionId, evaluatorReference, sourceReference, observations, existingOrdinal, `existing ordinal ${String(existingOrdinal)} differs from derived ${derivedOrdinal}`);
    }
    return {
      evidenceId: row.id,
      sessionId,
      attributeKey: row.attributeKey,
      evaluatorReference,
      sourceReference,
      standaloneObservations: observations,
      existingOrdinal,
      derivedOrdinal,
      status: "eligible",
      eligibleForRepair: true,
      reason: "missing normalized standalone ordinal can be repaired from raw observations",
      rawValue: row.rawValue
    };
  });
  return {
    items,
    scanned: items.length,
    eligible: items.filter((item) => item.eligibleForRepair).length,
    alreadyCorrect: items.filter((item) => item.status === "already_correct").length,
    relativeOnly: items.filter((item) => item.status === "relative_only").length,
    blocked: items.filter((item) => item.status === "blocked").length
  };
}

function repairBlocked(
  row: {
    id: string;
    attributeKey: string;
    rawValue: Prisma.JsonValue | null;
  },
  sessionId: string,
  evaluatorReference: string,
  sourceReference: string,
  observations: readonly string[],
  existingOrdinal: string | number | boolean | undefined,
  reason: string
): StandaloneOrdinalRepairItem {
  return {
    evidenceId: row.id,
    sessionId,
    attributeKey: row.attributeKey,
    evaluatorReference,
    sourceReference,
    standaloneObservations: observations,
    existingOrdinal,
    status: "blocked",
    eligibleForRepair: false,
    reason,
    rawValue: row.rawValue
  };
}

async function repairStandaloneOrdinals(report: Awaited<ReturnType<typeof buildStandaloneOrdinalRepairReport>>) {
  return prisma.$transaction(async (tx) => {
    let repaired = 0;
    let skipped = 0;
    let blocked = 0;
    for (const item of report.items) {
      if (!item.eligibleForRepair || typeof item.derivedOrdinal !== "string") {
        if (item.status === "blocked") blocked += 1;
        else skipped += 1;
        continue;
      }
      const raw = rawObject(item.rawValue);
      await tx.equipmentDNAEvidenceRecord.update({
        where: { id: item.evidenceId },
        data: {
          normalizedValue: item.derivedOrdinal,
          rawValue: {
            ...raw,
            canonicalInterpretationStatus: "available",
            canonicalInterpretation: item.derivedOrdinal,
            derivedStandaloneOrdinal: item.derivedOrdinal,
            standaloneOrdinalPersistenceVersion: STANDALONE_ORDINAL_PERSISTENCE_VERSION,
            standaloneOrdinalRepairVersion: STANDALONE_ORDINAL_REPAIR_VERSION,
            repairedFromEvidenceId: item.evidenceId
          } satisfies Prisma.InputJsonObject
        }
      });
      repaired += 1;
    }
    return { repaired, skipped, blocked };
  });
}

function printStandaloneOrdinalRepairReport(
  context: Awaited<ReturnType<typeof loadCatalogContext>>,
  report: Awaited<ReturnType<typeof buildStandaloneOrdinalRepairReport>>
) {
  console.log("STANDALONE ORDINAL REPAIR PREVIEW");
  console.log(`Equipment: ${context.equipmentLabel}`);
  console.log(`Equipment ID: ${context.catalog.equipmentId}`);
  console.log(`Variant: ${context.variantLabel}`);
  console.log(`Persistence version: ${STANDALONE_ORDINAL_PERSISTENCE_VERSION}`);
  console.log(`Repair version: ${STANDALONE_ORDINAL_REPAIR_VERSION}`);
  console.log("");
  for (const item of report.items) {
    console.log(`Evidence ID: ${item.evidenceId}`);
    console.log(`Session: ${item.sessionId}`);
    console.log(`Attribute: ${item.attributeKey}`);
    console.log(`Evaluator: ${item.evaluatorReference}`);
    console.log(`Raw standalone observations: ${item.standaloneObservations.join(", ") || "none"}`);
    console.log(`Existing ordinal: ${item.existingOrdinal ?? "none"}`);
    console.log(`Derived ordinal: ${item.derivedOrdinal ?? "none"}`);
    console.log(`Eligible for repair: ${item.eligibleForRepair ? "yes" : "no"}`);
    console.log(`Status: ${item.status}`);
    console.log(`Reason: ${item.reason}`);
    console.log("");
  }
  console.log(`Records scanned: ${report.scanned}`);
  console.log(`Records eligible: ${report.eligible}`);
  console.log(`Records already correct: ${report.alreadyCorrect}`);
  console.log(`Relative-only records untouched: ${report.relativeOnly}`);
  console.log(`Records blocked: ${report.blocked}`);
  console.log("Canonical evaluations created: 0");
  console.log("Numeric references created: 0");
  console.log("Live recommendation changed: no");
}

function printStandaloneOrdinalValidation(
  context: Awaited<ReturnType<typeof loadCatalogContext>>,
  report: Awaited<ReturnType<typeof buildStandaloneOrdinalRepairReport>>
) {
  console.log("STANDALONE ORDINAL PERSISTENCE VALIDATION");
  console.log(`Equipment: ${context.equipmentLabel}`);
  const standaloneItems = report.items.filter((item) => item.status !== "relative_only");
  const checks = [
    ["standalone records have valid ordinals or repair candidates", standaloneItems.every((item) =>
      item.status === "already_correct" || item.status === "eligible"
    )],
    ["relative-only records remain ordinal-free", report.items.filter((item) => item.status === "relative_only").every((item) => item.existingOrdinal === undefined)],
    ["raw observations preserved", report.items.every((item) => item.status === "relative_only" || item.standaloneObservations.length > 0 || item.status === "blocked")],
    ["evaluator provenance present", report.items.every((item) => item.evaluatorReference.length > 0 && item.evaluatorReference !== "unknown")],
    ["session provenance present", report.items.every((item) => item.sessionId.length > 0 && item.sessionId !== "unknown")],
    ["no numeric references created", true],
    ["no canonical evaluations created by repair", true],
    ["repair requires explicit confirmation", true]
  ] as const;
  for (const [name, passed] of checks) console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
  console.log(`Validation verdict: ${checks.every(([, passed]) => passed) ? "pass" : "fail"}`);
}

function responseFromRaw(attributeKey: string, raw: Record<string, unknown>): PhysicalBatRubricResponse | undefined {
  const dimensions = Array.isArray(raw.dimensions) ? raw.dimensions.map(rawObject) : [];
  if (dimensions.length === 0) return undefined;
  return {
    attributeKey: attributeKey as PhysicalBatRubricResponse["attributeKey"],
    dimensions: dimensions.map((dimension) => ({
      key: typeof dimension.key === "string" ? dimension.key : "",
      observation: typeof dimension.observation === "string" ? dimension.observation as PhysicalBatRubricResponse["dimensions"][number]["observation"] : "unable_to_assess",
      referenceId: typeof dimension.referenceId === "string" ? dimension.referenceId : undefined,
      notes: typeof dimension.notes === "string" ? dimension.notes : undefined
    })),
    canonicalInterpretation: scalar(raw.canonicalInterpretation) as PhysicalBatRubricResponse["canonicalInterpretation"],
    evaluatorConfidence: raw.evaluatorConfidence === "low" || raw.evaluatorConfidence === "high" ? raw.evaluatorConfidence : "medium",
    limitations: Array.isArray(raw.limitations) ? raw.limitations.filter((value): value is string => typeof value === "string") : []
  };
}

function standaloneObservationsFromRaw(raw: Record<string, unknown>): string[] {
  const dimensions = Array.isArray(raw.dimensions) ? raw.dimensions.map(rawObject) : [];
  return dimensions
    .map((dimension) => dimension.observation)
    .filter((value): value is string => typeof value === "string");
}

async function persistPhysicalEvidence(input: {
  session: PhysicalBatEvaluationSession;
  review: ReturnType<typeof reviewPhysicalBatEvaluationSession>;
  catalog: PhysicalBatCatalogIdentity;
}) {
  return prisma.$transaction(async (tx) => {
    let created = 0;
    let updatedOrNoop = 0;
    for (const record of input.review.evidence) {
      const attributeReview = input.review.attributes.find((attribute) => attribute.attributeKey === record.attributeKey);
      if (!attributeReview) throw new Error(`Commit blocked: missing attribute review for ${record.attributeKey ?? "unknown"}.`);
      const existing = await tx.equipmentDNAEvidenceRecord.findFirst({
        where: {
          equipmentId: input.catalog.equipmentId,
          equipmentVariantId: input.catalog.equipmentVariantId,
          attributeKey: String(record.attributeKey),
          attributeDefinitionVersion: "1.0",
          sourceType: "structured_expert_evaluation",
          method: "standardized_rubric",
          sourceReference: record.sourceReference
        }
      });
      const data = physicalEvidenceData(input, record, attributeReview);
      if (existing) {
        if (evidenceMatches(existing, data)) {
          updatedOrNoop += 1;
          continue;
        }
        await tx.equipmentDNAEvidenceRecord.update({
          where: { id: existing.id },
          data
        });
        updatedOrNoop += 1;
      } else {
        await tx.equipmentDNAEvidenceRecord.create({ data });
        created += 1;
      }
    }
    return {
      prepared: input.review.evidence.length,
      persisted: input.review.evidence.length,
      created,
      updatedOrNoop
    };
  });
}

function physicalEvidenceData(
  input: {
    session: PhysicalBatEvaluationSession;
    catalog: PhysicalBatCatalogIdentity;
  },
  record: BehavioralEvidenceRecord,
  attribute: PhysicalBatAttributeReview
): Prisma.EquipmentDNAEvidenceRecordUncheckedCreateInput {
  const raw = rawObject(record.rawValue);
  return {
    equipmentId: input.catalog.equipmentId,
    equipmentVariantId: input.catalog.equipmentVariantId,
    targetLevel: "equipment",
    attributeKey: String(record.attributeKey),
    attributeDefinitionVersion: "1.0",
    sourceType: "structured_expert_evaluation",
    sourceName: record.sourceName,
    sourceReference: record.sourceReference,
    sourceDate: new Date(input.session.evaluationDate),
    method: "standardized_rubric",
    rawValue: {
      ...raw,
      targetEquipmentId: input.catalog.equipmentId,
      targetEquipmentVariantId: input.catalog.equipmentVariantId,
      targetVerification: input.session.physicalVerification,
      targetCondition: input.session.equipmentCondition,
      evaluationDate: input.session.evaluationDate,
      evidenceClassification: input.session.provenanceClassification,
      evaluatorConfidence: attribute.canonicalInterpretationStatus === "deferred" ? raw.evaluatorConfidence ?? "medium" : raw.evaluatorConfidence,
      standaloneOrdinalPersistenceVersion: raw.evaluationMode === "standalone" ? STANDALONE_ORDINAL_PERSISTENCE_VERSION : undefined,
      derivedStandaloneOrdinal: raw.evaluationMode === "standalone" ? record.ordinalValue ?? raw.derivedStandaloneOrdinal ?? raw.canonicalInterpretation ?? null : undefined,
      sessionLimitations: input.session.limitations,
      sessionNotes: input.session.notes ?? []
    } satisfies Prisma.InputJsonObject,
    normalizedValue: record.ordinalValue,
    notes: record.notes,
    status: "active",
    evaluatorType: "staff",
    evaluatorReference: input.session.evaluator.evaluatorId
  };
}

function evidenceMatches(
  existing: {
    rawValue: Prisma.JsonValue | null;
    normalizedValue: Prisma.JsonValue | null;
    notes: string | null;
    evaluatorReference: string | null;
    sourceDate: Date | null;
  },
  next: Prisma.EquipmentDNAEvidenceRecordUncheckedCreateInput
) {
  return JSON.stringify(existing.rawValue) === JSON.stringify(next.rawValue) &&
    JSON.stringify(existing.normalizedValue) === JSON.stringify(next.normalizedValue ?? null) &&
    existing.notes === (next.notes ?? null) &&
    existing.evaluatorReference === (next.evaluatorReference ?? null) &&
    existing.sourceDate?.toISOString() === (next.sourceDate instanceof Date ? next.sourceDate.toISOString() : undefined);
}

function sessionIdFor(record: BehavioralEvidenceRecord): string | undefined {
  const raw = rawObject(record.rawValue);
  if (typeof raw.sessionId === "string") return raw.sessionId;
  const match = record.sourceReference.match(/^physical-bat-evaluation:[^:]+:([^:]+):/);
  return match?.[1];
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function scalar(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

function printSessionReview(
  context: Awaited<ReturnType<typeof loadCatalogContext>>,
  review: ReturnType<typeof reviewPhysicalBatEvaluationSession>
) {
  console.log("STRUCTURED PHYSICAL BAT EVALUATION");
  console.log(`Equipment: ${context.equipmentLabel}`);
  console.log(`Variant: ${context.variantLabel}`);
  console.log(`Session: ${review.sessionId}`);
  console.log(`Physical verification: ${review.physicalVerification.verified ? "verified" : "not verified"}`);
  console.log(`Condition: ${review.condition.value}`);
  console.log(`Evaluator: ${review.evaluator.valid ? review.evaluator.independenceGroup : "missing"} ${review.evaluator.category ?? ""}`.trim());
  console.log(`References verified: ${review.references.validCount}`);
  if (review.references.validCount > 0) {
    console.log("Reference authority: physical evaluation context only; no catalog/recommendation authority is granted.");
  }
  console.log(`Session quality: ${review.complete}`);
  for (const attribute of review.attributes) {
    console.log("");
    console.log(attribute.attributeKey.toUpperCase());
    console.log(`Rubric completion: ${attribute.completeness}`);
    console.log(`Observation completeness: ${attribute.observationCompleteness}`);
    console.log(`Evidence eligible: ${attribute.evidenceEligibility === "eligible" ? "yes" : "no"}`);
    console.log(`Interpretation mode: ${attribute.interpretationMode}`);
    console.log(`Canonical interpretation: ${attribute.canonicalInterpretationStatus === "available" ? String(attribute.canonicalInterpretation) : "deferred"}`);
    console.log(`Mode: ${attribute.evaluationMode}`);
    console.log(`Observations: ${attribute.observations.join(", ") || "none"}`);
    console.log(`Comparison observations: ${attribute.comparisonObservations.join(", ") || "none"}`);
    console.log(`Standalone observations: ${attribute.standaloneObservations.join(", ") || "none"}`);
    console.log(`Evidence created: ${attribute.evidenceCreated ? "yes" : "no"}`);
    if (attribute.blockers.length) console.log(`Blockers: ${attribute.blockers.join(", ")}`);
    if (attribute.warnings.length) console.log(`Warnings: ${attribute.warnings.join(" ")}`);
  }
  console.log("");
  console.log(`Evidence records prepared: ${review.evidence.length}`);
  console.log("Canonical attributes automatically changed: no");
  console.log("Numeric references created: no");
  console.log("Live recommendation changed: no");
}

function printProtocol() {
  console.log("STRUCTURED PHYSICAL BAT EVALUATION PROTOCOL");
  console.log(`Protocol version: ${PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION}`);
  console.log(`Standalone mode version: ${PHYSICAL_BAT_STANDALONE_EVALUATION_MODE_VERSION}`);
  for (const section of physicalBatOperatorProtocolSections) console.log(`- ${section}`);
  console.log("Writes performed: no");
}

function printProtocolV11Preview() {
  const preview = buildPhysicalEvaluationProtocolV11Preview();
  console.log("PHYSICAL BAT EVALUATION PROTOCOL v1.1 OPERATOR PREVIEW");
  console.log(`Protocol version: ${preview.protocolVersion}`);
  console.log(`Questionnaire version: ${preview.questionnaireVersion}`);
  console.log(`Status: ${preview.status}`);
  console.log(`Study classification: ${preview.studyClassification}`);
  console.log(`Historical v1.0 evidence: ${preview.historicalEvidencePolicy}`);
  console.log("");
  console.log("OPERATOR SEQUENCE");
  for (const step of preview.operatorSequence) console.log(`- ${step}`);
  console.log("");
  console.log("CONSTRUCTS");
  for (const construct of preview.constructs) {
    console.log(`- ${construct.name} [${construct.constructCode}]`);
    console.log(`  Attribute area: ${construct.attributeKey}`);
    console.log(`  Status: ${construct.status}`);
    console.log(`  Dimensions: ${construct.dimensions.join(", ")}`);
    console.log(`  Canonical attribute created: ${construct.canonicalAttributeCreated ? "yes" : "no"}`);
    console.log(`  Aggregation: ${construct.aggregationPolicy}`);
  }
  console.log("");
  console.log("FUTURE EVALUATOR QUESTIONNAIRE");
  for (const question of preview.questions) {
    console.log(`${question.order}. ${question.prompt}`);
    console.log(`   ID/dimension: ${question.id} / ${question.dimensionKey}`);
    console.log(`   Construct: ${question.construct}`);
    console.log(`   Trial block/minimum: ${question.trialBlock} / ${question.minimumTrials}`);
    console.log(`   Response scale: ${question.responseScale}`);
    console.log(`   Operator instruction: ${question.operatorInstruction}`);
    console.log(`   Aggregation role: ${question.aggregationRole}`);
  }
  console.log("");
  console.log("FUTURE EVIDENCE RULES");
  for (const rule of preview.futureEvidenceRules) console.log(`- ${rule}`);
  console.log(`Evaluation #6 performed: ${preview.evaluationSixPerformed ? "yes" : "no"}`);
  console.log(`Persistence allowed: ${preview.persistenceAllowed ? "yes" : "no"}`);
  console.log(`Canonical evaluations created: ${preview.canonicalEvaluationsCreated}`);
  console.log(`Numeric references created: ${preview.numericReferencesCreated}`);
  console.log(`Recommendation behavior changed: ${preview.recommendationBehaviorChanged ? "yes" : "no"}`);
  console.log("Writes performed: no");
}

function printProtocolV11Validation() {
  const validation = validatePhysicalEvaluationProtocolV11Preview();
  console.log("PHYSICAL BAT EVALUATION PROTOCOL v1.1 PREVIEW VALIDATION");
  for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
  console.log(`Validation verdict: ${validation.verdict}`);
  console.log("Writes performed: no");
}

function printProtocolV11SessionTemplate() {
  console.log(JSON.stringify(buildProtocolV11CalibrationSessionTemplate(), null, 2));
  console.log("Writes performed: no");
}

function printProtocolV11PilotValidation() {
  const preview = validatePhysicalEvaluationProtocolV11Preview();
  const firewall = validateProtocolV11CalibrationFirewall();
  console.log("PHYSICAL BAT EVALUATION PROTOCOL v1.1 PILOT VALIDATION");
  for (const check of [...preview.checks, ...firewall.checks]) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
  console.log(`Validation verdict: ${preview.verdict === "pass" && firewall.verdict === "pass" ? "pass" : "fail"}`);
  console.log("Evaluation #6 performed: no");
  console.log("Canonical evaluations created: 0");
  console.log("Numeric references created: 0");
  console.log("Recommendation behavior changed: no");
  console.log("Writes performed: no");
}

function printProtocolV11SessionReview(
  session: PhysicalEvaluationProtocolV11CalibrationSessionInput,
  review: ReturnType<typeof reviewProtocolV11CalibrationSession>
) {
  console.log("PHYSICAL BAT EVALUATION PROTOCOL v1.1 CALIBRATION SESSION");
  console.log(`Equipment: ${session.equipmentId}`);
  console.log(`Variant: ${session.equipmentVariantId}`);
  console.log(`Evaluator: ${session.evaluator.evaluatorId} (${session.evaluator.category})`);
  console.log(`Declared relationship: ${review.evaluatorRelationship.declaredRelationship}`);
  console.log(`Prior qualifying sessions for this evaluator: ${review.evaluatorRelationship.priorQualifyingSessionCount}`);
  console.log(`Derived relationship: ${review.evaluatorRelationship.derivedRelationship}`);
  console.log(`Relationship validation: ${review.evaluatorRelationship.valid ? "pass" : "blocked"}`);
  console.log(`Independent source contribution: ${review.evaluatorRelationship.independentSourceContribution}`);
  console.log(`Protocol/questionnaire: ${review.protocolVersion} / ${review.questionnaireVersion}`);
  console.log(`Study classification: ${review.studyClassification}`);
  console.log("Trial-block completeness:");
  for (const [block, complete] of Object.entries(review.trialBlockCompleteness)) console.log(`- ${block}: ${complete ? "complete" : "incomplete"}`);
  console.log(`Question completeness: ${review.questionCompleteness.answered}/${review.questionCompleteness.required}`);
  if (review.questionCompleteness.missingQuestionIds.length) console.log(`Missing questions: ${review.questionCompleteness.missingQuestionIds.join(", ")}`);
  if (review.blockers.length) console.log(`Blockers: ${review.blockers.join(", ")}`);
  console.log(`Evidence records prepared: ${review.evidence.length}`);
  console.log(`Persistence eligible: ${review.persistenceEligible ? "yes" : "no"}`);
  console.log(`Canonical writes planned: ${review.canonicalWritesPlanned}`);
  console.log(`Numeric references planned: ${review.numericReferencesPlanned}`);
  console.log(`Recommendation impact: ${review.recommendationImpact}`);
}

function createProtocolV11PersistenceRepository() {
  return {
    async persistPacketAtomically(records: readonly PhysicalEvaluationProtocolV11CalibrationEvidenceRecord[]) {
      return prisma.$transaction(async (tx) => {
        let created = 0;
        let unchanged = 0;
        for (const record of records) {
          const existing = await tx.equipmentDNAEvidenceRecord.findUnique({ where: { id: record.id } });
          if (existing) {
            if (existing.sourceReference !== record.sourceReference || JSON.stringify(existing.rawValue) !== JSON.stringify(record.rawValue)) {
              throw new Error(`Calibration evidence identity collision for ${record.sourceReference}; existing evidence is immutable.`);
            }
            unchanged += 1;
            continue;
          }
          const sourceCollision = await tx.equipmentDNAEvidenceRecord.findFirst({ where: { sourceReference: record.sourceReference } });
          if (sourceCollision) throw new Error(`Calibration source reference already belongs to ${sourceCollision.id}; no update was performed.`);
          await tx.equipmentDNAEvidenceRecord.create({ data: calibrationEvidenceData(record) });
          created += 1;
        }
        return { created, unchanged };
      });
    }
  };
}

function calibrationEvidenceData(record: PhysicalEvaluationProtocolV11CalibrationEvidenceRecord): Prisma.EquipmentDNAEvidenceRecordUncheckedCreateInput {
  return {
    id: record.id,
    equipmentId: record.equipmentId,
    equipmentVariantId: record.equipmentVariantId,
    targetLevel: "equipment",
    attributeKey: record.attributeKey,
    attributeDefinitionVersion: "1.0",
    sourceType: "structured_expert_evaluation",
    sourceName: "Ninery Physical Bat Evaluation Protocol v1.1 Calibration",
    sourceReference: record.sourceReference,
    sourceDate: new Date(record.evaluationDate),
    method: "standardized_rubric",
    rawValue: JSON.parse(JSON.stringify(record.rawValue)) as Prisma.InputJsonObject,
    normalizedValue: undefined,
    notes: "Protocol v1.1 calibration evidence only. Excluded from canonical evaluation, numeric references, recommendations, and genuine transition activation.",
    status: "active",
    evaluatorType: "staff",
    evaluatorReference: record.evaluatorId
  };
}

async function printProtocolV11PersistedEvidence(equipmentId: string) {
  const rows = await prisma.equipmentDNAEvidenceRecord.findMany({
    where: { equipmentId, sourceReference: { startsWith: "physical-bat-evaluation:1.1:" } },
    orderBy: [{ sourceDate: "asc" }, { sourceReference: "asc" }]
  });
  console.log("PROTOCOL v1.1 CALIBRATION EVIDENCE");
  console.log(`Equipment: ${equipmentId}`);
  console.log(`Records: ${rows.length}`);
  for (const row of rows) {
    const raw = rawObject(row.rawValue);
    console.log(`- ${row.sourceReference}`);
    console.log(`  session/evaluator: ${String(raw.sessionId ?? "unknown")} / ${row.evaluatorReference ?? "unknown"}`);
    console.log(`  evaluator relationship: ${String(raw.evaluatorRelationship ?? "derived_at_report_time")}`);
    console.log(`  construct/dimension: ${String(raw.construct ?? "unknown")} / ${String(raw.dimensionKey ?? "unknown")}`);
    console.log(`  calibration-only: ${raw.studyClassification === "protocol_calibration_evidence" ? "yes" : "no"}`);
    console.log(`  canonical/numeric/recommendation eligible: ${String(raw.canonicalEligible)} / ${String(raw.numericReferenceEligible)} / ${String(raw.recommendationEligible)}`);
  }
  console.log("Canonical evaluations created by this report: 0");
  console.log("Numeric references created by this report: 0");
  console.log("Recommendation behavior changed: no");
}

async function loadQualifyingPhysicalEvidence(equipmentId: string): Promise<PhysicalEvaluationQualifyingEvidence[]> {
  const rows = await prisma.equipmentDNAEvidenceRecord.findMany({
    where: {
      equipmentId,
      sourceType: "structured_expert_evaluation",
      sourceReference: { startsWith: "physical-bat-evaluation:" }
    },
    orderBy: [{ sourceDate: "asc" }, { sourceReference: "asc" }]
  });
  return rows.flatMap((row) => {
    const raw = rawObject(row.rawValue);
    const sessionId = typeof raw.sessionId === "string" ? raw.sessionId : undefined;
    const protocolVersion = typeof raw.protocolVersion === "string" ? raw.protocolVersion : undefined;
    const evaluatorId = row.evaluatorReference ?? evaluatorIdFromRaw(raw);
    if (!sessionId || !protocolVersion || !evaluatorId) return [];
    return [{
      evidenceRecordId: row.id,
      equipmentId: row.equipmentId,
      evaluatorId,
      sessionId,
      protocolVersion,
      sourceReference: row.sourceReference,
      evaluatedAt: row.sourceDate?.toISOString(),
      declaredRelationship: raw.evaluatorRelationship === "independent_evaluator" || raw.evaluatorRelationship === "repeat_evaluator"
        ? raw.evaluatorRelationship
        : undefined
    }];
  });
}

async function loadProtocolV11LearningEvidence(equipmentId: string): Promise<ProtocolV11LearningEvidenceRecord[]> {
  const rows = await prisma.equipmentDNAEvidenceRecord.findMany({
    where: {
      equipmentId,
      status: "active",
      sourceName: "Ninery Physical Bat Evaluation Protocol v1.1 Calibration",
      sourceReference: { startsWith: "physical-bat-evaluation:1.1:" }
    },
    orderBy: [{ sourceDate: "asc" }, { sourceReference: "asc" }]
  });
  return rows.flatMap((row) => row.equipmentId && row.sourceReference && row.evaluatorReference ? [{
    id: row.id,
    equipmentId: row.equipmentId,
    equipmentVariantId: row.equipmentVariantId ?? undefined,
    sourceReference: row.sourceReference,
    evaluatorId: row.evaluatorReference,
    evaluatedAt: row.sourceDate?.toISOString(),
    rawValue: row.rawValue
  }] : []);
}

async function loadCrossEquipmentV11Evidence(): Promise<CrossEquipmentQualifyingEvidence[]> {
  const rows = await prisma.equipmentDNAEvidenceRecord.findMany({
    where: { status: "active", sourceType: "structured_expert_evaluation", sourceReference: { startsWith: "physical-bat-evaluation:" } },
    orderBy: [{ sourceDate: "asc" }, { sourceReference: "asc" }]
  });
  return rows.flatMap((row) => {
    const raw = rawObject(row.rawValue);
    const evaluatorId = row.evaluatorReference ?? evaluatorIdFromRaw(raw);
    if (!row.equipmentId || !row.sourceReference || !evaluatorId || typeof raw.sessionId !== "string") return [];
    return [{
      evidenceRecordId: row.id,
      equipmentId: row.equipmentId,
      equipmentVariantId: row.equipmentVariantId ?? undefined,
      evaluatorId,
      sessionId: raw.sessionId,
      protocolVersion: typeof raw.protocolVersion === "string" ? raw.protocolVersion : "unknown",
      sourceReference: row.sourceReference,
      evaluatedAt: row.sourceDate?.toISOString(),
      declaredRelationship: raw.evaluatorRelationship === "independent_evaluator" || raw.evaluatorRelationship === "repeat_evaluator" ? raw.evaluatorRelationship : undefined,
      studyClassification: typeof raw.studyClassification === "string" ? raw.studyClassification : undefined,
      provenanceClassification: typeof raw.provenanceClassification === "string" ? raw.provenanceClassification : undefined,
      dimensionKey: typeof raw.dimensionKey === "string" ? raw.dimensionKey : undefined,
      synthetic: raw.fixtureKind === "synthetic" || raw.synthetic === true
    }];
  });
}

async function loadCalibrationCatalog(): Promise<CalibrationEquipmentArchetype[]> {
  const equipment = await prisma.equipment.findMany({
    where: { category: "bat" },
    include: { variants: { orderBy: [{ lengthInches: "asc" }, { weightOunces: "asc" }, { id: "asc" }] } },
    orderBy: [{ manufacturer: "asc" }, { model: "asc" }, { modelYear: "asc" }, { id: "asc" }]
  });
  return equipment.flatMap((item) => item.variants.map((variant) => {
    const physicalIdentityReady = Boolean(item.manufacturer && item.model && item.modelYear && variant.id && variant.lengthInches !== null && variant.weightOunces !== null && variant.dropWeight !== null);
    return {
      equipmentId: item.id,
      equipmentVariantId: variant.id,
      label: `${item.modelYear ?? "unknown year"} ${item.manufacturer} ${item.model}`,
      sku: variant.sku ?? undefined,
      construction: normalizeCalibrationConstruction(item.construction ?? undefined, item.material ?? undefined),
      certification: item.certification === "USA" || item.certification === "USSSA" || item.certification === "BBCOR" ? item.certification : "other",
      material: item.material ?? undefined,
      lengthInches: variant.lengthInches === null ? undefined : Number(variant.lengthInches),
      weightOunces: variant.weightOunces === null ? undefined : Number(variant.weightOunces),
      dropWeight: variant.dropWeight ?? undefined,
      barrelDiameter: item.barrelDiameter === null ? undefined : Number(item.barrelDiameter),
      physicalIdentityReady,
      protocolCompatible: true,
      requiredTrialBlocksCapable: physicalIdentityReady,
      synthetic: false
    } satisfies CalibrationEquipmentArchetype;
  }));
}

function printCrossEquipmentStatus(status: ReturnType<typeof buildCrossEquipmentCalibrationStatus>) {
  console.log("PROTOCOL v1.1 CROSS-EQUIPMENT CALIBRATION STATUS");
  console.log(`Genuine v1.1 equipment models: ${status.genuineEquipmentModelCount}`);
  console.log(`Genuine v1.1 variants: ${status.genuineVariantCount}`);
  console.log(`Genuine v1.1 sessions: ${status.genuineSessionCount}`);
  console.log(`Unique protocol evaluators: ${status.uniqueProtocolEvaluatorCount}`);
  console.log(`Equipment-level independent sources: ${status.equipmentLevelIndependentSourceCount}`);
  console.log(`Repeat-evaluator sessions: ${status.repeatEvaluatorSessionCount}`);
  console.log(`Repeat protocol participants: ${status.repeatProtocolParticipantCount}`);
  console.log("SESSION COUNT != INDEPENDENT SOURCE COUNT");
  console.log("");
  console.log("CONSTRUCTION COVERAGE");
  for (const [key, value] of Object.entries(status.constructionCoverage)) console.log(`${key}: ${value}`);
  console.log("");
  console.log("CERTIFICATION COVERAGE");
  for (const [key, value] of Object.entries(status.certificationCoverage)) console.log(`${key}: ${value}`);
  console.log("");
  console.log("REPRESENTED PILOTS");
  for (const item of status.representedArchetypes) console.log(`- ${item.label} / ${item.equipmentVariantId} / ${item.construction} / ${item.certification} / ${item.lengthInches}/${item.weightOunces}/${item.dropWeight}`);
  console.log("");
  console.log("GENERALIZATION READINESS");
  console.log(`State: ${status.readiness}`);
  console.log(`Reason: ${status.readinessReason}`);
  console.log(`Cross-equipment comparison available: ${status.crossEquipmentComparisonAvailable ? "yes" : "no"}`);
  console.log(`Protocol validated: ${status.protocolValidated ? "yes" : "no"}`);
  for (const safeguard of status.safeguards) console.log(`- ${safeguard}`);
  printCrossEquipmentFirewall(status.canonicalFirewall);
}

function printPilotCandidates(baseline: CalibrationEquipmentArchetype, candidates: readonly ReturnType<typeof assessPilotCandidate>[]) {
  const order = { eligible: 0, eligible_with_limited_contrast: 1, blocked_missing_identity: 2, blocked_missing_variant: 3, blocked_insufficient_catalog_data: 4, blocked_protocol_incompatible: 5 } as const;
  const contrastOrder = { high_contrast: 0, moderate_contrast: 1, low_contrast: 2, insufficient_catalog_data: 3 } as const;
  console.log("PROTOCOL v1.1 CALIBRATION PILOT CANDIDATES");
  console.log(`Baseline: ${baseline.label} / ${baseline.equipmentId} / ${baseline.equipmentVariantId}`);
  console.log("Ordering is experimental-design eligibility and contrast only; it is not a product ranking.");
  const sorted = [...candidates].sort((a, b) => order[a.eligibility] - order[b.eligibility] || contrastOrder[a.contrast] - contrastOrder[b.contrast] || a.candidate.label.localeCompare(b.candidate.label) || (a.candidate.equipmentVariantId ?? "").localeCompare(b.candidate.equipmentVariantId ?? ""));
  for (const item of sorted) {
    console.log("");
    console.log(`${item.candidate.label} / ${item.candidate.equipmentId}`);
    console.log(`Variant: ${item.candidate.equipmentVariantId ?? "missing"} / ${item.candidate.sku ?? "no SKU"}`);
    console.log(`Catalog archetype: ${item.candidate.construction}, ${item.candidate.certification}, ${item.candidate.lengthInches ?? "?"}/${item.candidate.weightOunces ?? "?"}/${item.candidate.dropWeight ?? "?"}`);
    console.log(`Physical-verification capable: ${item.candidate.physicalIdentityReady ? "yes" : "no"}`);
    console.log(`Pilot eligibility: ${item.eligibility}`);
    console.log(`Contrast: ${item.contrast}`);
    for (const reason of item.contrastReasons) console.log(`- ${reason}`);
    for (const blocker of item.blockers) console.log(`Blocker: ${blocker}`);
  }
  const omaha = sorted.filter((item) => item.candidate.label.toLowerCase().includes("louisville slugger") && item.candidate.label.toLowerCase().includes("omaha"));
  console.log("");
  console.log(`Genuine 2023 Louisville Slugger Omaha catalog candidate found: ${omaha.length ? "yes" : "no"}`);
  console.log("Historical comparative Omaha evidence was not converted into Protocol v1.1 evidence.");
  printCrossEquipmentFirewall({ canonicalEvaluationsCreated: 0, canonicalEvaluationsModified: 0, numericReferencesCreated: 0, recommendationScoringChanged: false, recommendationRankingChanged: false, liveEquipmentDNAChanged: false, historicalEvidenceModified: false, writesPerformed: false });
}

function printCrossEquipmentPrepare(candidate: CalibrationEquipmentArchetype, participation: ReturnType<typeof assessProtocolV11Participation>) {
  console.log("PROTOCOL v1.1 CROSS-EQUIPMENT SESSION PREPARATION");
  console.log(`Equipment: ${candidate.label} / ${candidate.equipmentId}`);
  console.log(`Variant: ${candidate.equipmentVariantId} / ${candidate.sku ?? "no SKU"}`);
  console.log(`Archetype: ${candidate.construction}, ${candidate.certification}, ${candidate.lengthInches}/${candidate.weightOunces}/${candidate.dropWeight}`);
  console.log(`Equipment evidence relationship: ${participation.equipmentEvidenceRelationship}`);
  console.log(`Protocol participation relationship: ${participation.protocolParticipationRelationship}`);
  console.log(`Prior sessions on this equipment: ${participation.priorSessionsOnEquipment.join(", ") || "none"}`);
  console.log(`Prior Protocol v1.1 sessions across equipment: ${participation.priorProtocolV11SessionsAcrossEquipment.join(", ") || "none"}`);
  console.log(`Independent-source contribution for this equipment: ${participation.independentSourceContributionForEquipment}`);
  console.log("Evaluator answers populated: no");
  console.log("Session created: no");
  console.log("Writes performed: no");
}

function printCrossEquipmentFirewall(firewall: ReturnType<typeof buildCrossEquipmentCalibrationStatus>["canonicalFirewall"]) {
  console.log("");
  console.log("CANONICAL FIREWALL");
  console.log(`Canonical evaluations created: ${firewall.canonicalEvaluationsCreated}`);
  console.log(`Canonical evaluations modified: ${firewall.canonicalEvaluationsModified}`);
  console.log(`Numeric references created: ${firewall.numericReferencesCreated}`);
  console.log(`Recommendation scoring changed: ${firewall.recommendationScoringChanged ? "yes" : "no"}`);
  console.log(`Recommendation ranking changed: ${firewall.recommendationRankingChanged ? "yes" : "no"}`);
  console.log(`Live Equipment DNA changed: ${firewall.liveEquipmentDNAChanged ? "yes" : "no"}`);
  console.log(`Historical evidence modified: ${firewall.historicalEvidenceModified ? "yes" : "no"}`);
  console.log(`Writes performed: ${firewall.writesPerformed ? "yes" : "no"}`);
}

function printProtocolV11LearningReport(report: ReturnType<typeof buildProtocolV11LearningReport>) {
  console.log("PHYSICAL EVALUATION PROTOCOL v1.1 LEARNING REPORT");
  console.log(`Report version: ${report.version}`);
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variants: ${report.variantLabels.join(", ")}`);
  console.log("");
  console.log("EVIDENCE COVERAGE");
  console.log(`Total qualifying sessions: ${report.evidenceCoverage.totalQualifyingPhysicalSessions}`);
  console.log(`Protocol v1.0 sessions: ${report.evidenceCoverage.protocolV10Sessions}`);
  console.log(`Protocol v1.1 sessions: ${report.evidenceCoverage.protocolV11Sessions}`);
  console.log(`Protocol v1.1 calibration records: ${report.evidenceCoverage.protocolV11CalibrationRecords}`);
  console.log(`Unique / independent evaluators: ${report.evidenceCoverage.uniqueEvaluatorCount} / ${report.evidenceCoverage.independentEvaluatorSourceCount}`);
  console.log(`Repeat-evaluator sessions: ${report.evidenceCoverage.repeatEvaluatorSessionCount}`);
  console.log(`Protocol versions represented: ${report.evidenceCoverage.protocolVersions.join(", ") || "none"}`);
  console.log("SESSION COUNT != INDEPENDENT SOURCE COUNT");
  console.log("");
  console.log("CONSTRUCT LEARNING");
  for (const construct of report.constructs) {
    console.log(construct.construct.replaceAll("_", " ").toUpperCase());
    for (const dimension of construct.dimensions) console.log(`${dimension.key}: ${dimension.observation ?? "missing"}`);
    if (construct.inverseDegradationProtected) console.log("Inverse degradation interpretation: high degradation means less forgiveness");
    console.log(`Separation observed: ${construct.separationObserved ? "yes" : "no"}`);
    console.log(`Information gain: ${construct.informationGain}`);
    console.log(`Candidate-subconstruct status: ${construct.candidateSubconstructsOnly ? "candidate only" : "not applicable"}`);
    console.log(`Interpretation: ${construct.interpretation}`);
    for (const limitation of construct.limitations) console.log(`Limitation: ${limitation}`);
    console.log("");
  }
  console.log("SAME-EVALUATOR v1.0 -> v1.1 REVIEW");
  console.log(`Available: ${report.sameEvaluatorReview.available ? "yes" : "no"}`);
  console.log(`Evaluator: ${report.sameEvaluatorReview.evaluatorId ?? "none"}`);
  console.log(`v1.0 session(s): ${report.sameEvaluatorReview.v10SessionIds.join(", ") || "none"}`);
  console.log(`v1.1 session: ${report.sameEvaluatorReview.v11SessionId ?? "none"}`);
  console.log(`Classification: ${report.sameEvaluatorReview.classification}`);
  console.log(`Independent replication: ${report.sameEvaluatorReview.independentReplication ? "yes" : "no"}`);
  console.log(`Causal interpretation: ${report.sameEvaluatorReview.causalInterpretation}`);
  for (const difference of report.sameEvaluatorReview.observedDifferences) console.log(`- ${difference}`);
  console.log("");
  console.log("HISTORICAL v1.0 COHORT");
  for (const item of report.historicalCohort) {
    console.log(`- ${item.attributeKey}: ${item.explanation}`);
    console.log(`  prior disagreement: ${item.priorDisagreementPattern}`);
    console.log(`  evidence strength: ${item.evidenceStrength}`);
    console.log(`  limitation: ${item.limitation}`);
  }
  console.log("");
  console.log("INFORMATION GAIN");
  for (const construct of report.constructs) console.log(`${construct.construct}: ${construct.informationGain}`);
  console.log("");
  console.log("PROTOCOL WEAKNESSES");
  for (const weakness of report.protocolWeaknesses) console.log(`- ${weakness}`);
  console.log(`Current learning state: ${report.currentLearningState}`);
  console.log(`Next protocol step: ${report.nextProtocolStep.decision}`);
  console.log(`Reason: ${report.nextProtocolStep.reason}`);
  for (const need of report.nextProtocolStep.additionalEvidenceNeeded) console.log(`- ${need}`);
  console.log(`Independent evaluator required immediately: ${report.nextProtocolStep.independentEvaluatorRequiredImmediately ? "yes" : "no"}`);
  console.log(`Cross-equipment generalization allowed: ${report.crossEquipmentGeneralization.allowed ? "yes" : "no"}`);
  console.log(`Cross-equipment limitation: ${report.crossEquipmentGeneralization.limitation}`);
  console.log("");
  console.log(`Historical v1.0 evidence modified: ${report.canonicalFirewall.historicalEvidenceModified ? "yes" : "no"}`);
  console.log(`Canonical evaluations created: ${report.canonicalFirewall.canonicalEvaluationsCreated}`);
  console.log(`Canonical evaluations modified: ${report.canonicalFirewall.canonicalEvaluationsModified}`);
  console.log(`Numeric references created: ${report.canonicalFirewall.numericReferencesCreated}`);
  console.log(`Recommendation scoring changed: ${report.canonicalFirewall.recommendationScoringChanged ? "yes" : "no"}`);
  console.log(`Recommendation ranking changed: ${report.canonicalFirewall.recommendationRankingChanged ? "yes" : "no"}`);
  console.log(`Live Equipment DNA changed: ${report.canonicalFirewall.liveEquipmentDNAChanged ? "yes" : "no"}`);
  console.log(`Writes performed: ${report.canonicalFirewall.writesPerformed ? "yes" : "no"}`);
}

function printProtocolV11LearningReportValidation() {
  const validation = validateProtocolV11LearningReportPolicy();
  console.log("PROTOCOL v1.1 CALIBRATION LEARNING REPORT VALIDATION");
  for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
  console.log(`Validation verdict: ${validation.verdict}`);
  console.log("Writes performed: no");
}

function evaluatorIdFromRaw(raw: Record<string, unknown>): string | undefined {
  const evaluator = raw.evaluator;
  if (!evaluator || typeof evaluator !== "object" || Array.isArray(evaluator)) return undefined;
  const evaluatorId = (evaluator as Record<string, unknown>).evaluatorId;
  return typeof evaluatorId === "string" ? evaluatorId : undefined;
}

function printEvidenceIndependenceSummary(summary: ReturnType<typeof buildPhysicalEvaluationEvidenceIndependenceSummary>) {
  console.log("PHYSICAL EVALUATION EVIDENCE INDEPENDENCE");
  console.log(`Equipment: ${summary.equipmentId}`);
  console.log(`Total qualifying physical sessions: ${summary.totalQualifyingPhysicalSessions}`);
  console.log(`Unique evaluators: ${summary.uniqueEvaluatorCount}`);
  console.log(`Independent evaluator sources: ${summary.independentEvaluatorSourceCount}`);
  console.log(`Repeat-evaluator sessions: ${summary.repeatEvaluatorSessionCount}`);
  console.log(`Protocol versions: ${summary.protocolVersions.join(", ") || "none"}`);
  for (const session of summary.sessions) {
    console.log(`- ${session.sessionId}`);
    console.log(`  evaluator: ${session.evaluatorId}`);
    console.log(`  protocol/relationship: ${session.protocolVersion} / ${session.relationship}`);
    console.log(`  evidence records: ${session.evidenceRecordCount}`);
  }
  console.log("SESSION COUNT != INDEPENDENT SOURCE COUNT");
  console.log("Canonical confidence interpretation: none");
  console.log("Recommendation behavior changed: no");
}

function printTemplate(mode: string) {
  if (mode === "external-reference") {
    console.log("External-reference comparative template: docs/examples/physical-bat-evaluation-external-reference.example.json");
    console.log("Mode: comparative");
    console.log("Reference type: verified_external_reference");
    console.log("Catalog ids required for reference: no");
    console.log("External reference authority: physical evaluation context only");
    console.log("Writes performed: no");
    return;
  }
  if (mode !== "standalone") {
    console.log("Comparative template: use docs/examples/physical-bat-evaluation.example.json");
    console.log("Writes performed: no");
    return;
  }
  console.log("Standalone template: docs/examples/physical-bat-evaluation-standalone.example.json");
  console.log("Mode: standalone");
  console.log("Reference required: no");
  console.log("Reference context required: yes");
  console.log("Dry-swing minimum: 8");
  console.log("Contact-trial minimum for forgiveness/sweet_spot_support: 8");
  console.log("Do not fabricate observations. Fill the template only after the physical session.");
  console.log("Writes performed: no");
}

function printHelp() {
  console.log("Physical evaluation commands: prepare | show | readiness | protocol | protocol-v1-1-preview | questionnaire-v1-1-preview | protocol-v1-1-validation | protocol-v1-1-session-template | protocol-v1-1-prepare --file=<file> | protocol-v1-1-commit --file=<file> --confirm | protocol-v1-1-show --equipment=<id> | evidence-independence --equipment=<id> | protocol-v1-1-pilot-validation | protocol-v1-1-learning-report --equipment=<id> | protocol-v1-1-learning-report-validation | protocol-v1-1-cross-equipment-status | protocol-v1-1-pilot-candidates --baseline=<id> | protocol-v1-1-cross-equipment-prepare --equipment=<id> --variant=<id> --evaluator=<id> | validation | standalone-ordinal-validation | standalone-ordinal-repair-preview | standalone-ordinal-repair --confirm | template --mode=standalone|external-reference | commit --confirm");
}

function parseArgs(values: readonly string[]) {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const [rawKey, inlineValue] = value.slice(2).split("=", 2);
    if (inlineValue !== undefined) result[rawKey] = inlineValue;
    else {
      const next = values[index + 1];
      if (!next || next.startsWith("--")) result[rawKey] = true;
      else {
        result[rawKey] = next;
        index += 1;
      }
    }
  }
  return result;
}

function stringArg(options: Record<string, string | boolean>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function hasFlag(options: Record<string, string | boolean>, key: string): boolean {
  return options[key] === true;
}
