export function normalizeEquipmentDNAScore(score: number): number {
  const normalized = score <= 10 ? score * 10 : score;
  return Math.min(100, Math.max(0, Math.round(normalized)));
}

export function decimalToNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }

  return Number(value);
}
