import assert from "node:assert/strict";
import test from "node:test";
import {
  PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
  STANDALONE_ORDINAL_PERSISTENCE_VERSION,
  buildPhysicalBatEvaluationReadinessReport,
  buildPhysicalBatEvidenceCoverage,
  deriveStandaloneCanonicalInterpretation,
  reviewPhysicalBatEvaluationSession,
  validateStructuredPhysicalBatEvaluationProtocol,
  verifyPhysicalBatIdentity,
  type PhysicalBatCatalogIdentity,
  type PhysicalBatEvaluationSession
} from "../physical-evaluation/index.js";
import { evaluateRealWorldBehavioralEquipmentDNA } from "../behavioral/index.js";

const catalog: PhysicalBatCatalogIdentity = {
  equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c",
  equipmentVariantId: "variant-demarini-30-20",
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

test("physical verification accepts a correct catalog and variant match", () => {
  const result = verifyPhysicalBatIdentity(catalog, baseSession().physicalVerification);
  assert.equal(result.verified, true);
  assert.deepEqual(result.blockers, []);
  assert.ok(result.matched.includes("manufacturer"));
  assert.ok(result.matched.includes("equipmentVariantId"));
});

test("physical verification blocks incorrect manufacturer, model, variant, certification, and uncertainty", () => {
  const result = verifyPhysicalBatIdentity(catalog, {
    ...baseSession().physicalVerification,
    manufacturer: "Rawlings",
    model: "ICON",
    equipmentVariantId: "wrong-variant",
    certification: "USSSA",
    confidence: "uncertain"
  });
  assert.equal(result.verified, false);
  assert.ok(result.blockers.includes("manufacturer_mismatch"));
  assert.ok(result.blockers.includes("model_mismatch"));
  assert.ok(result.blockers.includes("variant_mismatch"));
  assert.ok(result.blockers.includes("certification_mismatch"));
  assert.ok(result.blockers.includes("identity_uncertain"));
});

test("damaged bats block behavioral evidence output", () => {
  const review = reviewPhysicalBatEvaluationSession({ ...baseSession(), equipmentCondition: "damaged" }, catalog);
  assert.equal(review.condition.blocksEvaluation, true);
  assert.ok(review.blockers.includes("damaged_bat"));
  assert.equal(review.evidence.length, 0);
});

test("missing evaluator and uncertain references are blockers", () => {
  const review = reviewPhysicalBatEvaluationSession({
    ...baseSession(),
    evaluator: { evaluatorId: "", category: "coach_evaluator" },
    referenceEquipment: [{ ...baseSession().referenceEquipment[0], identityVerified: false }]
  }, catalog);
  assert.ok(review.blockers.includes("missing_evaluator"));
  assert.ok(review.references.blockers.includes("reference_identity_uncertain"));
});

test("same evaluator repeat sessions are not independent sources", () => {
  const first = reviewPhysicalBatEvaluationSession(baseSession({ sessionId: "session-a", evaluatorId: "eval-1" }), catalog);
  const second = reviewPhysicalBatEvaluationSession(baseSession({ sessionId: "session-b", evaluatorId: "eval-1" }), catalog);
  const coverage = buildPhysicalBatEvidenceCoverage([...first.evidence, ...second.evidence]);
  const swing = coverage.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.sessionCount, 2);
  assert.equal(swing?.independentSourceCount, 1);
  assert.equal(swing?.status, "partial");
});

test("different evaluators are independent sources", () => {
  const first = reviewPhysicalBatEvaluationSession(baseSession({ sessionId: "session-a", evaluatorId: "eval-1" }), catalog);
  const second = reviewPhysicalBatEvaluationSession(baseSession({ sessionId: "session-b", evaluatorId: "eval-2" }), catalog);
  const coverage = buildPhysicalBatEvidenceCoverage([...first.evidence, ...second.evidence]);
  const swing = coverage.find((item) => item.attributeKey === "swing_effort");
  assert.equal(swing?.independentSourceCount, 2);
  assert.equal(swing?.status, "complete");
});

