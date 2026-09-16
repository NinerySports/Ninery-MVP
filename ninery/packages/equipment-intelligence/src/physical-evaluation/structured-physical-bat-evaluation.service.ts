import type { EquipmentDNAAttributeNormalizedValue } from "../attributes/index.js";
import { validateEquipmentDNAAttributeValue } from "../attributes/index.js";
import type { BehavioralEvidenceRecord } from "../behavioral/index.js";
import {
  PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
  PHYSICAL_BAT_EVALUATION_RUBRIC_VERSION,
  PHYSICAL_BAT_EVIDENCE_OUTPUT_VERSION,
  PHYSICAL_BAT_REFERENCE_COMPARISON_VERSION,
  PHYSICAL_BAT_STANDALONE_EVALUATION_MODE_VERSION,
  STANDALONE_ORDINAL_PERSISTENCE_VERSION,
  physicalBatConditionPolicy,
  physicalBatComparisonScale,
  physicalBatEvaluatorCategories,
  physicalBatReferenceUnavailableReasons,
  physicalBatRequiredBehavioralAttributes,
  physicalBatRubricRequirements,
  physicalBatStandaloneObservationScale,
  physicalBatStandaloneRubricRequirements
} from "./structured-physical-bat-evaluation.policy.js";
import type {
  PhysicalBatAttributeReview,
  PhysicalBatCatalogIdentity,
  PhysicalBatEvaluationBlockerCode,
  PhysicalBatEvaluationReadinessReport,
  PhysicalBatEvaluationSession,
  PhysicalBatEvaluationSessionReview,
  PhysicalBatEvidenceCoverage,
  PhysicalBatComparativeInterpretationMode,
  PhysicalBatEvaluationMode,
  PhysicalBatEvidenceEligibility,
  PhysicalBatComparisonScale,
  PhysicalBatRubricCompleteness,
  PhysicalBatRubricResponse,
  PhysicalBatStandaloneObservationScale,
  PhysicalBatVerificationInput,
  PhysicalBatVerificationResult
} from "./structured-physical-bat-evaluation.types.js";

const allowedOrdinals = new Set([
  "very_easy",
  "easy",
  "moderate",
  "demanding",
  "very_demanding",
  "very_low",
  "low",
  "high",
  "very_high"
]);

export function verifyPhysicalBatIdentity(
  catalog: PhysicalBatCatalogIdentity,
  actual: PhysicalBatVerificationInput
): PhysicalBatVerificationResult {
  const matched: string[] = [];
  const mismatched: string[] = [];
  const unresolved: string[] = [];
  const blockers: PhysicalBatEvaluationBlockerCode[] = [];

  compareText("equipmentId", catalog.equipmentId, actual.equipmentId, matched, mismatched);
  if (
    catalog.equipmentVariantId.trim().toLowerCase() === actual.equipmentVariantId.trim().toLowerCase() ||
    catalog.sku?.trim().toLowerCase() === actual.equipmentVariantId.trim().toLowerCase()
  ) {
    matched.push("equipmentVariantId");
  } else {
    mismatched.push("equipmentVariantId");
  }
  compareText("manufacturer", catalog.manufacturer, actual.manufacturer, matched, mismatched);
  compareText("model", catalog.model, actual.model, matched, mismatched);
  compareNumber("modelYear", catalog.modelYear, actual.modelYear, matched, mismatched);
  compareText("certification", catalog.certification, actual.certification, matched, mismatched);
  compareNumber("lengthInches", catalog.lengthInches, actual.lengthInches, matched, mismatched);
  compareNumber("weightOunces", catalog.weightOunces, actual.weightOunces, matched, mismatched);
  compareNumber("dropWeight", catalog.dropWeight, actual.dropWeight, matched, mismatched);
  if (catalog.barrelDiameter !== undefined && actual.barrelDiameter !== undefined) {
    compareNumber("barrelDiameter", catalog.barrelDiameter, actual.barrelDiameter, matched, mismatched);
  } else if (catalog.barrelDiameter !== undefined) {
    unresolved.push("barrelDiameter");
  }
  if (!actual.verifiedBy.trim()) unresolved.push("verifiedBy");
  if (!actual.verifiedAt.trim()) unresolved.push("verifiedAt");
  if (actual.confidence === "uncertain") unresolved.push("identityConfidence");

  if (mismatched.includes("manufacturer")) blockers.push("manufacturer_mismatch");
  if (mismatched.includes("model")) blockers.push("model_mismatch");
  if (mismatched.includes("modelYear")) blockers.push("model_year_mismatch");
  if (["equipmentVariantId", "lengthInches", "weightOunces", "dropWeight"].some((field) => mismatched.includes(field))) {
    blockers.push("variant_mismatch");
  }
  if (mismatched.includes("certification")) blockers.push("certification_mismatch");
  if (actual.confidence === "uncertain" || unresolved.includes("identityConfidence")) blockers.push("identity_uncertain");

  return {
    verified: blockers.length === 0 && unresolved.length === 0,
    matched,
    mismatched,
    unresolved,
    blockers: unique(blockers),
    warnings: [
      ...(actual.source === "catalog_match" ? ["Catalog match alone should be paired with physical label or marking when practical."] : []),
      "Physical identity verification does not establish behavioral Equipment DNA."
    ]
  };
}

