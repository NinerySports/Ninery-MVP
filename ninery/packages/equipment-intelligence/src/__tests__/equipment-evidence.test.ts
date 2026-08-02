import assert from "node:assert/strict";
import test from "node:test";
import {
  EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION,
  EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
  EQUIPMENT_DNA_READINESS_MODEL_VERSION,
  EquipmentDNAEvaluationService,
  assessEquipmentAttributeConfidence,
  assessEquipmentDNARecommendationReadiness,
  assessEquipmentDNAMaturity,
  assessEvidenceRequirementCompatibility,
  detectEquipmentEvidenceConflict,
  getRequiredEquipmentDNAAttributeDefinitions,
  nextEvaluationVersion,
  validateEquipmentDNAAttributeEvaluation,
  validateEquipmentDNAEvidenceRecord,
  type CreateEquipmentDNAAttributeEvaluationInput,
  type CreateEquipmentDNAEvidenceRecordInput,
  type EquipmentDNAAttributeEvaluation,
  type EquipmentDNAEvaluationRepositoryPort,
  type EquipmentDNAEvidenceRecord
} from "../index.js";

const equipmentId = "equipment-1";
const variantId = "variant-1";

test("evidence validation accepts known registry keys and rejects unknown keys", () => {
  assert.equal(validateEquipmentDNAEvidenceRecord(evidence({ attributeKey: "certification", normalizedValue: "USA" })).valid, true);

  const result = validateEquipmentDNAEvidenceRecord(evidence({ attributeKey: "unknown_attribute" }));
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /Unknown Equipment DNA attribute key/);
});

test("evidence validation requires definition version, target, source name, and valid level", () => {
  assert.equal(validateEquipmentDNAEvidenceRecord({ ...evidence(), attributeDefinitionVersion: "" }).valid, false);
  assert.equal(validateEquipmentDNAEvidenceRecord({ ...evidence(), equipmentId: undefined }).valid, false);
  assert.equal(validateEquipmentDNAEvidenceRecord({ ...evidence(), sourceName: " " }).valid, false);
  assert.equal(validateEquipmentDNAEvidenceRecord({ ...evidence(), status: "collected" as "active" }).valid, false);
  assert.equal(validateEquipmentDNAEvidenceRecord(evidence({ attributeKey: "length", targetLevel: "equipment" })).valid, false);
});

test("superseded evidence remains readable and valid", () => {
  const result = validateEquipmentDNAEvidenceRecord(evidence({ status: "superseded" }));

  assert.equal(result.valid, true);
});

test("attribute evaluation validation accepts valid values and rejects invalid values", () => {
  const activeEvidence = [structuredEvidence({ attributeKey: "swing_effort", normalizedValue: "moderate" })];

  assert.equal(
    validateEquipmentDNAAttributeEvaluation(
      evaluation({ attributeKey: "swing_effort", value: "moderate", status: "active", rationale: "Rubric reviewed." }),
      activeEvidence
    ).valid,
    true
  );
  assert.equal(validateEquipmentDNAAttributeEvaluation(evaluation({ attributeKey: "swing_effort", value: "pretty easy" })).valid, false);
  assert.equal(validateEquipmentDNAAttributeEvaluation(evaluation({ attributeKey: "length", value: 10 })).valid, false);
});

test("active evaluations require evidence and rationale while drafts may be incomplete", () => {
  const active = validateEquipmentDNAAttributeEvaluation(
    evaluation({ attributeKey: "swing_effort", value: "moderate", status: "active", rationale: "" }),
    []
  );
  const draft = validateEquipmentDNAAttributeEvaluation(
    evaluation({ attributeKey: "swing_effort", value: "moderate", status: "draft", rationale: "" }),
    []
  );

  assert.equal(active.valid, false);
  assert.match(active.errors.join(" "), /evidence/);
  assert.match(active.errors.join(" "), /rationale/);
  assert.equal(draft.valid, true);
});

test("evaluation version increments deterministically", () => {
  assert.equal(nextEvaluationVersion([evaluation({ evaluationVersion: 1 }), evaluation({ evaluationVersion: 3 })]), 4);
});

