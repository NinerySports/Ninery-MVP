import type {
  CanonicalEquipmentDNAAttributeValue,
  CanonicalEquipmentDNAProfile,
  EquipmentDNAAttributeKey
} from "@ninery/equipment-intelligence";
import type { PlayerDNAProfileResult, PrimaryHittingGoal } from "@ninery/player-intelligence";
import {
  compareConfidenceCompatibilityWithLegacyDimension,
  evaluateConfidenceCompatibility,
  type LegacyConfidenceDimensionInput
} from "../confidence/index.js";
import {
  compareTransitionCompatibilityWithLegacyDimension,
  evaluateTransitionCompatibility,
  type LegacyTransitionDimensionInput
} from "../transition/index.js";
import {
  COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
  type CompatibilitySyntheticMatrixResult,
  type CompatibilitySyntheticPlayerProfile,
  type CompatibilityEquipmentIdentity
} from "./compatibility-validation.types.js";

export function buildCompatibilitySyntheticPlayerProfiles(basePlayerDNA: PlayerDNAProfileResult): readonly CompatibilitySyntheticPlayerProfile[] {
  return [
    profile(basePlayerDNA, {
      profileId: "synthetic-developing-support-needs",
      label: "Developing Support-Needs Player",
      purpose: "Tests high support need, lower control, lower contact consistency, and limited experience.",
      goal: "build_confidence",
      scores: { batControl: 48, contactConsistency: 44, swingSpeed: 46, physicalStrength: 42, transitionReadiness: 42, growthStability: 58, equipmentAwareness: 35, confidence: 46 },
      developmentStage: "developing",
      preferredSwingFeel: "balanced",
      experienceYears: 1,
      expectedDirectionalBehavior: ["Higher forgiveness and predictability should help.", "Large equipment changes should be less manageable."],
      knownMissingInformation: ["currentEquipmentFamiliarity"]
    }),
    profile(basePlayerDNA, {
      profileId: "synthetic-experienced-contact",
      label: "Experienced Contact-Oriented Player",
      purpose: "Tests strong control, contact consistency, and lower assisted-support need.",
      goal: "improve_contact",
      scores: { batControl: 88, contactConsistency: 90, swingSpeed: 70, physicalStrength: 68, transitionReadiness: 76, growthStability: 82, equipmentAwareness: 84, confidence: 82 },
      developmentStage: "performance",
      preferredSwingFeel: "balanced",
      experienceYears: 7,
      expectedDirectionalBehavior: ["Support excess should create some direct-feedback tradeoffs.", "Transition should tolerate modest changes."],
      knownMissingInformation: ["currentEquipmentFamiliarity"]
    }),
    profile(basePlayerDNA, {
      profileId: "synthetic-power-ready",
      label: "Physically Ready Power-Focused Player",
      purpose: "Tests higher physical readiness, power goal, and greater swing-effort tolerance.",
      goal: "improve_power",
      scores: { batControl: 78, contactConsistency: 72, swingSpeed: 86, physicalStrength: 90, transitionReadiness: 84, growthStability: 76, equipmentAwareness: 78, confidence: 78 },
      developmentStage: "performance",
      preferredSwingFeel: "slightly_end_loaded",
      experienceYears: 6,
      expectedDirectionalBehavior: ["More demanding equipment changes should be more manageable than for developing players.", "Confidence compatibility should not require maximum predictability."],
      knownMissingInformation: ["currentEquipmentFamiliarity"]
    }),
    profile(basePlayerDNA, {
      profileId: "synthetic-recent-growth",
      label: "Recent-Growth Player",
      purpose: "Tests growth uncertainty and whether transition distinguishes justified size change from excess change.",
      goal: "prepare_for_transition",
      scores: { batControl: 68, contactConsistency: 64, swingSpeed: 64, physicalStrength: 72, transitionReadiness: 70, growthStability: 42, equipmentAwareness: 62, confidence: 66 },
      developmentStage: "competitive",
      preferredSwingFeel: "balanced",
      experienceYears: 4,
      growthStatus: "rapid_growth",
      expectedDirectionalBehavior: ["Moderate size increases may be more explainable but should still carry demand.", "Growth uncertainty should limit confidence."],
      knownMissingInformation: ["currentEquipmentFamiliarity"]
    }),
    profile(basePlayerDNA, {
      profileId: "synthetic-incomplete-context",
      label: "Incomplete-Context Player",
      purpose: "Tests safe behavior when context is valid but incomplete.",
      goal: "unknown",
      scores: { batControl: 64, contactConsistency: 60, swingSpeed: 58, physicalStrength: 56, transitionReadiness: 55, growthStability: 50, equipmentAwareness: 50, confidence: 58 },
      developmentStage: "competitive",
      preferredSwingFeel: "unknown",
      experienceYears: undefined,
      confidenceLevel: "medium",
      expectedDirectionalBehavior: ["Missing context should lower confidence or block only when required inputs are absent.", "No missing value should be treated as zero."],
      knownMissingInformation: ["currentEquipmentFamiliarity", "playerProfile.experienceYears", "player.categories.preferredSwingFeel"]
    }),
    profile(basePlayerDNA, {
      profileId: "synthetic-advanced-direct-feedback",
      label: "Advanced Direct-Feedback Player",
      purpose: "Tests whether high support does not automatically become perfect for an advanced player.",
      goal: "improve_power",
      scores: { batControl: 94, contactConsistency: 92, swingSpeed: 88, physicalStrength: 86, transitionReadiness: 82, growthStability: 84, equipmentAwareness: 90, confidence: 84 },
      developmentStage: "advanced",
      preferredSwingFeel: "end_loaded",
      experienceYears: 8,
      expectedDirectionalBehavior: ["Very high support can create direct-feedback tradeoffs.", "Transition should tolerate greater demand but still report real changes."],
      knownMissingInformation: ["currentEquipmentFamiliarity"]
    })
  ];
}

