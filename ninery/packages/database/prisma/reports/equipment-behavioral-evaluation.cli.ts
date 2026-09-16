import { Prisma } from "@prisma/client";
import {
  analyzeCanonicalReferenceAnchorStrategy,
  analyzePhysicalEvaluationConflicts,
  analyzePhysicalEvaluationProtocolCalibration,
  buildCanonicalOrdinalPromotionPreview,
  buildPhysicalEvaluationAdjudicationPlan,
  buildCanonicalReferenceAnchorInventory,
  evaluateRealWorldBehavioralEquipmentDNA,
  requiredBehavioralEquipmentDNAAttributes,
  synthesizeStandaloneAbsoluteEvidence,
  synthesizeComparativeBehavioralEvidence,
  validateCanonicalReferenceAnchorPolicy,
  validateComparativeEvidenceSynthesisPolicy,
  validatePhysicalEvaluationConflictAdjudicationPolicy,
  validatePhysicalEvaluationProtocolCalibrationPolicy,
  validateStandaloneAbsoluteEvidencePolicy,
  CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION,
  type BehavioralEvidenceRecord,
  type CanonicalOrdinalPromotionPreview,
  type CanonicalReferenceAnchorStrategyReport
} from "../../../equipment-intelligence/src/behavioral/index.ts";
import {
  CanonicalEquipmentDNAProfileLoader,
  scalarCanonicalValue,
  type CanonicalEquipmentDNAProfileLoaderRepository
} from "../../../equipment-intelligence/src/index.ts";
import { prisma } from "../seeds/client.ts";

const command = process.argv[2] ?? "prepare";
const args = parseArgs(process.argv.slice(3));
const defaultEquipmentId = "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c";
const demoAnchorTargets = [
  { manufacturer: "Rawlings", model: "ICON", modelYear: 2026, selectedSku: "RAW-ICON-USA-30-22" },
  { manufacturer: "Louisville Slugger", model: "Atlas", modelYear: 2026, selectedSku: "LS-ATLAS-USA-30-22" },
  { manufacturer: "Easton", model: "Hype Fire", modelYear: 2026, selectedSku: "EAS-HYPE-USA-30-22" }
] as const;
const deterministicReportDate = new Date("2026-08-21T00:00:00.000Z");

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
  const equipmentId = stringArg(options, "equipment") ?? defaultEquipmentId;
  if (action === "commit") {
    if (!hasFlag(options, "confirm")) {
      console.log("Real-World Equipment Behavioral Evaluation");
      console.log("Commit requires --confirm.");
      console.log("Writes performed: no");
      return;
    }
    const context = await loadContext(equipmentId);
    const report = evaluateRealWorldBehavioralEquipmentDNA(context);
    printReport(report, { includeEvidence: true, validationOnly: false });
    console.log("Commit result: no supported behavioral evaluations to persist.");
    console.log("Writes performed: no");
    return;
  }
  if (action === "synthesis") {
    const context = await loadContext(equipmentId);
    const synthesis = synthesizeComparativeBehavioralEvidence(context);
    printSynthesisReport(synthesis);
    console.log("Writes performed: no");
    return;
  }
  if (action === "synthesis-validation") {
    const validation = validateComparativeEvidenceSynthesisPolicy();
    console.log("REAL-WORLD BEHAVIORAL EVIDENCE SYNTHESIS VALIDATION");
    for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
    console.log(`Validation verdict: ${validation.verdict}`);
    console.log("Writes performed: no");
    return;
  }
  if (action === "anchor-readiness") {
    const context = await loadContext(equipmentId);
    const synthesis = synthesizeComparativeBehavioralEvidence(context);
    const inventory = await loadDemoAnchorInventory();
    const strategy = analyzeCanonicalReferenceAnchorStrategy({
      synthesis,
      candidateAnchors: inventory.reviews,
      evidence: context.evidence
    });
    printAnchorReadinessReport(strategy);
    console.log("Writes performed: no");
    return;
  }
  if (action === "anchor-inventory") {
    const inventory = await loadDemoAnchorInventory();
    printAnchorInventoryReport(inventory);
    console.log("Writes performed: no");
    return;
  }
  if (action === "anchor-validation") {
    const validation = validateCanonicalReferenceAnchorPolicy();
    console.log("CANONICAL REFERENCE ANCHOR POLICY VALIDATION");
    for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
    console.log(`Validation verdict: ${validation.verdict}`);
    console.log("Writes performed: no");
    return;
  }
  if (action === "standalone-synthesis") {
    const context = await loadContext(equipmentId);
    if (context.loadWarning) console.log(`Evidence load warning: ${context.loadWarning}`);
    const comparative = synthesizeComparativeBehavioralEvidence(context);
    const standalone = synthesizeStandaloneAbsoluteEvidence({
      equipmentId: context.equipmentId,
      equipmentLabel: context.equipmentLabel,
      variantLabel: context.variantLabel,
      evidence: context.evidence,
      comparativeAttributes: comparative.attributes
    });
    printStandaloneSynthesisReport(standalone);
    console.log("Writes performed: no");
    return;
  }
  if (action === "canonical-preview") {
    const preview = await loadCanonicalPromotionPreview(equipmentId);
    printCanonicalPromotionPreview(preview);
    console.log("Writes performed: no");
    return;
  }
  if (action === "canonical-validation") {
    const validation = validateStandaloneAbsoluteEvidencePolicy();
    console.log("STANDALONE ABSOLUTE CANONICAL PROMOTION VALIDATION");
    for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
    console.log(`Validation verdict: ${validation.verdict}`);
    console.log("Writes performed: no");
    return;
  }
  if (action === "conflict-analysis" || action === "adjudication-plan" || action === "adjudication-validation") {
    if (action === "adjudication-validation") {
      const validation = validatePhysicalEvaluationConflictAdjudicationPolicy();
      console.log("PHYSICAL EVALUATION CONFLICT ADJUDICATION VALIDATION");
      for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
      console.log(`Validation verdict: ${validation.verdict}`);
      console.log("Writes performed: no");
      return;
    }
    const context = await loadContext(equipmentId);
    const comparative = synthesizeComparativeBehavioralEvidence(context);
    const standalone = synthesizeStandaloneAbsoluteEvidence({
      equipmentId: context.equipmentId,
      equipmentLabel: context.equipmentLabel,
      variantLabel: context.variantLabel,
      evidence: context.evidence,
      comparativeAttributes: comparative.attributes
    });
    const conflict = analyzePhysicalEvaluationConflicts({
      equipmentId: context.equipmentId,
      equipmentLabel: context.equipmentLabel,
      variantLabel: context.variantLabel,
      evidence: context.evidence,
      standaloneAttributes: standalone.attributes,
      comparativeAttributes: comparative.attributes
    });
    if (action === "conflict-analysis") {
      printConflictAnalysisReport(conflict);
      console.log("Writes performed: no");
      return;
    }
    printAdjudicationPlan(buildPhysicalEvaluationAdjudicationPlan(conflict));
    console.log("Writes performed: no");
    return;
  }
  if (["protocol-calibration", "construct-analysis", "pilot-learning-report", "protocol-calibration-validation"].includes(action)) {
    if (action === "protocol-calibration-validation") {
      const validation = validatePhysicalEvaluationProtocolCalibrationPolicy();
      console.log("PHYSICAL EVALUATION PROTOCOL CALIBRATION VALIDATION");
      for (const check of validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
      console.log(`Validation verdict: ${validation.verdict}`);
      console.log("Writes performed: no");
      return;
    }
    const context = await loadContext(equipmentId);
    if (context.loadWarning) console.log(`Evidence load warning: ${context.loadWarning}`);
    const comparative = synthesizeComparativeBehavioralEvidence(context);
    const calibration = analyzePhysicalEvaluationProtocolCalibration({
      equipmentId: context.equipmentId,
      equipmentLabel: context.equipmentLabel,
      variantLabel: context.variantLabel,
      evidence: context.evidence,
      comparativeAttributes: comparative.attributes
    });
    printProtocolCalibrationReport(calibration, action === "pilot-learning-report");
    console.log("Writes performed: no");
    return;
  }
  if (action === "canonical-commit") {
    const preview = await loadCanonicalPromotionPreview(equipmentId);
    printCanonicalPromotionPreview(preview);
    if (!hasFlag(options, "confirm")) {
      console.log("Commit requires --confirm.");
      console.log("Writes performed: no");
      return;
    }
    const result = await persistCanonicalOrdinalPromotions(preview);
    console.log("CANONICAL ORDINAL PROMOTION COMMIT");
    console.log(`Created: ${result.created}`);
    console.log(`Updated/no-op: ${result.updatedOrNoop}`);
    console.log(`Blocked: ${result.blocked}`);
    console.log("Numeric references created: 0");
    console.log("Live recommendation changed: no");
    console.log("Writes performed: yes");
    return;
  }
  if (["prepare", "evidence", "validate", "readiness"].includes(action)) {
    const context = await loadContext(equipmentId);
    const report = evaluateRealWorldBehavioralEquipmentDNA(context);
    printReport(report, { includeEvidence: action === "evidence", validationOnly: action === "validate" });
    console.log("Writes performed: no");
    return;
  }
  throw new Error(`Unknown behavioral evaluation command: ${action}.`);
}

