import assert from "node:assert/strict";
import test from "node:test";
import { assessStrongerEvidenceDependence } from "../evidence/dependence/index.js";
import { assessStrongerConstructEvidence, type StrongerEvidenceCandidate } from "../evidence/stronger-construct-evidence-admissibility.js";
import { calibrationCandidate, measurementCandidate } from "./stronger-evidence.fixture.js";
const request = { equipmentId: "equipment", equipmentVariantId: "variant", construct: "startup_demand" };
const raw = (record: StrongerEvidenceCandidate) => record.rawValue as Record<string, unknown>;
function run(records: StrongerEvidenceCandidate[], construct = request.construct) { return assessStrongerEvidenceDependence({ request: { ...request, construct }, contextRecords: records, assessments: assessStrongerConstructEvidence({ request: { ...request, construct }, records, variants: [{ id: "variant", equipmentId: "equipment" }] }) }); }
test("writer human sessions expose evaluator reuse without independence or promotion", () => {
  const first = { ...calibrationCandidate(), id: "a" }; const second = { ...first, id: "b" };
  const before = structuredClone([first, second]); const result = run([first, second]);
  assert.deepEqual(result.edges.map(item => item.kind), ["same_acquisition_dimension", "shared_evaluator", "shared_session"]);
  assert.deepEqual(result.independentGroups, []);
  assert.ok(Object.values(result.authority).every(value => value === false));
  assert.deepEqual(run([second, first]), result); assert.deepEqual([first,second], before);
});
for (const kind of ["shared_operator", "shared_session", "shared_specimen", "shared_instrument"] as const) test(`physical writer retains ${kind} without complete-dependence inference`, () => {
  const a = { ...measurementCandidate(), id: "a" }; const b = { ...a, id: "b" };
  assert.ok(run([a,b], "actual_mass").edges.some(edge => edge.kind === kind));
});
test("different evaluators sharing session remain source-independence unknown", () => {
  const a = { ...calibrationCandidate(), id: "a" };
  const b = { ...a, id: "b", evaluatorReference: "other", rawValue: { ...raw(a), evaluator: { ...(raw(a).evaluator as Record<string, unknown>), evaluatorId: "other" } } };
  assert.deepEqual(run([a,b]).edges.map(edge => edge.kind), ["shared_session"]);
  assert.deepEqual(run([a,b]).independentGroups, []);
});
test("unknown upstream namespaces never resolve by coincidental ID", () => {
  const a = { ...calibrationCandidate(), id: "a" }; const b = { ...a, id: "b", rawValue: { ...raw(a), inputEvidenceReferences: ["a"], upstreamClaimId: "a" } };
  const result = run([a,b]);
  assert.ok(result.nodes.find(node => node.recordId === "b")?.reasons.includes("upstream_endpoint_unresolved"));
  assert.equal(result.edges.some(edge => edge.kind.includes("upstream")), false);
});
test("explicit writer source references resolve only correctly typed endpoints", () => {
  const a = { ...calibrationCandidate(), id: "a" };
  const b = { ...a, id: "b", sourceReference: "physical-bat-evaluation:1.1:second:startup_demand", rawValue: { ...raw(a), sessionId: "second", inputEvidenceReferences: [a.sourceReference!] } };
  const c = { ...b, id: "c", sourceReference: "physical-bat-evaluation:1.1:third:startup_demand", rawValue: { ...raw(b), sessionId: "third" } };
  const result = run([a,b,c]);
  assert.ok(result.edges.some(edge => edge.kind === "documented_upstream_link" && edge.from === "b" && edge.to === "a" && edge.directed));
  assert.ok(result.edges.some(edge => edge.kind === "shared_upstream_reference" && edge.from === "b" && edge.to === "c"));
  assert.deepEqual(result.independentGroups, []);
});
test("duplicate identities and conflicting actor provenance fail closed", () => {
  const a = calibrationCandidate();
  assert.equal(run([a,a]).nodes[0]?.participation, "context_only");
  const b = { ...a, id: "b", evaluatorReference: "conflicting" };
  assert.equal(run([a,b]).edges.length, 0);
});
for (const status of ["disputed", "withdrawn", "superseded", "inactive"]) test(`${status} records remain diagnostic`, () => {
  const a = { ...calibrationCandidate(), id: "a" }; const b = { ...a, id: "b", status };
  assert.equal(run([a,b]).nodes.find(node => node.recordId === "b")?.participation, "context_only");
  assert.ok(run([a,b]).edges.every(edge => edge.participation === "context_only"));
});
test("relationships are pairwise, not transitive groups", () => {
  const a = { ...measurementCandidate(), id: "a" };
  const b = { ...a, id: "b", rawValue: { ...raw(a), specimenReference: "other" } };
  const c = { ...b, id: "c", sourceReference: "physical-measurement:1.0:other:actual_mass", evaluatorReference: "other", rawValue: { ...raw(b), operatorId: "other", instrument: { ...(raw(b).instrument as Record<string, unknown>), instrumentReference: "other" }, measurementSessionId: "other" } };
  const result = run([a,b,c], "actual_mass");
  assert.equal(result.edges.some(edge => edge.from === "a" && edge.to === "c"), false);
  assert.deepEqual(result.independentGroups, []);
});
for (const value of [undefined, 123, [], "<unfilled>"]) test(`invalid session provenance ${JSON.stringify(value)} is diagnostic only`, () => {
  const a = { ...calibrationCandidate(), id: "a" }; const b = { ...a, id: "b", rawValue: { ...raw(a), sessionId: value } };
  assert.equal(run([a,b]).nodes.find(node => node.recordId === "b")?.participation, "context_only");
});
test("cross-variant and cross-construct records remain diagnostic context", () => {
  const a = { ...calibrationCandidate(), id: "a" };
  const b = { ...a, id: "b", equipmentVariantId: "other", rawValue: { ...raw(a), equipmentVariantId: "other" } };
  const c = { ...a, id: "c", attributeKey: "other", rawValue: { ...raw(a), dimensionKey: "other" } };
  assert.ok(run([a,b,c]).nodes.filter(node => node.recordId !== "a").every(node => node.participation === "context_only"));
});

