const prohibitedPatterns = [
  /will be easy immediately/i,
  /player will struggle/i,
  /this is the wrong bat/i,
  /guarantees? performance/i,
  /guarantees? comfort/i
] as const;

export const approvedTransitionCompatibilityLanguage = [
  "appears manageable",
  "may require an adjustment period",
  "equipment-adjustment fit",
  "current bat and readiness",
  "move from the current bat"
] as const;

export function validateTransitionCompatibilityLanguage(text: string): readonly string[] {
  return prohibitedPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `Prohibited transition-compatibility language matched ${pattern.toString()}.`);
}
