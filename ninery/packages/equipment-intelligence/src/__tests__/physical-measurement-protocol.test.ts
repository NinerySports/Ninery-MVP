import assert from "node:assert/strict";
import test from "node:test";
import { aggregateTrials, buildPhysicalMeasurementEvidence, buildPhysicalMeasurementSessionTemplate, comparePhysicalMeasurementEvidence, circumferenceDerivedDiameterMethods, classifyPhysicalMeasurementIndependence, HANDLE_MEASUREMENT_LOCATION_FROM_KNOB_MM, normalizeAggregate, persistPhysicalMeasurementSession, physicalMeasurementEvidenceIsSemanticallyEqual, physicalMeasurementMethods, reviewPhysicalMeasurementSession, semanticJson, summarizeRepeatability, type PhysicalMeasurementBlock, type PhysicalMeasurementEvidenceRecord, type PhysicalMeasurementSession } from "../index.js";

test("blank packet preserves identity and contains no fabricated measurements", () => {
  const packet = template();
  assert.equal(packet.protocolVersion, "1.0"); assert.equal(packet.provenanceClassification, "real_physical_measurement");
  assert.equal(packet.measurementBlocks.length, 5); assert.ok(packet.measurementBlocks.every((block) => block.trials.every((trial) => trial.value === undefined)));
  assert.equal(reviewPhysicalMeasurementSession(packet).persistenceEligible, false);
});

test("identity, specimen, operator, session, verification, and condition gate persistence", () => {
  const base = complete();
  for (const [field, value, blocker] of [["equipmentId", "bad", "valid_equipment_uuid_required"], ["equipmentVariantId", "bad", "valid_variant_uuid_required"], ["specimenReference", "", "specimen_reference_required"], ["measurementSessionId", "", "measurement_session_id_required"], ["operatorId", "", "operator_id_required"]] as const) assert.ok(reviewPhysicalMeasurementSession({ ...base, [field]: value }).blockers.includes(blocker));
  assert.ok(reviewPhysicalMeasurementSession({ ...base, physicalVerification: { ...base.physicalVerification, equipmentId: "00000000-0000-4000-8000-000000000000" } }).blockers.includes("physical_verification_identity_mismatch"));
  assert.ok(reviewPhysicalMeasurementSession({ ...base, physicalVerification: { ...base.physicalVerification, confidence: "uncertain" } }).blockers.includes("physical_verification_uncertain"));
  assert.ok(reviewPhysicalMeasurementSession(base, { ...base.physicalVerification, manufacturer: "Wrong" }).blockers.includes("physical_verification_catalog_mismatch"));
  assert.ok(reviewPhysicalMeasurementSession({ ...base, equipmentCondition: "modified", modifications: [] }).blockers.includes("modifications_required"));
  assert.ok(reviewPhysicalMeasurementSession({ ...base, measurementBlocks: base.measurementBlocks.slice(1) }).blockers.includes("missing_measurement_block:actual_mass"));
});

test("median aggregation, raw trials, units, conversion, and repeatability remain traceable", () => {
  const block = complete().measurementBlocks[0]!;
  assert.equal(aggregateTrials(block), 567.1);
  const normalized = normalizeAggregate({ ...block, rawUnit: "ounces", trials: [{ trialNumber: 1, value: 20, repositioned: true }, { trialNumber: 2, value: 20, repositioned: true }, { trialNumber: 3, value: 20, repositioned: true }] }, 20);
  assert.equal(normalized.rawValue, 20); assert.equal(normalized.rawUnit, "ounces"); assert.equal(normalized.normalizedValue, 566.9904625);
  const evidence = buildPhysicalMeasurementEvidence(complete(), block, "complete_variation_observed");
  assert.deepEqual((evidence.rawValue as { trials: unknown }).trials, block.trials); assert.equal((evidence.normalizedValue as { independentMeasurement: boolean }).independentMeasurement, false);
  assert.deepEqual(summarizeRepeatability([1, 2, 3]), { trialCount: 3, minimum: 1, maximum: 3, range: 2, mean: 2, median: 2, standardDeviation: Math.sqrt(2 / 3), threshold: "calibration_pending" });
});

