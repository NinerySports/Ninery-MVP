import { createHash } from "node:crypto";
import type { CompatibilityInput } from "./compatibility.types.js";

export function createCompatibilityInputHash(input: CompatibilityInput): string {
  const payload = {
    playerDNAProfileId: input.playerDNA.profileId,
    equipmentProfileVersions: input.equipment.map((equipment) => ({
      equipmentId: equipment.equipmentId,
      variantId: equipment.variantId,
      sourceProfileId: equipment.sourceProfileId,
      profileVersion: equipment.profileVersion
    })).sort((a, b) => a.equipmentId.localeCompare(b.equipmentId)),
    context: {
      certification: input.context.certification,
      category: input.context.category,
      variantPreferences: input.context.variantPreferences,
      budget: input.context.budget,
      resultLimit: input.context.resultLimit ?? 3,
      scoringConfigVersion: input.context.scoringConfigVersion,
      includeInternalDraftProfiles: input.context.includeInternalDraftProfiles ?? false,
      minimumMatchScore: input.context.minimumMatchScore,
      minimumEvidenceConfidence: input.context.minimumEvidenceConfidence
    }
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
