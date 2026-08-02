export type MatchPresentation = {
  roundedScore: number;
  label: string;
};

const recommendationReasonCopy: Record<string, string> = {
  BAT_CONTROL_FIT: "Supports {player}'s goal of improving bat control.",
  SWING_WEIGHT_FIT: "Provides a manageable swing feel for {player}'s current player profile.",
  SWING_FEEL_BALANCE_FIT: "Matches {player}'s preference for a lighter-feeling, balanced bat.",
  CONFIDENCE_BUILDING_FIT: "Offers a performance profile that can support confidence at the plate.",
  BARREL_FORGIVENESS_FIT: "Provides forgiveness while {player} continues building consistent contact.",
  SWEET_SPOT_FIT: "Gives {player} useful hitting-area support for this stage of development.",
  POWER_POTENTIAL_FIT: "Balances power potential with control and consistency needs.",
  TRANSITION_READINESS_FIT: "Fits {player}'s current transition-readiness profile.",
  DEVELOPMENT_GOAL_FIT: "Connects to {player}'s current development goal.",
  GROWTH_USEFUL_LIFE_FIT: "Accounts for {player}'s current growth and expected useful life.",
  EQUIPMENT_PREFERENCE_FIT: "Reflects {player}'s current bat preferences.",
  BUDGET_FIT: "Fits within the stated budget comfort range.",
  EVIDENCE_QUALITY: "Uses equipment information with enough support for this recommendation.",
  PROFILE_COMPLETENESS: "Reflects the amount of player information Ninery currently has.",
  LEAGUE_LEGALITY_FIT: "Meets the required {certification} equipment standard."
};

const tradeoffCopy: Record<string, string> = {
  BARREL_FORGIVENESS_FIT: "This bat may offer less forgiveness for off-center contact than some alternatives.",
  SWEET_SPOT_FIT: "Players still developing consistent contact may benefit from a bat with a larger or more forgiving hitting area.",
  POWER_POTENTIAL_FIT: "This recommendation prioritizes control and consistency over maximum power potential.",
  SWING_WEIGHT_FIT: "A more powerful-feeling bat may also feel harder to control for this player right now.",
  BAT_CONTROL_FIT: "This recommendation leans toward control, which may matter more than pure power for this fit.",
  CONFIDENCE_BUILDING_FIT: "Confidence support depends on confirming the player's preferred feel before a final purchase decision."
};

const developmentGoalCopy: Record<string, string> = {
  improve_contact: "improving contact",
  improve_power: "developing more power",
  improve_bat_control: "improving bat control",
  increase_swing_speed: "increasing swing speed",
  build_confidence: "building confidence",
  prepare_for_transition: "preparing for an equipment transition",
  maintain_current_fit: "maintaining a good current fit",
  unknown: "finding a better bat fit"
};

const expectedBenefitCopy: Record<string, string> = {
  improve_contact: "More consistent contact support",
  improve_power: "Power development support",
  improve_bat_control: "Better bat-control support",
  increase_swing_speed: "Swing-speed development support",
  build_confidence: "More confidence at the plate",
  prepare_for_transition: "A smoother equipment transition",
  maintain_current_fit: "Confirmation that the current fit still makes sense",
  unknown: "Clearer fit confidence"
};

export const recommendationCtaLabels = {
  showAnalysis: "See Complete Analysis",
  hideAnalysis: "Hide Complete Analysis",
  runDemo: "Run Another Demo"
} as const;

export function getMatchPresentation(score?: number): MatchPresentation | undefined {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;
  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));

  if (roundedScore >= 90) return { roundedScore, label: "Exceptional Match" };
  if (roundedScore >= 80) return { roundedScore, label: "Great Match" };
  if (roundedScore >= 70) return { roundedScore, label: "Strong Match" };
  if (roundedScore >= 60) return { roundedScore, label: "Promising Match" };
  return { roundedScore, label: "Limited Match" };
}

export function formatMatchScore(score?: number): string {
  const presentation = getMatchPresentation(score);
  return presentation ? `${presentation.roundedScore} / 100` : "Score unavailable";
}

export function getRecommendationReasonCopy(input: {
  code?: string;
  fallback?: string;
  playerFirstName?: string;
  certificationLabel?: string;
}): string | undefined {
  const player = input.playerFirstName ?? "this player";
  const certification = input.certificationLabel ?? "league-required";
  const mapped = input.code ? recommendationReasonCopy[input.code] : undefined;

  if (mapped) {
    return formatSentence(mapped.replaceAll("{player}", player).replaceAll("{certification}", certification));
  }

  const fallback = sanitizeCustomerCopy(input.fallback);
  return fallback ? formatSentence(fallback) : undefined;
}

export function getTradeoffCopy(value?: string): string | undefined {
  if (!value) return undefined;
  const knownCode = Object.keys(tradeoffCopy).find((code) => value.includes(code));
  if (knownCode) return tradeoffCopy[knownCode];

  const fallback = sanitizeCustomerCopy(value);
  return fallback ? formatSentence(fallback) : undefined;
}

