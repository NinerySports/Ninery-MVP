import type { CurrentEquipmentFamiliarityLevel } from "./current-equipment-familiarity.types.js";

export const currentEquipmentFamiliarityLevelMeanings = {
  new_or_unfamiliar: "The player has little or no meaningful use with the current setup.",
  limited_familiarity: "The player has used it only a small number of times.",
  developing_familiarity: "The player has begun adjusting but does not yet have a long-established baseline.",
  established_familiarity: "The player regularly uses the setup and has a useful adjustment baseline.",
  highly_established_familiarity: "The setup has been used consistently over an extended period.",
  unknown: "The available information is insufficient."
} as const satisfies Record<CurrentEquipmentFamiliarityLevel, string>;

export const currentEquipmentFamiliarityNumericReferences = {
  new_or_unfamiliar: 5,
  limited_familiarity: 25,
  developing_familiarity: 50,
  established_familiarity: 75,
  highly_established_familiarity: 95,
  unknown: undefined
} as const satisfies Record<CurrentEquipmentFamiliarityLevel, number | undefined>;

export const currentEquipmentFamiliarityPolicy = {
  version: "1.0",
  numericDirection: "0 = no established familiarity, 100 = highly established familiarity",
  ownershipAloneInsufficient: true,
  conflictingReportsLowerConfidence: true,
  noHiddenMidpointDefault: true,
  minimumHighConfidenceEvidenceCount: 3,
  minimumEstablishedWeeks: 8,
  minimumEstablishedSessions: 20,
  minimumHighlyEstablishedWeeks: 16,
  minimumHighlyEstablishedSessions: 40
} as const;
