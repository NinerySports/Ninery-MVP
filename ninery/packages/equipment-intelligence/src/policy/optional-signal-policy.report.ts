import { getOptionalSignalCanonicalizationDecisions } from "./optional-signal-policy.definitions.js";
import { validateOptionalSignalCanonicalizationPolicy } from "./optional-signal-policy.validation.js";
import { OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION, type OptionalSignalCanonicalizationDecision } from "./optional-signal-policy.types.js";

export function buildOptionalSignalPolicyReport(
  decisions: readonly OptionalSignalCanonicalizationDecision[] = getOptionalSignalCanonicalizationDecisions()
): string {
  const validation = validateOptionalSignalCanonicalizationPolicy(decisions);
  const lines = [
    `Optional Signal Canonicalization Policy v${OPTIONAL_SIGNAL_CANONICALIZATION_POLICY_VERSION}`,
    "",
    `Policy valid: ${validation.valid ? "yes" : "no"}`,
    ""
  ];

  for (const decision of [...decisions].sort((a, b) => order(a) - order(b))) {
    lines.push(signalHeading(decision));
    lines.push("");
    lines.push(`Legacy field: ${decision.signal.legacyField}`);
    if (decision.signal.existingCanonicalAttributeKey) lines.push(`Existing canonical attribute: ${decision.signal.existingCanonicalAttributeKey}`);
    lines.push(`Canonical outcome: ${decision.outcome}`);
    lines.push(`Ownership: ${decision.futureState.ownership}`);
    lines.push(`Nature: ${decision.futureState.attributeNature}`);
    lines.push(`Representation: ${decision.futureState.valueRepresentation}`);
    if (decision.futureState.canonicalTechnicalName) {
      lines.push(`${decision.futureState.ownership === "compatibility_intelligence" ? "Future concept" : "Equipment concept"}: ${decision.futureState.canonicalTechnicalName}`);
    }
    if (decision.futureState.compatibilityConceptKey) lines.push(`Compatibility concept: ${decision.futureState.compatibilityConceptKey}`);
    if (decision.numericReferencePolicy.direction) lines.push(`Numeric direction: ${decision.numericReferencePolicy.direction}`);
    lines.push(`Numeric reference supported: ${decision.numericReferencePolicy.supported ? "yes" : "no"}`);
    lines.push(`Evidence: ${decision.evidencePolicy.expectedEvidenceRequirement}`);
    lines.push(`Manufacturer claim alone sufficient: ${decision.evidencePolicy.manufacturerClaimAloneSufficient ? "yes" : "no"}`);
    lines.push(`Direct value migration allowed: ${decision.migrationGuidance.directValueMigrationAllowed ? "yes" : "no"}`);
    lines.push(`Historical reproducibility required: ${decision.migrationGuidance.historicalReproducibilityRequired ? "yes" : "no"}`);
    lines.push(`Status: ${decision.effectiveStatus}`);
    lines.push("");
    lines.push("Current engine usage:");
    lines.push(`- dimensions: ${decision.currentState.currentEngineUsage.dimensionNames.join(", ") || "none"}`);
    lines.push(`- match scoring: ${yesNo(decision.currentState.currentEngineUsage.usedByMatchScoring)}`);
    lines.push(`- confidence: ${yesNo(decision.currentState.currentEngineUsage.usedByRecommendationConfidence)}`);
    lines.push(`- reasons/tradeoffs: ${yesNo(decision.currentState.currentEngineUsage.usedByReasons || decision.currentState.currentEngineUsage.usedByTradeoffs)}`);
    lines.push("");
    lines.push("Future candidate blocker:");
    lines.push(`- ${candidateBlocker(decision)}`);
    lines.push("");
  }

  lines.push("Future canonical candidate policy");
  lines.push("");
  lines.push("Balance:");
  lines.push("- Canonical balance_profile numeric-reference path is implemented for demo profiles; it remains shadow-only and requires ongoing evidence review before live activation.");
  lines.push("Confidence building:");
  lines.push("- Equipment-side predictability_support is implemented for demo profiles; player-relative confidence_compatibility is validated in shadow with promotion outcome blocked_unstable_behavior.");
  lines.push("Transition:");
  lines.push("- Transition compatibility is validated in shadow with promotion outcome blocked_unstable_behavior.");
  lines.push("");
  lines.push("Implementation status:");
  lines.push("- balance_profile: implemented");
  lines.push("- predictability_support: implemented");
  lines.push("- confidence_compatibility: validated in shadow; promotion outcome blocked_unstable_behavior");
  lines.push("- transition_compatibility: validated in shadow; promotion outcome blocked_unstable_behavior");
  lines.push("");
  lines.push("Recommended next implementation order:");
  lines.push("1. Balance Profile Numeric Reference");
  lines.push("2. Equipment Predictability Support definition");
  lines.push("3. Confidence Compatibility stability, score-separation, and double-counting review");
  lines.push("4. Transition Compatibility stability review and current-equipment familiarity capture");
  lines.push("");
  lines.push("Current live recommendation source:");
  lines.push("legacy");
  lines.push("");
  lines.push("Policy changes live behavior:");
  lines.push("no");

  if (!validation.valid) {
    lines.push("");
    lines.push("Validation errors:");
    validation.errors.forEach((error) => lines.push(`- ${error}`));
  }

  return lines.join("\n");
}

function signalHeading(decision: OptionalSignalCanonicalizationDecision): string {
  if (decision.signal.key === "confidence_building") return "CONFIDENCE BUILDING";
  return decision.signal.key.toUpperCase();
}

function order(decision: OptionalSignalCanonicalizationDecision): number {
  if (decision.signal.key === "balance") return 1;
  if (decision.signal.key === "confidence_building") return 2;
  return 3;
}

function candidateBlocker(decision: OptionalSignalCanonicalizationDecision): string {
  if (decision.signal.key === "balance") return "Resolved for demo shadow comparison by active balance_profile evaluations, inverse direction bridge, and evidence-backed numeric references.";
  if (decision.signal.key === "confidence_building") return "Equipment-side predictability_support exists and player-relative confidence_compatibility is validated in shadow; promotion is blocked by stability, low separation, and high double-counting risk.";
  return "Player-specific transition_compatibility is validated in shadow; promotion is blocked by stability findings and current-equipment familiarity remains missing.";
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}