export function getWhyChosenSummary(input: {
  playerFirstName?: string;
  batName: string;
  developmentGoal?: string;
  primaryReasons: string[];
}): string {
  const player = input.playerFirstName ?? "this player";
  const goal = developmentGoalCopy[input.developmentGoal ?? "unknown"] ?? developmentGoalCopy.unknown;
  const supportPhrase =
    input.primaryReasons.length > 0
      ? "the control, feel, confidence, and development signals Ninery can see right now"
      : "the player needs, development goals, and league requirements Ninery can confirm right now";

  return `${player}'s current profile suggests the ${input.batName} may be the best fit because it lines up with ${supportPhrase}. It is recommended as a strong option for ${goal}, while still leaving room to confirm final feel and sizing before a purchase.`;
}

export function getMatchContext(input: { playerFirstName?: string; matchLabel?: string }): string {
  const player = input.playerFirstName ?? "this player";
  const label = input.matchLabel ?? "match";
  return `A ${label} means this bat closely aligns with ${player}'s current playing style, development goals, and equipment needs.`;
}

export function getHeroRecommendationCopy(playerFirstName?: string): string {
  const player = playerFirstName ?? "this player";
  return `Recommended for ${player} based on his current swing profile, experience level, and development goals.`;
}

export function getReassuranceCopy(playerFirstName?: string): { lead: string; body: string } {
  const player = playerFirstName ?? "your player";
  return {
    lead: "You don't have to guess anymore.",
    body: `Ninery turns ${player}'s profile, current bat context, and development goals into a recommendation parents can understand. This is not a guarantee of performance, but it gives you a clearer starting point and explains why this bat rises to the top.`
  };
}

export function formatDevelopmentGoal(value?: string): string {
  return developmentGoalCopy[value ?? "unknown"] ?? developmentGoalCopy.unknown;
}

export function formatExpectedBenefit(value?: string): string {
  return expectedBenefitCopy[value ?? "unknown"] ?? expectedBenefitCopy.unknown;
}

export function formatCertificationApproval(certification?: string): string | undefined {
  if (!certification) return undefined;
  const normalized = certification.toLowerCase();
  if (normalized === "usa") return "USA Baseball Approved";
  if (normalized === "usssa") return "USSSA Approved";
  if (normalized === "bbcor") return "BBCOR Approved";
  if (normalized === "none") return "No Certification Listed";
  if (normalized === "unknown") return "Certification Not Confirmed";
  return `${formatLabel(certification)} Approved`;
}

export function formatPlayerContext(age?: number, competitionLevel?: string): string {
  const competition = competitionLevel ? `${formatLabel(competitionLevel)} Baseball` : "Player profile";
  return age ? `Age ${age} - ${competition}` : competition;
}

export function formatCurrentBat(currentBat?: string): string[] {
  if (!currentBat) return [];
  const compactMatch = currentBat.match(/(.+?)\s+(\d+(?:\.\d+)?)\s+(?:inch|in\.)\s+drop\s+(-?\d+)/i);
  if (compactMatch) {
    const drop = compactMatch[3].startsWith("-") ? compactMatch[3] : `-${compactMatch[3]}`;
    return [compactMatch[1].trim(), `${compactMatch[2]} in.`, `drop ${drop}`];
  }

  const normalized = currentBat.replace(/ inch\b/i, " in.").replace(/ drop /i, " - drop ");
  const parts = normalized.split(/\s+-\s+|\s+•\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [normalized];
}

export function getPlayerFirstName(name?: string): string | undefined {
  return name?.trim().split(/\s+/)[0];
}

export function confidenceLabel(label?: string): string | undefined {
  if (!label) return undefined;
  const formatted = formatLabel(label);
  return formatted.includes("Confidence") ? formatted : `${formatted} Confidence`;
}

export function confidenceCopy(score?: number): string | undefined {
  if (score === undefined) return undefined;
  if (score >= 85) return "Ninery has strong supporting player and equipment information for this recommendation.";
  if (score >= 65) return "Ninery has enough reliable information to recommend confidently, with a few details still worth confirming.";
  return "Ninery can make an initial recommendation, but more player and equipment information would improve confidence.";
}

export function sanitizeCustomerCopy(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || looksLikeInternalCode(trimmed) || soundsLikeRuleText(trimmed)) return undefined;
  const cleaned = trimmed.replace(/\b[A-Z]{2,}[_-][A-Z0-9_-]{2,}\b/g, "").replace(/\s{2,}/g, " ").trim();
  return cleaned && !looksLikeInternalCode(cleaned) ? cleaned : undefined;
}

export function formatLabel(value?: string): string {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function soundsLikeRuleText(value: string): boolean {
  return /\b(rewards|compares|scored from|request constraints|evidence quality|player dna|equipment dna|algorithm|rule)\b/i.test(value);
}

function looksLikeInternalCode(value: string): boolean {
  return /^(PDNA|EDNA|BATMATCH|REC)-/i.test(value) || (/^[A-Z0-9_ -]{6,}$/.test(value) && /[_-]/.test(value));
}

function formatSentence(value: string): string {
  const trimmed = value.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