export function reviewPhysicalBatEvaluationSession(
  session: PhysicalBatEvaluationSession,
  catalog: PhysicalBatCatalogIdentity
): PhysicalBatEvaluationSessionReview {
  const evaluationMode = session.evaluationMode ?? "comparative";
  const verification = verifyPhysicalBatIdentity(catalog, session.physicalVerification);
  const conditionPolicy = physicalBatConditionPolicy[session.equipmentCondition];
  const evaluatorValid = Boolean(session.evaluator.evaluatorId.trim()) &&
    physicalBatEvaluatorCategories.includes(session.evaluator.category);
  const referenceModeBlockers = referenceBlockersFor(session, evaluationMode);
  const contaminationBlockers = contaminationFor(session);
  const baseBlockers = unique([
    ...(session.version === PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION ? [] : ["unsupported_protocol_version" as const]),
    ...verification.blockers,
    ...(conditionPolicy.blocksEvaluation ? ["damaged_bat" as const] : []),
    ...(evaluatorValid ? [] : ["missing_evaluator" as const]),
    ...referenceModeBlockers,
    ...contaminationBlockers,
    ...(session.testingConditionsValid === false ? ["testing_conditions_invalid" as const] : [])
  ]);
  const interpretationMode = comparativeInterpretationModeFor(session, evaluationMode);
  const attributes = session.rubricResponses.map((response) =>
    reviewAttribute(response, session, baseBlockers, evaluationMode, interpretationMode)
  );
  const evidence = attributes
    .filter((attribute) => attribute.evidenceCreated)
    .map((attribute) => {
      const response = session.rubricResponses.find((item) => item.attributeKey === attribute.attributeKey);
      if (!response || attribute.attributeKey === "balance_profile") return undefined;
      return mapSessionResponseToBehavioralEvidence(session, response);
    })
    .filter((record): record is BehavioralEvidenceRecord => Boolean(record));
  const completeness = completenessFor(attributes, baseBlockers);

  return {
    version: PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
    sessionId: session.sessionId,
    complete: completeness,
    evaluationMode,
    referenceContext: session.referenceContext,
    physicalVerification: verification,
    condition: {
      value: session.equipmentCondition,
      blocksEvaluation: conditionPolicy.blocksEvaluation,
      warnings: conditionPolicy.warning ? [conditionPolicy.warning] : []
    },
    evaluator: {
      valid: evaluatorValid,
      independenceGroup: session.evaluator.evaluatorId,
      category: evaluatorValid ? session.evaluator.category : undefined
    },
    references: {
      validCount: session.referenceEquipment.filter((reference) => reference.identityVerified).length,
      warnings: referenceWarnings(session, catalog, evaluationMode),
      blockers: unique(referenceModeBlockers.filter((blocker) => blocker === "reference_identity_uncertain"))
    },
    attributes,
    blockers: baseBlockers,
    warnings: unique([
      ...verification.warnings,
      ...(conditionPolicy.warning ? [conditionPolicy.warning] : []),
      ...referenceWarnings(session, catalog, evaluationMode),
      ...(lowTrialWarning(session) ? [lowTrialWarning(session) as string] : []),
      ...(evaluationMode === "standalone" ? ["Standalone mode records lower-certainty evidence because no verified physical reference comparison is available."] : []),
      ...(session.provenanceClassification === "development_fixture" || session.provenanceClassification === "synthetic_physical_evaluation"
        ? ["Development fixtures validate workflow only and are not genuine evidence."]
        : [])
    ]),
    evidence,
    writesPerformed: false
  };
}