test("measurement-specific methods and firewalls are explicit", () => {
  assert.match(physicalMeasurementMethods.overall_length.referencePoints, /furthest physical knob endpoint/i);
  assert.match(physicalMeasurementMethods.balance_point.referencePoints, /knob endpoint/);
  assert.equal(physicalMeasurementMethods.balance_point.minimumTrials, 3);
  assert.equal(HANDLE_MEASUREMENT_LOCATION_FROM_KNOB_MM, 152.4);
  const session = complete(); const handle = session.measurementBlocks.find((block) => block.measurementType === "handle_diameter")!;
  assert.equal(handle.measuredSurface, "factory_grip_outer_diameter");
  const evidence = buildPhysicalMeasurementEvidence(session, session.measurementBlocks[2]!, "complete_repeatable");
  const raw = evidence.rawValue as Record<string, unknown>;
  assert.equal(raw.canonicalEligible, false); assert.equal(raw.numericReferenceEligible, false); assert.equal(raw.recommendationEligible, false);
  assert.equal("swingDemand" in raw, false); assert.equal("batControl" in raw, false); assert.equal("forgiveness" in raw, false); assert.equal("sweetSpot" in raw, false);
});

test("deviations, instrument uncertainty, and method distinctions stay visible", () => {
  const base = complete();
  const mass = base.measurementBlocks[0]!;
  const uncertain = reviewPhysicalMeasurementSession({ ...base, measurementBlocks: [{ ...mass, instrument: { ...mass.instrument, calibrationStatus: "unknown" } }, ...base.measurementBlocks.slice(1)] });
  assert.equal(uncertain.blocks[0]?.quality, "instrument_uncertain");
  const deviated = reviewPhysicalMeasurementSession({ ...base, measurementBlocks: [{ ...mass, methodCompliant: false, deviations: ["scale would not stabilize"] }, ...base.measurementBlocks.slice(1)] });
  assert.equal(deviated.blocks[0]?.quality, "method_deviation"); assert.ok(deviated.blocks[0]?.blockers.includes("method_deviation"));
  const barrel = base.measurementBlocks.find((block) => block.measurementType === "barrel_diameter")!;
  assert.ok(reviewPhysicalMeasurementSession({ ...base, measurementBlocks: base.measurementBlocks.map((block) => block === barrel ? { ...block, method: "circumference_derived" } : block) }).blockers.some((item) => item.includes("unsupported_measurement_method")));
});

test("direct-caliper barrel and handle methods remain backward compatible", () => {
  const review = reviewPhysicalMeasurementSession(complete());
  assert.equal(review.blocks.find((block) => block.measurementType === "barrel_diameter")?.complete, true);
  assert.equal(review.blocks.find((block) => block.measurementType === "handle_diameter")?.complete, true);
  assert.equal(physicalMeasurementMethods.barrel_diameter.method, "maximum_direct_caliper");
  assert.equal(physicalMeasurementMethods.handle_diameter.method, "ninery_152_4mm_from_knob_caliper");
});

test("circumference-derived barrel diameter preserves observation and derives with Math.PI", () => {
  const block = circumferenceBlock("barrel_diameter", 8);
  const review = reviewPhysicalMeasurementSession(replaceBlock(complete(), block));
  const barrel = review.blocks.find((item) => item.measurementType === "barrel_diameter")!;
  assert.equal(barrel.complete, true); assert.equal(barrel.observedQuantity, "circumference"); assert.equal(barrel.aggregate, 8); assert.equal(barrel.aggregateUnit, "inches");
  assert.ok(Math.abs(barrel.normalizedAggregate! - (8 / Math.PI) * 25.4) < 1e-12);
  assert.equal(barrel.derivationMethod, "diameter_equals_circumference_divided_by_pi");
  const evidence = buildPhysicalMeasurementEvidence(replaceBlock(complete(), block), block, barrel.quality);
  const raw = evidence.rawValue as Record<string, unknown>; const normalized = evidence.normalizedValue as Record<string, unknown>;
  assert.deepEqual(raw.trials, block.trials); assert.equal(raw.rawUnit, "inches"); assert.equal(raw.observedQuantity, "circumference");
  assert.equal(normalized.derivedQuantity, "diameter"); assert.equal(normalized.independentMeasurement, false); assert.equal(normalized.derivationMethod, "diameter_equals_circumference_divided_by_pi");
});

test("circumference-derived handle preserves grip surface and Ninery location", () => {
  const block = circumferenceBlock("handle_diameter", 3);
  const review = reviewPhysicalMeasurementSession(replaceBlock(complete(), block));
  const handle = review.blocks.find((item) => item.measurementType === "handle_diameter")!;
  assert.equal(handle.complete, true); assert.equal(handle.aggregate, 3); assert.ok(Math.abs(handle.normalizedAggregate! - (3 / Math.PI) * 25.4) < 1e-12);
  const evidence = buildPhysicalMeasurementEvidence(replaceBlock(complete(), block), block, handle.quality);
  const raw = evidence.rawValue as Record<string, unknown>;
  assert.equal(raw.measuredSurface, "factory_grip_outer_diameter"); assert.equal(raw.locationFromKnobMm, 152.4); assert.equal(raw.method, "circumference_derived_outer_diameter");
});

