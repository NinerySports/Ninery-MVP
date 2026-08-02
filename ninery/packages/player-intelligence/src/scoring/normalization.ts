export function clampScore(score: number): number {
  if (Number.isNaN(score)) {
    return 50;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function normalizeAdjustment(scoreAdjustment: number, weight: number): number {
  return scoreAdjustment * weight;
}
