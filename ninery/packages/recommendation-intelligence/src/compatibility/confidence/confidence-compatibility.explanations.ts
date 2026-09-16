const prohibitedPatterns = [
  /will make (?:the )?(?:player|child|hitter).{0,20}confident/i,
  /guarantees? confidence/i,
  /fix(?:es)? confidence/i,
  /low confidence child/i,
  /anxious player/i,
  /psychological problem/i
] as const;

export const approvedConfidenceCompatibilityLanguage = [
  "manageable fit",
  "predictable response",
  "development support",
  "understandable feedback",
  "current consistency needs",
  "equipment adjustment demand"
] as const;

export function validateConfidenceCompatibilityLanguage(text: string): readonly string[] {
  return prohibitedPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `Prohibited confidence-compatibility language matched ${pattern.toString()}.`);
}
