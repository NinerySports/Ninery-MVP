import { createHash } from "node:crypto";
import type { CompatibilityResultItem, RecommendationTrace } from "../compatibility.types.js";

export function stableTraceId(seed: unknown): string {
  return createHash("sha256").update(JSON.stringify(seed)).digest("hex").slice(0, 32);
}

export function withRankTrace(item: CompatibilityResultItem, rank: number, tieBreakRulesUsed: string[]): CompatibilityResultItem {
  const trace: RecommendationTrace = {
    ...item.trace,
    rank,
    tieBreakRulesUsed
  };
  return { ...item, trace };
}