for (const kind of ["physical", "human"] as const) {
  const candidate = () => kind === "physical" ? measurementCandidate() : calibrationCandidate();
  const construct = kind === "physical" ? "actual_mass" : "startup_demand";
  const sessionKey = kind === "physical" ? "measurementSessionId" : "sessionId";
  const dimensionKey = kind === "physical" ? "measurementType" : "dimensionKey";
  test(`${kind} writer acquisition identity remains eligible for dependence assessment`, () => {
    assert.equal(run([candidate()], construct).nodes[0]?.participation, "assessment");
  });
  for (const field of [sessionKey, dimensionKey]) test(`${kind} contradictory ${field} is diagnostic without changing #082`, () => {
    const original = candidate();
    const changed = { ...original, rawValue: { ...raw(original), [field]: "contradiction" } };
    const assessments = assessStrongerConstructEvidence({ request: { ...request, construct }, records: [changed], variants: [{ id: "variant", equipmentId: "equipment" }] });
    const before = structuredClone(assessments);
    const result = assessStrongerEvidenceDependence({ request: { ...request, construct }, contextRecords: [changed], assessments });
    assert.equal(result.nodes[0]?.disposition, assessments[0]?.disposition);
    assert.equal(result.nodes[0]?.participation, "context_only");
    assert.ok(result.nodes[0]?.reasons.includes("conflicting_provenance"));
    assert.deepEqual(assessments, before);
    assert.deepEqual(result.independentGroups, []);
  });
  test(`${kind} contradictory reference cannot create false shared acquisition relationships`, () => {
    const a = { ...candidate(), id: "a" };
    const b = { ...candidate(), id: "b", sourceReference: "incorrect-session-reference" };
    const result = run([a, b], construct);
    assert.equal(result.nodes.find(node => node.recordId === "b")?.participation, "context_only");
    assert.ok(result.nodes.find(node => node.recordId === "b")?.reasons.includes("conflicting_provenance"));
    assert.deepEqual(result.edges, []);
  });
  test(`${kind} changed session cannot falsely join another writer session`, () => {
    const a = { ...candidate(), id: "a" };
    const prefix = kind === "physical" ? "physical-measurement:1.0" : "physical-bat-evaluation:1.1";
    const b = { ...candidate(), id: "b", sourceReference: `${prefix}:second:${construct}`, rawValue: { ...raw(a), [sessionKey]: "second" } };
    const changed = { ...a, rawValue: { ...raw(a), [sessionKey]: "second" } };
    const result = run([changed, b], construct);
    assert.equal(result.nodes.find(node => node.recordId === "a")?.participation, "context_only");
    assert.equal(result.nodes.find(node => node.recordId === "b")?.participation, "assessment");
    assert.deepEqual(result.edges, []);
  });
  for (const field of [sessionKey, dimensionKey]) for (const value of [undefined, 123]) test(`${kind} malformed ${field} ${String(value)} fails closed`, () => {
    const original = candidate();
    const result = run([{ ...original, rawValue: { ...raw(original), [field]: value } }], construct);
    assert.equal(result.nodes[0]?.participation, "context_only");
    assert.ok(result.nodes[0]?.reasons.includes("malformed_provenance"));
    assert.deepEqual(result.edges, []);
  });
  for (const sourceReference of [undefined, "", "<missing>"]) test(`${kind} malformed source reference ${JSON.stringify(sourceReference)} fails closed`, () => {
    const result = run([{ ...candidate(), sourceReference }], construct);
    assert.equal(result.nodes[0]?.participation, "context_only");
    assert.ok(result.nodes[0]?.reasons.includes("malformed_provenance"));
  });
}
