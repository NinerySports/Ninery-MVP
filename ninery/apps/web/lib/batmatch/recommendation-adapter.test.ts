import assert from "node:assert/strict";
import test from "node:test";
import { mapRecommendationResponseToViewModel } from "./recommendation-adapter.ts";
import {
  formatCertificationApproval,
  getMatchContext,
  getMatchPresentation,
  getRecommendationReasonCopy,
  getTradeoffCopy,
  recommendationCtaLabels
} from "./recommendation-copy.ts";
import type { BackendDemoRecommendationResponse } from "./recommendation-types";

const response: BackendDemoRecommendationResponse = {
  developmentOnly: true,
  player: {
    id: "player-1",
    name: "Jackson Sanders",
    age: 11,
    competitionLevel: "travel",
    currentBat: "2026 Rawlings ICON USA 30 inch drop 8"
  },
  playerDNA: {
    scores: {
      batControl: 81,
      swingSpeed: 66,
      powerPotential: 61,
      confidence: 77,
      transitionReadiness: 58,
      growthStability: 72,
      profileCompleteness: 84
    },
    categories: {
      primaryHittingGoal: "improve_bat_control",
      profileConfidenceLevel: "high"
    },
    confidence: {
      score: 83,
      level: "high",
      missingInformation: ["Confirm preferred barrel feel"]
    },
    explanations: [
      {
        attribute: "batControl",
        score: 81,
        confidence: "high",
        summary: "The player shows a strong need for a controllable swing.",
        sourceCodes: ["PDNA-GOAL-003"],
        ruleIds: ["PREFERRED_SWING_FEEL"]
      },
      {
        attribute: "confidence",
        score: 77,
        confidence: "medium",
        summary: "Confidence matters for this player's current fit."
      },
      {
        attribute: "equipmentAwareness",
        score: 74,
        confidence: "medium",
        summary: "The current bat details help Ninery compare equipment fit."
      },
      {
        attribute: "swingSpeed",
        score: 66,
        confidence: "medium",
        summary: "Swing speed is still developing."
      },
      {
        attribute: "transitionReadiness",
        score: 58,
        confidence: "medium",
        summary: "Transition readiness should be monitored."
      },
      {
        attribute: "profileCompleteness",
        score: 84,
        confidence: "high",
        summary: "The profile is strong, with a few details still worth confirming."
      }
    ],
    missingInformation: ["Add recent height and weight measurements"]
  },
  recommendations: {
    primaryRecommendation: {
      equipment: {
        equipmentId: "bat-1",
        manufacturer: "Louisville Slugger",
        model: "Meta",
        certification: "USA",
        selectedVariant: {
          id: "variant-1",
          lengthInches: 30,
          weightOunces: 22,
          dropWeight: -8
        }
      },
      overallMatchScore: 71.59,
      matchBand: "Conditional Match",
      confidence: {
        score: 84.6,
        band: "high",
        missingInformation: ["Confirm league certification required"]
      },
      explanation: {
        summary: "Rawlings ICON is scored from Player DNA, Equipment DNA, evidence quality, and request constraints.",
        topReasons: [
          {
            dimension: "BAT_CONTROL_FIT",
            reason: "Rewards manageable swing weight"
          },
          {
            dimension: "SWING_WEIGHT_FIT",
            reason: "Compares the player's control need with the bat's control profile"
          },
          {
            dimension: "PDNA-GOAL-003",
            reason: "PDNA-GOAL-003"
          }
        ],
        tradeoffs: [
          "BARREL_FORGIVENESS_FIT is a trade-off: Players with less consistent contact benefit more from forgiveness.",
          "SWEET_SPOT_FIT is a trade-off: Compares contact consistency needs to sweet-spot support."
        ],
        uncertainties: ["The player's preferred barrel feel has not yet been confirmed."]
      },
      dimensions: [
        {
          code: "CONFIDENCE_BUILDING_FIT",
          reason: "Helps the player feel more confident in the batter's box.",
          tradeoff: false
        }
      ],
      trace: { traceId: "trace-1" }
    },
    alternatives: [
      {
        equipment: {
          equipmentId: "bat-2",
          manufacturer: "Marucci",
          model: "CATX2",
          certification: "USA"
        },
        overallMatchScore: 67.4,
        explanation: {
          summary: "Another balanced option.",
          topReasons: [{ dimension: "SWING_WEIGHT_FIT", reason: "Fits the target swing-weight range." }]
        },
        confidence: { score: 84, band: "medium" }
      }
    ],
    filteredEquipment: []
  },
  traceSummary: {
    generatedAt: "2026-07-18T00:00:00.000Z",
    eligibleCount: 5,
    filteredCount: 2
  }
};