test("complete structured session emits #046-compatible behavioral evidence without numeric references", () => {
  const review = reviewPhysicalBatEvaluationSession(baseSession(), catalog);
  assert.equal(review.complete, "complete");
  assert.equal(review.evidence.length, 4);
  assert.equal(review.evidence.every((record) => record.category === "structured_internal_equipment_evaluation"), true);
  assert.equal(review.evidence.every((record) => record.numericReference === undefined), true);
  const behavioral = evaluateRealWorldBehavioralEquipmentDNA({
    equipmentId: catalog.equipmentId,
    equipmentLabel: "2023 DeMarini The Goods (-10) USA",
    variantLabel: catalog.sku,
    evidence: review.evidence
  });
  assert.equal(behavioral.readiness.requiredBehavioralAttributesUnresolved.length, 0);
  assert.equal(behavioral.readiness.liveActivationAllowed, false);
});

test("partial session preserves valid attribute evidence only", () => {
  const review = reviewPhysicalBatEvaluationSession({
    ...baseSession(),
    rubricResponses: [baseSession().rubricResponses[0], { ...baseSession().rubricResponses[2], dimensions: [] }]
  }, catalog);
  assert.equal(review.complete, "partial");
  assert.deepEqual(review.evidence.map((record) => record.attributeKey), ["swing_effort"]);
});

test("arbitrary canonical numeric input is rejected", () => {
  const review = reviewPhysicalBatEvaluationSession({
    ...baseSession(),
    rubricResponses: [{ ...baseSession().rubricResponses[0], canonicalInterpretation: 73 }]
  }, catalog);
  assert.ok(review.attributes[0]?.blockers.includes("arbitrary_canonical_score"));
  assert.equal(review.evidence.length, 0);
});

test("unable_to_assess is supported but does not create completed evidence", () => {
  const response = {
    ...baseSession().rubricResponses[0],
    dimensions: [{ key: "startup_demand", observation: "unable_to_assess" as const }]
  };
  const review = reviewPhysicalBatEvaluationSession({ ...baseSession(), rubricResponses: [response] }, catalog);
  assert.equal(review.attributes[0]?.completeness, "partial");
  assert.equal(review.evidence.length, 0);
});

test("player compatibility, Pilot outcome, and transition score contamination are blocked", () => {
  const review = reviewPhysicalBatEvaluationSession({
    ...baseSession(),
    playerSpecificConclusion: "Jackson will hit better with this bat.",
    pilotStudyReference: "pilot-study-01",
    transitionScoreUsed: true
  }, catalog);
  assert.ok(review.blockers.includes("player_specific_contamination"));
  assert.ok(review.blockers.includes("pilot_study_contamination"));
  assert.ok(review.blockers.includes("transition_score_contamination"));
  assert.equal(review.evidence.length, 0);
});

test("conflicting evaluator observations are preserved for Ticket #046 conflict policy", () => {
  const easier = reviewPhysicalBatEvaluationSession(baseSession({
    sessionId: "easy",
    evaluatorId: "eval-1",
    swingInterpretation: "easy"
  }), catalog);
  const demanding = reviewPhysicalBatEvaluationSession(baseSession({
    sessionId: "demanding",
    evaluatorId: "eval-2",
    swingInterpretation: "demanding"
  }), catalog);
  const behavioral = evaluateRealWorldBehavioralEquipmentDNA({
    equipmentId: catalog.equipmentId,
    equipmentLabel: "2023 DeMarini The Goods (-10) USA",
    evidence: [...easier.evidence, ...demanding.evidence]
  });
  const swing = behavioral.attributes.find((attribute) => attribute.attributeKey === "swing_effort");
  assert.equal(swing?.evaluationStatus, "blocked_conflict");
});

test("DeMarini readiness can be ready for evaluation while canonical readiness remains false", () => {
  const report = buildPhysicalBatEvaluationReadinessReport({
    equipmentId: catalog.equipmentId,
    equipmentVariantId: catalog.equipmentVariantId,
    equipmentLabel: "2023 DeMarini The Goods (-10) USA",
    variantLabel: catalog.sku,
    physicalIdentityReady: true,
    catalogSpecsReady: true,
    existingSessions: [],
    canonicalProfileReady: false
  });
  assert.equal(report.readyToPerformPhysicalEvaluation, true);
  assert.equal(report.existingPhysicalSessionCount, 0);
  assert.equal(report.canonicalProfileReady, false);
  assert.equal(report.genuineStudyReady, false);
  assert.equal(report.liveRecommendationActivationAllowed, false);
});