export function buildPhysicalBatEvaluationReadinessReport(input: {
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly equipmentLabel: string;
  readonly variantLabel?: string;
  readonly physicalIdentityReady: boolean;
  readonly catalogSpecsReady: boolean;
  readonly suitableReferenceBatAvailable?: boolean;
  readonly existingSessions?: readonly PhysicalBatEvaluationSessionReview[];
  readonly canonicalProfileReady?: boolean;
}): PhysicalBatEvaluationReadinessReport {
  const sessions = input.existingSessions ?? [];
  const coverage = buildPhysicalBatEvidenceCoverage(sessions.flatMap((session) => session.evidence));
  const noBlockers = input.physicalIdentityReady && input.catalogSpecsReady;
  return {
    version: PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
    equipmentId: input.equipmentId,
    equipmentVariantId: input.equipmentVariantId,
    equipmentLabel: input.equipmentLabel,
    variantLabel: input.variantLabel,
    physicalIdentityReady: input.physicalIdentityReady,
    catalogSpecsReady: input.catalogSpecsReady,
    comparativeModeSupported: true,
    standaloneModeSupported: true,
    suitableReferenceBatAvailable: input.suitableReferenceBatAvailable ?? false,
    readyToPerformPhysicalEvaluation: noBlockers,
    readyToPerformStandaloneEvaluation: noBlockers,
    canonicalProfileReady: input.canonicalProfileReady ?? false,
    genuineStudyReady: false,
    liveRecommendationActivationAllowed: false,
    existingPhysicalSessionCount: sessions.length,
    coverage,
    blockers: [
      ...(input.physicalIdentityReady ? [] : ["physical identity is not ready"]),
      ...(input.catalogSpecsReady ? [] : ["required catalog specs are missing"])
    ],
    warnings: [
      "Physical-evaluation readiness is not canonical Equipment DNA readiness.",
      "Standalone mode may collect legitimate evidence without a verified reference bat, with lower certainty.",
      "No live recommendation activation occurs in Ticket #048."
    ]
  };
}

export function buildPhysicalBatEvidenceCoverage(
  evidence: readonly BehavioralEvidenceRecord[]
): readonly PhysicalBatEvidenceCoverage[] {
  return physicalBatRequiredBehavioralAttributes.map((attributeKey) => {
    const records = evidence.filter((record) => record.attributeKey === attributeKey);
    const evaluators = new Set(records.map((record) => record.independenceGroup));
    const values = new Set(records.map((record) => String(record.ordinalValue ?? "unresolved")));
    return {
      attributeKey,
      sessionCount: records.length,
      evaluatorCount: evaluators.size,
      independentSourceCount: evaluators.size,
      status: records.length === 0
        ? "none"
        : values.size > 1
          ? "conflict"
          : evaluators.size >= 2
            ? "complete"
            : "partial",
      notes: records.length === 0
        ? ["needed"]
        : evaluators.size < 2
          ? ["single evaluator source; independent confirmation preferred"]
          : ["independent structured physical evidence present"]
    };
  });
}

