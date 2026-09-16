import {
  InMemoryTransitionShadowAdminRepository,
  TransitionGenuineStudyIntakeService,
  genuineStudyReadinessReport
} from "../../../recommendation-intelligence/src/index.ts";

const report = genuineStudyReadinessReport();
const dryRun = await runDryRun();

console.log("Genuine Transition Study Readiness v1.0");
console.log("");
console.log(`Delivery mode:`);
console.log(report.deliveryMode);
console.log("");
console.log(`Authorization:`);
console.log(report.authorization);
console.log("");
console.log(`Acknowledgement protocol:`);
console.log(report.acknowledgementProtocol);
console.log("");
console.log(`Current equipment verification:`);
console.log(report.currentEquipmentVerification);
console.log("");
console.log(`Proposed equipment verification:`);
console.log(report.proposedEquipmentVerification);
console.log("");
console.log(`Familiarity intake:`);
console.log(report.familiarityIntake);
console.log("");
console.log(`Prospective v1.1 prediction:`);
console.log(report.prospectiveV1_1Prediction);
console.log("");
console.log(`Field observation protocol:`);
console.log(report.fieldObservationProtocol);
console.log("");
console.log(`Evidence-quality evaluation:`);
console.log(report.evidenceQualityEvaluation);
console.log("");
console.log(`Genuine evidence registry:`);
console.log(report.genuineEvidenceRegistry);
console.log("");
console.log(`Synthetic/genuine separation:`);
console.log(report.syntheticGenuineSeparation);
console.log("");
console.log(`Dry-run classification:`);
console.log(dryRun.fixtureClassification);
console.log(`Dry-run creates genuine evidence:`);
console.log(dryRun.wouldCreateGenuineEvidence ? "yes" : "no");
console.log("");
console.log(`Model automatically changed:`);
console.log(report.modelAutomaticallyChanged ? "yes" : "no");
console.log("");
console.log(`Live promotion automatically recommended:`);
console.log(report.livePromotionAutomaticallyRecommended ? "yes" : "no");
console.log("");
console.log(`Readiness verdict:`);
console.log(report.readinessVerdict);

async function runDryRun() {
  const repository = new InMemoryTransitionShadowAdminRepository();
  repository.players.set("ticket-041-player", { id: "ticket-041-player", status: "active", label: "Ticket 041 dry-run player" });
  repository.playerDNA.add("ticket-041-player");
  repository.equipment.set("ticket-041-current", { id: "ticket-041-current", label: "Dry Run Current Bat" });
  repository.equipment.set("ticket-041-proposed", { id: "ticket-041-proposed", label: "Dry Run Proposed Bat" });
  repository.variants.set("ticket-041-current-v", { id: "ticket-041-current-v", equipmentId: "ticket-041-current", label: "DRY-CURRENT-30-22" });
  repository.variants.set("ticket-041-proposed-v", { id: "ticket-041-proposed-v", equipmentId: "ticket-041-proposed", label: "DRY-PROPOSED-30-22" });
  const service = new TransitionGenuineStudyIntakeService(repository);
  const actor = { actorId: "ticket-041-dry-run-operator", roleCodes: ["transition_shadow_operator"], capabilityCodes: [], active: true };
  return service.genuineIntakeDryRun({
    id: "ticket-041-dry-run",
    playerId: "ticket-041-player",
    observationPeriodKey: "ticket-041-dry-run",
    currentEquipmentVerification: {
      equipmentId: "ticket-041-current",
      equipmentVariantId: "ticket-041-current-v",
      lengthInches: 30,
      weightOunces: 22,
      dropWeight: -8,
      certification: "USA",
      verifiedAsActualCurrentPrimary: true,
      source: "combined",
      verifiedAt: new Date("2026-08-09T00:00:00.000Z")
    },
    proposedEquipmentVerification: {
      equipmentId: "ticket-041-proposed",
      equipmentVariantId: "ticket-041-proposed-v",
      lengthInches: 30,
      weightOunces: 22,
      dropWeight: -8,
      certification: "USA",
      expectedToBeUsed: true,
      availableForUse: true,
      sizeSpecificationMatched: true,
      source: "combined",
      verifiedAt: new Date("2026-08-09T00:00:00.000Z")
    },
    familiarityInput: {
      playerId: "ticket-041-player",
      equipmentId: "ticket-041-current",
      equipmentVariantId: "ticket-041-current-v",
      estimatedSessionsUsed: 20,
      estimatedWeeksUsed: 8,
      regularUseFrequency: "multiple_times_weekly",
      usageContexts: ["practice", "games"],
      currentlyPrimaryEquipment: true,
      directlyReportedFamiliarity: "familiar",
      source: "combined",
      capturedAt: new Date("2026-08-09T00:00:00.000Z")
    },
    participationAcknowledgement: {
      version: "1.0",
      playerId: "ticket-041-player",
      acknowledgementType: "internal_operational_authorization",
      acknowledgedByRole: "internal_staff",
      acknowledgedAt: new Date("2026-08-09T00:00:00.000Z"),
      purposeAcknowledged: true,
      observationalNatureAcknowledged: true,
      noRecommendationImpactAcknowledged: true,
      voluntaryFeedbackAcknowledged: true,
      capturedByActorId: "ticket-041-dry-run-operator"
    },
    playerDNAProfileId: "ticket-041-player-dna",
    playerDNAVersion: "1.0.0",
    captureOrigin: "internal_guided_entry",
    createdAt: new Date("2026-08-09T00:00:00.000Z")
  }, actor);
}