test("evidence requirement compatibility follows registry requirements", () => {
  assert.equal(
    assessEvidenceRequirementCompatibility("length", [
      evidence({ attributeKey: "length", targetLevel: "variant", equipmentId: undefined, equipmentVariantId: variantId, normalizedValue: 30 })
    ]).compatible,
    true
  );
  assert.equal(
    assessEvidenceRequirementCompatibility("forgiveness", [
      evidence({ attributeKey: "forgiveness", normalizedValue: "high" })
    ]).compatible,
    false
  );
  assert.equal(
    assessEvidenceRequirementCompatibility("forgiveness", [
      structuredEvidence({ attributeKey: "forgiveness", normalizedValue: "high" }),
      feedbackEvidence({ attributeKey: "forgiveness", normalizedValue: "high" })
    ]).compatible,
    true
  );
  assert.equal(
    assessEvidenceRequirementCompatibility("barrel_stability", [
      structuredEvidence({ attributeKey: "barrel_stability", normalizedValue: "moderate" })
    ]).compatible,
    true
  );
});

test("confidence model is deterministic and returns reasons", () => {
  const input = {
    evaluation: evaluation({ attributeKey: "length", targetLevel: "variant", equipmentId: undefined, equipmentVariantId: variantId, value: 30 }),
    evidenceRecords: [
      evidence({ attributeKey: "length", targetLevel: "variant", equipmentId: undefined, equipmentVariantId: variantId, normalizedValue: 30 })
    ]
  };

  assert.equal(EQUIPMENT_ATTRIBUTE_CONFIDENCE_MODEL_VERSION, "1.0");
  assert.deepEqual(assessEquipmentAttributeConfidence(input), assessEquipmentAttributeConfidence(input));
  assert.equal(assessEquipmentAttributeConfidence(input).confidence, "validated");
  assert.ok(assessEquipmentAttributeConfidence(input).reasons.length > 0);
});

test("qualitative manufacturer-only evidence cannot receive validated confidence", () => {
  const result = assessEquipmentAttributeConfidence({
    evaluation: evaluation({ attributeKey: "forgiveness", value: "high" }),
    evidenceRecords: [evidence({ attributeKey: "forgiveness", normalizedValue: "high" })]
  });

  assert.equal(result.confidence, "estimated");
});

test("multiple independent sources increase confidence", () => {
  const result = assessEquipmentAttributeConfidence({
    evaluation: evaluation({ attributeKey: "forgiveness", value: "high" }),
    evidenceRecords: [
      structuredEvidence({ attributeKey: "forgiveness", normalizedValue: "high" }),
      feedbackEvidence({ attributeKey: "forgiveness", normalizedValue: "high" })
    ]
  });

  assert.equal(result.confidence, "high");
});

test("disputed and materially conflicting evidence limit confidence", () => {
  const disputed = assessEquipmentAttributeConfidence({
    evaluation: evaluation({ attributeKey: "material", value: "composite" }),
    evidenceRecords: [evidence({ attributeKey: "material", normalizedValue: "composite", status: "disputed" })]
  });
  const conflict = detectEquipmentEvidenceConflict({
    attributeKey: "material",
    evidenceRecords: [
      evidence({ attributeKey: "material", normalizedValue: "composite" }),
      evidence({ attributeKey: "material", normalizedValue: "alloy", sourceName: "Second source" })
    ]
  });
  const conflicted = assessEquipmentAttributeConfidence({
    evaluation: evaluation({ attributeKey: "material", value: "composite" }),
    evidenceRecords: [],
    conflict
  });

  assert.equal(disputed.confidence, "estimated");
  assert.equal(conflict.severity, "material");
  assert.equal(conflicted.confidence, "estimated");
});

test("conflict detection handles matching, numeric tolerance, ordinal spread, and disputed status", () => {
  assert.equal(
    detectEquipmentEvidenceConflict({
      attributeKey: "length",
      evidenceRecords: [
        evidence({ attributeKey: "length", targetLevel: "variant", equipmentId: undefined, equipmentVariantId: variantId, normalizedValue: 30 }),
        evidence({ attributeKey: "length", targetLevel: "variant", equipmentId: undefined, equipmentVariantId: variantId, normalizedValue: 30.1 })
      ]
    }).severity,
    "none"
  );
  assert.equal(
    detectEquipmentEvidenceConflict({
      attributeKey: "length",
      evidenceRecords: [
        evidence({ attributeKey: "length", targetLevel: "variant", equipmentId: undefined, equipmentVariantId: variantId, normalizedValue: 30 }),
        evidence({ attributeKey: "length", targetLevel: "variant", equipmentId: undefined, equipmentVariantId: variantId, normalizedValue: 31 })
      ]
    }).severity,
    "material"
  );
  assert.equal(
    detectEquipmentEvidenceConflict({
      attributeKey: "swing_effort",
      evidenceRecords: [
        structuredEvidence({ attributeKey: "swing_effort", normalizedValue: "very_easy" }),
        structuredEvidence({ attributeKey: "swing_effort", normalizedValue: "very_demanding", sourceName: "Second rubric" })
      ]
    }).severity,
    "material"
  );
  assert.equal(
    detectEquipmentEvidenceConflict({
      attributeKey: "material",
      evidenceRecords: [evidence({ attributeKey: "material", normalizedValue: "composite", status: "disputed" })]
    }).severity,
    "material"
  );
});