test("protocol validation report protects Ticket #047 boundaries", () => {
  const report = validateStructuredPhysicalBatEvaluationProtocol();
  assert.equal(report.verdict, "pass");
  assert.ok(report.checks.some((check) => check.name === "no live recommendation change" && check.passed));
});

test("standalone mode permits zero reference bats with explicit reference-unavailability context", () => {
  const review = reviewPhysicalBatEvaluationSession(standaloneSession(), catalog);
  assert.equal(review.evaluationMode, "standalone");
  assert.equal(review.references.validCount, 0);
  assert.equal(review.blockers.includes("missing_reference_context"), false);
  assert.equal(review.warnings.some((warning) => warning.includes("Standalone mode")), true);
});

test("standalone mode requires explicit reference-unavailability context", () => {
  const review = reviewPhysicalBatEvaluationSession({ ...standaloneSession(), referenceContext: undefined }, catalog);
  assert.ok(review.blockers.includes("missing_reference_context"));
  assert.equal(review.evidence.length, 0);
});

test("standalone mode rejects comparative observation vocabulary", () => {
  const session = {
    ...standaloneSession(),
    rubricResponses: [
      {
        ...standaloneSession().rubricResponses[0],
        dimensions: [{ key: "startup_demand", observation: "similar" as const }]
      }
    ]
  };
  const review = reviewPhysicalBatEvaluationSession(session, catalog);
  assert.ok(review.attributes[0]?.blockers.includes("mode_observation_mismatch"));
  assert.equal(review.evidence.length, 0);
});

test("comparative mode rejects standalone-only observation vocabulary", () => {
  const session = {
    ...baseSession(),
    rubricResponses: [
      {
        ...baseSession().rubricResponses[0],
        dimensions: [{ key: "startup_demand", observation: "low" as const }]
      }
    ]
  };
  const review = reviewPhysicalBatEvaluationSession(session, catalog);
  assert.ok(review.attributes[0]?.blockers.includes("mode_observation_mismatch"));
  assert.equal(review.evidence.length, 0);
});

test("dry-swing-only standalone session cannot fabricate forgiveness or sweet-spot evidence", () => {
  const session = {
    ...standaloneSession(),
    trialCounts: { drySwingTrialCount: 8, contactTrialCount: 0, referenceAlternationCount: 0 }
  };
  const review = reviewPhysicalBatEvaluationSession(session, catalog);
  const forgiveness = review.attributes.find((item) => item.attributeKey === "forgiveness");
  const sweetSpot = review.attributes.find((item) => item.attributeKey === "sweet_spot_support");
  assert.equal(forgiveness?.evidenceCreated, false);
  assert.equal(sweetSpot?.evidenceCreated, false);
  assert.ok(forgiveness?.blockers.includes("insufficient_trials"));
  assert.ok(sweetSpot?.blockers.includes("insufficient_trials"));
  assert.deepEqual(review.evidence.map((record) => record.attributeKey), ["swing_effort", "bat_control_support"]);
});

test("sufficient standalone dry-swing observations support swing effort and bat control only", () => {
  const session = {
    ...standaloneSession(),
    trialCounts: { drySwingTrialCount: 8, contactTrialCount: 0, referenceAlternationCount: 0 },
    rubricResponses: standaloneSession().rubricResponses.slice(0, 2)
  };
  const review = reviewPhysicalBatEvaluationSession(session, catalog);
  assert.deepEqual(review.evidence.map((record) => record.attributeKey), ["swing_effort", "bat_control_support"]);
  const swing = review.evidence.find((record) => record.attributeKey === "swing_effort");
  assert.equal(swing?.ordinalValue, "easy");
  assert.equal(swing?.numericReference, undefined);
  assert.equal(swing?.confidence, "estimated");
});

test("sufficient standalone contact observations support forgiveness and sweet spot support", () => {
  const review = reviewPhysicalBatEvaluationSession(standaloneSession(), catalog);
  const keys = review.evidence.map((record) => record.attributeKey);
  assert.ok(keys.includes("forgiveness"));
  assert.ok(keys.includes("sweet_spot_support"));
  assert.equal(review.evidence.every((record) => record.numericReference === undefined), true);
});

