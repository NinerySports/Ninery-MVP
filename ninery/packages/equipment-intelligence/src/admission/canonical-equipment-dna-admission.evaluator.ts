import {
  getEquipmentDNAAttributeDefinition,
  getRequiredEquipmentDNAAttributeDefinitions,
  type EquipmentDNAAttributeKey
} from "../attributes/index.js";
import {
  EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION,
  type CanonicalEquipmentDNAProfile,
  type EquipmentDNAAttributeComparison,
  type EquipmentDNAShadowComparisonResult,
  type EquipmentDNASpecificationCheck
} from "../profiles/index.js";
import { meetsMinimumConfidence } from "../evidence/index.js";
import {
  CANONICAL_EQUIPMENT_DNA_ADMISSION_BLOCKER_PRIORITY,
  canonicalEquipmentDNAAdmissionPolicy,
  meetsMinimumEquipmentDNAMaturity
} from "./canonical-equipment-dna-admission.policy.js";
import {
  CANONICAL_EQUIPMENT_DNA_ADMISSION_DECISION_VERSION,
  type CanonicalEquipmentDNAAdmissionCriterion,
  type CanonicalEquipmentDNAAdmissionDecision,
  type CanonicalEquipmentDNAAdmissionFinding,
  type CanonicalEquipmentDNAAdmissionOutcome,
  type CanonicalEquipmentDNAAdmissionPolicy,
  type CanonicalEquipmentDNAMappingCoverage,
  type CanonicalEquipmentDNAVersionAssessment
} from "./canonical-equipment-dna-admission.types.js";