export function buildCompatibilitySyntheticMatrix(input: {
  readonly basePlayerDNA: PlayerDNAProfileResult;
  readonly canonicalProfiles: readonly CanonicalEquipmentDNAProfile[];
  readonly currentEquipmentProfile: CanonicalEquipmentDNAProfile;
  readonly confidenceLegacyInputs?: readonly LegacyConfidenceDimensionInput[];
  readonly transitionLegacyInputs?: readonly LegacyTransitionDimensionInput[];
  readonly evaluatedAt: Date;
}): CompatibilitySyntheticMatrixResult {
  const players = buildCompatibilitySyntheticPlayerProfiles(input.basePlayerDNA);
  const equipment = input.canonicalProfiles.map(identity);
  const evaluations = [];

  for (const player of players) {
    for (const equipmentProfile of input.canonicalProfiles) {
      try {
        const confidenceCompatibility = evaluateConfidenceCompatibility({
          playerDNA: player.playerDNA,
          canonicalEquipmentProfile: equipmentProfile,
          evaluatedAt: input.evaluatedAt
        });
        const transitionCompatibility = evaluateTransitionCompatibility({
          playerDNA: player.playerDNA,
          currentEquipmentProfile: input.currentEquipmentProfile,
          proposedEquipmentProfile: equipmentProfile,
          evaluatedAt: input.evaluatedAt
        });
        const confidenceLegacy = input.confidenceLegacyInputs?.find((legacy) => legacy.equipmentId === equipmentProfile.equipmentId);
        const transitionLegacy = input.transitionLegacyInputs?.find((legacy) => legacy.equipmentId === equipmentProfile.equipmentId);
        evaluations.push({
          profileId: player.profileId,
          equipmentId: equipmentProfile.equipmentId,
          equipmentVariantId: equipmentProfile.equipmentVariantId,
          confidenceCompatibility,
          transitionCompatibility,
          confidenceLegacyComparison: confidenceLegacy ? compareConfidenceCompatibilityWithLegacyDimension({ result: confidenceCompatibility, legacy: confidenceLegacy }) : undefined,
          transitionLegacyComparison: transitionLegacy ? compareTransitionCompatibilityWithLegacyDimension({ result: transitionCompatibility, legacy: transitionLegacy }) : undefined
        });
      } catch (error) {
        evaluations.push({
          profileId: player.profileId,
          equipmentId: equipmentProfile.equipmentId,
          equipmentVariantId: equipmentProfile.equipmentVariantId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  const allResults = evaluations.flatMap((evaluation) => [evaluation.confidenceCompatibility, evaluation.transitionCompatibility].filter(Boolean));
  return {
    version: COMPATIBILITY_SYNTHETIC_PLAYER_MATRIX_VERSION,
    playerProfiles: players.map((player) => ({ profileId: player.profileId, label: player.label, purpose: player.purpose })),
    equipment,
    evaluations,
    completedEvaluationCount: allResults.filter((result) => result?.status === "completed").length,
    blockedEvaluationCount: allResults.filter((result) => result?.status.startsWith("blocked")).length + evaluations.filter((evaluation) => evaluation.error).length,
    partialEvaluationCount: allResults.filter((result) => result?.status === "partial").length,
    deterministic: true
  };
}

export function perturbPlayerDNA(
  playerDNA: PlayerDNAProfileResult,
  input: {
    readonly profileId?: string;
    readonly scoreChanges?: Partial<PlayerDNAProfileResult["scores"]>;
    readonly categoryChanges?: Partial<PlayerDNAProfileResult["categories"]>;
    readonly experienceYears?: number;
  }
): PlayerDNAProfileResult {
  const hasExperienceYears = Object.prototype.hasOwnProperty.call(input, "experienceYears");
  const playerProfile = hasExperienceYears
    ? { ...playerDNA.inputSnapshot.playerProfile, experienceYears: input.experienceYears }
    : playerDNA.inputSnapshot.playerProfile;
  return {
    ...playerDNA,
    profileId: input.profileId ?? playerDNA.profileId,
    playerId: input.profileId ?? playerDNA.playerId,
    scores: { ...playerDNA.scores, ...input.scoreChanges },
    categories: { ...playerDNA.categories, ...input.categoryChanges },
    confidence: {
      ...playerDNA.confidence,
      level: input.categoryChanges?.profileConfidenceLevel ?? playerDNA.confidence.level
    },
    inputSnapshot: {
      ...playerDNA.inputSnapshot,
      player: { ...playerDNA.inputSnapshot.player, id: input.profileId ?? playerDNA.inputSnapshot.player.id },
      playerProfile
    }
  };
}

export function perturbCanonicalProfile(
  profile: CanonicalEquipmentDNAProfile,
  changes: Partial<Record<EquipmentDNAAttributeKey, number | string>>
): CanonicalEquipmentDNAProfile {
  return {
    ...profile,
    attributes: profile.attributes.map((attribute) => {
      if (!(attribute.key in changes)) return attribute;
      const next = changes[attribute.key];
      return {
        ...attribute,
        value: next ?? attribute.value,
        evidence: attribute.evidence.map((evidence) => ({
          ...evidence,
          rawValue: typeof next === "number"
            ? { ...(typeof evidence.rawValue === "object" && evidence.rawValue !== null ? evidence.rawValue : {}), normalizedScore: next, sourceScore: next }
            : evidence.rawValue
        }))
      };
    })
  };
}

function profile(
  base: PlayerDNAProfileResult,
  input: {
    readonly profileId: string;
    readonly label: string;
    readonly purpose: string;
    readonly goal: PrimaryHittingGoal;
    readonly scores: Partial<PlayerDNAProfileResult["scores"]>;
    readonly developmentStage: PlayerDNAProfileResult["categories"]["developmentStage"];
    readonly preferredSwingFeel: PlayerDNAProfileResult["categories"]["preferredSwingFeel"];
    readonly experienceYears?: number;
    readonly growthStatus?: PlayerDNAProfileResult["categories"]["growthStatus"];
    readonly confidenceLevel?: PlayerDNAProfileResult["confidence"]["level"];
    readonly expectedDirectionalBehavior: readonly string[];
    readonly knownMissingInformation: readonly string[];
  }
): CompatibilitySyntheticPlayerProfile {
  const confidenceLevel = input.confidenceLevel ?? "high";
  return {
    profileId: input.profileId,
    label: input.label,
    purpose: input.purpose,
    playerDNA: perturbPlayerDNA(base, {
      profileId: input.profileId,
      scoreChanges: input.scores,
      categoryChanges: {
        primaryHittingGoal: input.goal,
        developmentStage: input.developmentStage,
        preferredSwingFeel: input.preferredSwingFeel,
        growthStatus: input.growthStatus ?? "moderate_growth",
        profileConfidenceLevel: confidenceLevel
      },
      experienceYears: input.experienceYears
    }),
    expectedDirectionalBehavior: input.expectedDirectionalBehavior,
    knownMissingInformation: input.knownMissingInformation
  };
}

function identity(profile: CanonicalEquipmentDNAProfile): CompatibilityEquipmentIdentity {
  return {
    equipmentId: profile.equipmentId,
    equipmentVariantId: profile.equipmentVariantId,
    equipmentName: profile.equipmentName,
    variantLabel: profile.variantLabel
  };
}
