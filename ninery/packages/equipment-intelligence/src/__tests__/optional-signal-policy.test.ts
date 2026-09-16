import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildOptionalSignalPolicyReport,
  getOptionalSignalCanonicalizationDecision,
  getOptionalSignalCanonicalizationDecisions,
  OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION,
  OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION,
  validateOptionalSignalCanonicalizationPolicy
} from "../index.js";

test("policy defines all three optional signals with stable versions", () => {
  const decisions = getOptionalSignalCanonicalizationDecisions();
  assert.deepEqual(decisions.map((decision) => decision.signal.key), ["balance", "confidence_building", "transition"]);
  assert.equal(new Set(decisions.map((decision) => decision.signal.key)).size, 3);
  assert.equal(decisions.every((decision) => decision.version === OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION), true);
  assert.equal(decisions.every((decision) => decision.policyVersion === OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION), true);
  assert.equal(validateOptionalSignalCanonicalizationPolicy(decisions).valid, true);
});

test("balance is approved as evaluated-intrinsic Equipment DNA with conditional numeric references", () => {
  const balance = requiredDecision("balance");
  assert.equal(balance.outcome, "canonical_equipment_numeric_reference");
  assert.equal(balance.futureState.ownership, "equipment_intelligence");
  assert.equal(balance.futureState.attributeNature, "evaluated_intrinsic");
  assert.equal(balance.futureState.valueRepresentation, "ordinal_and_numeric_reference");
  assert.equal(balance.futureState.canonicalAttributeKey, "balance_profile");
  assert.equal(balance.numericReferencePolicy.supported, true);
  assert.equal(balance.numericReferencePolicy.scale, "0_100");
  assert.equal(balance.numericReferencePolicy.direction, "balanced_to_end_loaded");
  assert.equal(balance.evidencePolicy.manufacturerClaimAloneSufficient, false);
  assert.equal(balance.confidencePolicy.minimumForInternalCandidate, "moderate");
  assert.ok(balance.currentState.currentDirectionality.includes("higher legacy values"));
  assert.ok(balance.warnings.some((warning) => warning.code === "DIRECTION_INVERSION_REQUIRED"));
  assert.equal(balance.definitions.technical.includes("player"), false);
});

test("confidence building is split and blocks direct migration", () => {
  const confidence = requiredDecision("confidence_building");
  assert.equal(confidence.outcome, "split_equipment_and_compatibility");
  assert.equal(confidence.futureState.ownership, "split");
  assert.equal(confidence.futureState.canonicalTechnicalName, "predictability_support");
  assert.equal(confidence.futureState.compatibilityConceptKey, "confidence_compatibility");
  assert.equal(confidence.migrationGuidance.directValueMigrationAllowed, false);
  assert.equal(confidence.migrationGuidance.historicalReproducibilityRequired, true);
  assert.ok(confidence.definitions.explicitlyNot.some((item) => item.includes("guarantee")));
  assert.ok(confidence.futureState.relationalInputs?.includes("Player DNA confidence indicators"));
  assert.equal(confidence.recommendationPolicy.futureCandidateEligibility, "requires_separate_policy");
});

test("transition is compatibility-only with required relational inputs and inverse legacy naming", () => {
  const transition = requiredDecision("transition");
  assert.equal(transition.outcome, "compatibility_only");
  assert.equal(transition.futureState.ownership, "compatibility_intelligence");
  assert.equal(transition.futureState.compatibilityConceptKey, "transition_compatibility");
  assert.equal(transition.migrationGuidance.directValueMigrationAllowed, false);
  assert.ok(transition.currentState.currentDirectionality.includes("inverse"));
  assert.ok(transition.futureState.relationalInputs?.includes("current equipment length"));
  assert.ok(transition.futureState.relationalInputs?.includes("player age or development stage"));
  assert.ok(transition.futureState.transitionComponents?.includes("drop_change_demand"));
  assert.ok(transition.blockers.some((finding) => finding.code === "CURRENT_EQUIPMENT_REQUIRED"));
  assert.ok(transition.definitions.explicitlyNot.some((item) => item.includes("universal product-level")));
});

test("evidence and recommendation policies preserve live behavior while defining future blockers", () => {
  const decisions = getOptionalSignalCanonicalizationDecisions();
  assert.equal(decisions.every((decision) => decision.recommendationPolicy.currentLegacyUse === "continue_authoritative"), true);
  assert.equal(decisions.every((decision) => decision.recommendationPolicy.mayAffectRanking), true);
  assert.equal(decisions.every((decision) => decision.migrationGuidance.historicalReproducibilityRequired), true);
  assert.equal(requiredDecision("balance").evidencePolicy.acceptableSourceTypes.includes("objective_measurement"), true);
  assert.equal(requiredDecision("confidence_building").numericReferencePolicy.supported, false);
  assert.equal(requiredDecision("transition").numericReferencePolicy.requiredEvidence, "relational_calculation");
});

test("invalid policy definitions fail integrity validation", () => {
  const [balance, ...rest] = getOptionalSignalCanonicalizationDecisions();
  assert.ok(balance);
  const invalid = [{
    ...balance,
    numericReferencePolicy: { ...balance.numericReferencePolicy, direction: undefined },
    definitions: { ...balance.definitions, parentFriendly: "" }
  }, ...rest];
  const result = validateOptionalSignalCanonicalizationPolicy(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("scale or direction")));
  assert.ok(result.errors.some((error) => error.includes("parent-friendly")));
});

test("architecture decision records exist and contain status and decision sections", () => {
  for (const path of [
    "docs/architecture/adr-optional-signal-balance.md",
    "docs/architecture/adr-confidence-building-split.md",
    "docs/architecture/adr-transition-compatibility.md"
  ]) {
    const absolute = resolve(process.cwd(), "..", "..", path);
    assert.equal(existsSync(absolute), true, `${path} should exist`);
    const text = readFileSync(absolute, "utf8");
    assert.match(text, /Status:/);
    assert.match(text, /## Decision/);
    assert.doesNotMatch(text, /implemented production mapping/i);
  }
});

test("policy report is deterministic and states shadow-only guidance", () => {
  const first = buildOptionalSignalPolicyReport();
  const second = buildOptionalSignalPolicyReport();
  assert.equal(first, second);
  assert.match(first, /Optional Signal Canonicalization Policy v1\.0/);
  assert.match(first, /BALANCE/);
  assert.match(first, /CONFIDENCE BUILDING/);
  assert.match(first, /TRANSITION/);
  assert.match(first, /Current live recommendation source:\nlegacy/);
  assert.match(first, /Policy changes live behavior:\nno/);
  assert.doesNotMatch(first, /DATABASE_URL|postgres:\/\/|password/i);
});

function requiredDecision(key: "balance" | "confidence_building" | "transition") {
  const decision = getOptionalSignalCanonicalizationDecision(key);
  assert.ok(decision);
  return decision;
}