export function evaluateCanonicalEquipmentDNAAdmission(input: {
  readonly canonicalProfile: CanonicalEquipmentDNAProfile;
  readonly shadowComparison: EquipmentDNAShadowComparisonResult;
  readonly policy?: CanonicalEquipmentDNAAdmissionPolicy;
  readonly evaluatedAt?: Date;
}): CanonicalEquipmentDNAAdmissionDecision {
  const policy = input.policy ?? canonicalEquipmentDNAAdmissionPolicy;
  const blockers: CanonicalEquipmentDNAAdmissionFinding[] = [];
  const warnings: CanonicalEquipmentDNAAdmissionFinding[] = [];
  const criteria: CanonicalEquipmentDNAAdmissionCriterion[] = [];
  const versionAssessment = assessVersions(input.canonicalProfile, input.shadowComparison, policy);
  const mappingCoverage = assessMappingCoverage(input.shadowComparison, policy);
  const sourceSummary = {
    ready: input.canonicalProfile.readiness.ready,
    maturity: input.canonicalProfile.maturity,
    shadowStatus: input.shadowComparison.overallStatus,
    specificationMatchCount: input.shadowComparison.specificationChecks.filter((check) => check.status === "match").length,
    specificationProblemCount: input.shadowComparison.specificationChecks.filter((check) => check.status !== "match").length,
    alignedBehaviorCount: input.shadowComparison.alignedCount,
    minorBehaviorDifferenceCount: input.shadowComparison.minorDifferenceCount,
    materialBehaviorDifferenceCount: input.shadowComparison.materialDifferenceCount,
    incomparableBehaviorCount: input.shadowComparison.incomparableCount
  };

  if (input.canonicalProfile.equipmentId !== input.shadowComparison.equipmentId) {
    blockers.push(finding("INVALID_CANONICAL_VALUE", "Canonical profile and shadow comparison equipment IDs do not match.", "blocked_invalid_profile"));
  }
  if (input.canonicalProfile.equipmentVariantId !== input.shadowComparison.equipmentVariantId) {
    blockers.push(finding("INVALID_CANONICAL_VALUE", "Canonical profile and shadow comparison variant IDs do not match.", "blocked_invalid_profile"));
  }
  if (!input.canonicalProfile.equipmentVariantId) {
    blockers.push(finding("MISSING_SELECTED_VARIANT", "Admission requires an explicit selected equipment variant.", "blocked_invalid_profile"));
  }
  if (input.canonicalProfile.invalidAttributes.length > 0) {
    blockers.push(
      finding(
        "INVALID_CANONICAL_VALUE",
        "Canonical profile contains invalid attribute evaluations.",
        "blocked_invalid_profile",
        input.canonicalProfile.invalidAttributes
      )
    );
  }
  if (input.canonicalProfile.attributes.length === 0) {
    blockers.push(finding("PROFILE_LOAD_FAILED", "Canonical profile contains no active attributes.", "blocked_invalid_profile"));
  }
  criteria.push({
    name: "profile_validity",
    passed: !blockers.some((blocker) => blocker.outcome === "blocked_invalid_profile"),
    reasonCodes: input.canonicalProfile.equipmentVariantId && input.canonicalProfile.invalidAttributes.length === 0 ? ["SUPPORTED_VERSIONS"] : ["INVALID_CANONICAL_VALUE"],
    details: ["Profile has a matching equipment target, selected variant, and valid active canonical values."]
  });

  if (!versionAssessment.supported) {
    blockers.push(
      finding(
        "UNSUPPORTED_VERSION",
        `Unsupported version(s): ${versionAssessment.unsupported.join(", ")}.`,
        "blocked_unsupported_version"
      )
    );
  }
  criteria.push({
    name: "supported_versions",
    passed: versionAssessment.supported,
    reasonCodes: versionAssessment.supported ? ["SUPPORTED_VERSIONS"] : ["UNSUPPORTED_VERSION"],
    details: versionAssessment.supported ? ["All profile, registry, readiness, mapping, and comparison versions are supported."] : versionAssessment.unsupported
  });

  if (!input.canonicalProfile.readiness.ready) {
    blockers.push(
      finding(
        "PROFILE_NOT_READY",
        "Canonical profile is not recommendation-ready.",
        "blocked_not_ready",
        input.canonicalProfile.missingAttributes
      )
    );
  }
  criteria.push({
    name: "profile_readiness",
    passed: input.canonicalProfile.readiness.ready,
    reasonCodes: input.canonicalProfile.readiness.ready ? ["PROFILE_READY"] : ["PROFILE_NOT_READY"],
    details: input.canonicalProfile.readiness.reasons
  });

  const materialConflictKeys = input.canonicalProfile.conflicts
    .filter((conflict) => conflict.severity === "material")
    .map((conflict) => conflict.key)
    .filter(isEquipmentDNAAttributeKey);
  if (materialConflictKeys.length > 0) {
    blockers.push(
      finding(
        "MATERIAL_CONFLICT_PRESENT",
        "Material evidence conflicts must be resolved before canonical admission.",
        "blocked_conflict",
        materialConflictKeys
      )
    );
  }
  criteria.push({
    name: "material_conflicts",
    passed: materialConflictKeys.length === 0,
    reasonCodes: materialConflictKeys.length === 0 ? ["NO_MATERIAL_CONFLICTS"] : ["MATERIAL_CONFLICT_PRESENT"],
    details: materialConflictKeys.length === 0 ? ["No material canonical evidence conflicts were reported."] : materialConflictKeys
  });

  const insufficientConfidenceKeys = requiredConfidenceFailures(input.canonicalProfile, policy);
  if (insufficientConfidenceKeys.length > 0) {
    blockers.push(
      finding(
        "REQUIRED_CONFIDENCE_INSUFFICIENT",
        "One or more required canonical attributes do not meet the admission confidence threshold.",
        "blocked_insufficient_confidence",
        insufficientConfidenceKeys
      )
    );
  }
  criteria.push({
    name: "required_confidence",
    passed: insufficientConfidenceKeys.length === 0,
    reasonCodes: insufficientConfidenceKeys.length === 0 ? ["REQUIRED_CONFIDENCE_SUFFICIENT"] : ["REQUIRED_CONFIDENCE_INSUFFICIENT"],
    details: insufficientConfidenceKeys.length === 0 ? ["All required attributes meet domain-specific confidence thresholds."] : insufficientConfidenceKeys
  });

  const specificationProblems = specificationAlignmentProblems(input.shadowComparison.specificationChecks, policy);
  if (specificationProblems.length > 0) {
    blockers.push(
      finding(
        "SPECIFICATION_MISMATCH_PRESENT",
        "One or more required canonical specification values do not match the selected catalog values.",
        "blocked_specification_mismatch",
        specificationProblems
      )
    );
  }
  criteria.push({
    name: "specification_alignment",
    passed: specificationProblems.length === 0,
    reasonCodes: specificationProblems.length === 0 ? ["SPECIFICATIONS_ALIGNED"] : ["SPECIFICATION_MISMATCH_PRESENT"],
    details: specificationProblems.length === 0 ? ["Required specification checks match catalog values."] : specificationProblems
  });

  if (!mappingCoverage.requiredCoverageSatisfied) {
    blockers.push(
      finding(
        "MAPPING_COVERAGE_INSUFFICIENT",
        "Required behavior mapping coverage is below the admission policy threshold.",
        "blocked_insufficient_mapping_coverage",
        [
          ...mappingCoverage.missingCanonicalKeys,
          ...mappingCoverage.missingLegacyKeys,
          ...mappingCoverage.incomparableRequiredKeys
        ]
      )
    );
  }
  criteria.push({
    name: "mapping_coverage",
    passed: mappingCoverage.requiredCoverageSatisfied,
    reasonCodes: mappingCoverage.requiredCoverageSatisfied ? ["MAPPING_COVERAGE_SUFFICIENT"] : ["MAPPING_COVERAGE_INSUFFICIENT"],
    details: [`Required behavior mapping coverage is ${formatCoverage(mappingCoverage.coverageRatio)}.`]
  });

  if (input.shadowComparison.overallStatus === "material_disagreement") {
    blockers.push(
      finding(
        "SHADOW_MATERIAL_DISAGREEMENT",
        "Canonical and legacy behavior values contain a material disagreement.",
        "blocked_material_disagreement",
        input.shadowComparison.comparedAttributes
          .filter((comparison) => comparison.status === "material_difference")
          .map((comparison) => comparison.canonicalKey)
      )
    );
  } else if (input.shadowComparison.overallStatus === "insufficient_data") {
    blockers.push(finding("MISSING_LEGACY_PROFILE", "Legacy Equipment DNA profile is missing or insufficient for admission comparison.", "blocked_insufficient_mapping_coverage"));
  } else if (input.shadowComparison.overallStatus === "review_recommended") {
    warnings.push(finding("SHADOW_REVIEW_RECOMMENDED", "Shadow comparison recommends review before internal candidate use."));
  }
  criteria.push({
    name: "shadow_alignment",
    passed: input.shadowComparison.overallStatus === "aligned",
    reasonCodes:
      input.shadowComparison.overallStatus === "aligned"
        ? ["SHADOW_ALIGNED"]
        : input.shadowComparison.overallStatus === "material_disagreement"
          ? ["SHADOW_MATERIAL_DISAGREEMENT"]
          : ["SHADOW_REVIEW_RECOMMENDED"],
    details: input.shadowComparison.reasons
  });

  const maturitySufficient = meetsMinimumEquipmentDNAMaturity(input.canonicalProfile.maturity, policy.minimumInternalCandidateMaturity);
  if (!maturitySufficient) {
    blockers.push(
      finding(
        "MATURITY_INSUFFICIENT",
        `Canonical profile maturity ${input.canonicalProfile.maturity} is below ${policy.minimumInternalCandidateMaturity}.`,
        "blocked_insufficient_maturity"
      )
    );
  }
  criteria.push({
    name: "minimum_maturity",
    passed: maturitySufficient,
    reasonCodes: maturitySufficient ? ["MATURITY_SUFFICIENT"] : ["MATURITY_INSUFFICIENT"],
    details: [`Maturity is ${input.canonicalProfile.maturity}; policy minimum is ${policy.minimumInternalCandidateMaturity}.`]
  });

  if (mappingCoverage.optionalIncomparableKeys.length > 0) {
    warnings.push(
      finding(
        "OPTIONAL_MAPPING_UNAVAILABLE",
        "Optional or experimental attributes are intentionally not admitted as trusted intrinsic comparisons.",
        undefined,
        mappingCoverage.optionalIncomparableKeys
      )
    );
  }
  if (input.canonicalProfile.readiness.experimentalAttributesIgnored.length > 0) {
    warnings.push(
      finding(
        "EXPERIMENTAL_ATTRIBUTE_IGNORED",
        "Experimental relational attributes were ignored for recommendation-readiness admission.",
        undefined,
        input.canonicalProfile.readiness.experimentalAttributesIgnored
      )
    );
  }

  const outcome = selectOutcome(blockers, input.shadowComparison.overallStatus);
  return {
    version: CANONICAL_EQUIPMENT_DNA_ADMISSION_DECISION_VERSION,
    policyVersion: policy.version,
    equipmentId: input.canonicalProfile.equipmentId,
    equipmentVariantId: input.canonicalProfile.equipmentVariantId,
    equipmentName: input.canonicalProfile.equipmentName,
    evaluatedAt: input.evaluatedAt ?? new Date(),
    outcome,
    eligibleForShadow: outcome === "approved_for_shadow" || outcome === "approved_for_internal_candidate",
    eligibleForInternalCandidate: outcome === "approved_for_internal_candidate",
    liveRecommendationUseAllowed: false,
    blockers,
    warnings,
    criteria,
    mappingCoverage,
    versionAssessment,
    sourceSummary,
    nextActions: nextActionsFor(blockers, outcome)
  };
}

