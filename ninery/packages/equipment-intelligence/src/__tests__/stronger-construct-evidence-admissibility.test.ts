import assert from "node:assert/strict";
import test from "node:test";
import { assessStrongerConstructEvidence, STRONGER_CONSTRUCT_EVIDENCE_ADMISSIBILITY_VERSION, type StrongerEvidenceCandidate, type StrongerEvidenceRequest } from "../evidence/stronger-construct-evidence-admissibility.js";
import { calibrationCandidate, measurementCandidate } from "./stronger-evidence.fixture.js";

const request: StrongerEvidenceRequest = { equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand" };
const variants = [{ id: "variant", equipmentId: "equipment" }, { id: "other-variant", equipmentId: "equipment" }];
const run = (records: StrongerEvidenceCandidate[] = [calibrationCandidate()], query = request) => assessStrongerConstructEvidence({ request: query, records, variants });
const raw = (record: StrongerEvidenceCandidate) => record.rawValue as Record<string, unknown>;
const mutate = (changes: Record<string, unknown>) => { const record = calibrationCandidate(); return { ...record, rawValue: { ...raw(record), ...changes } }; };

test("real writer shape is exact-variant calibration evidence, never model-wide", () => {
  const result = run()[0]!;
  assert.equal(result.version, STRONGER_CONSTRUCT_EVIDENCE_ADMISSIBILITY_VERSION);
  assert.equal(result.disposition, "admissible_with_restrictions");
  assert.equal(result.declaredTarget.targetLevel, "equipment");
  assert.equal(result.observedIdentity.equipmentVariantId, "variant");
  assert.equal(result.applicability.level, "variant");
  assert.equal(result.applicability.modelGeneralizationEstablished, false);
  assert.equal(result.permittedAssessment, "calibration_only");
  assert.ok(result.restrictions.includes("generalization_not_established"));
  assert.ok(result.restrictions.includes("calibration_only"));
  assert.equal(run(undefined, { ...request, equipmentVariantId: undefined })[0]?.disposition, "unresolved");
});

test("variant declared target does not broaden a genuine observation", () => {
  const result = run([{ ...calibrationCandidate(), targetLevel: "variant" }])[0]!;
  assert.equal(result.applicability.level, "variant");
  assert.equal(result.disposition, "admissible_with_restrictions");
});

test("catalog equipment fact has nominal model scope without asserting measured behavior", () => {
  const record: StrongerEvidenceCandidate = { id: "catalog", equipmentId: "equipment", targetLevel: "equipment", attributeKey: "material", attributeDefinitionVersion: "1.0",
    sourceType: "manufacturer_specification", sourceName: "Internal catalog fixture", sourceReference: "catalog:material", sourceDate: "2026-10-01", method: "direct_specification", normalizedValue: "alloy", status: "active" };
  const result = run([record], { ...request, construct: "material", equipmentVariantId: undefined })[0]!;
  assert.equal(result.applicability.level, "equipment");
  assert.equal(result.value.kind, "categorical");
  assert.equal(result.dependence.state, "unresolved");
});

const rejected: [string, Partial<StrongerEvidenceCandidate>, string][] = [
  ["unsupported source cannot fall back to modeled", { sourceType: "other" }, "unsupported_source_type"],
  ["mechanical claim cannot be inferred from an unknown instrument source", { sourceType: "other", method: "instrument_measurement", evidenceClass: "controlled_mechanical_test" }, "unsupported_evidence_class"],
  ["unsupported method", { method: "manual_review" }, "unsupported_method"],
  ["unsupported evidence class", { evidenceClass: "invented" }, "unsupported_evidence_class"],
  ["class inconsistent with source", { evidenceClass: "modeled_estimate" }, "unsupported_evidence_class"],
  ["unsupported definition", { attributeDefinitionVersion: "2.0" }, "unsupported_definition_version"],
  ["malformed raw array", { rawValue: [] , attributeKey: "startup_demand" }, "malformed_raw_metadata"],
  ["missing equipment identity", { equipmentId: undefined }, "malformed_identity"],
  ["equipment mismatch", { equipmentId: "other-equipment" }, "equipment_mismatch"],
  ["source reference missing", { sourceReference: undefined }, "missing_required_provenance"],
  ["source date missing", { sourceDate: undefined }, "missing_required_provenance"],
  ["disputed", { status: "disputed" }, "disputed_evidence"],
  ["withdrawn", { status: "withdrawn" }, "withdrawn_evidence"],
  ["superseded", { status: "superseded" }, "superseded_evidence"],
  ["inactive", { status: "inactive" }, "inactive_evidence"]
];
for (const [name, changes, reason] of rejected) test(name, () => {
  const result = run([{ ...calibrationCandidate(), ...changes }])[0]!;
  assert.ok(["excluded", "unresolved"].includes(result.disposition));
  assert.ok(result.exclusions.some(value => value === reason));
  assert.equal(result.permittedAssessment, "none");
  if (changes.sourceType === "other") assert.equal(result.evidenceClass, undefined);
});

test("wrong selected variant is explicitly excluded", () => {
  const result = run(undefined, { ...request, equipmentVariantId: "other-variant" })[0]!;
  assert.equal(result.disposition, "excluded");
  assert.ok(result.exclusions.includes("observed_variant_mismatch"));
});

test("unsupported protocol remains unresolved", () => {
  const result = run([mutate({ protocolVersion: "2.0" })])[0]!;
  assert.equal(result.disposition, "unresolved");
  assert.ok(result.exclusions.includes("unsupported_protocol_version"));
});

test("conflicting observed and declared variant identity is excluded", () => {
  assert.ok(run([mutate({ equipmentVariantId: "other-variant" })])[0]?.exclusions.includes("malformed_identity"));
});

test("calibration flags and verification cannot be silently omitted", () => {
  const result = run([mutate({ canonicalEligible: true, physicalVerification: {} })])[0]!;
  assert.equal(result.disposition, "unresolved");
  assert.ok(result.reasons.includes("missing_required_provenance"));
});

test("repeat evaluator retains zero new independence and exact historical participation", () => {
  const record = mutate({ evaluatorRelationship: "repeat_evaluator", independentSourceContribution: 0 });
  const prior = { ...calibrationCandidate(), id: "prior", sourceDate: "2026-09-01", sourceReference: "physical-bat-evaluation:1.1:prior:startup_demand", rawValue: { ...raw(calibrationCandidate()), sessionId: "prior" } };
  const result = run([record, prior]).find(item => item.evidenceRecordId === record.id)!;
  assert.equal(result.dependence.state, "repeat_evaluator");
  assert.ok(result.restrictions.includes("repeat_evaluator"));
});

test("contradictory independence declarations remain unresolved", () => {
  assert.ok(run([mutate({ independentSourceContribution: 0 })])[0]?.exclusions.includes("independence_metadata_conflict"));
});

test("unknown evaluator relationship is preserved as restricted unknown", () => {
  const result = run([mutate({ evaluatorRelationship: undefined })])[0]!;
  assert.equal(result.dependence.state, "unresolved");
  assert.ok(result.restrictions.includes("unresolved_dependence"));
});

test("shared evaluator/session/specimen/instrument/upstream are relations, not independence proof", () => {
  const first = mutate({ specimenReference: "specimen", instrument: { instrumentReference: "instrument" }, inputEvidenceReferences: ["input"] });
  const second = { ...first, id: "second" };
  const result = run([first, second])[0]!;
  assert.deepEqual(result.dependence.relationships.map(item => item.kind), ["evaluator", "instrument", "session", "specimen", "upstream"]);
  assert.ok(result.restrictions.includes("shared_provenance"));
});

test("numeric physical measurement preserves original normalized value and specimen scope", () => {
  const result = run([measurementCandidate()], { ...request, construct: "actual_mass" })[0]!;
  assert.equal(result.disposition, "admissible_with_restrictions");
  assert.equal(result.applicability.level, "specimen");
  assert.equal(result.value.kind, "numeric");
  assert.equal(result.value.value, 570);
  assert.equal(result.value.unit, "grams");
  assert.equal(result.dependence.state, "unresolved");
});

test("physical measurements with incomplete protocol trials remain unresolved", () => {
  const record = measurementCandidate();
  const result = run([{ ...record, rawValue: { ...raw(record), trials: [{ trialNumber: 1, value: 570, repositioned: true }] } }], { ...request, construct: "actual_mass" })[0]!;
  assert.equal(result.disposition, "unresolved");
  assert.ok(result.provenance.missing.includes("protocol_trials"));
});

test("physical measurements cannot disguise incompatible normalized units", () => {
  const record = measurementCandidate();
  const result = run([{ ...record, normalizedValue: { value: 570, unit: "inches" } }], { ...request, construct: "actual_mass" })[0]!;
  assert.equal(result.disposition, "excluded");
  assert.ok(result.exclusions.includes("incompatible_value_representation"));
});

test("invalid dates and malformed identity metadata fail closed without crashing", () => {
  assert.equal(run([{ ...calibrationCandidate(), sourceDate: "not-a-date" }])[0]?.disposition, "unresolved");
  assert.ok(run([mutate({ equipmentVariantId: 123 })])[0]?.exclusions.includes("malformed_identity"));
});

test("ordinal remains qualitative and cross-record comparability unestablished", () => {
  const result = run()[0]!;
  assert.equal(result.value.kind, "ordinal");
  assert.equal(result.value.value, "moderate");
  assert.equal(result.value.crossRecordComparability, "not_established");
  assert.equal(typeof result.value.value, "string");
});

test("unable to assess is observation only", () => {
  assert.equal(run([mutate({ observation: "unable_to_assess" })])[0]?.value.kind, "observation_only");
});

test("unsupported ordinal and scale direction fail closed", () => {
  assert.ok(run([mutate({ observation: "excellent", inverseSemantics: true })])[0]?.reasons.includes("incompatible_value_representation"));
});

test("field and modeled classes stay unresolved pending acquisition contracts", () => {
  for (const [sourceType, method, evidenceClass] of [["field_observation", "structured_feedback", "structured_field_observation"], ["internal_derived", "derived_mapping", "modeled_estimate"]]) {
    const result = run([{ ...calibrationCandidate(), sourceType: sourceType!, method: method! }])[0]!;
    assert.equal(result.evidenceClass, evidenceClass);
    assert.equal(result.disposition, "unresolved");
    assert.ok(result.exclusions.includes("acquisition_contract_not_established"));
  }
});

test("stable ordering and explicit zero authority preserve input state", () => {
  const records = [{ ...calibrationCandidate(), id: "z" }, { ...calibrationCandidate(), id: "a" }];
  const before = structuredClone(records);
  assert.deepEqual(run(records), run([...records].reverse()));
  assert.deepEqual(records, before);
  assert.deepEqual(run(records).map(item => item.evidenceRecordId), ["a", "z"]);
  assert.ok(run(records).every(item => Object.values(item.authority).every(value => value === false)));
});