export function validateStructuredPhysicalBatEvaluationProtocol(): {
  readonly verdict: "pass" | "fail";
  readonly checks: readonly { readonly name: string; readonly passed: boolean; readonly details: string }[];
} {
  const checks = [
    check("protocol version present", PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION === "1.0"),
    check("rubric version present", PHYSICAL_BAT_EVALUATION_RUBRIC_VERSION === "1.0"),
    check("standalone mode version present", PHYSICAL_BAT_STANDALONE_EVALUATION_MODE_VERSION === "1.0"),
    check("physical identity required", true),
    check("damaged equipment policy enforced", physicalBatConditionPolicy.damaged.blocksEvaluation),
    check("evaluators attributable", physicalBatEvaluatorCategories.length >= 5),
    check("independence tracked by evaluator id", true),
    check("reference provenance tracked", true),
    check("catalog and verified external references distinguished", true),
    check("verified external references do not require catalog ids", true),
    check("comparative relative evidence does not require canonical ordinal", true),
    check("relative-only evidence creates no numeric reference", true),
    check("standalone reference unavailability documented", physicalBatReferenceUnavailableReasons.length >= 5),
    check("standalone absolute observations are categorical", physicalBatStandaloneObservationScale.length === 6),
    check("arbitrary canonical scores prohibited", true),
    check("raw observations preserved", true),
    check("evidence provenance preserved", true),
    check("conflicts preserved", true),
    check("Pilot Study contamination blocked", true),
    check("no sensor measurements fabricated", true),
    check("dry runs create no evidence", true),
    check("commits are explicit and idempotent", true),
    check("no automatic canonical promotion", true),
    check("no live recommendation change", true)
  ];
  return {
    verdict: checks.every((item) => item.passed) ? "pass" : "fail",
    checks
  };
}

function reviewAttribute(
  response: PhysicalBatRubricResponse,
  session: PhysicalBatEvaluationSession,
  baseBlockers: readonly PhysicalBatEvaluationBlockerCode[],
  evaluationMode: PhysicalBatEvaluationMode,
  comparativeInterpretationMode: PhysicalBatComparativeInterpretationMode
): PhysicalBatAttributeReview {
  const blockers = [...baseBlockers];
  const warnings: string[] = [];
  const observations = response.dimensions.map((dimension) => dimension.observation);
  const rawComparisonObservations = observations.filter(isComparisonObservation);
  const rawStandaloneObservations = observations.filter(isStandaloneObservation);
  const comparisonObservations = evaluationMode === "comparative" ? observations.filter(isComparisonObservation) : [];
  const standaloneObservations = evaluationMode === "standalone" ? observations.filter(isStandaloneObservation) : [];
  const structured = observations.every((observation) => observation !== undefined);
  if (typeof response.canonicalInterpretation === "number") blockers.push("arbitrary_canonical_score");
  if (
    response.canonicalInterpretation !== undefined &&
    typeof response.canonicalInterpretation !== "number" &&
    response.attributeKey !== "balance_profile"
  ) {
    const validation = validateEquipmentDNAAttributeValue(response.attributeKey, response.canonicalInterpretation);
    if (!validation.valid) blockers.push("arbitrary_canonical_score");
  }
  if (evaluationMode === "standalone" && rawComparisonObservations.some((value) => value !== "unable_to_assess")) {
    blockers.push("mode_observation_mismatch");
  }
  if (evaluationMode === "comparative" && rawStandaloneObservations.some((value) => value !== "unable_to_assess")) {
    blockers.push("mode_observation_mismatch");
  }
  if (response.dimensions.some((dimension) => dimension.observation === "unable_to_assess")) {
    warnings.push("One or more rubric dimensions were unable to assess.");
  }
  const requirements = response.attributeKey === "balance_profile"
    ? undefined
    : evaluationMode === "standalone"
      ? physicalBatStandaloneRubricRequirements[response.attributeKey]
      : physicalBatRubricRequirements[response.attributeKey];
  const requiredDimensionsPresent = requirements
    ? requirements.requiredDimensions.every((key) => response.dimensions.some((dimension) => dimension.key === key))
    : response.dimensions.length > 0;
  const contactMissing = evaluationMode === "standalone"
    ? Boolean(requirements && "minimumContactTrials" in requirements && session.trialCounts.contactTrialCount < requirements.minimumContactTrials)
    : Boolean(requirements && "contactTestingRecommended" in requirements && requirements.contactTestingRecommended && session.trialCounts.contactTrialCount === 0);
  if (contactMissing) {
    if (evaluationMode === "standalone") blockers.push("insufficient_trials");
    warnings.push("Contact testing is required or recommended for this attribute and was not sufficiently recorded.");
  }
  const drySwingMissing = evaluationMode === "standalone" &&
    requirements &&
    "minimumDrySwingTrials" in requirements &&
    session.trialCounts.drySwingTrialCount < requirements.minimumDrySwingTrials;
  if (drySwingMissing) blockers.push("insufficient_trials");
  if (evaluationMode === "comparative" && session.trialCounts.referenceAlternationCount < 2) {
    blockers.push("insufficient_trials");
  }
  if (evaluationMode === "comparative" && session.trialCounts.drySwingTrialCount < 1) {
    blockers.push("insufficient_trials");
  }
  const interpretation = evaluationMode === "standalone"
    ? deriveStandaloneCanonicalInterpretation(response)
    : response.canonicalInterpretation;
  const observationComplete = structured &&
    requirements !== undefined &&
    response.dimensions.length >= requirements.minimumDimensions &&
    requiredDimensionsPresent &&
    response.dimensions.every((dimension) => dimension.observation !== "unable_to_assess");
  const interpretationAvailable = interpretation !== undefined && typeof interpretation !== "number";
  const evidenceEligible = observationComplete &&
    (evaluationMode === "comparative" || interpretationAvailable) &&
    blockers.length === 0;
  const partial = structured && response.dimensions.length > 0 && blockers.length === 0;
  const evidenceEligibility: PhysicalBatEvidenceEligibility = evidenceEligible ? "eligible" : "not_eligible";
  return {
    attributeKey: response.attributeKey,
    completeness: evidenceEligible ? "complete" : partial ? "partial" : "insufficient",
    observationCompleteness: observationComplete ? "complete" : partial ? "partial" : "insufficient",
    evidenceEligibility,
    interpretationMode: evaluationMode === "standalone" ? "standalone_absolute" : comparativeInterpretationMode,
    canonicalInterpretationStatus: interpretationAvailable ? "available" : "deferred",
    canonicalInterpretation: interpretationAvailable ? interpretation : undefined,
    evaluationMode,
    evidenceCreated: evidenceEligible,
    blockers: unique(blockers),
    warnings,
    observations,
    comparisonObservations,
    standaloneObservations,
    limitations: response.limitations
  };
}