function assessVersions(
  canonicalProfile: CanonicalEquipmentDNAProfile,
  shadowComparison: EquipmentDNAShadowComparisonResult,
  policy: CanonicalEquipmentDNAAdmissionPolicy
): CanonicalEquipmentDNAVersionAssessment {
  const actual = {
    admissionPolicyVersion: policy.version,
    canonicalProfileVersion: canonicalProfile.version,
    registryVersion: canonicalProfile.registryVersion,
    confidenceModelVersion: canonicalProfile.confidenceModelVersion,
    readinessModelVersion: canonicalProfile.readinessModelVersion,
    scoreMappingVersion: canonicalProfile.scoreMappingVersion,
    shadowComparisonVersion: shadowComparison.version,
    ordinalComparisonVersion: EQUIPMENT_ORDINAL_TO_NUMERIC_COMPARISON_VERSION
  };
  const unsupported: string[] = [];
  if (!policy.supportedVersions.canonicalProfile.includes(actual.canonicalProfileVersion)) unsupported.push(`canonicalProfile=${actual.canonicalProfileVersion}`);
  if (!policy.supportedVersions.registry.includes(actual.registryVersion)) unsupported.push(`registry=${actual.registryVersion}`);
  if (!policy.supportedVersions.confidenceModel.includes(actual.confidenceModelVersion)) unsupported.push(`confidenceModel=${actual.confidenceModelVersion}`);
  if (!policy.supportedVersions.readinessModel.includes(actual.readinessModelVersion)) unsupported.push(`readinessModel=${actual.readinessModelVersion}`);
  if (!policy.supportedVersions.scoreMapping.includes(actual.scoreMappingVersion)) unsupported.push(`scoreMapping=${actual.scoreMappingVersion}`);
  if (!policy.supportedVersions.shadowComparison.includes(actual.shadowComparisonVersion)) unsupported.push(`shadowComparison=${actual.shadowComparisonVersion}`);
  if (!policy.supportedVersions.ordinalComparison.includes(actual.ordinalComparisonVersion)) unsupported.push(`ordinalComparison=${actual.ordinalComparisonVersion}`);
  return { supported: unsupported.length === 0, actual, unsupported };
}

