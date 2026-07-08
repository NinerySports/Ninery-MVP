import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const questions = [
  {
    code: "biggest-goal-this-season",
    section: "player_goals",
    questionText: "Biggest goal this season",
    helperText: "Choose the outcome that matters most for this player right now.",
    answerType: "single_select",
    options: ["more_contact", "more_power", "more_confidence", "better_fit", "prepare_for_next_level"],
    required: true,
    confidenceWeight: 1,
    version: 1,
    active: true
  },
  {
    code: "current-bat-feel",
    section: "current_equipment",
    questionText: "Current bat feel",
    helperText: "How does the current bat feel during normal swings?",
    answerType: "single_select",
    options: ["too_heavy", "too_light", "balanced", "end_loaded", "not_sure"],
    required: true,
    confidenceWeight: 1,
    version: 1,
    active: true
  },
  {
    code: "hardest-at-plate",
    section: "swing_feel",
    questionText: "What feels hardest at the plate",
    helperText: "Pick the challenge that shows up most often.",
    answerType: "single_select",
    options: ["catching_up", "making_contact", "driving_ball", "controlling_barrel", "confidence"],
    required: true,
    confidenceWeight: 1,
    version: 1,
    active: true
  },
  {
    code: "box-confidence",
    section: "performance_confidence",
    questionText: "Confidence in the batter's box",
    helperText: "Use a 1 to 5 scale where 5 means very confident.",
    answerType: "scale",
    options: { min: 1, max: 5 },
    required: true,
    confidenceWeight: 0.9,
    version: 1,
    active: true
  },
  {
    code: "competition-level-confirmation",
    section: "development_growth",
    questionText: "Current competition level confirmation",
    helperText: "Confirm the level this player is currently facing.",
    answerType: "single_select",
    options: ["recreational", "school", "travel", "elite", "unknown"],
    required: true,
    confidenceWeight: 0.8,
    version: 1,
    active: true
  },
  {
    code: "recent-growth-change",
    section: "development_growth",
    questionText: "Recent growth change",
    helperText: "Has the player had a noticeable growth change recently?",
    answerType: "single_select",
    options: ["none", "small", "moderate", "major", "not_sure"],
    required: true,
    confidenceWeight: 0.8,
    version: 1,
    active: true
  },
  {
    code: "preferred-swing-feel",
    section: "preferences",
    questionText: "Preferred swing feel",
    helperText: "What swing feel does the player prefer or respond to best?",
    answerType: "single_select",
    options: ["light_and_quick", "balanced", "power_loaded", "not_sure"],
    required: true,
    confidenceWeight: 0.9,
    version: 1,
    active: true
  },
  {
    code: "budget-comfort-level",
    section: "preferences",
    questionText: "Budget comfort level",
    helperText: "Select the price range that feels comfortable for this recommendation.",
    answerType: "single_select",
    options: ["value", "mid_range", "premium", "no_preference"],
    required: true,
    confidenceWeight: 0.7,
    version: 1,
    active: true
  }
];

try {
  for (const question of questions) {
    await prisma.batMatchQuestion.upsert({
      where: { code: question.code },
      update: question,
      create: question
    });
  }

  console.log(`Seeded ${questions.length} BatMatch questions.`);
} finally {
  await prisma.$disconnect();
}