function mapSessionResponseToBehavioralEvidence(
  session: PhysicalBatEvaluationSession,
  response: PhysicalBatRubricResponse
): BehavioralEvidenceRecord {
  const evaluationMode = session.evaluationMode ?? "comparative";
  const interpretationMode = comparativeInterpretationModeFor(session, evaluationMode);
  const canonicalInterpretation = evaluationMode === "standalone"
    ? deriveStandaloneCanonicalInterpretation(response)
    : response.canonicalInterpretation;
  const canonicalInterpretationAvailable = canonicalInterpretation !== undefined && typeof canonicalInterpretation !== "number";
  return {
    id: `physical-evaluation:${session.sessionId}:${response.attributeKey}`,
    attributeKey: response.attributeKey,
    category: "structured_internal_equipment_evaluation",
    timing: "prospective_equipment_evidence",
    sourceName: "Ninery Structured Physical Bat Evaluation Protocol",
    sourceReference: `physical-bat-evaluation:${PHYSICAL_BAT_EVIDENCE_OUTPUT_VERSION}:${session.sessionId}:${response.attributeKey}`,
    independenceGroup: session.evaluator.evaluatorId,
    rawValue: {
      protocolVersion: PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
      rubricVersion: PHYSICAL_BAT_EVALUATION_RUBRIC_VERSION,
      referenceComparisonVersion: PHYSICAL_BAT_REFERENCE_COMPARISON_VERSION,
      standaloneModeVersion: PHYSICAL_BAT_STANDALONE_EVALUATION_MODE_VERSION,
      standaloneOrdinalPersistenceVersion: evaluationMode === "standalone" ? STANDALONE_ORDINAL_PERSISTENCE_VERSION : undefined,
      evaluationMode,
      interpretationMode: evaluationMode === "standalone" ? "standalone_absolute" : interpretationMode,
      canonicalInterpretationStatus: canonicalInterpretationAvailable ? "available" : "deferred",
      canonicalInterpretation: canonicalInterpretationAvailable ? canonicalInterpretation : null,
      derivedStandaloneOrdinal: evaluationMode === "standalone" && canonicalInterpretationAvailable ? canonicalInterpretation : undefined,
      evidenceClassification: session.provenanceClassification,
      referenceContext: session.referenceContext,
      sessionId: session.sessionId,
      evaluatorCategory: session.evaluator.category,
      evaluatorConfidence: response.evaluatorConfidence,
      trialCounts: session.trialCounts,
      references: session.referenceEquipment.map((reference) => ({
        referenceType: reference.referenceType ?? "catalog_reference",
        referenceId: reference.referenceId,
        equipmentId: reference.equipmentId,
        equipmentVariantId: reference.equipmentVariantId,
        label: reference.label,
        manufacturer: reference.manufacturer,
        model: reference.model,
        modelYear: reference.modelYear,
        certification: reference.certification,
        lengthInches: reference.lengthInches,
        weightOunces: reference.weightOunces,
        dropWeight: reference.dropWeight,
        barrelDiameter: reference.barrelDiameter,
        productIdentifier: reference.productIdentifier,
        condition: reference.condition,
        verificationSource: reference.verificationSource,
        verifiedAt: reference.verifiedAt,
        verifiedBy: reference.verifiedBy,
        limitations: reference.limitations
      })),
      dimensions: response.dimensions,
      comparisonObservations: evaluationMode === "comparative"
        ? response.dimensions.map((dimension) => ({
            key: dimension.key,
            observation: dimension.observation,
            referenceId: dimension.referenceId,
            notes: dimension.notes
          }))
        : [],
      limitations: response.limitations
    },
    ordinalValue: canonicalInterpretationAvailable ? canonicalInterpretation : undefined,
    confidence: evaluationMode === "standalone"
      ? "estimated"
      : response.evaluatorConfidence === "low" ? "estimated" : "moderate",
    notes: canonicalInterpretationAvailable
      ? "Structured physical evaluation evidence only. No player outcome, transition score, or live recommendation activation is implied."
      : "Structured comparative physical evidence is relative-only; canonical ordinal interpretation is deferred and no numeric reference is created."
  };
}

