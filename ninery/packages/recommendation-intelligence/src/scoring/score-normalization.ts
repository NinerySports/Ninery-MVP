export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

export function similarityScore(target: number, capability: number, tolerance = 35): number {
  return clampScore(100 - Math.abs(target - capability) * (100 / tolerance));
}

export function preferredRangeScore(value: number | undefined, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (value >= min && value <= max) return 100;
  const distance = value < min ? min - value : value - max;
  return clampScore(100 - distance * 10);
}

export function inverseScore(value: number): number {
  return clampScore(100 - value);
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return clampScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}