test("API response maps into the recommendation view model", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.equal(viewModel.player.name, "Jackson Sanders");
  assert.equal(viewModel.player.firstName, "Jackson");
  assert.equal(viewModel.primaryRecommendation?.model, "Meta");
  assert.equal(viewModel.primaryRecommendation?.brand, "Louisville Slugger");
  assert.equal(viewModel.primaryRecommendation?.displayName, "Louisville Slugger Meta");
  assert.equal(viewModel.decisionConversation.version, "1.0");
});

test("score presentation rounds decimals and maps to parent-friendly labels", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.deepEqual(viewModel.primaryRecommendation?.matchPresentation, { roundedScore: 72, label: "Strong Match" });
  assert.notEqual(viewModel.primaryRecommendation?.matchBand, "Conditional Match");
});

test("match presentation boundaries map correctly", () => {
  assert.deepEqual(getMatchPresentation(90), { roundedScore: 90, label: "Exceptional Match" });
  assert.deepEqual(getMatchPresentation(89.4), { roundedScore: 89, label: "Great Match" });
  assert.deepEqual(getMatchPresentation(71.59), { roundedScore: 72, label: "Strong Match" });
  assert.deepEqual(getMatchPresentation(60), { roundedScore: 60, label: "Promising Match" });
  assert.deepEqual(getMatchPresentation(59.4), { roundedScore: 59, label: "Limited Match" });
  assert.equal(getMatchPresentation(undefined), undefined);
  assert.equal(getMatchPresentation(Number.NaN), undefined);
});

test("recommendation confidence maps separately from match score", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.equal(viewModel.overallConfidence?.label, "High Confidence");
  assert.equal(viewModel.overallConfidence?.score, 84.6);
  assert.match(viewModel.overallConfidence?.explanation ?? "", /enough reliable information/i);
  assert.notEqual(viewModel.overallConfidence?.score, viewModel.primaryRecommendation?.matchPresentation?.roundedScore);
});

test("known reason codes return parent-friendly copy", () => {
  assert.equal(
    getRecommendationReasonCopy({ code: "BAT_CONTROL_FIT", playerFirstName: "Jackson" }),
    "Supports Jackson's goal of improving bat control."
  );
  assert.equal(
    getRecommendationReasonCopy({ code: "LEAGUE_LEGALITY_FIT", certificationLabel: "USA Baseball Approved" }),
    "Meets the required USA Baseball Approved equipment standard."
  );
});

test("reasons render without exposing raw internal rule codes or algorithm copy", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);
  const reasons = viewModel.primaryRecommendation?.reasons.join(" ") ?? "";

  assert.match(reasons, /Jackson's goal of improving bat control/i);
  assert.match(reasons, /manageable swing feel/i);
  assert.match(reasons, /USA Baseball Approved/i);
  assert.doesNotMatch(reasons, /PDNA-GOAL-003|BAT_CONTROL_FIT|SWING_WEIGHT_FIT|Rewards|Compares/);
});

test("unknown reason codes do not break the page or show raw codes", () => {
  assert.equal(getRecommendationReasonCopy({ code: "UNKNOWN_FIT_CODE" }), undefined);
  assert.equal(getRecommendationReasonCopy({ fallback: "UNKNOWN_FIT_CODE" }), undefined);
});