test("standalone unable_to_assess and missing observations do not become zero", () => {
  const session = {
    ...standaloneSession(),
    rubricResponses: [
      {
        ...standaloneSession().rubricResponses[0],
        dimensions: [
          { key: "startup_demand", observation: "unable_to_assess" as const },
          { key: "rotational_demand", observation: "low" as const }
        ]
      }
    ]
  };
  const review = reviewPhysicalBatEvaluationSession(session, catalog);
  assert.equal(review.evidence.length, 0);
  assert.equal(review.attributes[0]?.evidenceCreated, false);
});

test("standalone evidence provenance records mode and reference context", () => {
  const review = reviewPhysicalBatEvaluationSession(standaloneSession(), catalog);
  const raw = review.evidence[0]?.rawValue as { evaluationMode?: string; referenceContext?: { referenceAvailable?: boolean } };
  assert.equal(raw.evaluationMode, "standalone");
  assert.equal(raw.referenceContext?.referenceAvailable, false);
});

test("standalone evidence preserves derived ordinal persistence metadata", () => {
  const review = reviewPhysicalBatEvaluationSession(standaloneSession(), catalog);
  const swing = review.evidence.find((record) => record.attributeKey === "swing_effort");
  const raw = swing?.rawValue as {
    derivedStandaloneOrdinal?: string | null;
    standaloneOrdinalPersistenceVersion?: string;
    canonicalInterpretationStatus?: string;
  };
  assert.equal(swing?.ordinalValue, "easy");
  assert.equal(raw.derivedStandaloneOrdinal, "easy");
  assert.equal(raw.standaloneOrdinalPersistenceVersion, STANDALONE_ORDINAL_PERSISTENCE_VERSION);
  assert.equal(raw.canonicalInterpretationStatus, "available");
});

test("standalone derivation inverts response degradation for forgiveness", () => {
  const response = standaloneResponse("forgiveness", [
    ["off_center_response_consistency", "moderate"],
    ["handle_side_miss_tolerance", "low"],
    ["end_side_miss_tolerance", "low"],
    ["response_degradation", "high"]
  ]);
  assert.equal(deriveStandaloneCanonicalInterpretation(response), "low");
});

test("standalone repeated sessions remain distinct evidence records", () => {
  const first = reviewPhysicalBatEvaluationSession(standaloneSession({ sessionId: "standalone-a" }), catalog);
  const second = reviewPhysicalBatEvaluationSession(standaloneSession({ sessionId: "standalone-b" }), catalog);
  assert.notEqual(first.evidence[0]?.id, second.evidence[0]?.id);
  assert.equal([...first.evidence, ...second.evidence].filter((record) => record.attributeKey === "swing_effort").length, 2);
});

test("comparative mode accepts a verified external reference without catalog ids", () => {
  const review = reviewPhysicalBatEvaluationSession(externalReferenceSession(), catalog);
  assert.equal(review.evaluationMode, "comparative");
  assert.equal(review.references.validCount, 1);
  assert.equal(review.blockers.length, 0);
  assert.equal(review.warnings.some((warning) => warning.includes("verified external reference")), true);
  assert.equal(review.warnings.some((warning) => warning.includes("1 oz and 1 drop")), true);
});

test("verified external reference provenance is preserved without catalog authority", () => {
  const review = reviewPhysicalBatEvaluationSession(externalReferenceSession(), catalog);
  const raw = review.evidence[0]?.rawValue as {
    references?: readonly {
      referenceType?: string;
      equipmentId?: string;
      manufacturer?: string;
      model?: string;
      productIdentifier?: string;
      condition?: string;
    }[];
  };
  const reference = raw.references?.[0];
  assert.equal(reference?.referenceType, "verified_external_reference");
  assert.equal(reference?.equipmentId, undefined);
  assert.equal(reference?.manufacturer, "Louisville Slugger");
  assert.equal(reference?.model, "Omaha");
  assert.equal(reference?.productIdentifier, "WBL26640101930");
  assert.equal(reference?.condition, "normal_used_condition");
});