function printConflictAnalysisReport(
  report: ReturnType<typeof analyzePhysicalEvaluationConflicts>
) {
  console.log("PHYSICAL EVALUATION CONFLICT ANALYSIS");
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variant: ${report.variantLabel ?? "not selected"}`);
  console.log(`Policy version: ${report.policyVersion}`);
  console.log(`Qualifying evaluators: ${report.qualifyingEvaluatorCount}`);
  console.log(`Physical sessions: ${report.physicalSessionCount}`);
  console.log(`Evidence records: ${report.evidenceCount}`);
  console.log("");
  console.log("Blinding policy:");
  console.log(`- prior ordinals: ${report.blindingPolicy.priorEvaluatorCanonicalInterpretations}`);
  console.log(`- prior raw observations: ${report.blindingPolicy.priorEvaluatorRawObservations}`);
  console.log(`- comparative synthesis: ${report.blindingPolicy.comparativeSynthesisResult}`);
  console.log(`- current candidate: ${report.blindingPolicy.currentCanonicalCandidate}`);
  console.log("");
  for (const attribute of report.attributes) {
    console.log(`ATTRIBUTE: ${attribute.attributeKey}`);
    console.log(`Current synthesis: ${attribute.currentSynthesis?.classification ?? "none"} / ${attribute.currentSynthesis?.synthesisStatus ?? "none"}`);
    console.log(`Observed ordinals: ${attribute.observedOrdinals.join(", ") || "none"}`);
    console.log(`Ordinal spread: ${attribute.ordinalSpread ?? "none"}`);
    console.log(`Conflict severity: ${attribute.conflictSeverity}`);
    console.log(`Classifications: ${attribute.conflictClassifications.join(", ") || "none"}`);
    console.log(`Comparative corroboration: ${attribute.comparativeCorroboration?.summary ?? "not available"}`);
    if (attribute.comparativeCorroboration) console.log("Comparative role: corroborating only; non-dispositive");
    console.log(`Adjudication status: ${attribute.adjudicationStatus}`);
    console.log(`Target dimensions: ${attribute.targetDimensions.join(", ") || "none"}`);
    console.log(`Stable dimensions: ${attribute.stableDimensions.join(", ") || "none"}`);
    console.log(`Resolution candidate: ${attribute.resolutionCandidate ?? "none"}`);
    console.log(`Canonical promotion status: ${attribute.canonicalPromotionStatus}`);
    console.log("Dimension analysis:");
    for (const dimension of attribute.dimensionAnalysis) {
      console.log(`- ${dimension.dimensionKey}: ${dimension.conflictSeverity}; ${dimension.normalizedValues.join(", ") || "none"}`);
      for (const observation of dimension.observations) {
        console.log(`  ${observation.evaluatorId}/${observation.sessionId}: ${observation.rawObservation} -> ${observation.normalizedConstructValue}${observation.inverseSemanticsApplied ? " (inverse)" : ""}`);
      }
    }
    if (attribute.nextEvidence) {
      console.log(`Recommended next evidence: ${attribute.nextEvidence.recommendedEvaluationMode}`);
      console.log(`Reason: ${attribute.nextEvidence.reason}`);
      console.log(`Minimum trials: dry=${attribute.nextEvidence.minimumTrials.drySwingTrialCount}, contact=${attribute.nextEvidence.minimumTrials.contactTrialCount}, alternation=${attribute.nextEvidence.minimumTrials.referenceAlternationCount}`);
      console.log(`Reference use: ${attribute.nextEvidence.referenceUse}`);
      console.log(`Canonical promotion after collection: ${attribute.nextEvidence.canonicalPromotionAllowedAfterCollection ? "yes" : "no"}`);
    }
    console.log("");
  }
  console.log(`Canonical evaluations created: ${report.canonicalEvaluationsCreated}`);
  console.log(`Numeric references created: ${report.numericReferencesCreated}`);
  console.log(`Live recommendation activation allowed: ${report.liveRecommendationActivationAllowed ? "yes" : "no"}`);
}

function printProtocolCalibrationReport(
  report: ReturnType<typeof analyzePhysicalEvaluationProtocolCalibration>,
  pilotLearning: boolean
) {
  console.log(pilotLearning ? "PHYSICAL EVALUATION PILOT LEARNING REPORT" : "PHYSICAL EVALUATION PROTOCOL CALIBRATION");
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variant: ${report.variantLabel ?? "not selected"}`);
  console.log(`Versions: calibration=${report.version}, construct=${report.constructAnalysisVersion}, stop-policy=${report.stopPolicyVersion}`);
  console.log(`Qualifying evaluators: ${report.qualifyingEvaluatorCount}`);
  console.log(`Physical sessions: ${report.physicalSessionCount}`);
  console.log(`Evidence records: ${report.evidenceCount}`);
  console.log("");
  for (const attribute of report.attributes) {
    console.log(`ATTRIBUTE: ${attribute.attributeKey}`);
    console.log(`Construct coherence: ${attribute.constructCoherence}`);
    console.log(`Disagreement type: ${attribute.disagreementType}`);
    console.log(`Cross-dimension divergence: ${attribute.crossDimensionDivergence ? "yes" : "no"}`);
    console.log(`Comparative role: ${attribute.comparativeEvidenceRole}`);
    console.log(`Collection decision: ${attribute.collectionDecision}`);
    console.log(`Evaluation #6 recommended: ${attribute.evaluationSixRecommended ? "yes" : "no"}`);
    for (const dimension of attribute.dimensions) {
      console.log(`- ${dimension.dimensionKey}: mode=${dimension.modalOrdinal ?? "none"} ${dimension.modalSupportCount}/${dimension.observationCount} (${dimension.modalSupportPercentage}%); adjacent=${dimension.adjacentSupportPercentage}%; spread=${dimension.dimensionSpread ?? "none"}${dimension.inverseDimensionHandling ? "; inverse" : ""}`);
      console.log(`  distribution: ${dimension.ordinalDistribution.map((item) => `${item.ordinal}=${item.count}`).join(", ") || "none"}`);
      for (const outlier of dimension.possibleOutliers) console.log(`  possible_outlier_observation: ${outlier.evaluatorId}/${outlier.sessionId} ${outlier.observation}; mode=${outlier.modalObservation}; distance=${outlier.ordinalDistanceFromMode}; diagnostic only`);
    }
    console.log("Findings:");
    for (const finding of attribute.findings) console.log(`- ${finding}`);
    console.log("Protocol recommendations:");
    for (const recommendation of attribute.recommendations) console.log(`- ${recommendation.type}: ${recommendation.rationale}`);
    console.log("");
  }
  console.log(`Overall stop/continue decision: ${report.overallCollectionDecision}`);
  console.log(`Historical evidence changed: ${report.historicalEvidenceChanged ? "yes" : "no"}`);
  console.log(`Canonical evaluations created: ${report.canonicalEvaluationsCreated}`);
  console.log(`Numeric references created: ${report.numericReferencesCreated}`);
  console.log(`Recommendation behavior changed: ${report.recommendationBehaviorChanged ? "yes" : "no"}`);
}