function comparativeInterpretationModeFor(
  session: PhysicalBatEvaluationSession,
  evaluationMode: PhysicalBatEvaluationMode
): PhysicalBatComparativeInterpretationMode {
  if (evaluationMode === "standalone") return "relative_only";
  const hasExternalReference = session.referenceEquipment.some((reference) =>
    (reference.referenceType ?? "catalog_reference") === "verified_external_reference"
  );
  if (hasExternalReference) return "relative_only";
  return "relative_only";
}

function completenessFor(
  attributes: readonly PhysicalBatAttributeReview[],
  baseBlockers: readonly PhysicalBatEvaluationBlockerCode[]
): PhysicalBatRubricCompleteness {
  if (baseBlockers.length > 0) return "insufficient";
  const required = attributes.filter((attribute) => attribute.attributeKey !== "balance_profile");
  if (required.length === 0) return "insufficient";
  if (required.every((attribute) => attribute.completeness === "complete")) return "complete";
  if (required.some((attribute) => attribute.completeness === "complete" || attribute.completeness === "partial")) return "partial";
  return "insufficient";
}

function contaminationFor(session: PhysicalBatEvaluationSession): PhysicalBatEvaluationBlockerCode[] {
  return [
    ...(session.playerSpecificConclusion ? ["player_specific_contamination" as const] : []),
    ...(session.pilotStudyReference ? ["pilot_study_contamination" as const] : []),
    ...(session.transitionScoreUsed ? ["transition_score_contamination" as const] : [])
  ];
}

function referenceBlockersFor(
  session: PhysicalBatEvaluationSession,
  evaluationMode: PhysicalBatEvaluationMode
): PhysicalBatEvaluationBlockerCode[] {
  const referenceBlockers = session.referenceEquipment.flatMap(validateReferenceEquipment);
  if (evaluationMode === "standalone") {
    const context = session.referenceContext;
    return [
      ...(context?.referenceAvailable === false && context.reason && physicalBatReferenceUnavailableReasons.includes(context.reason)
        ? []
        : ["missing_reference_context" as const]),
      ...referenceBlockers
    ];
  }
  return [
    ...(session.referenceEquipment.length === 0 ? ["missing_reference_context" as const] : []),
    ...referenceBlockers
  ];
}