test("comparative external-reference observations create relative-only evidence without canonical interpretation", () => {
  const review = reviewPhysicalBatEvaluationSession(realDemariniOmahaSession(), catalog);
  assert.equal(review.complete, "complete");
  assert.equal(review.evidence.length, 4);
  for (const attribute of review.attributes) {
    assert.equal(attribute.observationCompleteness, "complete");
    assert.equal(attribute.evidenceEligibility, "eligible");
    assert.equal(attribute.interpretationMode, "relative_only");
    assert.equal(attribute.canonicalInterpretationStatus, "deferred");
    assert.equal(attribute.canonicalInterpretation, undefined);
    assert.equal(attribute.evidenceCreated, true);
  }
  for (const record of review.evidence) {
    const raw = record.rawValue as {
      interpretationMode?: string;
      canonicalInterpretationStatus?: string;
      canonicalInterpretation?: unknown;
      derivedStandaloneOrdinal?: unknown;
      standaloneOrdinalPersistenceVersion?: unknown;
      comparisonObservations?: readonly unknown[];
      evidenceClassification?: string;
      evaluatorConfidence?: string;
    };
    assert.equal(record.ordinalValue, undefined);
    assert.equal(record.numericReference, undefined);
    assert.equal(raw.interpretationMode, "relative_only");
    assert.equal(raw.canonicalInterpretationStatus, "deferred");
    assert.equal(raw.canonicalInterpretation, null);
    assert.equal(raw.derivedStandaloneOrdinal, undefined);
    assert.equal(raw.standaloneOrdinalPersistenceVersion, undefined);
    assert.equal(raw.evidenceClassification, "real_observation");
    assert.equal(raw.evaluatorConfidence, "medium");
    assert.ok((raw.comparisonObservations?.length ?? 0) >= 3);
  }
});

test("Ticket #046 consumes relative-only physical evidence while leaving absolute ordinals unresolved", () => {
  const review = reviewPhysicalBatEvaluationSession(realDemariniOmahaSession(), catalog);
  const behavioral = evaluateRealWorldBehavioralEquipmentDNA({
    equipmentId: catalog.equipmentId,
    equipmentLabel: "2023 DeMarini The Goods (-10) USA",
    variantLabel: catalog.sku,
    evidence: review.evidence
  });
  const swing = behavioral.attributes.find((attribute) => attribute.attributeKey === "swing_effort");
  assert.equal(swing?.evaluationStatus, "insufficient_evidence");
  assert.equal(swing?.evidenceCount, 1);
  assert.equal(swing?.supportingEvidence.length, 1);
  assert.equal(swing?.ordinalValue, undefined);
  assert.equal(swing?.numericReference, undefined);
  assert.ok(swing?.missingEvidence.some((item) => item.includes("Directional comparative physical evidence exists")));
  assert.deepEqual(behavioral.readiness.requiredBehavioralAttributesResolved, []);
  assert.equal(behavioral.readiness.liveActivationAllowed, false);
});

test("real DeMarini/Omaha repeated preparation is idempotent and deterministic", () => {
  const first = reviewPhysicalBatEvaluationSession(realDemariniOmahaSession(), catalog);
  const second = reviewPhysicalBatEvaluationSession(realDemariniOmahaSession(), catalog);
  assert.deepEqual(first.evidence.map((record) => record.id), second.evidence.map((record) => record.id));
  assert.deepEqual(first.evidence.map((record) => record.sourceReference), second.evidence.map((record) => record.sourceReference));
  assert.deepEqual(first.attributes, second.attributes);
});

test("verified external reference rejects insufficient identity, missing certification, and missing size", () => {
  const session = externalReferenceSession();
  const review = reviewPhysicalBatEvaluationSession({
    ...session,
    referenceEquipment: [
      {
        ...session.referenceEquipment[0],
        manufacturer: "",
        certification: undefined,
        weightOunces: undefined
      }
    ]
  }, catalog);
  assert.ok(review.blockers.includes("external_reference_identity_insufficient"));
  assert.ok(review.blockers.includes("external_reference_certification_missing"));
  assert.ok(review.blockers.includes("external_reference_size_missing"));
  assert.equal(review.evidence.length, 0);
});

