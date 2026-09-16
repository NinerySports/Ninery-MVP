import { EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION } from "../attributes/index.js";
import {
  OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION,
  OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION,
  type OptionalSignalCanonicalizationDecision
} from "./optional-signal-policy.types.js";

export const OPTIONAL_SIGNAL_POLICY_REVIEWED_AT = new Date("2026-07-29T00:00:00.000Z");

const scoreScale = "0-100 legacy Equipment DNA score";

export const optionalSignalCanonicalizationPolicy = [
  {
    version: OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION,
    policyVersion: OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION,
    registryVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    reviewedAt: OPTIONAL_SIGNAL_POLICY_REVIEWED_AT,
    signal: {
      key: "balance",
      legacyField: "balance",
      legacyCharacteristicCode: "SWING_BALANCE",
      existingCanonicalAttributeKey: "balance_profile",
      namingNotes: [
        "Legacy score is named balance and maps from SWING_BALANCE.",
        "Canonical balance_profile is directional feel, not player preference fit."
      ]
    },
    outcome: "canonical_equipment_numeric_reference",
    currentState: {
      legacyMeaning: "A legacy Equipment DNA score used as the bat's balance behavior when comparing against a player's preferred swing feel.",
      currentEngineUsage: {
        usedByEligibility: false,
        usedByMatchScoring: true,
        usedByDimensionScoring: true,
        usedByRecommendationConfidence: true,
        usedByReasons: true,
        usedByTradeoffs: true,
        usedByAlternatives: false,
        usedByTieBreaking: false,
        dimensionNames: ["SWING_FEEL_BALANCE_FIT"],
        weights: { SWING_FEEL_BALANCE_FIT: 0.1 },
        notes: [
          "Current scoring compares preferredSwingFeel to scores.balance through similarityScore().",
          "Missing balance creates a neutral 50-point dimension and missing-information confidence penalty.",
          "The current score also influences reason and tradeoff selection through the generated dimension."
        ]
      },
      currentDirectionality: "Repository scoring targets 85 for light, 70 for balanced, and 45 for end-loaded preferences, so higher legacy values currently behave as more balanced/supportive rather than more end-loaded.",
      currentScale: scoreScale,
      knownAmbiguities: [
        "Legacy direction does not match the proposed canonical numeric direction.",
        "Legacy balance is already used relationally through player preferred swing feel."
      ]
    },
    futureState: {
      canonicalTechnicalName: "balance_profile",
      canonicalAttributeKey: "balance_profile",
      ownership: "equipment_intelligence",
      attributeNature: "evaluated_intrinsic",
      valueRepresentation: "ordinal_and_numeric_reference"
    },
    definitions: {
      technical: "The distribution of mass along the bat and the resulting tendency for the barrel to feel more balanced or more end-loaded during movement.",
      parentFriendly: "How balanced or barrel-heavy the bat tends to feel in motion, before considering whether that feel is right for a specific player.",
      explicitlyNot: [
        "player manageability",
        "player preference fit",
        "overall bat-control compatibility",
        "transition difficulty",
        "swing effort by itself"
      ]
    },
    numericReferencePolicy: {
      supported: true,
      scale: "0_100",
      direction: "balanced_to_end_loaded",
      minimumConfidence: "moderate",
      requiredEvidence: "combined_evidence",
      ordinalConsistencyRequired: true,
      ordinalConsistencyIntervals: {
        very_balanced: [0, 19],
        balanced: [20, 39],
        slightly_end_loaded: [40, 59],
        end_loaded: [60, 79],
        very_end_loaded: [80, 100]
      },
      notes: [
        "Policy proposal: 0 = most balanced and 100 = most end-loaded.",
        "Current seeded legacy values cannot be safely interpreted under this direction without explicit conversion and evidence validation.",
        "An inversion or remapping is required if legacy values are used as migration input."
      ]
    },
    evidencePolicy: {
      expectedEvidenceRequirement: "combined_evidence",
      acceptableSourceTypes: ["objective_measurement", "structured_expert_evaluation", "field_observation", "internal_derived"],
      minimumIndependentSources: 1,
      objectiveMeasurementPreferred: true,
      manufacturerClaimAloneSufficient: false,
      notes: [
        "Objective balance-point, center-of-mass, or standardized swing-balance measurement is preferred.",
        "Manufacturer marketing language alone must not produce validated confidence."
      ]
    },
    confidencePolicy: {
      minimumForInternalCandidate: "moderate",
      confidenceAppliesTo: "equipment_evaluation",
      estimatedAllowedForShadow: true,
      estimatedAllowedForInternalCandidate: false,
      notes: ["Estimated balance may be observed in shadow mode but is not eligible for internal candidate use."]
    },
    recommendationPolicy: {
      currentLegacyUse: "continue_authoritative",
      futureCanonicalUse: "equipment_and_compatibility",
      futureCandidateEligibility: "eligible_after_implementation",
      affectsEligibility: false,
      mayAffectRanking: true,
      mayAffectConfidence: true,
      mayAffectReasons: true,
      notes: [
        "Balance profile may become an Equipment DNA input and a player-preference compatibility input.",
        "Balance alone must not determine whether a bat is good or bad."
      ]
    },
    migrationGuidance: {
      legacyFieldDisposition: "preserve",
      historicalReproducibilityRequired: true,
      directValueMigrationAllowed: true,
      migrationDisposition: "preserve_legacy_history",
      futureReplacementKeys: ["balance_profile"],
      steps: [
        "Preserve legacy balance for historical recommendations.",
        "Confirm legacy score direction with source data.",
        "Validate ordinal consistency against the canonical balanced-to-end-loaded direction.",
        "Create numeric references only after evidence-backed conversion is approved."
      ],
      warnings: ["Direct migration is conditional and must not assume legacy high balance means high end-loadedness."]
    },
    blockers: [],
    warnings: [
      { code: "DIRECTION_INVERSION_REQUIRED", severity: "warning", message: "Legacy direction appears inverse or support-oriented relative to the proposed canonical direction." },
      { code: "MANUFACTURER_CLAIM_INSUFFICIENT", severity: "warning", message: "Marketing terms alone are insufficient for validated balance confidence." }
    ],
    rationale: [
      "Balance has a defensible equipment-intrinsic meaning.",
      "Ticket #028 showed balance accounts for material residual variance.",
      "The current legacy direction needs explicit conversion before numeric-reference use."
    ],
    effectiveStatus: "approved_with_future_work"
  },
  {
    version: OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION,
    policyVersion: OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION,
    registryVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    reviewedAt: OPTIONAL_SIGNAL_POLICY_REVIEWED_AT,
    signal: {
      key: "confidence_building",
      legacyField: "confidenceBuilding",
      legacyCharacteristicCode: "CONFIDENCE_BUILDING",
      existingCanonicalAttributeKey: "confidence_building_potential",
      namingNotes: [
        "Legacy field suggests a bat can build confidence.",
        "Future architecture splits equipment predictability from player-specific confidence compatibility."
      ]
    },
    outcome: "split_equipment_and_compatibility",
    currentState: {
      legacyMeaning: "A legacy score used as equipment support for players who may need confidence-related support.",
      currentEngineUsage: {
        usedByEligibility: false,
        usedByMatchScoring: true,
        usedByDimensionScoring: true,
        usedByRecommendationConfidence: true,
        usedByReasons: true,
        usedByTradeoffs: true,
        usedByAlternatives: false,
        usedByTieBreaking: false,
        dimensionNames: ["CONFIDENCE_BUILDING_FIT", "DEVELOPMENT_GOAL_FIT"],
        weights: { CONFIDENCE_BUILDING_FIT: 0.1, DEVELOPMENT_GOAL_FIT: 0.08 },
        notes: [
          "CONFIDENCE_BUILDING_FIT compares player confidence need to scores.confidenceBuilding.",
          "When primaryHittingGoal is build_confidence, DEVELOPMENT_GOAL_FIT also reads confidenceBuilding.",
          "Missing confidenceBuilding creates missing-information confidence penalties."
        ]
      },
      currentDirectionality: "Higher legacy values mean more confidence-building support.",
      currentScale: scoreScale,
      knownAmbiguities: [
        "Equipment behavior and player psychological response are mixed in one score.",
        "The name may imply guaranteed confidence outcomes."
      ]
    },
    futureState: {
      canonicalTechnicalName: "predictability_support",
      canonicalAttributeKey: "predictability_support",
      compatibilityConceptKey: "confidence_compatibility",
      ownership: "split",
      attributeNature: "mixed",
      valueRepresentation: "ordinal",
      relationalInputs: [
        "Player DNA confidence indicators",
        "contact consistency",
        "experience level",
        "current equipment",
        "development goal",
        "equipment predictability support",
        "transition compatibility"
      ]
    },
    definitions: {
      technical: "Equipment-side predictability_support describes stable, understandable, and repeatable performance feedback across typical swings and contact outcomes; confidence_compatibility describes how that behavior aligns with a specific player's current needs.",
      parentFriendly: "How predictable and manageable the bat's response tends to feel, and separately how well that may support this player's confidence and development.",
      explicitlyNot: [
        "a guarantee that equipment creates confidence",
        "a psychological outcome claim",
        "a hidden copy of the legacy confidenceBuilding score",
        "a pure product fact independent of player context"
      ]
    },
    numericReferencePolicy: {
      supported: false,
      requiredEvidence: "not_applicable",
      ordinalConsistencyRequired: false,
      notes: ["Do not directly migrate confidenceBuilding into an intrinsic numeric reference."]
    },
    evidencePolicy: {
      expectedEvidenceRequirement: "structured_evaluation",
      acceptableSourceTypes: ["structured_expert_evaluation", "field_observation", "historical_outcome", "internal_derived"],
      minimumIndependentSources: 1,
      objectiveMeasurementPreferred: false,
      manufacturerClaimAloneSufficient: false,
      notes: [
        "Equipment-side predictability may use structured evaluation or combined lower-level evidence.",
        "Confidence compatibility requires relational calculation and cannot be established by one product evidence record."
      ]
    },
    confidencePolicy: {
      minimumForInternalCandidate: "moderate",
      confidenceAppliesTo: "both",
      estimatedAllowedForShadow: true,
      estimatedAllowedForInternalCandidate: false,
      notes: [
        "Equipment evaluation confidence and compatibility calculation confidence must remain separate.",
        "Compatibility confidence must reflect player-data and equipment-data quality."
      ]
    },
    recommendationPolicy: {
      currentLegacyUse: "continue_authoritative",
      futureCanonicalUse: "equipment_and_compatibility",
      futureCandidateEligibility: "requires_separate_policy",
      affectsEligibility: false,
      mayAffectRanking: true,
      mayAffectConfidence: true,
      mayAffectReasons: true,
      notes: ["Future candidate use is blocked until the split model is implemented."]
    },
    migrationGuidance: {
      legacyFieldDisposition: "deprecate",
      historicalReproducibilityRequired: true,
      directValueMigrationAllowed: false,
      migrationDisposition: "replace_with_split_model",
      futureReplacementKeys: ["predictability_support", "confidence_compatibility"],
      steps: [
        "Preserve confidenceBuilding for historical recommendation reproducibility.",
        "Do not copy it to an intrinsic canonical profile.",
        "Define predictability_support as an Equipment Intelligence concept.",
        "Define confidence_compatibility as a Compatibility Intelligence concept."
      ],
      warnings: ["Direct migration would preserve a mixed and potentially misleading semantic."]
    },
    blockers: [
      { code: "COMPATIBILITY_MODEL_REQUIRED", severity: "blocking", message: "confidence_compatibility must be designed before future canonical recommendation use." }
    ],
    warnings: [
      { code: "DIRECT_MIGRATION_BLOCKED", severity: "warning", message: "Legacy confidenceBuilding must not be copied into an intrinsic Equipment DNA field." }
    ],
    rationale: [
      "The score has useful explanatory value but mixes product behavior and player response.",
      "Splitting prevents Ninery from claiming that a bat causes confidence."
    ],
    effectiveStatus: "approved_with_future_work"
  },
  {
    version: OPTIONAL_SIGNAL_ARCHITECTURE_DECISION_VERSION,
    policyVersion: OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION,
    registryVersion: EQUIPMENT_DNA_ATTRIBUTE_REGISTRY_VERSION,
    reviewedAt: OPTIONAL_SIGNAL_POLICY_REVIEWED_AT,
    signal: {
      key: "transition",
      legacyField: "transitionFriendliness",
      legacyCharacteristicCode: "TRANSITION_FRIENDLINESS",
      existingCanonicalAttributeKey: "transition_difficulty",
      namingNotes: [
        "Legacy transitionFriendliness and canonical transition_difficulty are semantic inverses.",
        "Future transition_compatibility is player-relative, not product-level."
      ]
    },
    outcome: "compatibility_only",
    currentState: {
      legacyMeaning: "A legacy score representing how friendly the bat is expected to be for transition.",
      currentEngineUsage: {
        usedByEligibility: false,
        usedByMatchScoring: true,
        usedByDimensionScoring: true,
        usedByRecommendationConfidence: true,
        usedByReasons: true,
        usedByTradeoffs: true,
        usedByAlternatives: true,
        usedByTieBreaking: false,
        dimensionNames: ["TRANSITION_READINESS_FIT", "DEVELOPMENT_GOAL_FIT"],
        weights: { TRANSITION_READINESS_FIT: 0.07, DEVELOPMENT_GOAL_FIT: 0.08 },
        notes: [
          "TRANSITION_READINESS_FIT compares player transition readiness to scores.transitionFriendliness.",
          "When primaryHittingGoal is prepare_for_transition, DEVELOPMENT_GOAL_FIT reads transitionFriendliness.",
          "A high transition readiness dimension can influence alternative labels."
        ]
      },
      currentDirectionality: "Higher legacy values mean more transition-friendly; canonical transition_difficulty is inverse in name and meaning.",
      currentScale: scoreScale,
      knownAmbiguities: [
        "Transition depends on the player's current equipment and readiness.",
        "A product-level transition score cannot be universally true."
      ]
    },
    futureState: {
      canonicalTechnicalName: "transition_compatibility",
      compatibilityConceptKey: "transition_compatibility",
      ownership: "compatibility_intelligence",
      attributeNature: "relational",
      valueRepresentation: "calculated_compatibility_score",
      relationalInputs: [
        "current equipment length",
        "current equipment weight",
        "current equipment drop",
        "current equipment balance profile",
        "current equipment swing effort",
        "current equipment construction or feel",
        "proposed equipment length",
        "proposed equipment weight",
        "proposed equipment drop",
        "proposed equipment balance profile",
        "proposed equipment swing effort",
        "proposed equipment construction or feel",
        "player age or development stage",
        "strength and physical readiness",
        "bat-control profile",
        "experience level",
        "current equipment familiarity",
        "recent growth",
        "stated swing-feel preference",
        "development goal"
      ],
      transitionComponents: [
        "size_change_demand",
        "mass_change_demand",
        "drop_change_demand",
        "balance_change_demand",
        "swing_effort_change_demand",
        "construction_change_demand",
        "experience_adjustment_demand"
      ]
    },
    definitions: {
      technical: "The expected adjustment demand when a specific player moves from their current equipment to a proposed equipment setup.",
      parentFriendly: "How much adjustment this player may need when moving from the bat they know to the recommended bat.",
      explicitlyNot: [
        "a universal product-level transition score",
        "an intrinsic Equipment DNA characteristic",
        "a simple inversion of transitionFriendliness",
        "a calculation that can run without current equipment and player context"
      ]
    },
    numericReferencePolicy: {
      supported: false,
      requiredEvidence: "relational_calculation",
      ordinalConsistencyRequired: false,
      notes: ["Do not create product-level transition numeric references."]
    },
    evidencePolicy: {
      expectedEvidenceRequirement: "relational_calculation",
      acceptableSourceTypes: ["structured_expert_evaluation", "player_feedback", "parent_feedback", "coach_feedback", "historical_outcome", "internal_derived"],
      objectiveMeasurementPreferred: false,
      manufacturerClaimAloneSufficient: false,
      notes: ["No single product evidence record can establish universal transition friendliness."]
    },
    confidencePolicy: {
      confidenceAppliesTo: "compatibility_calculation",
      estimatedAllowedForShadow: true,
      estimatedAllowedForInternalCandidate: false,
      notes: [
        "Missing current-equipment data should reduce confidence or block calculation.",
        "Transition confidence must reflect player context quality."
      ]
    },
    recommendationPolicy: {
      currentLegacyUse: "continue_authoritative",
      futureCanonicalUse: "compatibility_input",
      futureCandidateEligibility: "requires_separate_policy",
      affectsEligibility: false,
      mayAffectRanking: true,
      mayAffectConfidence: true,
      mayAffectReasons: true,
      notes: ["Future candidate use is blocked until Compatibility Intelligence owns transition_compatibility."]
    },
    migrationGuidance: {
      legacyFieldDisposition: "deprecate",
      historicalReproducibilityRequired: true,
      directValueMigrationAllowed: false,
      migrationDisposition: "replace_with_compatibility_model",
      futureReplacementKeys: ["transition_compatibility"],
      steps: [
        "Preserve transitionFriendliness for historical recommendations.",
        "Do not migrate it into Equipment DNA evaluations.",
        "Define a player-specific transition_compatibility model using current and proposed equipment.",
        "Mark transition_difficulty for future relocation or deprecation after replacement exists."
      ],
      warnings: ["High transition friendliness equals low transition difficulty, but a simple inversion is not a future canonical solution."]
    },
    blockers: [
      { code: "CURRENT_EQUIPMENT_REQUIRED", severity: "blocking", message: "Transition compatibility requires current equipment." },
      { code: "PLAYER_CONTEXT_REQUIRED", severity: "blocking", message: "Transition compatibility requires player context." }
    ],
    warnings: [
      { code: "DIRECTION_INVERSION_REQUIRED", severity: "warning", message: "Legacy transitionFriendliness is inverse to transition_difficulty naming." },
      { code: "DIRECT_MIGRATION_BLOCKED", severity: "warning", message: "Legacy transitionFriendliness must not become an equipment-level canonical value." }
    ],
    rationale: [
      "The same bat can be easy for one player to transition into and difficult for another.",
      "A relational Compatibility Intelligence model is the correct owner."
    ],
    effectiveStatus: "approved_with_future_work"
  }
] as const satisfies readonly OptionalSignalCanonicalizationDecision[];

export function getOptionalSignalCanonicalizationDecisions(): readonly OptionalSignalCanonicalizationDecision[] {
  return optionalSignalCanonicalizationPolicy;
}

export function getOptionalSignalCanonicalizationDecision(
  key: OptionalSignalCanonicalizationDecision["signal"]["key"]
): OptionalSignalCanonicalizationDecision | undefined {
  return optionalSignalCanonicalizationPolicy.find((decision) => decision.signal.key === key);
}
