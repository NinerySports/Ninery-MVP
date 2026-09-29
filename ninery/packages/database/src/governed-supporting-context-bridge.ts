import { createHash } from "node:crypto";
import { canonicalizeExternalClaimValue } from "./external-claim-ingestion.js";
import type { GovernedReviewLocator, ReviewedSupportingInterpretation } from "./external-claim-review.js";
import { ExternalSupportingEvidencePersistenceService, type ExternalSupportingPersistenceCommand, type ExternalSupportingPersistenceRepository, type PersistedExternalSupportingDecision } from "./external-supporting-evidence-persistence.js";

export const GOVERNED_SUPPORTING_CONTEXT_BRIDGE_VERSION = "1.0";

export type GovernedSupportingContextCommand = GovernedReviewLocator & {
  readonly expectedQualificationDecisionId: string;
  readonly expectedReviewDecisionId: string;
  readonly identityScope: ExternalSupportingPersistenceCommand["identityScope"];
  readonly direction: ExternalSupportingPersistenceCommand["direction"];
  readonly comparisonTarget?: string;
  readonly idempotencyKey: string;
};

export type CurrentGovernedSupportingLineage = Pick<ExternalSupportingPersistenceCommand,
  "rawClaimId" | "normalizedClaimId" | "dependencyAssessmentId" | "constructRelationshipId" | "qualificationDecisionId" | "reviewDecisionId"> & {
    readonly interpretation: ReviewedSupportingInterpretation;
  };

export class GovernedSupportingContextBridgeError extends Error {
  constructor(readonly code: string) { super(code); this.name = "GovernedSupportingContextBridgeError"; }
}

export interface GovernedSupportingContextBridgeRepository {
  transaction<T>(operation: (repository: GovernedSupportingContextBridgeRepository) => Promise<T>): Promise<T>;
  lock(locator: GovernedReviewLocator): Promise<void>;
  loadCurrent(locator: GovernedReviewLocator): Promise<CurrentGovernedSupportingLineage>;
  supportingRepository(): ExternalSupportingPersistenceRepository;
}

export function governedSupportingContextIdempotencyKey(
  lineage: CurrentGovernedSupportingLineage,
  options: Pick<GovernedSupportingContextCommand, "identityScope" | "direction" | "comparisonTarget">
): string {
  const fingerprint = createHash("sha256").update(canonicalizeExternalClaimValue({
    version: GOVERNED_SUPPORTING_CONTEXT_BRIDGE_VERSION,
    policy: "external_expert_supporting_role",
    policyVersion: "1.0-provisional",
    lineage,
    identityScope: options.identityScope,
    direction: options.direction,
    comparisonTarget: options.comparisonTarget ?? null
  })).digest("hex");
  return `governed-supporting:${fingerprint}`;
}

export class GovernedSupportingContextBridgeService {
  constructor(private readonly repository: GovernedSupportingContextBridgeRepository) {}

  persist(command: GovernedSupportingContextCommand): Promise<PersistedExternalSupportingDecision> {
    return this.repository.transaction(async repository => {
      await repository.lock(command);
      const lineage = await repository.loadCurrent(command);
      if (lineage.qualificationDecisionId !== command.expectedQualificationDecisionId ||
        lineage.reviewDecisionId !== command.expectedReviewDecisionId) {
        throw new GovernedSupportingContextBridgeError("STALE_GOVERNED_LINEAGE");
      }
      const { interpretation, ...ids } = lineage;
      if (command.identityScope !== interpretation.identityScope || command.direction !== interpretation.direction ||
        (command.comparisonTarget ?? null) !== (interpretation.comparisonTarget ?? null)) {
        throw new GovernedSupportingContextBridgeError("INTERPRETATION_MISMATCH");
      }
      const expectedKey = governedSupportingContextIdempotencyKey(lineage, interpretation);
      if (command.idempotencyKey !== expectedKey) {
        throw new GovernedSupportingContextBridgeError("IDEMPOTENCY_CONFLICT");
      }
      const supportingCommand: ExternalSupportingPersistenceCommand = {
        ...ids, identityScope: interpretation.identityScope, direction: interpretation.direction,
        comparisonTarget: interpretation.comparisonTarget, idempotencyKey: expectedKey
      };
      const supportingRepository = repository.supportingRepository();
      const supportingService = new ExternalSupportingEvidencePersistenceService(supportingRepository);
      const context = await supportingRepository.loadContext(supportingCommand);
      if (!context) throw new GovernedSupportingContextBridgeError("PERSISTENCE_CONTEXT_NOT_FOUND");
      if (context.constructRelationship.proposedConstruct !== interpretation.construct ||
        context.constructRelationship.role !== interpretation.role) {
        throw new GovernedSupportingContextBridgeError("INTERPRETATION_MISMATCH");
      }
      const decision = supportingService.assessCurrentEligibility(supportingCommand, context);
      if (!decision.eligible) throw new GovernedSupportingContextBridgeError(`SUPPORTING_ROLE_INELIGIBLE:${decision.blockers.join(",")}`);
      return supportingService.persist(supportingCommand);
    });
  }
}
