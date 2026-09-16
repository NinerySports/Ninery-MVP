export const CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION = "1.0";

export type CurrentEquipmentFamiliarityLevel =
  | "new_or_unfamiliar"
  | "limited_familiarity"
  | "developing_familiarity"
  | "established_familiarity"
  | "highly_established_familiarity"
  | "unknown";

export type CurrentEquipmentFamiliarityFrequency =
  | "less_than_weekly"
  | "weekly"
  | "multiple_times_weekly"
  | "daily_or_near_daily"
  | "unknown";

export type CurrentEquipmentFamiliarityUsageContext =
  | "practice"
  | "lessons"
  | "games"
  | "batting_cage"
  | "other";

export type DirectlyReportedCurrentEquipmentFamiliarity =
  | "not_familiar"
  | "somewhat_familiar"
  | "familiar"
  | "very_familiar"
  | "unknown";

export type CurrentEquipmentFamiliaritySource =
  | "player"
  | "parent_or_guardian"
  | "coach"
  | "internal_staff"
  | "system_history"
  | "combined";

export type CurrentEquipmentFamiliarityInput = {
  readonly playerId: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly firstUsedAt?: Date;
  readonly mostRecentUseAt?: Date;
  readonly estimatedSessionsUsed?: number;
  readonly estimatedWeeksUsed?: number;
  readonly regularUseFrequency?: CurrentEquipmentFamiliarityFrequency;
  readonly usageContexts?: readonly CurrentEquipmentFamiliarityUsageContext[];
  readonly currentlyPrimaryEquipment?: boolean;
  readonly directlyReportedFamiliarity?: DirectlyReportedCurrentEquipmentFamiliarity;
  readonly conflictingReports?: boolean;
  readonly ownershipOnly?: boolean;
  readonly source: CurrentEquipmentFamiliaritySource;
  readonly capturedAt: Date;
};

export type CurrentEquipmentFamiliarityResult = {
  readonly version: typeof CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION;
  readonly playerId: string;
  readonly equipmentId: string;
  readonly equipmentVariantId?: string;
  readonly level: CurrentEquipmentFamiliarityLevel;
  readonly numericReference?: number;
  readonly confidence: "estimated" | "moderate" | "high";
  readonly availableInputs: readonly string[];
  readonly missingInputs: readonly string[];
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly evaluatedAt: Date;
};

export const CURRENT_EQUIPMENT_FAMILIARITY_DEFINITION =
  "The extent to which the player has established experience using the current equipment setup under normal practice or game conditions.";

export const CURRENT_EQUIPMENT_FAMILIARITY_EXCLUSIONS = [
  "equipment ownership",
  "product preference alone",
  "skill level",
  "equipment quality",
  "transition compatibility",
  "confidence compatibility",
  "psychological comfort"
] as const;
