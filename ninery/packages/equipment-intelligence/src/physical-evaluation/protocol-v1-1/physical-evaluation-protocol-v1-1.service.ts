import {
  PHYSICAL_EVALUATION_PROTOCOL_V1_1_PREVIEW_VERSION,
  PHYSICAL_EVALUATION_PROVENANCE_V1_1_VERSION,
  PHYSICAL_EVALUATION_QUESTIONNAIRE_V1_1_VERSION,
  physicalEvaluationProtocolV11Constructs,
  physicalEvaluationProtocolV11Questions
} from "./physical-evaluation-protocol-v1-1.policy.js";
import type { PhysicalEvaluationProtocolV11Preview } from "./physical-evaluation-protocol-v1-1.types.js";

export function buildPhysicalEvaluationProtocolV11Preview(): PhysicalEvaluationProtocolV11Preview {
  return {
    protocolVersion: PHYSICAL_EVALUATION_PROTOCOL_V1_1_PREVIEW_VERSION,
    questionnaireVersion: PHYSICAL_EVALUATION_QUESTIONNAIRE_V1_1_VERSION,
    provenanceVersion: PHYSICAL_EVALUATION_PROVENANCE_V1_1_VERSION,
    status: "operator_preview_only",
    studyClassification: "protocol_calibration_evidence",
    priorProtocolVersion: "1.0",
    historicalEvidencePolicy: "immutable_and_version_distinct",
    constructs: physicalEvaluationProtocolV11Constructs,
    questions: physicalEvaluationProtocolV11Questions,
    operatorSequence: [
      "Verify target bat identity and condition using the existing physical-verification controls.",
      "Do not show prior evaluator observations, synthesis results, or canonical candidates.",
      "Complete a consistent warm-up before any recorded rating.",
      "Complete three separate four-trial dry-swing blocks for startup, rotation, and redirect tasks.",
      "Establish six centered-contact baseline trials before controlled miss-location blocks.",
      "Complete six modest near-center handle-side and six modest near-center end-side controlled-contact trials (18 total contacts).",
      "Record each dimension before any aggregate interpretation or qualitative summary.",
      "Mark unable_to_assess when contact location or task execution cannot be controlled.",
      "Treat all v1.1 observations as calibration evidence; no canonical promotion is authorized."
    ],
    futureEvidenceRules: [
      "Use protocolVersion 1.1 and questionnaireVersion 1.1 in raw provenance.",
      "Use a version-distinct source reference such as physical-bat-evaluation:1.1:<session>:<dimension>.",
      "Preserve raw dimension observations, trial-block counts, contact-location controls, evaluator identity, and session identity.",
      "Never update or reinterpret a physical-bat-evaluation:1.0 evidence record.",
      "Candidate sweet-spot subconstruct observations are not canonical Equipment DNA attributes.",
      "Calibration evidence cannot create canonical evaluations, numeric references, or live recommendation inputs."
    ],
    evaluationSixPerformed: false,
    persistenceAllowed: false,
    canonicalEvaluationsCreated: 0,
    numericReferencesCreated: 0,
    recommendationBehaviorChanged: false
  };
}

export function validatePhysicalEvaluationProtocolV11Preview() {
  const preview = buildPhysicalEvaluationProtocolV11Preview();
  const ids = preview.questions.map((item) => item.id);
  const dimensions = preview.questions.map((item) => item.dimensionKey);
  const checks = [
    check("protocol is preview-only v1.1", preview.protocolVersion === "1.1-preview" && preview.status === "operator_preview_only"),
    check("historical v1.0 remains immutable and distinct", preview.priorProtocolVersion === "1.0" && preview.historicalEvidencePolicy === "immutable_and_version_distinct"),
    check("question ids are unique", new Set(ids).size === ids.length),
    check("question order is deterministic", preview.questions.every((item, index) => item.order === index + 1)),
    check("swing effort uses three four-trial blocks", ["startup_demand", "rotational_demand", "barrel_redirect_demand"].every((key) => preview.questions.some((item) => item.dimensionKey === key && item.minimumTrials === 4))),
    check("forgiveness controls center handle and end contact", ["center_response_baseline", "handle_side_miss_tolerance", "end_side_miss_tolerance", "response_degradation"].every((key) => dimensions.includes(key))),
    check("controlled contact design requires 18 trials", preview.questions.some((item) => item.dimensionKey === "response_degradation" && item.minimumTrials === 18)),
    check("response degradation remains inverse", preview.questions.some((item) => item.dimensionKey === "response_degradation" && item.responseScale === "five_level_inverse_degradation")),
    check("sweet spot breadth is candidate-only", preview.questions.some((item) => item.dimensionKey === "usable_contact_region_breadth" && item.aggregationRole === "candidate_subconstruct_only")),
    check("sweet spot response quality is candidate-only", ["centered_response_consistency", "near_center_response_consistency"].every((key) => preview.questions.some((item) => item.dimensionKey === key && item.aggregationRole === "candidate_subconstruct_only"))),
    check("preview itself performs no persistence", preview.studyClassification === "protocol_calibration_evidence" && preview.persistenceAllowed === false),
    check("evaluation six is not performed", preview.evaluationSixPerformed === false),
    check("canonical and numeric outputs remain zero", preview.canonicalEvaluationsCreated === 0 && preview.numericReferencesCreated === 0),
    check("recommendation behavior remains unchanged", preview.recommendationBehaviorChanged === false)
  ];
  return { verdict: checks.every((item) => item.passed) ? "pass" as const : "fail" as const, checks };
}

function check(name: string, passed: boolean) { return { name, passed, details: passed ? "pass" : "fail" }; }