function printAdjudicationPlan(
  plan: ReturnType<typeof buildPhysicalEvaluationAdjudicationPlan>
) {
  console.log("PHYSICAL EVALUATION ADJUDICATION PLAN");
  console.log(`Equipment: ${plan.equipmentLabel}`);
  console.log(`Equipment ID: ${plan.equipmentId}`);
  console.log(`Variant: ${plan.variantLabel ?? "not selected"}`);
  console.log(`Policy version: ${plan.policyVersion}`);
  console.log("");
  console.log("Evaluator blinding:");
  console.log(`- prior ordinals: ${plan.blindingPolicy.priorEvaluatorCanonicalInterpretations}`);
  console.log(`- prior raw observations: ${plan.blindingPolicy.priorEvaluatorRawObservations}`);
  console.log(`- comparative synthesis: ${plan.blindingPolicy.comparativeSynthesisResult}`);
  console.log(`- current canonical candidate: ${plan.blindingPolicy.currentCanonicalCandidate}`);
  console.log(`- bat identity: ${plan.blindingPolicy.batIdentity}`);
  console.log(`- reference bat identity: ${plan.blindingPolicy.referenceBatIdentity}`);
  console.log("");
  console.log("General evaluator instructions:");
  for (const instruction of plan.evaluatorInstructions) console.log(`- ${instruction}`);
  console.log("");
  for (const item of plan.attributes) {
    console.log(`ATTRIBUTE: ${item.attributeKey}`);
    console.log(`Reason: ${item.reason}`);
    console.log(`Severity: ${item.conflictSeverity}`);
    console.log(`Classifications: ${item.conflictClassifications.join(", ")}`);
    console.log(`Target dimensions: ${item.targetDimensions.join(", ") || "none"}`);
    console.log(`Stable dimensions: ${item.stableDimensions.join(", ") || "none"}`);
    console.log(`Mode: ${item.recommendedEvaluationMode}`);
    console.log(`Minimum trials: dry=${item.minimumTrials.drySwingTrialCount}, contact=${item.minimumTrials.contactTrialCount}, alternation=${item.minimumTrials.referenceAlternationCount}`);
    console.log(`Reference use: ${item.referenceUse}`);
    console.log("Controls:");
    for (const control of item.controls) console.log(`- ${control}`);
    console.log("Instructions:");
    for (const instruction of item.instructions) console.log(`- ${instruction}`);
    console.log("Success criteria:");
    for (const criterion of item.successCriteria) console.log(`- ${criterion}`);
    console.log(`Canonical promotion allowed after collection: ${item.canonicalPromotionAllowedAfterCollection ? "yes" : "no"}`);
    console.log("");
  }
  console.log(`Canonical promotion allowed after collection: ${plan.canonicalPromotionAllowedAfterCollection ? "yes" : "no"}`);
}