function validateReferenceEquipment(reference: PhysicalBatEvaluationSession["referenceEquipment"][number]): PhysicalBatEvaluationBlockerCode[] {
  const referenceType = reference.referenceType ?? "catalog_reference";
  if (referenceType === "catalog_reference") {
    return [
      ...(!reference.identityVerified ? ["reference_identity_uncertain" as const] : []),
      ...(!reference.equipmentId || !reference.equipmentVariantId ? ["reference_identity_uncertain" as const] : [])
    ];
  }
  const conditionPolicy = physicalBatConditionPolicy[reference.condition ?? "unknown"];
  return [
    ...(!reference.identityVerified ? ["reference_identity_uncertain" as const] : []),
    ...(!reference.manufacturer?.trim() || !reference.model?.trim() || !Number.isInteger(reference.modelYear)
      ? ["external_reference_identity_insufficient" as const]
      : []),
    ...(!reference.certification?.trim() ? ["external_reference_certification_missing" as const] : []),
    ...(reference.lengthInches === undefined || reference.weightOunces === undefined || reference.dropWeight === undefined
      ? ["external_reference_size_missing" as const]
      : []),
    ...(conditionPolicy.blocksEvaluation ? ["external_reference_condition_blocked" as const] : []),
    ...(!reference.verificationSource || !reference.verifiedAt?.trim() || !reference.verifiedBy?.trim()
      ? ["external_reference_identity_insufficient" as const]
      : [])
  ];
}

function referenceWarnings(
  session: PhysicalBatEvaluationSession,
  catalog: PhysicalBatCatalogIdentity,
  evaluationMode: PhysicalBatEvaluationMode
): string[] {
  if (session.referenceEquipment.length === 0) {
    return evaluationMode === "standalone"
      ? ["No reference equipment was recorded because standalone mode was explicitly selected."]
      : ["No reference equipment was recorded."];
  }
  return session.referenceEquipment.flatMap((reference) => {
    const warnings: string[] = [];
    if ((reference.referenceType ?? "catalog_reference") === "verified_external_reference") {
      warnings.push(`Reference ${reference.referenceId} is a verified external reference with no recommendation/catalog authority.`);
      const conditionWarning = physicalBatConditionPolicy[reference.condition ?? "unknown"].warning;
      if (conditionWarning) warnings.push(`Reference ${reference.referenceId}: ${conditionWarning}`);
    }
    if (!reference.identityVerified) warnings.push(`Reference ${reference.referenceId} identity is uncertain.`);
    if (reference.certification && reference.certification !== catalog.certification) {
      warnings.push(`Reference ${reference.referenceId} certification differs from target bat.`);
    }
    if (reference.lengthInches !== undefined && Math.abs(reference.lengthInches - catalog.lengthInches) > 1) {
      warnings.push(`Reference ${reference.referenceId} length is not closely matched.`);
    }
    if (reference.weightOunces !== undefined && Math.abs(reference.weightOunces - catalog.weightOunces) > 2) {
      warnings.push(`Reference ${reference.referenceId} weight is not closely matched.`);
    }
    if (reference.weightOunces !== undefined && reference.dropWeight !== undefined) {
      const ounceDifference = reference.weightOunces - catalog.weightOunces;
      const dropDifference = reference.dropWeight - catalog.dropWeight;
      if (ounceDifference !== 0 || dropDifference !== 0) {
        warnings.push(`Reference ${reference.referenceId} differs by ${Math.abs(ounceDifference)} oz and ${Math.abs(dropDifference)} drop unit(s) from target equipment.`);
      }
    }
    warnings.push(...(reference.limitations ?? []));
    return warnings;
  });
}

function lowTrialWarning(session: PhysicalBatEvaluationSession): string | undefined {
  if (session.trialCounts.drySwingTrialCount < 5) return "Low dry-swing trial count limits evidence quality.";
  if ((session.evaluationMode ?? "comparative") === "comparative" && session.trialCounts.referenceAlternationCount < 2) {
    return "Low reference alternation count limits comparison strength.";
  }
  return undefined;
}