test("known tradeoff codes produce readable copy", () => {
  assert.equal(
    getTradeoffCopy("BARREL_FORGIVENESS_FIT is a trade-off: Players with less consistent contact benefit more from forgiveness."),
    "This bat may offer less forgiveness for off-center contact than some alternatives."
  );
  assert.equal(
    getTradeoffCopy("SWEET_SPOT_FIT is a trade-off: Compares contact consistency needs to sweet-spot support."),
    "Players still developing consistent contact may benefit from a bat with a larger or more forgiving hitting area."
  );
});

test("tradeoffs use natural language and hide raw codes", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);
  const tradeoffs = viewModel.primaryRecommendation?.tradeoffs.join(" ") ?? "";

  assert.match(tradeoffs, /off-center contact/i);
  assert.doesNotMatch(tradeoffs, /BARREL_FORGIVENESS_FIT|SWEET_SPOT_FIT|trade-off:|Compares/);
});

test("empty tradeoff arrays render gracefully in the view model", () => {
  const viewModel = mapRecommendationResponseToViewModel({
    ...response,
    recommendations: {
      ...response.recommendations,
      primaryRecommendation: {
        ...response.recommendations?.primaryRecommendation,
        explanation: { summary: "Ready.", topReasons: [], tradeoffs: [] }
      }
    }
  });

  assert.deepEqual(viewModel.primaryRecommendation?.tradeoffs, []);
});

test("alternative recommendations use rounded customer-facing scores", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.equal(viewModel.alternatives.length, 1);
  assert.deepEqual(viewModel.alternatives[0]?.matchPresentation, { roundedScore: 67, label: "Promising Match" });
});

test("league presentation formats USA eligibility safely", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.equal(formatCertificationApproval("USA"), "USA Baseball Approved");
  assert.equal(viewModel.primaryRecommendation?.leagueApprovalLabel, "USA Baseball Approved");
});

test("player summary includes age, competition level, and formatted current bat parts", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.equal(viewModel.player.displayContext, "Age 11 - Travel Baseball");
  assert.deepEqual(viewModel.player.currentBatParts, ["2026 Rawlings ICON USA", "30 in.", "drop -8"]);
});

test("dynamic player heading data falls back when player name is missing", () => {
  const viewModel = mapRecommendationResponseToViewModel({
    player: {},
    recommendations: { alternatives: [], filteredEquipment: [] }
  });

  assert.equal(viewModel.player.firstName, undefined);
  assert.equal(viewModel.player.name, "Demo Player");
});

test("primary summary is parent-facing and avoids internal terminology", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);
  const summary = viewModel.primaryRecommendation?.whyChosenSummary ?? "";

  assert.match(summary, /Jackson's current profile/i);
  assert.match(summary, /Louisville Slugger Meta/i);
  assert.match(summary, /improving bat control/i);
  assert.match(summary, /confirm final feel and sizing/i);
  assert.doesNotMatch(summary, /Player DNA|Equipment DNA|evidence quality|request constraints|scored from/i);
});

test("hero match context and reassurance copy are dynamic and parent friendly", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.equal(
    viewModel.primaryRecommendation?.heroRecommendationCopy,
    "Recommended for Jackson based on his current swing profile, experience level, and development goals."
  );
  assert.equal(
    viewModel.primaryRecommendation?.matchContext,
    "A Strong Match means this bat closely aligns with Jackson's current playing style, development goals, and equipment needs."
  );
  assert.equal(viewModel.reassurance.lead, "You don't have to guess anymore.");
  assert.match(viewModel.reassurance.body, /Jackson's profile/i);
  assert.doesNotMatch(viewModel.reassurance.body, /guaranteed performance/i);
});

test("match context falls back safely without a player name or label", () => {
  assert.equal(
    getMatchContext({}),
    "A match means this bat closely aligns with this player's current playing style, development goals, and equipment needs."
  );
});

