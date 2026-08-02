import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionConversation } from "./decision-conversation-builder.ts";
import type { DecisionConversationInput } from "./decision-conversation-builder.ts";

const input: DecisionConversationInput = {
  player: {
    firstName: "Jackson",
    name: "Jackson Sanders",
    currentBatParts: ["2026 Rawlings ICON USA", "30 in.", "drop -8"]
  },
  primaryRecommendation: {
    id: "bat-1",
    brand: "Louisville Slugger",
    model: "Meta",
    displayName: "Louisville Slugger Meta",
    size: "30 in. / 22 oz / drop -8",
    leagueApprovalLabel: "USA Baseball Approved",
    matchPresentation: { roundedScore: 72, label: "Strong Match" },
    confidenceLabel: "High Confidence",
    confidenceScore: 84.6,
    summary: "A parent-facing summary.",
    whyChosenSummary: "Jackson's current profile suggests the Louisville Slugger Meta may be the best fit.",
    reasons: [
      "Supports Jackson's goal of improving bat control.",
      "Provides a manageable swing feel for Jackson's current player profile.",
      "Meets the required USA Baseball Approved equipment standard.",
      "Offers a performance profile that can support confidence at the plate."
    ],
    tradeoffs: ["This recommendation prioritizes control and consistency over maximum power potential."],
    missingInformation: ["Confirm preferred barrel feel."]
  },
  alternatives: [
    {
      id: "bat-2",
      brand: "Marucci",
      model: "CATX2",
      displayName: "Marucci CATX2",
      matchPresentation: { roundedScore: 67, label: "Promising Match" },
      summary: "Another balanced option.",
      reasons: ["Provides a manageable swing feel for Jackson's current player profile."],
      tradeoffs: [],
      missingInformation: []
    }
  ],
  playerDNAGroups: [
    {
      key: "strengths",
      title: "Jackson's Current Strengths",
      attributes: [
        { key: "batControl", label: "Bat Control", score: 81, summary: "The player shows a strong need for a controllable swing." },
        { key: "equipmentAwareness", label: "Equipment Awareness", score: 74, summary: "Current bat details help compare fit." }
      ]
    },
    {
      key: "developing",
      title: "Areas Still Developing",
      attributes: [
        { key: "swingSpeed", label: "Swing Speed", score: 66, summary: "Swing speed is still developing." },
        { key: "transitionReadiness", label: "Transition Readiness", score: 58, summary: "Transition readiness should be monitored." }
      ]
    }
  ],
  overallConfidence: {
    label: "High Confidence",
    score: 84.6,
    explanation: "Ninery has enough reliable information to recommend confidently, with a few details still worth confirming."
  },
  missingInformation: ["Add recent height and weight measurements."]
};

test("builder is deterministic for the same input", () => {
  assert.deepEqual(buildDecisionConversation(input), buildDecisionConversation(input));
});

test("builder populates all required narrative sections", () => {
  const conversation = buildDecisionConversation(input);

  assert.equal(conversation.version, "1.0");
  assert.equal(conversation.recommendationSummary.heading, "Why Ninery Chose This Bat");
  assert.equal(conversation.recommendationSummary.equipmentName, "Louisville Slugger Meta");
  assert.ok(conversation.recommendationSummary.primaryReason);
  assert.ok(conversation.playerFit.strengthsUsed.length > 0);
  assert.ok(conversation.tradeoffSummary.expectedBenefits.length > 0);
  assert.ok(conversation.confidenceExplanation.supportingEvidence.length > 0);
  assert.ok(conversation.futureGuidance.reassessWhen.length > 0);
});

test("supporting arrays respect maximum lengths", () => {
  const conversation = buildDecisionConversation(input);

  assert.ok(conversation.recommendationSummary.supportingReasons.length <= 3);
  assert.ok(conversation.tradeoffSummary.expectedBenefits.length <= 3);
  assert.ok(conversation.tradeoffSummary.compromises.length <= 2);
  assert.ok((conversation.tradeoffSummary.unknowns ?? []).length <= 2);
  assert.ok(conversation.alternativeExplanations.length <= 3);
});