function assessMappingCoverage(
  shadowComparison: EquipmentDNAShadowComparisonResult,
  policy: CanonicalEquipmentDNAAdmissionPolicy
): CanonicalEquipmentDNAMappingCoverage {
  const required = policy.requiredComparableBehaviorKeys;
  const requiredComparisons = required.map((key) => shadowComparison.comparedAttributes.find((comparison) => comparison.canonicalKey === key));
  const successfullyComparedKeys = requiredComparisons
    .filter((comparison): comparison is EquipmentDNAAttributeComparison => Boolean(comparison))
    .filter((comparison) => comparison.status === "aligned" || comparison.status === "minor_difference" || comparison.status === "material_difference")
    .map((comparison) => comparison.canonicalKey);
  const missingCanonicalKeys = requiredComparisons
    .filter((comparison): comparison is EquipmentDNAAttributeComparison => Boolean(comparison))
    .filter((comparison) => comparison.status === "missing_canonical")
    .map((comparison) => comparison.canonicalKey);
  const missingLegacyKeys = requiredComparisons
    .filter((comparison): comparison is EquipmentDNAAttributeComparison => Boolean(comparison))
    .filter((comparison) => comparison.status === "missing_legacy")
    .map((comparison) => comparison.canonicalKey);
  const incomparableRequiredKeys = [
    ...required.filter((key) => !shadowComparison.comparedAttributes.some((comparison) => comparison.canonicalKey === key)),
    ...requiredComparisons
      .filter((comparison): comparison is EquipmentDNAAttributeComparison => Boolean(comparison))
      .filter((comparison) => comparison.status === "incomparable")
      .map((comparison) => comparison.canonicalKey)
  ];
  const optionalIncomparableKeys = shadowComparison.comparedAttributes
    .filter((comparison) => policy.optionalComparableBehaviorKeys.includes(comparison.canonicalKey))
    .filter((comparison) => comparison.status === "incomparable")
    .map((comparison) => comparison.canonicalKey);
  const coverageRatio = required.length === 0 ? 1 : successfullyComparedKeys.length / required.length;
  return {
    requiredComparableKeys: required,
    successfullyComparedKeys,
    missingCanonicalKeys,
    missingLegacyKeys,
    incomparableRequiredKeys,
    optionalIncomparableKeys,
    coverageRatio,
    requiredCoverageSatisfied: coverageRatio >= policy.minimumBehaviorMappingCoverage
  };
}

