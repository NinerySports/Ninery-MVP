import {
  fieldObservationProtocol,
  genuineStudyDefinition,
  participationAcknowledgementLanguage
} from "../../../recommendation-intelligence/src/index.ts";

console.log("Genuine Transition Field Observation Protocol v1.0");
console.log("");
console.log("Genuine study definition:");
console.log(genuineStudyDefinition.definition);
console.log("");
console.log("Not genuine evidence:");
for (const item of genuineStudyDefinition.exclusions) console.log(`- ${item}`);
console.log("");
console.log("Participation acknowledgement:");
for (const line of participationAcknowledgementLanguage) console.log(`- ${line}`);
console.log("- This is an internal operational acknowledgement, not a formal legal or clinical research-consent system.");
console.log("");
console.log("Checkpoints:");
console.log(`- first_use: ${fieldObservationProtocol.checkpoints.first_use}`);
console.log(`- early_sessions: ${fieldObservationProtocol.checkpoints.early_sessions}`);
console.log(`- acclimation_period: ${fieldObservationProtocol.checkpoints.acclimation_period}`);
console.log("");
console.log("Evidence fields:");
console.log("- equipment actually used");
console.log("- meaningful use occurred");
console.log("- adjustment demand");
console.log("- swing-effort, timing, barrel-control, and balance-feel adjustment");
console.log("- continued-use state when actually known");
console.log("- observer source, direct-witness status, confidence, limited notes, and session context");
console.log("");
console.log("Observer-source rules:");
console.log(fieldObservationProtocol.observerSourcePolicy);
console.log("");
console.log("Evidence quality policy:");
console.log("- insufficient, limited, usable, or strong");
console.log("- direct witness, meaningful use, checkpoint coverage, confidence, completeness, and conflicts affect quality");
console.log("- material disagreement remains useful evidence when quality is otherwise sufficient");
console.log("- evidence quality does not mean statistical validation");
console.log("");
console.log("Prospective-prediction requirement:");
console.log("- Transition v1.1 prediction must be captured before the first observation.");
console.log("- Retrospective outcome-known studies are blocked from genuine predictive evidence.");
console.log("");
console.log("Data minimization:");
for (const line of fieldObservationProtocol.dataMinimization) console.log(`- ${line}`);
console.log("");
console.log("Prohibited causal or sensitive claims:");
console.log("- no medical, psychological, school, precise-location, or unrelated family details");
console.log("- no claims that the bat caused an outcome");
console.log("- no claims that the model was proven correct");
console.log("- no accuracy percentage and no automatic promotion threshold");
console.log("");
console.log("Promotion guardrails:");
for (const line of fieldObservationProtocol.promotionGuardrails) console.log(`- ${line}`);