test("raw internal codes and algorithm copy are not exposed", () => {
  const conversation = buildDecisionConversation({
    ...input,
    primaryRecommendation: {
      ...input.primaryRecommendation!,
      reasons: ["PDNA-GOAL-003", "BAT_CONTROL_FIT", "This bat is scored from algorithm evidence quality."],
      tradeoffs: ["SWEET_SPOT_FIT"]
    }
  });
  const rendered = JSON.stringify(conversation);

  assert.doesNotMatch(rendered, /PDNA-GOAL-003|BAT_CONTROL_FIT|SWEET_SPOT_FIT|scored from algorithm/i);
});

test("player fit uses strengths and developing areas without inventing unsupported traits", () => {
  const conversation = buildDecisionConversation(input);

  assert.deepEqual(conversation.playerFit.strengthsUsed.map((item) => item.label), ["Bat Control", "Equipment Awareness"]);
  assert.deepEqual(conversation.playerFit.developingAreasSupported.map((item) => item.label), ["Swing Speed", "Transition Readiness"]);
  assert.doesNotMatch(JSON.stringify(conversation.playerFit), /poor|weak/i);
});

test("fallbacks work when recommendation and player dna details are missing", () => {
  const conversation = buildDecisionConversation({
    player: { name: "Demo Player", currentBatParts: [] },
    alternatives: [],
    playerDNAGroups: [],
    missingInformation: []
  });

  assert.equal(conversation.recommendationSummary.equipmentName, "the recommended bat");
  assert.equal(conversation.playerFit.heading, "Why It Fits This Player");
  assert.equal(conversation.uncertaintyDisclosure?.missingInformation[0], "Current bat details are not provided yet.");
});

test("alternatives explain both credibility and why they ranked lower", () => {
  const conversation = buildDecisionConversation(input);
  const alternative = conversation.alternativeExplanations[0];

  assert.equal(alternative?.equipmentName, "Marucci CATX2");
  assert.match(alternative?.whyItIsStrong ?? "", /manageable swing feel/i);
  assert.match(alternative?.whyItWasNotSelected ?? "", /ranked higher/i);
  assert.doesNotMatch(alternative?.whyItWasNotSelected ?? "", /score only/i);
});

test("confidence preserves existing level and avoids probability-of-performance language", () => {
  const conversation = buildDecisionConversation(input);

  assert.equal(conversation.confidenceExplanation.level, "high");
  assert.equal(conversation.confidenceExplanation.label, "High Confidence");
  assert.doesNotMatch(conversation.confidenceExplanation.summary, /probability|chance of success|guarantee/i);
});

test("future guidance renders supported reassessment triggers without precise invented dates", () => {
  const conversation = buildDecisionConversation(input);

  assert.ok(conversation.futureGuidance.reassessWhen.some((trigger) => trigger.type === "growth"));
  assert.ok(conversation.futureGuidance.reassessWhen.some((trigger) => trigger.type === "league"));
  assert.doesNotMatch(
    JSON.stringify(conversation.futureGuidance),
    /January|February|March|April|May|June|July|August|September|October|November|December \d{1,2}/
  );
});

test("uncertainty appears for close decisions or missing information and is omitted when complete", () => {
  const closeConversation = buildDecisionConversation(input);
  const completeConversation = buildDecisionConversation({
    ...input,
    alternatives: [],
    missingInformation: [],
    primaryRecommendation: {
      ...input.primaryRecommendation!,
      missingInformation: []
    }
  });

  assert.equal(closeConversation.uncertaintyDisclosure?.closeDecision, true);
  assert.equal(completeConversation.uncertaintyDisclosure, undefined);
});