async function loadCanonicalPromotionPreview(equipmentId: string) {
  const context = await loadContext(equipmentId);
  const comparative = synthesizeComparativeBehavioralEvidence(context);
  const standalone = synthesizeStandaloneAbsoluteEvidence({
    equipmentId: context.equipmentId,
    equipmentLabel: context.equipmentLabel,
    variantLabel: context.variantLabel,
    evidence: context.evidence,
    comparativeAttributes: comparative.attributes
  });
  return buildCanonicalOrdinalPromotionPreview(standalone);
}

function printStandaloneSynthesisReport(
  report: ReturnType<typeof synthesizeStandaloneAbsoluteEvidence>
) {
  console.log("STANDALONE ABSOLUTE EVIDENCE SYNTHESIS");
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variant: ${report.variantLabel ?? "not selected"}`);
  console.log(`Policy version: ${report.version}`);
  console.log("");
  for (const attribute of report.attributes) {
    console.log(`ATTRIBUTE: ${attribute.attributeKey}`);
    console.log(`Qualifying evidence: ${attribute.evidenceCount}`);
    console.log(`Independent sources: ${attribute.independentSourceCount}`);
    console.log(`Physical sessions: ${attribute.physicalSessionCount}`);
    console.log(`Observed ordinals: ${attribute.observedOrdinals.join(", ") || "none"}`);
    console.log(`Agreement: ${attribute.classification}`);
    console.log(`Status: ${attribute.synthesisStatus}`);
    console.log(`Supported ordinal: ${attribute.supportedCanonicalOrdinal ?? "none"}`);
    console.log(`Bounded range: ${attribute.supportedOrdinalRange?.join(" to ") ?? "none"}`);
    console.log(`Confidence: ${attribute.confidence}`);
    console.log(`Comparative corroboration: ${attribute.comparativeCorroboration}`);
    if (attribute.comparativeSummary) console.log(`Comparative summary: ${attribute.comparativeSummary}`);
    console.log(`Additional evaluator required: ${attribute.additionalEvaluationRequired ? "yes" : "no"}`);
    console.log(`Source evidence: ${attribute.sourceEvidenceIds.join(", ") || "none"}`);
    if (attribute.excludedEvidence.length) {
      console.log("Excluded evidence:");
      for (const exclusion of attribute.excludedEvidence) console.log(`- ${exclusion.evidenceRecordId}: ${exclusion.reason}`);
    }
    console.log(`Limitations: ${attribute.limitations.join(" ")}`);
    console.log("");
  }
  console.log(`Promotion candidates: ${report.promotionCandidates.map((item) => item.attributeKey).join(", ") || "none"}`);
  console.log(`Bounded attributes: ${report.boundedAttributes.map((item) => item.attributeKey).join(", ") || "none"}`);
  console.log(`Blocked attributes: ${report.blockedAttributes.map((item) => item.attributeKey).join(", ") || "none"}`);
  console.log("Numeric references created: no");
  console.log("Live recommendation activation allowed: no");
}

function printCanonicalPromotionPreview(preview: CanonicalOrdinalPromotionPreview) {
  console.log("CONTROLLED CANONICAL ORDINAL PROMOTION PREVIEW");
  console.log(`Equipment: ${preview.equipmentLabel}`);
  console.log(`Equipment ID: ${preview.equipmentId}`);
  console.log(`Variant: ${preview.variantLabel ?? "not selected"}`);
  console.log(`Policy version: ${preview.version}`);
  console.log("");
  for (const attribute of preview.attributes) {
    console.log(`ATTRIBUTE: ${attribute.attributeKey}`);
    console.log(`Gate: ${attribute.gateStatus}`);
    console.log(`Proposed canonical ordinal: ${attribute.proposedCanonicalOrdinal ?? "none"}`);
    console.log(`Bounded range: ${attribute.supportedOrdinalRange?.join(" to ") ?? "none"}`);
    console.log(`Confidence: ${attribute.confidence}`);
    console.log(`Evidence links: ${attribute.evidenceRecordIds.join(", ") || "none"}`);
    console.log(`Additional evaluator required: ${attribute.additionalEvaluationRequired ? "yes" : "no"}`);
    console.log(`Rationale: ${attribute.rationale}`);
    console.log(`Limitations: ${attribute.limitations.join(" ")}`);
    console.log("");
  }
  console.log(`Promotion permitted: ${preview.promotionPermitted ? "yes" : "no"}`);
  console.log(`Promotable attributes: ${preview.promotedAttributeCount}`);
  console.log(`Bounded attributes: ${preview.boundedAttributeCount}`);
  console.log(`Blocked attributes: ${preview.blockedAttributeCount}`);
  console.log("Numeric references created: no");
  console.log("Live recommendation activation allowed: no");
}

async function persistCanonicalOrdinalPromotions(preview: CanonicalOrdinalPromotionPreview) {
  return prisma.$transaction(async (tx) => {
    let created = 0;
    let updatedOrNoop = 0;
    let blocked = 0;
    for (const attribute of preview.attributes) {
      if (attribute.gateStatus !== "single_ordinal_ready" || !attribute.proposedCanonicalOrdinal) continue;
      const existing = await tx.equipmentDNAAttributeEvaluation.findFirst({
        where: {
          equipmentId: preview.equipmentId,
          equipmentVariantId: null,
          targetLevel: "equipment",
          attributeKey: attribute.attributeKey,
          attributeDefinitionVersion: "1.0",
          status: "active"
        },
        include: { evidenceLinks: true }
      });
      if (existing && scalar(existing.value) !== attribute.proposedCanonicalOrdinal) {
        blocked += 1;
        throw new Error(`Canonical promotion blocked for ${attribute.attributeKey}: active value ${String(scalar(existing.value))} already exists.`);
      }
      if (existing) {
        await ensureEvidenceLinks(tx, existing.id, attribute.evidenceRecordIds);
        updatedOrNoop += 1;
        continue;
      }
      const evaluation = await tx.equipmentDNAAttributeEvaluation.create({
        data: {
          equipmentId: preview.equipmentId,
          equipmentVariantId: null,
          targetLevel: "equipment",
          attributeKey: attribute.attributeKey,
          attributeDefinitionVersion: "1.0",
          value: attribute.proposedCanonicalOrdinal,
          confidence: attribute.confidence,
          evaluationMethod: "multi_evaluator_consensus",
          evaluationVersion: 1,
          status: "active",
          rationale: [
            attribute.rationale,
            `Policy: ${CANONICAL_ORDINAL_PROMOTION_POLICY_VERSION}.`,
            "Promotion source: independent standalone absolute physical evaluations.",
            "No 0-100 numeric reference was created and live recommendation behavior was not changed."
          ].join(" "),
          evaluatedAt: deterministicReportDate
        } satisfies Prisma.EquipmentDNAAttributeEvaluationUncheckedCreateInput
      });
      await ensureEvidenceLinks(tx, evaluation.id, attribute.evidenceRecordIds);
      created += 1;
    }
    return { created, updatedOrNoop, blocked };
  });
}

async function ensureEvidenceLinks(
  tx: Prisma.TransactionClient,
  evaluationId: string,
  evidenceRecordIds: readonly string[]
) {
  for (const evidenceRecordId of evidenceRecordIds) {
    await tx.equipmentDNAAttributeEvaluationEvidence.upsert({
      where: { evaluationId_evidenceRecordId: { evaluationId, evidenceRecordId } },
      update: {},
      create: { evaluationId, evidenceRecordId }
    });
  }
}

function printAnchorReadinessReport(report: CanonicalReferenceAnchorStrategyReport) {
  console.log("CANONICAL REFERENCE ANCHOR READINESS");
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variant: ${report.variantLabel ?? "not selected"}`);
  console.log(`Physical sessions: ${report.physicalSessionCount}`);
  console.log(`Independent evaluators: ${report.independentEvaluatorCount}`);
  console.log(`Evidence records: ${report.evidenceCount}`);
  console.log("");
  for (const attribute of report.attributes) {
    console.log(`ATTRIBUTE: ${attribute.attributeKey}`);
    console.log(`Comparative consensus: ${attribute.comparativeConsensus}`);
    console.log(`Consensus strength: ${attribute.consensusStrength}`);
    console.log(`Material conflict: ${attribute.materialConflict ? "yes" : "no"}`);
    console.log(`Current reference: ${attribute.currentReferenceLabel ?? "unknown"}`);
    console.log(`Reference type: ${attribute.currentReferenceType ?? "unknown"}`);
    console.log(`Reference anchored: ${attribute.referenceAnchored ? "yes" : "no"}`);
    console.log(`Approved anchors: ${attribute.availableAnchors.length}`);
    if (attribute.availableAnchors.length) {
      for (const anchor of attribute.availableAnchors) {
        console.log(`- ${anchor.equipmentName} ${anchor.variantLabel ?? ""}: ${anchor.anchorStatus} ${anchor.canonicalOrdinal ?? "unresolved"}`.trim());
      }
    }
    console.log(`Rejected/provisional anchors: ${attribute.rejectedAnchors.length}`);
    if (attribute.rejectedAnchors.length) {
      for (const anchor of attribute.rejectedAnchors) {
        console.log(`- ${anchor.equipmentName} ${anchor.variantLabel ?? ""}: ${anchor.anchorStatus}; ${anchor.limitations.join(" ")}`.trim());
      }
    }
    console.log(`Standalone evidence: ${attribute.standaloneEvidenceCount} (${attribute.standaloneIndependentSourceCount} independent sources)`);
    console.log(`Objective evidence: ${attribute.objectiveEvidenceCount}`);
    console.log(`Canonical gate: ${attribute.canonicalInterpretationGateStatus}`);
    console.log(`Bounded range: ${attribute.boundedCanonicalRange?.join(" to ") ?? "none"}`);
    console.log(`Preferred next action: ${attribute.preferredNextAction}`);
    console.log(`Canonical interpretation: ${attribute.canonicalInterpretationStatus}`);
    for (const path of attribute.absolutePathCandidates) {
      console.log(`Path ${path.path}: ${path.status} - ${path.reasons.join(" ")}`);
    }
    console.log("");
  }
  console.log("OMAHA ANCHOR PATH");
  console.log(`Catalog onboarding needed: ${report.omahaAnchorRequirements.catalogOnboardingNeeded ? "yes" : "no"}`);
  console.log(`Behavioral evaluation needed: ${report.omahaAnchorRequirements.behavioralEvaluationNeeded ? "yes" : "no"}`);
  console.log(`Independent evaluations needed: ${report.omahaAnchorRequirements.independentEvaluationsNeeded}`);
  console.log(`Objective evidence needed: ${report.omahaAnchorRequirements.objectiveEvidenceNeeded ? "yes" : "no"}`);
  console.log(`Canonical ordinal required: ${report.omahaAnchorRequirements.canonicalOrdinalRequired ? "yes" : "no"}`);
  console.log(`Numeric reference required: ${report.omahaAnchorRequirements.numericReferenceRequired ? "yes" : "no"}`);
  console.log("Evidence gap:");
  for (const item of report.omahaAnchorRequirements.estimatedEvidenceGap) console.log(`- ${item}`);
  console.log("");
  console.log(`DeMarini maturity: ${report.maturity}`);
  console.log(`Canonical profile ready: ${report.canonicalProfileReady ? "yes" : "no"}`);
  console.log(`Genuine-study ready: ${report.genuineStudyReady ? "yes" : "no"}`);
  console.log(`Live recommendation activation allowed: ${report.liveRecommendationActivationAllowed ? "yes" : "no"}`);
}