test("damaged external reference is rejected as comparative context", () => {
  const session = externalReferenceSession();
  const review = reviewPhysicalBatEvaluationSession({
    ...session,
    referenceEquipment: [{ ...session.referenceEquipment[0], condition: "damaged" }]
  }, catalog);
  assert.ok(review.blockers.includes("external_reference_condition_blocked"));
  assert.equal(review.evidence.length, 0);
});

test("catalog reference still requires catalog ids and existing comparative behavior", () => {
  const review = reviewPhysicalBatEvaluationSession({
    ...baseSession(),
    referenceEquipment: [{ ...baseSession().referenceEquipment[0], referenceType: "catalog_reference" }]
  }, catalog);
  assert.equal(review.blockers.length, 0);
  assert.equal(review.evidence.length, 4);
});

test("comparative missing dimension, unable observation, and insufficient alternation block relative evidence", () => {
  const missingDimension = reviewPhysicalBatEvaluationSession({
    ...realDemariniOmahaSession(),
    rubricResponses: [
      {
        ...realDemariniOmahaSession().rubricResponses[0],
        dimensions: realDemariniOmahaSession().rubricResponses[0]!.dimensions.slice(0, 2)
      }
    ]
  }, catalog);
  assert.equal(missingDimension.attributes[0]?.evidenceCreated, false);
  assert.equal(missingDimension.attributes[0]?.observationCompleteness, "partial");

  const unable = reviewPhysicalBatEvaluationSession({
    ...realDemariniOmahaSession(),
    rubricResponses: [
      {
        ...realDemariniOmahaSession().rubricResponses[0],
        dimensions: [
          ...realDemariniOmahaSession().rubricResponses[0]!.dimensions.slice(0, 2),
          { key: "barrel_redirect", observation: "unable_to_assess" as const }
        ]
      }
    ]
  }, catalog);
  assert.equal(unable.attributes[0]?.evidenceCreated, false);
  assert.equal(unable.attributes[0]?.evidenceEligibility, "not_eligible");

  const insufficientTrials = reviewPhysicalBatEvaluationSession({
    ...realDemariniOmahaSession(),
    trialCounts: { drySwingTrialCount: 12, contactTrialCount: 12, referenceAlternationCount: 1 }
  }, catalog);
  assert.ok(insufficientTrials.attributes.every((attribute) => attribute.blockers.includes("insufficient_trials")));
  assert.equal(insufficientTrials.evidence.length, 0);
});

function baseSession(overrides: {
  readonly sessionId?: string;
  readonly evaluatorId?: string;
  readonly swingInterpretation?: string;
} = {}): PhysicalBatEvaluationSession {
  return {
    version: PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
    evaluationMode: "comparative",
    sessionId: overrides.sessionId ?? "physical-session-1",
    equipmentId: catalog.equipmentId,
    equipmentVariantId: catalog.equipmentVariantId,
    evaluationDate: "2026-08-15T00:00:00.000Z",
    physicalVerification: {
      equipmentId: catalog.equipmentId,
      equipmentVariantId: catalog.equipmentVariantId,
      manufacturer: catalog.manufacturer,
      model: catalog.model,
      modelYear: catalog.modelYear,
      certification: catalog.certification,
      lengthInches: catalog.lengthInches,
      weightOunces: catalog.weightOunces,
      dropWeight: catalog.dropWeight,
      barrelDiameter: catalog.barrelDiameter,
      source: "combined",
      verifiedAt: "2026-08-15T00:00:00.000Z",
      verifiedBy: "operator-1",
      productIdentifier: "WBD2359010",
      confidence: "confident"
    },
    equipmentCondition: "normal_used_condition",
    evaluator: {
      evaluatorId: overrides.evaluatorId ?? "evaluator-1",
      category: "internal_equipment_evaluator"
    },
    referenceEquipment: [
      {
          referenceId: "rawlings-icon-reference",
          referenceType: "catalog_reference",
          equipmentId: "raw-icon",
        equipmentVariantId: "raw-icon-30-20",
        label: "Rawlings ICON reference",
        certification: "USA",
        lengthInches: 30,
        weightOunces: 20,
        dropWeight: -10,
        identityVerified: true
      }
    ],
    trialCounts: {
      drySwingTrialCount: 8,
      contactTrialCount: 8,
      referenceAlternationCount: 3
    },
    rubricResponses: [
      response("swing_effort", overrides.swingInterpretation ?? "moderate", [
        "startup_demand",
        "rotational_demand",
        "barrel_redirect"
      ]),
      response("bat_control_support", "moderate", [
        "direction_changes",
        "start_stop_manageability",
        "path_consistency"
      ]),
      response("forgiveness", "moderate", [
        "varied_contact_regions",
        "mishit_response",
        "vibration_feedback"
      ]),
      response("sweet_spot_support", "moderate", [
        "usable_response_region",
        "barrel_response_consistency",
        "contact_location_variation"
      ])
    ],
    limitations: ["Controlled human evaluation only; no sensor measurements were recorded."],
    notes: ["Barrel observations stayed equipment-side."],
    provenanceClassification: "real_structured_physical_evaluation",
    testingConditionsValid: true
  };
}

