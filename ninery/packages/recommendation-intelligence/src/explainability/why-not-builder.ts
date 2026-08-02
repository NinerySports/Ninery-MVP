import type { CompatibilityResultItem, WhyNotComparison } from "../compatibility.types.js";

export function buildWhyNotComparison(source: CompatibilityResultItem, target: CompatibilityResultItem): WhyNotComparison {
  const sourceBetter = source.dimensions
    .filter((dimension) => {
      const targetDimension = target.dimensions.find((item) => item.code === dimension.code);
      return targetDimension && dimension.rawScore - targetDimension.rawScore >= 5;
    })
    .slice(0, 3);
  const targetBetter = target.dimensions
    .filter((dimension) => {
      const sourceDimension = source.dimensions.find((item) => item.code === dimension.code);
      return sourceDimension && dimension.rawScore - sourceDimension.rawScore >= 5;
    })
    .slice(0, 3);

  return {
    sourceEquipmentId: source.equipment.equipmentId,
    targetEquipmentId: target.equipment.equipmentId,
    sourceRank: source.trace.rank,
    targetRank: target.trace.rank,
    sourceAdvantages: sourceBetter.map((dimension) => `${source.equipment.model} scored higher on ${dimension.code}.`),
    targetMayBePreferableWhen: targetBetter.map((dimension) => `${target.equipment.model} may be preferable when ${dimension.code} matters more.`),
    summary: `${source.equipment.model} ranked ahead of ${target.equipment.model} for this player-specific scoring run.`
  };
}