function printAnchorInventoryReport(
  inventory: ReturnType<typeof buildCanonicalReferenceAnchorInventory>
) {
  console.log("CANONICAL REFERENCE ANCHOR INVENTORY");
  console.log(`Generated at: ${inventory.generatedAt.toISOString()}`);
  console.log(`Reviews: ${inventory.reviews.length}`);
  console.log("");
  for (const review of inventory.reviews) {
    console.log(`${review.equipmentName} ${review.variantLabel ?? ""}`.trim());
    console.log(`ATTRIBUTE: ${review.attributeKey}`);
    console.log(`Canonical ordinal: ${review.canonicalOrdinal ?? "none"}`);
    console.log(`Numeric reference available: ${review.numericReferenceAvailable ? "yes" : "no"}`);
    console.log(`Confidence: ${review.confidence ?? "none"}`);
    console.log(`Evaluation method: ${review.evaluationMethod ?? "none"}`);
    console.log(`Anchor status: ${review.anchorStatus}`);
    console.log(`Evidence quality: ${review.evidenceQuality}`);
    console.log(`Approved for inference: ${review.approvedForInference ? "yes" : "no"}`);
    console.log(`Lineage depth: ${review.lineage.anchorDepth}`);
    console.log(`Circular lineage: ${review.lineage.circular ? "yes" : "no"}`);
    console.log(`Limitations: ${review.limitations.join(" ") || "none"}`);
    console.log("");
  }
}