test("decision snapshot uses existing data with safe display values", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.deepEqual(viewModel.decisionSnapshot, [
    { label: "Current Bat", value: "2026 Rawlings ICON USA - 30 in. - drop -8" },
    { label: "Recommended Bat", value: "Louisville Slugger Meta - 30 in. / 22 oz / drop -8" },
    { label: "Primary Goal", value: "improving bat control" },
    { label: "Expected Benefit", value: "Better bat-control support" },
    { label: "Confidence", value: "High Confidence" }
  ]);
});

test("Player DNA is organized into fixed story groups without changing scores", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.deepEqual(
    viewModel.playerDNAGroups.map((group) => ({
      title: group.title,
      keys: group.attributes.map((attribute) => attribute.key),
      scores: group.attributes.map((attribute) => attribute.score)
    })),
    [
      { title: "Jackson's Current Strengths", keys: ["batControl", "equipmentAwareness"], scores: [81, 74] },
      { title: "Areas Still Developing", keys: ["swingSpeed", "transitionReadiness"], scores: [66, 58] },
      { title: "More Information Helps", keys: ["profileCompleteness", "confidence"], scores: [84, 77] }
    ]
  );
});

test("CTA labels match the premium results experience", () => {
  assert.equal(recommendationCtaLabels.showAnalysis, "See Complete Analysis");
  assert.equal(recommendationCtaLabels.hideAnalysis, "Hide Complete Analysis");
  assert.equal(recommendationCtaLabels.runDemo, "Run Another Demo");
});

test("missing-information panel data is present only when applicable", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);
  const completeViewModel = mapRecommendationResponseToViewModel({
    ...response,
    playerDNA: { ...response.playerDNA, missingInformation: [], confidence: { score: 90, level: "high" } },
    recommendations: {
      ...response.recommendations,
      primaryRecommendation: {
        ...response.recommendations?.primaryRecommendation,
        confidence: { score: 91, band: "high" },
        explanation: { summary: "Ready.", topReasons: [] }
      }
    }
  });

  assert.ok(viewModel.missingInformation.length > 0);
  assert.equal(completeViewModel.missingInformation.length, 0);
});

test("empty recommendation response does not crash", () => {
  const viewModel = mapRecommendationResponseToViewModel({
    player: { id: "player-1", name: "Jackson Sanders" },
    recommendations: { alternatives: [], filteredEquipment: [] }
  });

  assert.equal(viewModel.primaryRecommendation, undefined);
  assert.deepEqual(viewModel.alternatives, []);
});

test("unexpected optional fields do not crash the page view model", () => {
  const viewModel = mapRecommendationResponseToViewModel({
    player: { name: "Jackson Sanders" },
    recommendations: {
      primaryRecommendation: {
        equipment: { model: "Mystery Bat" },
        explanation: { topReasons: [{ dimension: "BAT_CONTROL_FIT" }] }
      },
      alternatives: []
    }
  });

  assert.equal(viewModel.primaryRecommendation?.model, "Mystery Bat");
  assert.ok(viewModel.primaryRecommendation?.reasons.length);
});

test("Player DNA is summarized in human-readable language", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);
  const batControl = viewModel.playerDNAGroups
    .flatMap((group) => group.attributes)
    .find((attribute) => attribute.key === "batControl");

  assert.equal(batControl?.label, "Bat Control");
  assert.match(batControl?.summary ?? "", /controllable swing/i);
});

test("adapter integrates the Decision Conversation without changing recommendation values", () => {
  const viewModel = mapRecommendationResponseToViewModel(response);

  assert.equal(viewModel.decisionConversation.recommendationSummary.equipmentName, "Louisville Slugger Meta");
  assert.equal(viewModel.decisionConversation.confidenceExplanation.label, viewModel.overallConfidence?.label);
  assert.equal(viewModel.decisionConversation.alternativeExplanations[0]?.equipmentName, "Marucci CATX2");
  assert.equal(viewModel.primaryRecommendation?.matchPresentation?.roundedScore, 72);
  assert.doesNotMatch(JSON.stringify(viewModel.decisionConversation), /PDNA-GOAL-003|BAT_CONTROL_FIT|scored from/i);
});
