import assert from "node:assert/strict";
import test from "node:test";
import {
  PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION,
  PHYSICAL_EVALUATION_PROTOCOL_V1_1_PREVIEW_VERSION,
  buildPhysicalEvaluationProtocolV11Preview,
  validatePhysicalEvaluationProtocolV11Preview
} from "../physical-evaluation/index.js";

test("v1.1 preview is version-distinct and leaves v1.0 unchanged", () => {
  const preview = buildPhysicalEvaluationProtocolV11Preview();
  assert.equal(PHYSICAL_BAT_EVALUATION_PROTOCOL_VERSION, "1.0");
  assert.equal(PHYSICAL_EVALUATION_PROTOCOL_V1_1_PREVIEW_VERSION, "1.1-preview");
  assert.equal(preview.priorProtocolVersion, "1.0");
  assert.equal(preview.historicalEvidencePolicy, "immutable_and_version_distinct");
});

test("preview exposes exact deterministic evaluator questionnaire", () => {
  const preview = buildPhysicalEvaluationProtocolV11Preview();
  assert.equal(preview.questions.length, 13);
  assert.deepEqual(preview.questions.map((item) => item.id), Array.from({ length: 13 }, (_, index) => `v1.1-q${String(index + 1).padStart(2, "0")}`));
  assert.equal(preview.questions[0]?.prompt, "How much effort is required to start the bat moving from the launch position?");
  assert.equal(preview.questions[12]?.prompt, "How consistent is response quality across verified near-center contacts?");
});

test("swing effort uses separate repeated trial blocks", () => {
  const questions = buildPhysicalEvaluationProtocolV11Preview().questions.filter((item) => item.attributeKey === "swing_effort");
  assert.deepEqual(questions.map((item) => item.trialBlock), ["dry_swing_block_1", "dry_swing_block_2", "dry_swing_block_3"]);
  assert.ok(questions.every((item) => item.minimumTrials === 4));
  assert.ok(questions.every((item) => item.operatorInstruction.includes("only") || item.operatorInstruction.includes("independently")));
});

test("forgiveness controls contact location and preserves inverse degradation", () => {
  const questions = buildPhysicalEvaluationProtocolV11Preview().questions.filter((item) => item.attributeKey === "forgiveness");
  assert.deepEqual(questions.map((item) => item.dimensionKey), ["center_response_baseline", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation"]);
  assert.deepEqual(questions.slice(0, 3).map((item) => item.trialBlock), ["centered_contact", "near_center_handle_side", "near_center_end_side"]);
  assert.deepEqual(questions.slice(0, 3).map((item) => item.minimumTrials), [6, 6, 6]);
  assert.equal(questions[3]?.responseScale, "five_level_inverse_degradation");
  assert.equal(questions[3]?.minimumTrials, 18);
});

test("sweet spot concepts remain candidate subconstructs rather than canonical attributes", () => {
  const preview = buildPhysicalEvaluationProtocolV11Preview();
  const candidates = preview.constructs.filter((item) => item.attributeKey === "sweet_spot_support");
  assert.deepEqual(candidates.map((item) => item.constructCode), ["sweet_spot_breadth_candidate", "sweet_spot_response_quality_candidate"]);
  assert.ok(candidates.every((item) => item.status === "candidate_subconstruct" && item.canonicalAttributeCreated === false));
  assert.ok(preview.questions.filter((item) => item.construct.includes("sweet_spot_")).every((item) => item.aggregationRole === "candidate_subconstruct_only"));
});

test("bat control tasks separate direction path and start-stop redirect", () => {
  const dimensions = buildPhysicalEvaluationProtocolV11Preview().questions.filter((item) => item.attributeKey === "bat_control_support").map((item) => item.dimensionKey);
  assert.deepEqual(dimensions, ["directional_adjustment_control", "barrel_path_repeatability", "start_stop_redirect_control"]);
});

test("calibration preview performs no evaluation persistence or recommendation change", () => {
  const preview = buildPhysicalEvaluationProtocolV11Preview();
  assert.equal(preview.studyClassification, "protocol_calibration_evidence");
  assert.equal(preview.evaluationSixPerformed, false);
  assert.equal(preview.persistenceAllowed, false);
  assert.equal(preview.canonicalEvaluationsCreated, 0);
  assert.equal(preview.numericReferencesCreated, 0);
  assert.equal(preview.recommendationBehaviorChanged, false);
  assert.equal(validatePhysicalEvaluationProtocolV11Preview().verdict, "pass");
});

test("repeated previews are deterministic", () => {
  assert.deepEqual(buildPhysicalEvaluationProtocolV11Preview(), buildPhysicalEvaluationProtocolV11Preview());
});