function printSynthesisReport(
  report: ReturnType<typeof synthesizeComparativeBehavioralEvidence>
) {
  console.log("REAL-WORLD BEHAVIORAL EVIDENCE SYNTHESIS");
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variant: ${report.variantLabel ?? "not selected"}`);
  console.log(`Physical sessions: ${report.physicalSessionCount}`);
  console.log(`Independent evaluators: ${report.independentEvaluatorCount}`);
  console.log(`Evidence records: ${report.evidenceCount}`);
  console.log("");
  for (const attribute of report.attributes) {
    console.log(`ATTRIBUTE: ${attribute.attributeKey}`);
    console.log("Dimension synthesis:");
    for (const dimension of attribute.dimensionResults) {
      console.log(`${dimension.dimensionKey}: ${dimension.direction} (${dimension.agreement}, conflict: ${dimension.conflictSeverity})`);
      for (const observation of dimension.observations) {
        console.log(`- ${observation.sessionId} / ${observation.evaluatorId}: ${observation.observation}`);
      }
    }
    console.log(`Comparative direction: ${attribute.comparativeDirection}`);
    console.log(`Consensus strength: ${attribute.consensusStrength}`);
    console.log(`Material conflict: ${attribute.materialConflict ? "yes" : "no"}`);
    console.log(`Conflicting dimensions: ${attribute.conflictingDimensions.join(", ") || "none"}`);
    console.log(`Reference: ${attribute.referenceContext.referenceType ?? "unknown"} ${attribute.referenceContext.referenceLabel ?? ""}`.trim());
    console.log(`Canonical interpretation: ${attribute.canonicalInterpretationStatus}`);
    console.log(`Canonical ordinal: ${attribute.canonicalOrdinal ?? "none"}`);
    console.log(`Numeric reference: ${attribute.numericReference ?? "none"}`);
    console.log(`Next evidence action: ${attribute.nextEvidenceAction}`);
    console.log("");
  }
  console.log(`Canonical profile ready: ${report.canonicalProfileReady ? "yes" : "no"}`);
  console.log(`Genuine-study ready: ${report.genuineStudyReady ? "yes" : "no"}`);
  console.log(`Live recommendation activation allowed: ${report.liveRecommendationActivationAllowed ? "yes" : "no"}`);
}

async function loadContext(equipmentId: string) {
  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        variants: {
          orderBy: [{ lengthInches: "asc" }, { weightOunces: "asc" }],
          include: { dnaEvidenceRecords: { where: { status: "active" }, orderBy: [{ attributeKey: "asc" }, { createdAt: "asc" }] } }
        },
        dnaEvidenceRecords: { where: { status: "active" }, orderBy: [{ attributeKey: "asc" }, { createdAt: "asc" }] },
        dnaAttributeEvaluations: { where: { status: "active" } }
      }
    });
    if (!equipment) throw new Error(`Equipment ${equipmentId} was not found.`);
    const evidenceRows = uniqueById([
      ...equipment.dnaEvidenceRecords,
      ...equipment.variants.flatMap((variant) => variant.dnaEvidenceRecords)
    ]);
    return {
      equipmentId: equipment.id,
      equipmentLabel: `${equipment.modelYear ?? ""} ${equipment.manufacturer} ${equipment.model}`.trim(),
      variantLabel: equipment.variants.map((variant) => `${variant.sku ?? variant.id} ${variant.lengthInches}/${variant.weightOunces}/${variant.dropWeight}`).join(", "),
      identityReady: true,
      specificationReady: hasSpecEvaluations(equipment.dnaAttributeEvaluations.map((row) => row.attributeKey)),
      evidence: evidenceRows.map(mapEvidenceRecord)
    };
  } catch (error) {
    if (equipmentId !== defaultEquipmentId) throw error;
    return {
      equipmentId,
      equipmentLabel: "2023 DeMarini The Goods (-10) USA",
      variantLabel: "DEM-THE-GOODS-USA-30-20 30/20/-10",
      identityReady: true,
      specificationReady: true,
      evidence: [],
      loadWarning: `Database evidence load unavailable: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`
    };
  }
}

async function loadDemoAnchorInventory() {
  const loader = new CanonicalEquipmentDNAProfileLoader(createCanonicalRepository());
  const profiles = [];
  for (const target of demoAnchorTargets) {
    const equipment = await prisma.equipment.findFirst({
      where: { manufacturer: target.manufacturer, model: target.model, modelYear: target.modelYear },
      include: { variants: { where: { sku: target.selectedSku } } }
    });
    if (!equipment || equipment.variants.length === 0) throw new Error(`Missing demo anchor target ${target.selectedSku}.`);
    const profile = await loader.loadCanonicalEquipmentDNAProfile({
      equipmentId: equipment.id,
      equipmentVariantId: equipment.variants[0].id,
      generatedAt: deterministicReportDate
    });
    profiles.push({ profile, syntheticFixture: false });
  }
  return buildCanonicalReferenceAnchorInventory({ profiles, generatedAt: deterministicReportDate });
}

function createCanonicalRepository(): CanonicalEquipmentDNAProfileLoaderRepository {
  return {
    async getEquipmentForCanonicalProfile(equipmentId: string) {
      return prisma.equipment.findUnique({ where: { id: equipmentId } });
    },
    async getVariantForCanonicalProfile(equipmentVariantId: string) {
      return prisma.equipmentVariant.findUnique({ where: { id: equipmentVariantId } });
    },
    async listActiveCanonicalEvaluations(input: { equipmentId: string; equipmentVariantId?: string }) {
      const rows = await prisma.equipmentDNAAttributeEvaluation.findMany({
        where: {
          OR: [
            { equipmentId: input.equipmentId },
            ...(input.equipmentVariantId ? [{ equipmentVariantId: input.equipmentVariantId }] : [])
          ],
          status: "active"
        },
        include: { evidenceLinks: { include: { evidenceRecord: true } } },
        orderBy: [{ targetLevel: "asc" }, { attributeKey: "asc" }, { evaluationVersion: "desc" }]
      });
      return rows.map((row) => ({
        id: row.id,
        equipmentId: row.equipmentId ?? undefined,
        equipmentVariantId: row.equipmentVariantId ?? undefined,
        targetLevel: row.targetLevel,
        attributeKey: row.attributeKey,
        attributeDefinitionVersion: row.attributeDefinitionVersion,
        value: scalarCanonicalValue(row.value),
        confidence: row.confidence,
        evaluationMethod: row.evaluationMethod,
        evaluationVersion: row.evaluationVersion,
        status: row.status,
        rationale: row.rationale ?? undefined,
        evaluatedAt: row.evaluatedAt ?? undefined,
        evidenceRecords: row.evidenceLinks.map((link) => ({
          id: link.evidenceRecord.id,
          equipmentId: link.evidenceRecord.equipmentId ?? undefined,
          equipmentVariantId: link.evidenceRecord.equipmentVariantId ?? undefined,
          targetLevel: link.evidenceRecord.targetLevel,
          attributeKey: link.evidenceRecord.attributeKey,
          attributeDefinitionVersion: link.evidenceRecord.attributeDefinitionVersion,
          sourceType: link.evidenceRecord.sourceType,
          sourceName: link.evidenceRecord.sourceName,
          sourceReference: link.evidenceRecord.sourceReference ?? undefined,
          method: link.evidenceRecord.method,
          rawValue: link.evidenceRecord.rawValue ?? undefined,
          normalizedValue: link.evidenceRecord.normalizedValue ?? undefined,
          unit: link.evidenceRecord.unit ?? undefined,
          notes: link.evidenceRecord.notes ?? undefined,
          status: link.evidenceRecord.status,
          evaluatorType: link.evidenceRecord.evaluatorType ?? undefined,
          evaluatorReference: link.evidenceRecord.evaluatorReference ?? undefined
        }))
      }));
    }
  };
}

function mapEvidenceRecord(row: {
  id: string;
  attributeKey: string;
  sourceType: string;
  sourceName: string;
  sourceReference: string | null;
  rawValue: unknown;
  normalizedValue: unknown;
  notes: string | null;
  evaluatorReference: string | null;
}): BehavioralEvidenceRecord {
  return {
    id: row.id,
    attributeKey: requiredBehavioralEquipmentDNAAttributes.includes(row.attributeKey as never) ? row.attributeKey : undefined,
    category: row.sourceType === "objective_measurement"
      ? "objective_measured"
      : row.sourceType === "structured_expert_evaluation"
        ? "structured_internal_equipment_evaluation"
        : row.sourceType === "manufacturer_specification"
          ? "manufacturer_technical"
          : "unknown",
    timing: row.evaluatorReference?.includes("retrospective") ? "retrospective_validation_evidence" : "prospective_equipment_evidence",
    sourceName: row.sourceName,
    sourceReference: row.sourceReference ?? row.id,
    independenceGroup: row.evaluatorReference ?? row.sourceReference ?? row.sourceName,
    rawValue: row.rawValue,
    ordinalValue: scalar(row.normalizedValue),
    notes: row.notes ?? "Persisted equipment evidence."
  };
}

function printReport(
  report: ReturnType<typeof evaluateRealWorldBehavioralEquipmentDNA>,
  options: { includeEvidence: boolean; validationOnly: boolean }
) {
  console.log("REAL-WORLD EQUIPMENT BEHAVIORAL EVALUATION");
  console.log(`Equipment: ${report.equipmentLabel}`);
  console.log(`Equipment ID: ${report.equipmentId}`);
  console.log(`Variant: ${report.variantLabel ?? "not selected"}`);
  console.log("");
  if (!options.validationOnly) {
    for (const attribute of report.attributes) {
      console.log(`ATTRIBUTE: ${attribute.attributeKey}`);
      console.log(`Status: ${attribute.evaluationStatus}`);
      console.log(`Ordinal: ${attribute.ordinalValue ?? "unresolved"}`);
      console.log(`Numeric reference: ${attribute.numericReference ?? "none"}`);
      console.log(`Confidence: ${attribute.confidence}`);
      console.log(`Evidence: ${attribute.evidenceCount}`);
      console.log(`Conflicts: ${attribute.conflictingEvidence.length}`);
      console.log(`Limitations: ${attribute.limitations.join(" ")}`);
      if (attribute.missingEvidence.length) {
        console.log("Needed:");
        for (const item of attribute.missingEvidence) console.log(`- ${item}`);
      }
      console.log("");
    }
    console.log("EVIDENCE QUALITY");
    console.log(`Objective: ${report.evidenceQuality.objective_measured}`);
    console.log(`Manufacturer technical: ${report.evidenceQuality.manufacturer_technical}`);
    console.log(`Independent: ${report.evidenceQuality.independent_expert}`);
    console.log(`Structured internal: ${report.evidenceQuality.structured_internal_equipment_evaluation}`);
    console.log(`Player-specific: ${report.evidenceQuality.anecdotal_player_specific}`);
    console.log("");
    console.log("CANONICAL READINESS");
    console.log(`Required behavioral attributes resolved: ${report.readiness.requiredBehavioralAttributesResolved.join(", ") || "none"}`);
    console.log(`Required behavioral attributes unresolved: ${report.readiness.requiredBehavioralAttributesUnresolved.join(", ") || "none"}`);
    console.log(`Material conflicts: ${report.readiness.materialConflicts.join(", ") || "none"}`);
    console.log(`Confidence thresholds satisfied: ${report.readiness.confidenceThresholdsSatisfied ? "yes" : "no"}`);
    console.log(`Canonical profile ready: ${report.readiness.canonicalProfileReady ? "yes" : "no"}`);
    console.log("Equipment DNA maturity: basic");
    console.log(`Genuine transition study ready: ${report.readiness.genuineStudyReady ? "yes" : "no"}`);
    console.log(`Live recommendation activation allowed: ${report.readiness.liveActivationAllowed ? "yes" : "no"}`);
    console.log("");
    if (options.includeEvidence) {
      console.log("Evidence inventory:");
      for (const item of report.evidenceInventory) {
        console.log(`- ${item.id} ${item.category} ${item.attributeKey ?? "not_behavioral"} ${item.sourceReference}`);
      }
      if (report.evidenceInventory.length === 0) console.log("- none");
      console.log("");
    }
  }
  console.log("VALIDATION REPORT");
  for (const check of report.validation.checks) console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
  console.log(`Validation verdict: ${report.validation.verdict}`);
  console.log("");
  console.log("Production recommendation model changed: no");
  console.log("Live recommendation activation allowed: no");
  console.log("Public API changed: no");
  console.log("Web UI changed: no");
}

function hasSpecEvaluations(keys: readonly string[]) {
  return ["length", "weight", "drop", "certification", "barrel_diameter"].every((key) => keys.includes(key));
}

function scalar(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return undefined;
}

function uniqueById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    result.push(row);
  }
  return result;
}

function printHelp() {
  console.log("Behavioral evaluation commands: prepare | evidence | validate | readiness | synthesis | synthesis-validation | anchor-readiness | anchor-inventory | anchor-validation | standalone-synthesis | canonical-preview | canonical-validation | conflict-analysis | adjudication-plan | adjudication-validation | protocol-calibration | construct-analysis | pilot-learning-report | protocol-calibration-validation | canonical-commit --confirm | commit --confirm");
}

function parseArgs(values: readonly string[]) {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const equalsIndex = value.indexOf("=");
    if (equalsIndex > 2) {
      result[value.slice(2, equalsIndex)] = value.slice(equalsIndex + 1);
      continue;
    }
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
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