test("readiness reports missing, invalid, estimated, experimental, and complete profile states", () => {
  assert.equal(EQUIPMENT_DNA_READINESS_MODEL_VERSION, "1.0");
  assert.deepEqual(
    getRequiredEquipmentDNAAttributeDefinitions().map((definition) => definition.key),
    [
      "length",
      "weight",
      "drop",
      "certification",
      "barrel_diameter",
      "swing_effort",
      "forgiveness",
      "sweet_spot_support",
      "bat_control_support"
    ]
  );

  const missing = assessEquipmentDNARecommendationReadiness({ evaluations: [] });
  assert.equal(missing.ready, false);
  assert.ok(missing.missingRequiredAttributes.includes("length"));

  const invalid = assessEquipmentDNARecommendationReadiness({
    evaluations: [completeProfileEvaluation("length", 10, "variant", [variantEvidence("length", 10)])]
  });
  assert.equal(invalid.ready, false);
  assert.ok(invalid.invalidAttributes.includes("length"));

  const estimated = assessEquipmentDNARecommendationReadiness({
    evaluations: [
      completeProfileEvaluation("length", 30, "variant", [
        { ...variantEvidence("length", 30), sourceType: "other", method: "manual_review" }
      ])
    ]
  });
  assert.equal(estimated.ready, false);
  assert.ok(estimated.insufficientConfidenceAttributes.includes("length") || estimated.invalidAttributes.includes("length"));

  const complete = assessEquipmentDNARecommendationReadiness({
    evaluations: [
      ...completeSyntheticProfile(),
      evaluation({
        attributeKey: "transition_difficulty",
        value: "moderate",
        status: "active",
        confidence: "moderate",
        rationale: "Candidate context only.",
        evidenceRecords: [structuredEvidence({ attributeKey: "transition_difficulty", normalizedValue: "moderate" })]
      })
    ]
  });
  assert.equal(complete.ready, true);
  assert.ok(complete.experimentalAttributesIgnored.includes("transition_difficulty"));
});

test("maturity is separate from readiness and requires appropriate evidence", () => {
  assert.equal(assessEquipmentDNAMaturity({ evaluations: [] }).maturity, "basic");
  assert.equal(assessEquipmentDNAMaturity({ evaluations: completeSyntheticProfile() }).maturity, "evaluated");
  assert.equal(
    assessEquipmentDNAMaturity({
      evaluations: [
        ...completeSyntheticProfile(),
        completeProfileEvaluation("forgiveness", "high", "equipment", [
          structuredEvidence({ attributeKey: "forgiveness", normalizedValue: "high" }),
          { ...structuredEvidence({ attributeKey: "forgiveness", normalizedValue: "high" }), sourceType: "objective_measurement", method: "instrument_measurement" }
        ])
      ]
    }).maturity,
    "validated"
  );
});

test("service enforces active lifecycle rules and active uniqueness", async () => {
  const repository = new InMemoryEvaluationRepository();
  const service = new EquipmentDNAEvaluationService(repository);
  const draft = await service.createDraftEvaluation(
    evaluation({ attributeKey: "swing_effort", value: "moderate", status: "draft", rationale: "" })
  );
  const evidenceRecord = await service.createEvidence(structuredEvidence({ attributeKey: "swing_effort", normalizedValue: "moderate" }));
  const feedbackRecord = await service.createEvidence(feedbackEvidence({ attributeKey: "swing_effort", normalizedValue: "moderate" }));

  const active = await service.activateEvaluation({
    evaluationId: draft.id ?? "",
    evidenceRecordIds: [evidenceRecord.id ?? "", feedbackRecord.id ?? ""],
    rationale: "Standard rubric supports a moderate swing-effort value."
  });

  assert.equal(active.status, "active");
  assert.equal(active.confidence, "high");

  const secondDraft = await service.createDraftEvaluation(
    evaluation({ attributeKey: "swing_effort", value: "moderate", status: "draft", rationale: "" })
  );
  await assert.rejects(
    () =>
      service.activateEvaluation({
        evaluationId: secondDraft.id ?? "",
        evidenceRecordIds: [evidenceRecord.id ?? "", feedbackRecord.id ?? ""],
        rationale: "Duplicate active attempt."
      }),
    /Only one active evaluation/
  );
});