test("circumference method rejects masquerading, unsupported units, instruments, and manual derivations", () => {
  const base = circumferenceBlock("barrel_diameter", 8);
  for (const changed of [
    { ...base, observedQuantity: "diameter" as const },
    { ...base, rawUnit: "centimeters" },
    { ...base, instrument: { ...base.instrument, instrumentType: "digital_calipers" } },
    { ...base, derivedDiameter: 2.5 } as PhysicalMeasurementBlock
  ]) assert.equal(reviewPhysicalMeasurementSession(replaceBlock(complete(), changed)).persistenceEligible, false);
});

test("dry-run writes nothing, confirmed persistence is atomic-facing and idempotency is delegated", async () => {
  let calls = 0; const records = new Map<string, PhysicalMeasurementEvidenceRecord>();
  const repository = { async persistSessionAtomically(input: readonly PhysicalMeasurementEvidenceRecord[]) { calls += 1; let created = 0; let unchanged = 0; for (const record of input) { const prior = records.get(record.id); if (prior) { if (JSON.stringify(prior) !== JSON.stringify(record)) throw new Error("immutable collision"); unchanged += 1; } else { records.set(record.id, record); created += 1; } } return { created, unchanged }; } };
  assert.equal((await persistPhysicalMeasurementSession(complete(), repository, false)).writesPerformed, false); assert.equal(calls, 0);
  assert.deepEqual(await persistPhysicalMeasurementSession(complete(), repository, true).then(({ created, unchanged }) => ({ created, unchanged })), { created: 5, unchanged: 0 });
  assert.deepEqual(await persistPhysicalMeasurementSession(complete(), repository, true).then(({ created, unchanged }) => ({ created, unchanged })), { created: 0, unchanged: 5 }); assert.equal(calls, 2);
  const changed = complete(); const mass = changed.measurementBlocks[0]!;
  await assert.rejects(() => persistPhysicalMeasurementSession({ ...changed, measurementBlocks: [{ ...mass, trials: mass.trials.map((trial, index) => index === 0 ? { ...trial, value: 999 } : trial) }, ...changed.measurementBlocks.slice(1)] }, repository, true), /immutable collision/);
});

test("repeat sessions preserve measurement independence terminology", () => {
  const first = complete();
  assert.equal(classifyPhysicalMeasurementIndependence(first, first), "same_specimen_same_operator_same_instrument");
  assert.equal(classifyPhysicalMeasurementIndependence(first, { ...first, operatorId: "operator-2" }), "same_specimen_different_operator_same_instrument");
  assert.equal(classifyPhysicalMeasurementIndependence(first, { ...first, specimenReference: "specimen-2" }), "different_specimen");
  assert.equal(classifyPhysicalMeasurementIndependence(first, first).includes("evaluator"), false);
});

test("database JSON key reordering remains an exact semantic replay", () => {
  const session = replaceBlock(complete(), circumferenceBlock("barrel_diameter", 8));
  const block = session.measurementBlocks.find((item) => item.measurementType === "barrel_diameter")!;
  const generated = buildPhysicalMeasurementEvidence(session, block, "instrument_uncertain");
  const persisted = persistedRecord(generated, JSON.parse(semanticJson(generated.rawValue)), JSON.parse(semanticJson(generated.normalizedValue)));
  assert.equal(JSON.stringify(persisted.rawValue) === JSON.stringify(generated.rawValue), false);
  assert.equal(physicalMeasurementEvidenceIsSemanticallyEqual(persisted, generated), true);
  assert.deepEqual(comparePhysicalMeasurementEvidence(persisted, generated), []);
});

