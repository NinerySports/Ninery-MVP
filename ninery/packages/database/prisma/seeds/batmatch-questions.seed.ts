import { prisma } from "./client.ts";

const optionSets = {
  goals: ["more_contact", "more_power", "more_confidence", "better_fit", "prepare_for_next_level"],
  feel: ["too_heavy", "too_light", "balanced", "end_loaded", "not_sure"],
  confidenceScale: { min: 1, max: 5 },
  yesNoUnsure: ["yes", "no", "not_sure"],
  budget: ["value", "mid_range", "premium", "no_preference"],
  level: ["recreational", "little_league", "school", "travel", "elite_travel", "showcase"]
};

export const batMatchQuestions = [
  ["goal-primary", "player_goals", "Biggest goal this season", "Choose the outcome that matters most right now.", "single_select", optionSets.goals, 1],
  ["goal-secondary", "player_goals", "Second biggest goal this season", "Pick the next most important outcome.", "single_select", optionSets.goals, 0.8],
  ["goal-timeline", "player_goals", "When do you want to see improvement?", "This helps weight short-term vs long-term recommendations.", "single_select", ["now", "this_season", "next_season", "long_term"], 0.7],
  ["goal-player-input", "player_goals", "What does the player want most?", "Use the player's own words when possible.", "text", null, 0.7],
  ["goal-parent-input", "player_goals", "What does the parent or coach want most?", "Capture any adult context around the player's needs.", "text", null, 0.6],
  ["current-bat-model", "current_equipment", "What bat is the player using now?", "Manufacturer and model are enough if you know them.", "text", null, 0.8],
  ["current-bat-length", "current_equipment", "Current bat length", "Enter length in inches if known.", "number", null, 0.7],
  ["current-bat-weight", "current_equipment", "Current bat weight", "Enter weight in ounces if known.", "number", null, 0.7],
  ["current-bat-drop", "current_equipment", "Current bat drop", "Example: -10, -8, -5, or BBCOR -3.", "number", null, 0.7],
  ["current-bat-feel", "current_equipment", "Current bat feel", "How does the current bat feel during normal swings?", "single_select", optionSets.feel, 1],
  ["current-certification", "current_equipment", "Current bat certification", "Choose the certification printed on the bat.", "single_select", ["usa", "usssa", "bbcor", "none", "unknown"], 0.7],
  ["current-equipment-complaint", "current_equipment", "Biggest complaint about current bat", "Pick the issue that shows up most often.", "single_select", ["too_heavy", "not_enough_pop", "stings_hands", "hard_to_control", "no_complaint", "unknown"], 0.9],
  ["swing-tempo", "swing_feel", "Swing tempo", "How would you describe the player's swing rhythm?", "single_select", ["quick", "smooth", "long", "inconsistent", "unknown"], 0.8],
  ["swing-path", "swing_feel", "Typical swing path", "Choose the closest description.", "single_select", ["level", "upward", "downward", "varies", "unknown"], 0.6],
  ["barrel-control", "swing_feel", "Barrel control", "How well does the player control the barrel?", "scale", optionSets.confidenceScale, 1],
  ["contact-location", "swing_feel", "Most common contact location", "Where does contact usually happen on the bat?", "single_select", ["sweet_spot", "handle", "end_cap", "mixed", "unknown"], 0.8],
  ["late-on-fastballs", "swing_feel", "Late on fastballs?", "Does the player often feel late against velocity?", "single_select", optionSets.yesNoUnsure, 0.8],
  ["rollover-frequency", "swing_feel", "Rollover frequency", "How often does the player roll over ground balls?", "single_select", ["rarely", "sometimes", "often", "unknown"], 0.5],
  ["hardest-at-plate", "performance_confidence", "What feels hardest at the plate", "Pick the challenge that shows up most often.", "single_select", ["catching_up", "making_contact", "driving_ball", "controlling_barrel", "confidence"], 1],
  ["box-confidence", "performance_confidence", "Confidence in the batter's box", "Use a 1 to 5 scale where 5 means very confident.", "scale", optionSets.confidenceScale, 1],
  ["two-strike-confidence", "performance_confidence", "Two-strike confidence", "How confident is the player with two strikes?", "scale", optionSets.confidenceScale, 0.8],
  ["game-vs-practice", "performance_confidence", "Game swing vs practice swing", "How different is the game swing from practice?", "single_select", ["same", "slightly_worse", "much_worse", "better_in_games", "unknown"], 0.7],
  ["miss-pattern", "performance_confidence", "Most common miss", "Choose the miss pattern seen most often.", "single_select", ["swing_miss", "weak_contact", "pop_up", "ground_ball", "late_foul", "unknown"], 0.8],
  ["competition-confirmation", "development_growth", "Current competition level confirmation", "Confirm the level this player is currently facing.", "single_select", optionSets.level, 0.8],
  ["pitch-speed-comfort", "development_growth", "Pitch speed comfort", "How comfortable is the player against current velocity?", "scale", optionSets.confidenceScale, 0.7],
  ["practice-frequency", "development_growth", "Practice frequency", "How often does the player practice hitting?", "single_select", ["rarely", "weekly", "multiple_weekly", "daily", "seasonal"], 0.6],
  ["coaching-support", "development_growth", "Coaching support", "Does the player currently receive hitting instruction?", "single_select", optionSets.yesNoUnsure, 0.5],
  ["experience-years", "development_growth", "Years of baseball or softball experience", "Approximate years of playing experience.", "number", null, 0.5],
  ["recent-growth-change", "development_growth", "Recent growth change", "Has the player had a noticeable growth change recently?", "single_select", ["none", "small", "moderate", "major", "not_sure"], 0.9],
  ["height-recent", "development_growth", "Current height", "Enter height in inches if known.", "number", null, 0.5],
  ["weight-recent", "development_growth", "Current weight", "Enter weight in pounds if known.", "number", null, 0.5],
  ["strength-change", "development_growth", "Recent strength change", "Has the player gotten noticeably stronger recently?", "single_select", optionSets.yesNoUnsure, 0.6],
  ["fatigue-late-games", "development_growth", "Fatigue late in games", "Does swing quality fade late in games or tournaments?", "single_select", optionSets.yesNoUnsure, 0.6],
  ["preferred-swing-feel", "preferences", "Preferred swing feel", "What swing feel does the player prefer?", "single_select", ["light_and_quick", "balanced", "power_loaded", "not_sure"], 0.9],
  ["preferred-material", "preferences", "Preferred bat material", "Choose a preference if the player has one.", "single_select", ["alloy", "composite", "hybrid", "wood", "no_preference"], 0.5],
  ["preferred-brand", "preferences", "Preferred brand", "Enter any preferred brand or leave blank.", "text", null, 0.4],
  ["sting-sensitivity", "preferences", "Hand sting sensitivity", "How much does hand sting affect confidence?", "scale", optionSets.confidenceScale, 0.6],
  ["sound-preference", "preferences", "Sound preference", "Does the player care about bat sound?", "single_select", ["loud_pop", "muted", "no_preference", "unknown"], 0.3],
  ["budget-comfort-level", "preferences", "Budget comfort level", "Select the price range that feels comfortable.", "single_select", optionSets.budget, 0.8],
  ["budget-max", "preferences", "Maximum comfortable budget", "Enter a maximum budget if there is one.", "number", null, 0.6],
  ["new-or-used", "preferences", "New or used equipment preference", "Would used equipment be acceptable?", "single_select", ["new_only", "used_ok", "either", "unknown"], 0.4],
  ["timeline-to-buy", "preferences", "Buying timeline", "When are you likely to make a decision?", "single_select", ["now", "this_month", "this_season", "researching", "unknown"], 0.5],
  ["size-risk-comfort", "preferences", "Size change comfort", "How comfortable are you with changing bat size?", "scale", optionSets.confidenceScale, 0.6],
  ["recommendation-style", "preferences", "Recommendation style", "What kind of recommendation is most useful?", "single_select", ["best_overall", "safe_choice", "growth_room", "budget_value", "premium_performance"], 0.5],
  ["anything-else", "preferences", "Anything else we should know?", "Share extra context about the player or equipment needs.", "text", null, 0.3]
].map(([code, section, questionText, helperText, answerType, options, confidenceWeight]) => ({
  code,
  section,
  questionText,
  helperText,
  answerType,
  options,
  required: true,
  confidenceWeight,
  version: 1,
  active: true
}));

export async function seed() {
  for (const question of batMatchQuestions) {
    await prisma.batMatchQuestion.upsert({
      where: { code: question.code },
      update: question,
      create: question
    });
  }
}

export async function clear() {
  await prisma.batMatchAnswer.deleteMany({
    where: {
      question: {
        code: { in: batMatchQuestions.map((question) => question.code) }
      }
    }
  });
  await prisma.batMatchQuestion.deleteMany({
    where: { code: { in: batMatchQuestions.map((question) => question.code) } }
  });
}