test("service supersedes previous evaluations and increments versions", async () => {
  const repository = new InMemoryEvaluationRepository();
  const service = new EquipmentDNAEvaluationService(repository);
  const prior = await service.createDraftEvaluation(evaluation({ evaluationVersion: 1 }));

  const next = await service.supersedeEvaluation({
    priorEvaluationId: prior.id ?? "",
    nextEvaluation: evaluation({ evaluationVersion: 99, supersedesEvaluationId: undefined })
  });

  const updatedPrior = await repository.findEvaluationById(prior.id ?? "");
  assert.equal(updatedPrior?.status, "superseded");
  assert.equal(next.evaluationVersion, 2);
  assert.equal(next.supersedesEvaluationId, prior.id);
});

function evidence(overrides: Partial<EquipmentDNAEvidenceRecord> = {}): EquipmentDNAEvidenceRecord {
  return {
    equipmentId,
    targetLevel: "equipment",
    attributeKey: "certification",
    attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    sourceType: "manufacturer_specification",
    sourceName: "Manufacturer spec sheet",
    method: "direct_specification",
    normalizedValue: "USA",
    status: "active",
    ...overrides
  };
}

function structuredEvidence(overrides: Partial<EquipmentDNAEvidenceRecord> = {}): EquipmentDNAEvidenceRecord {
  return evidence({
    attributeKey: "forgiveness",
    sourceType: "structured_expert_evaluation",
    sourceName: "Internal standardized rubric",
    method: "standardized_rubric",
    normalizedValue: "high",
    ...overrides
  });
}

function feedbackEvidence(overrides: Partial<EquipmentDNAEvidenceRecord> = {}): EquipmentDNAEvidenceRecord {
  return evidence({
    attributeKey: "forgiveness",
    sourceType: "coach_feedback",
    sourceName: "Coach structured feedback",
    method: "structured_feedback",
    normalizedValue: "high",
    ...overrides
  });
}

function variantEvidence(attributeKey: string, normalizedValue: string | number): EquipmentDNAEvidenceRecord {
  return evidence({
    attributeKey,
    equipmentId: undefined,
    equipmentVariantId: variantId,
    targetLevel: "variant",
    normalizedValue
  });
}

function evaluation(overrides: Partial<EquipmentDNAAttributeEvaluation> = {}): EquipmentDNAAttributeEvaluation {
  return {
    equipmentId,
    targetLevel: "equipment",
    attributeKey: "forgiveness",
    attributeDefinitionVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    value: "high",
    confidence: "estimated",
    evaluationMethod: "standardized_rubric",
    evaluationVersion: 1,
    status: "draft",
    ...overrides
  };
}

function completeProfileEvaluation(
  attributeKey: string,
  value: string | number,
  targetLevel: "equipment" | "variant",
  evidenceRecords: EquipmentDNAEvidenceRecord[]
): EquipmentDNAAttributeEvaluation {
  return evaluation({
    attributeKey,
    value,
    targetLevel,
    equipmentId: targetLevel === "equipment" ? equipmentId : undefined,
    equipmentVariantId: targetLevel === "variant" ? variantId : undefined,
    confidence: targetLevel === "variant" ? "validated" : "high",
    status: "active",
    rationale: "Synthetic complete profile fixture.",
    evidenceRecords
  });
}

function completeSyntheticProfile(): EquipmentDNAAttributeEvaluation[] {
  return [
    completeProfileEvaluation("length", 30, "variant", [variantEvidence("length", 30)]),
    completeProfileEvaluation("weight", 22, "variant", [variantEvidence("weight", 22)]),
    completeProfileEvaluation("drop", -8, "variant", [variantEvidence("drop", -8)]),
    completeProfileEvaluation("certification", "USA", "equipment", [evidence({ attributeKey: "certification", normalizedValue: "USA" })]),
    completeProfileEvaluation("barrel_diameter", 2.625, "equipment", [evidence({ attributeKey: "barrel_diameter", normalizedValue: 2.625 })]),
    completeProfileEvaluation("swing_effort", "moderate", "equipment", [
      structuredEvidence({ attributeKey: "swing_effort", normalizedValue: "moderate" }),
      feedbackEvidence({ attributeKey: "swing_effort", normalizedValue: "moderate" })
    ]),
    completeProfileEvaluation("forgiveness", "high", "equipment", [
      structuredEvidence({ attributeKey: "forgiveness", normalizedValue: "high" }),
      feedbackEvidence({ attributeKey: "forgiveness", normalizedValue: "high" })
    ]),
    completeProfileEvaluation("sweet_spot_support", "high", "equipment", [
      structuredEvidence({ attributeKey: "sweet_spot_support", normalizedValue: "high" }),
      feedbackEvidence({ attributeKey: "sweet_spot_support", normalizedValue: "high" })
    ]),
    completeProfileEvaluation("bat_control_support", "high", "equipment", [
      structuredEvidence({ attributeKey: "bat_control_support", normalizedValue: "high" }),
      feedbackEvidence({ attributeKey: "bat_control_support", normalizedValue: "high" })
    ])
  ];
}