test("semantic replay comparison protects every meaningful evidence boundary", () => {
  const session = replaceBlock(complete(), circumferenceBlock("barrel_diameter", 8));
  const block = session.measurementBlocks.find((item) => item.measurementType === "barrel_diameter")!;
  const generated = buildPhysicalMeasurementEvidence(session, block, "instrument_uncertain");
  const raw = generated.rawValue as Record<string, unknown>;
  const cases: Array<[string, ReturnType<typeof persistedRecord>]> = [
    ["equipmentId", { ...persistedRecord(generated), equipmentId: "00000000-0000-4000-8000-000000000000" }],
    ["sourceDate", { ...persistedRecord(generated), sourceDate: new Date("2026-09-03") }],
    ["unit", { ...persistedRecord(generated), unit: "inches" }],
    ["evaluatorReference", { ...persistedRecord(generated), evaluatorReference: "other-operator" }],
    ["rawValue", persistedRecord(generated, { ...raw, specimenReference: "other-specimen" })],
    ["rawValue", persistedRecord(generated, { ...raw, method: "maximum_direct_caliper" })],
    ["rawValue", persistedRecord(generated, { ...raw, rawUnit: "millimeters" })],
    ["rawValue", persistedRecord(generated, { ...raw, trials: [{ trialNumber: 1, value: 9, repositioned: true }, ...(raw.trials as unknown[]).slice(1)] })]
  ];
  for (const [field, persisted] of cases) assert.equal(comparePhysicalMeasurementEvidence(persisted, generated)[0]?.field, field);
});

test("semantic replay comparison ignores database floating-point serialization noise", () => {
  assert.equal(semanticJson({ value: 463.55 }), semanticJson({ value: 463.54999999999995 }));
  assert.equal(semanticJson({ value: 2.546479089470326 }), semanticJson({ value: 2.5464790894703255 }));
  assert.notEqual(semanticJson({ value: 463.55 }), semanticJson({ value: 463.551 }));
});

function template() { return buildPhysicalMeasurementSessionTemplate({ equipmentId: "6cf0f7fa-c8c2-4ce7-a36e-6ad1c52cc56c", equipmentVariantId: "af5ff27c-aedd-4f56-88c3-c1ec4b70affa", manufacturer: "DeMarini", model: "The Goods USA", modelYear: 2023, certification: "USA", nominalLengthInches: 30, nominalWeightOunces: 20, nominalDrop: -10 }); }
function complete(): PhysicalMeasurementSession { const packet = template(); return { ...packet, measurementSessionId: "physical-session-01", specimenReference: "specimen-demarini-01", measurementDate: "2026-09-02", operatorId: "operator-01", physicalVerification: { ...packet.physicalVerification, verifiedAt: "2026-09-02", verifiedBy: "operator-01", confidence: "confident" }, equipmentCondition: "normal_used_condition", measurementBlocks: packet.measurementBlocks.map((block, blockIndex) => ({ ...block, methodCompliant: true, instrument: { ...block.instrument, instrumentReference: `instrument-${blockIndex}`, calibrationStatus: "operator_checked" }, trials: block.trials.map((trial, trialIndex) => ({ ...trial, value: blockIndex === 0 ? [567, 567.1, 567.2][trialIndex] : 100 + blockIndex + trialIndex / 10, repositioned: true })) })) }; }
function circumferenceBlock(type: "barrel_diameter" | "handle_diameter", value: number): PhysicalMeasurementBlock { const definition = circumferenceDerivedDiameterMethods[type]; return { measurementType: type, method: definition.method, methodVersion: "1.0", observedQuantity: "circumference", referencePoints: definition.referencePoints, rawUnit: "inches", measuredSurface: type === "handle_diameter" ? "factory_grip_outer_diameter" : undefined, locationFromKnobMm: type === "handle_diameter" ? 152.4 : undefined, instrument: { instrumentType: "flexible_measuring_tape", instrumentReference: "flexible-tape-01", calibrationStatus: "unknown" }, trials: [1, 2, 3].map((trialNumber) => ({ trialNumber, value, repositioned: true })), aggregationMethod: "median", methodCompliant: true, deviations: [], limitations: ["Circumference-derived diameter; not a direct-caliper measurement."] }; }
function replaceBlock(session: PhysicalMeasurementSession, replacement: PhysicalMeasurementBlock): PhysicalMeasurementSession { return { ...session, measurementBlocks: session.measurementBlocks.map((block) => block.measurementType === replacement.measurementType ? replacement : block) }; }
function persistedRecord(record: PhysicalMeasurementEvidenceRecord, rawValue: unknown = record.rawValue, normalizedValue: unknown = record.normalizedValue) { return { id: record.id, sourceReference: record.sourceReference, equipmentId: record.equipmentId, equipmentVariantId: record.equipmentVariantId, attributeKey: record.attributeKey, sourceDate: new Date(record.sourceDate), unit: record.unit, evaluatorReference: record.operatorId, rawValue, normalizedValue }; }