function requiredConfidenceFailures(
  canonicalProfile: CanonicalEquipmentDNAProfile,
  policy: CanonicalEquipmentDNAAdmissionPolicy
): EquipmentDNAAttributeKey[] {
  return getRequiredEquipmentDNAAttributeDefinitions()
    .map((definition) => {
      const attribute = canonicalProfile.attributes.find((candidate) => candidate.key === definition.key);
      if (!attribute) return definition.key;
      return meetsMinimumConfidence(attribute.confidence, policy.minimumConfidenceByDomain[definition.domain])
        ? undefined
        : definition.key;
    })
    .filter(isEquipmentDNAAttributeKey);
}

function specificationAlignmentProblems(
  checks: readonly EquipmentDNASpecificationCheck[],
  policy: CanonicalEquipmentDNAAdmissionPolicy
): EquipmentDNAAttributeKey[] {
  return policy.requiredSpecificationKeys.filter((key) => {
    const check = checks.find((candidate) => candidate.key === key);
    return !check || check.status !== "match";
  });
}

function selectOutcome(
  blockers: readonly CanonicalEquipmentDNAAdmissionFinding[],
  shadowStatus: EquipmentDNAShadowComparisonResult["overallStatus"]
): CanonicalEquipmentDNAAdmissionOutcome {
  for (const outcome of CANONICAL_EQUIPMENT_DNA_ADMISSION_BLOCKER_PRIORITY) {
    if (outcome.startsWith("blocked") && blockers.some((blocker) => blocker.outcome === outcome)) {
      return outcome;
    }
  }
  return shadowStatus === "aligned" ? "approved_for_internal_candidate" : "approved_for_shadow";
}

function nextActionsFor(
  blockers: readonly CanonicalEquipmentDNAAdmissionFinding[],
  outcome: CanonicalEquipmentDNAAdmissionOutcome
): string[] {
  if (blockers.length === 0) {
    return outcome === "approved_for_internal_candidate"
      ? ["Keep this profile in shadow mode until a future ticket explicitly authorizes live recommendation consumption."]
      : ["Review warnings before considering internal candidate admission."];
  }
  const actions = blockers.map((blocker) => {
    switch (blocker.code) {
      case "PROFILE_NOT_READY":
        return "Complete missing required Equipment DNA evaluations.";
      case "REQUIRED_CONFIDENCE_INSUFFICIENT":
        return "Upgrade required attribute evidence to meet the domain confidence threshold.";
      case "MATERIAL_CONFLICT_PRESENT":
        return "Resolve material evidence conflicts before admission can advance.";
      case "SPECIFICATION_MISMATCH_PRESENT":
        return "Review canonical specification evidence against selected catalog values.";
      case "MAPPING_COVERAGE_INSUFFICIENT":
      case "MISSING_LEGACY_PROFILE":
        return "Add or repair required legacy comparison coverage.";
      case "SHADOW_MATERIAL_DISAGREEMENT":
        return "Review canonical and legacy behavioral score alignment.";
      case "MATURITY_INSUFFICIENT":
        return "Add sufficient evaluated evidence to reach the policy maturity threshold.";
      case "UNSUPPORTED_VERSION":
        return "Regenerate the profile or comparison using supported policy versions.";
      case "MISSING_SELECTED_VARIANT":
        return "Load admission against an explicit selected equipment variant.";
      default:
        return "Repair malformed canonical profile data and rerun admission.";
    }
  });
  return [...new Set(actions)];
}

function finding(
  code: CanonicalEquipmentDNAAdmissionFinding["code"],
  message: string,
  outcome?: CanonicalEquipmentDNAAdmissionOutcome,
  attributeKeys?: readonly EquipmentDNAAttributeKey[]
): CanonicalEquipmentDNAAdmissionFinding {
  return { code, message, outcome, attributeKeys };
}

function formatCoverage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isEquipmentDNAAttributeKey(value: unknown): value is EquipmentDNAAttributeKey {
  return typeof value === "string" && Boolean(getEquipmentDNAAttributeDefinition(value));
}