class InMemoryEvaluationRepository implements EquipmentDNAEvaluationRepositoryPort {
  private evidenceRecords: EquipmentDNAEvidenceRecord[] = [];
  private evaluations: EquipmentDNAAttributeEvaluation[] = [];

  async createEvidence(input: CreateEquipmentDNAEvidenceRecordInput): Promise<EquipmentDNAEvidenceRecord> {
    const record = { ...input, id: `evidence-${this.evidenceRecords.length + 1}` };
    this.evidenceRecords.push(record);
    return record;
  }

  async listEvidenceForEquipment(equipmentIdInput: string): Promise<EquipmentDNAEvidenceRecord[]> {
    return this.evidenceRecords.filter((record) => record.equipmentId === equipmentIdInput);
  }

  async listEvidenceForVariant(equipmentVariantIdInput: string): Promise<EquipmentDNAEvidenceRecord[]> {
    return this.evidenceRecords.filter((record) => record.equipmentVariantId === equipmentVariantIdInput);
  }

  async listEvidenceByIds(evidenceRecordIds: readonly string[]): Promise<EquipmentDNAEvidenceRecord[]> {
    return this.evidenceRecords.filter((record) => record.id && evidenceRecordIds.includes(record.id));
  }

  async createDraftEvaluation(
    input: CreateEquipmentDNAAttributeEvaluationInput
  ): Promise<EquipmentDNAAttributeEvaluation> {
    const record = { ...input, id: `evaluation-${this.evaluations.length + 1}` };
    this.evaluations.push(record);
    return record;
  }

  async updateEvaluationStatus(input: {
    evaluationId: string;
    status: EquipmentDNAAttributeEvaluation["status"];
    confidence?: EquipmentDNAAttributeEvaluation["confidence"];
    rationale?: string;
    evaluatedAt?: Date;
  }): Promise<EquipmentDNAAttributeEvaluation> {
    const index = this.evaluations.findIndex((evaluationRecord) => evaluationRecord.id === input.evaluationId);
    assert.notEqual(index, -1);
    this.evaluations[index] = {
      ...this.evaluations[index],
      status: input.status,
      confidence: input.confidence ?? this.evaluations[index].confidence,
      rationale: input.rationale ?? this.evaluations[index].rationale,
      evaluatedAt: input.evaluatedAt ?? this.evaluations[index].evaluatedAt
    };
    return this.evaluations[index];
  }

  async linkEvidenceToEvaluation(evaluationId: string, evidenceRecordIds: readonly string[]): Promise<void> {
    const evaluationRecord = await this.findEvaluationById(evaluationId);
    if (evaluationRecord) {
      evaluationRecord.evidenceRecords = await this.listEvidenceByIds(evidenceRecordIds);
    }
  }

  async findEvaluationById(evaluationId: string): Promise<EquipmentDNAAttributeEvaluation | undefined> {
    return this.evaluations.find((evaluationRecord) => evaluationRecord.id === evaluationId);
  }

  async findCurrentActiveEvaluation(input: {
    equipmentId?: string;
    equipmentVariantId?: string;
    attributeKey: string;
    attributeDefinitionVersion: string;
  }): Promise<EquipmentDNAAttributeEvaluation | undefined> {
    return this.evaluations.find(
      (evaluationRecord) =>
        evaluationRecord.status === "active" &&
        evaluationRecord.equipmentId === input.equipmentId &&
        evaluationRecord.equipmentVariantId === input.equipmentVariantId &&
        evaluationRecord.attributeKey === input.attributeKey &&
        evaluationRecord.attributeDefinitionVersion === input.attributeDefinitionVersion
    );
  }

  async listCurrentEvaluationsForEquipment(equipmentIdInput: string): Promise<EquipmentDNAAttributeEvaluation[]> {
    return this.evaluations.filter(
      (evaluationRecord) => evaluationRecord.status === "active" && evaluationRecord.equipmentId === equipmentIdInput
    );
  }

  async listCurrentEvaluationsForVariant(equipmentVariantIdInput: string): Promise<EquipmentDNAAttributeEvaluation[]> {
    return this.evaluations.filter(
      (evaluationRecord) =>
        evaluationRecord.status === "active" && evaluationRecord.equipmentVariantId === equipmentVariantIdInput
    );
  }
}