function externalReferenceSession(): PhysicalBatEvaluationSession {
  return {
    ...baseSession(),
    sessionId: "external-reference-session",
    referenceEquipment: [
      {
        referenceType: "verified_external_reference",
        referenceId: "external-ls-omaha-2023-30-19",
        label: "2023 Louisville Slugger Omaha USA 30/19/-11",
        manufacturer: "Louisville Slugger",
        model: "Omaha",
        modelYear: 2023,
        certification: "USA",
        lengthInches: 30,
        weightOunces: 19,
        dropWeight: -11,
        barrelDiameter: 2.625,
        productIdentifier: "WBL26640101930",
        condition: "normal_used_condition",
        verificationSource: "combined",
        verifiedAt: "2026-08-16T00:00:00.000Z",
        verifiedBy: "operator-1",
        identityVerified: true,
        limitations: [
          "Reference differs by 1 oz and one drop unit from target equipment.",
          "Reference is one-piece alloy while target is two-piece hybrid.",
          "Reference has no recommendation/catalog authority."
        ]
      }
    ]
  };
}

function realDemariniOmahaSession(): PhysicalBatEvaluationSession {
  const referenceId = "external-louisville-slugger-omaha-2023-usa-30-19";
  return {
    ...externalReferenceSession(),
    sessionId: "demarini-omaha-physical-evaluation-01",
    evaluationDate: "2026-08-17T00:00:00.000Z",
    evaluator: {
      evaluatorId: "transition-operator",
      category: "internal_equipment_evaluator"
    },
    physicalVerification: {
      ...externalReferenceSession().physicalVerification,
      equipmentVariantId: "DEM-THE-GOODS-USA-30-20",
      verifiedAt: "2026-08-17T00:00:00.000Z",
      verifiedBy: "transition-operator"
    },
    referenceEquipment: [
      {
        referenceType: "verified_external_reference",
        referenceId,
        label: "2023 Louisville Slugger Omaha USA 30/19/-11",
        manufacturer: "Louisville Slugger",
        model: "Omaha",
        modelYear: 2023,
        certification: "USA",
        lengthInches: 30,
        weightOunces: 19,
        dropWeight: -11,
        barrelDiameter: 2.625,
        productIdentifier: "WBL266401030",
        condition: "normal_used_condition",
        verificationSource: "combined",
        verifiedAt: "2026-08-17T00:00:00.000Z",
        verifiedBy: "transition-operator",
        identityVerified: true,
        limitations: [
          "Reference differs by 1 oz and one drop unit from target equipment.",
          "Reference is one-piece alloy while target is two-piece hybrid.",
          "Reference is an evaluation instrument only and has no recommendation/catalog authority."
        ]
      }
    ],
    trialCounts: {
      drySwingTrialCount: 12,
      contactTrialCount: 12,
      referenceAlternationCount: 3
    },
    rubricResponses: [
      comparativeResponse("swing_effort", referenceId, [
        ["startup_demand", "somewhat_more"],
        ["rotational_demand", "somewhat_more"],
        ["barrel_redirect", "clearly_more"]
      ]),
      comparativeResponse("bat_control_support", referenceId, [
        ["direction_changes", "somewhat_less"],
        ["start_stop_manageability", "somewhat_less"],
        ["path_consistency", "somewhat_less"]
      ]),
      comparativeResponse("forgiveness", referenceId, [
        ["varied_contact_regions", "somewhat_less"],
        ["mishit_response", "somewhat_less"],
        ["vibration_feedback", "somewhat_more"]
      ]),
      comparativeResponse("sweet_spot_support", referenceId, [
        ["usable_response_region", "somewhat_less"],
        ["barrel_response_consistency", "somewhat_less"],
        ["contact_location_variation", "somewhat_less"]
      ])
    ],
    limitations: [
      "Reference bat is 1 oz lighter and one drop unit different from target equipment.",
      "Reference is one-piece alloy while target is two-piece hybrid.",
      "Behavioral observations are comparative physical-evaluation observations and not player compatibility conclusions."
    ],
    notes: ["Real structured comparative physical evaluation."],
    provenanceClassification: "real_observation",
    testingConditionsValid: true
  };
}