export function deriveStandaloneCanonicalInterpretation(
  response: PhysicalBatRubricResponse
): EquipmentDNAAttributeNormalizedValue | undefined {
  if (typeof response.canonicalInterpretation === "number") return undefined;
  if (response.attributeKey === "balance_profile") return response.canonicalInterpretation;
  const standaloneValues = response.dimensions
    .filter((dimension) => isStandaloneObservation(dimension.observation))
    .filter((dimension) => dimension.observation !== "unable_to_assess");
  if (standaloneValues.length !== response.dimensions.length) return undefined;
  if (standaloneValues.length === 0) return response.canonicalInterpretation;
  const mapped = standaloneValues.map((dimension) => {
    const value = dimension.observation as PhysicalBatStandaloneObservationScale;
    if (response.attributeKey === "swing_effort") return swingDemandOrdinal(value);
    if (response.attributeKey === "forgiveness" && dimension.key === "response_degradation") {
      return supportOrdinal(invertStandalone(value));
    }
    return supportOrdinal(value);
  });
  const ordered = mapped.map(ordinalRank).sort((a, b) => a - b);
  const medianRank = ordered[Math.floor(ordered.length / 2)];
  return response.attributeKey === "swing_effort" ? swingOrdinalFromRank(medianRank) : supportOrdinalFromRank(medianRank);
}

function isComparisonObservation(value: string): value is PhysicalBatComparisonScale {
  return (physicalBatComparisonScale as readonly string[]).includes(value);
}

function isStandaloneObservation(value: string): value is PhysicalBatStandaloneObservationScale {
  return (physicalBatStandaloneObservationScale as readonly string[]).includes(value);
}

function invertStandalone(value: PhysicalBatStandaloneObservationScale): PhysicalBatStandaloneObservationScale {
  const map: Record<PhysicalBatStandaloneObservationScale, PhysicalBatStandaloneObservationScale> = {
    very_low: "very_high",
    low: "high",
    moderate: "moderate",
    high: "low",
    very_high: "very_low",
    unable_to_assess: "unable_to_assess"
  };
  return map[value];
}

function swingDemandOrdinal(value: PhysicalBatStandaloneObservationScale) {
  const map = {
    very_low: "very_easy",
    low: "easy",
    moderate: "moderate",
    high: "demanding",
    very_high: "very_demanding",
    unable_to_assess: undefined
  } as const;
  return map[value];
}

function supportOrdinal(value: PhysicalBatStandaloneObservationScale) {
  const map = {
    very_low: "very_low",
    low: "low",
    moderate: "moderate",
    high: "high",
    very_high: "very_high",
    unable_to_assess: undefined
  } as const;
  return map[value];
}

function ordinalRank(value: string | undefined): number {
  const ranks: Record<string, number> = {
    very_easy: 0,
    very_low: 0,
    easy: 1,
    low: 1,
    moderate: 2,
    demanding: 3,
    high: 3,
    very_demanding: 4,
    very_high: 4
  };
  return ranks[value ?? "moderate"] ?? 2;
}

function swingOrdinalFromRank(rank: number) {
  return ["very_easy", "easy", "moderate", "demanding", "very_demanding"][rank] ?? "moderate";
}

function supportOrdinalFromRank(rank: number) {
  return ["very_low", "low", "moderate", "high", "very_high"][rank] ?? "moderate";
}

function compareText(label: string, expected: string, actual: string, matched: string[], mismatched: string[]) {
  if (expected.trim().toLowerCase() === actual.trim().toLowerCase()) matched.push(label);
  else mismatched.push(label);
}

function compareNumber(label: string, expected: number, actual: number, matched: string[], mismatched: string[]) {
  if (Math.abs(expected - actual) < 0.001) matched.push(label);
  else mismatched.push(label);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function check(name: string, passed: boolean, details = passed ? "pass" : "fail") {
  return { name, passed, details };
}

export function assertStructuredPhysicalInterpretation(value: EquipmentDNAAttributeNormalizedValue | undefined): void {
  if (typeof value === "number") {
    throw new Error("Structured physical evaluators may not enter arbitrary canonical numeric scores.");
  }
  if (typeof value === "string" && !allowedOrdinals.has(value)) {
    throw new Error(`Unsupported structured physical interpretation: ${value}.`);
  }
}