function standaloneSession(overrides: {
  readonly sessionId?: string;
  readonly evaluatorId?: string;
} = {}): PhysicalBatEvaluationSession {
  return {
    ...baseSession({ sessionId: overrides.sessionId, evaluatorId: overrides.evaluatorId }),
    evaluationMode: "standalone",
    referenceContext: {
      referenceAvailable: false,
      reason: "no_suitable_verified_reference_available",
      notes: "No suitable verified physical reference bat was available."
    },
    referenceEquipment: [],
    trialCounts: {
      drySwingTrialCount: 8,
      contactTrialCount: 8,
      referenceAlternationCount: 0
    },
    rubricResponses: [
      standaloneResponse("swing_effort", [
        ["startup_demand", "low"],
        ["rotational_demand", "low"],
        ["barrel_redirect_demand", "moderate"]
      ]),
      standaloneResponse("bat_control_support", [
        ["directional_controllability", "high"],
        ["barrel_path_manageability", "moderate"],
        ["start_stop_controllability", "moderate"]
      ]),
      standaloneResponse("forgiveness", [
        ["off_center_response_consistency", "moderate"],
        ["handle_side_miss_tolerance", "moderate"],
        ["end_side_miss_tolerance", "moderate"],
        ["response_degradation", "moderate"]
      ]),
      standaloneResponse("sweet_spot_support", [
        ["usable_contact_region", "moderate"],
        ["centered_response_consistency", "high"],
        ["near_center_response_consistency", "moderate"]
      ])
    ]
  };
}

function response(
  attributeKey: PhysicalBatEvaluationSession["rubricResponses"][number]["attributeKey"],
  canonicalInterpretation: string,
  keys: readonly string[]
) {
  return {
    attributeKey,
    canonicalInterpretation,
    evaluatorConfidence: "high" as const,
    limitations: ["No exact 0-100 score was entered by the evaluator."],
    dimensions: keys.map((key) => ({
      key,
      observation: "similar" as const,
      referenceId: "rawlings-icon-reference",
      notes: "Structured comparison observation."
    }))
  };
}

function standaloneResponse(
  attributeKey: PhysicalBatEvaluationSession["rubricResponses"][number]["attributeKey"],
  dimensions: readonly (readonly [string, "very_low" | "low" | "moderate" | "high" | "very_high" | "unable_to_assess"])[]
) {
  return {
    attributeKey,
    evaluatorConfidence: "medium" as const,
    limitations: ["Standalone observation only; no verified physical reference comparison was available."],
    dimensions: dimensions.map(([key, observation]) => ({
      key,
      observation,
      notes: "Standalone categorical equipment-side observation."
    }))
  };
}

function comparativeResponse(
  attributeKey: PhysicalBatEvaluationSession["rubricResponses"][number]["attributeKey"],
  referenceId: string,
  dimensions: readonly (readonly [string, "clearly_less" | "somewhat_less" | "similar" | "somewhat_more" | "clearly_more" | "unable_to_assess"])[]
) {
  return {
    attributeKey,
    evaluatorConfidence: "medium" as const,
    limitations: ["Reference-only comparison; canonical interpretation is deferred."],
    dimensions: dimensions.map(([key, observation]) => ({
      key,
      observation,
      referenceId,
      notes: "Structured relative comparison observation."
    }))
  };
}
