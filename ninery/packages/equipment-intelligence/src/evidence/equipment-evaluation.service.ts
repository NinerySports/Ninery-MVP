import { assessEquipmentAttributeConfidence } from "./equipment-confidence.js";
import { detectEquipmentEvidenceConflict } from "./equipment-conflict.js";
import type {
  CreateEquipmentDNAAttributeEvaluationInput,
  CreateEquipmentDNAEvidenceRecordInput,
  EquipmentDNAEvaluationRepositoryPort
} from "./equipment-evaluation.repository.js";
import type {
  EquipmentDNAAttributeEvaluation,
  EquipmentDNAEvidenceRecord
} from "./equipment-evidence.types.js";
import {
  assessEvidenceRequirementCompatibility,
  nextEvaluationVersion,
  validateEquipmentDNAAttributeEvaluation,
  validateEquipmentDNAEvidenceRecord
} from "./equipment-evidence.validation.js";
import { assessEquipmentDNAMaturity } from "./equipment-maturity.js";
import { assessEquipmentDNARecommendationReadiness } from "./equipment-readiness.js";

export class EquipmentDNAEvaluationService {
  constructor(private readonly repository: EquipmentDNAEvaluationRepositoryPort) {}

  async createEvidence(input: CreateEquipmentDNAEvidenceRecordInput): Promise<EquipmentDNAEvidenceRecord> {
    const validation = validateEquipmentDNAEvidenceRecord(input);
    if (!validation.valid) {
      throw new Error(`Invalid Equipment DNA evidence: ${validation.errors.join(" ")}`);
    }
    return this.repository.createEvidence(input);
  }

  async createDraftEvaluation(
    input: CreateEquipmentDNAAttributeEvaluationInput
  ): Promise<EquipmentDNAAttributeEvaluation> {
    const validation = validateEquipmentDNAAttributeEvaluation(input);
    if (!validation.valid && input.status !== "draft") {
      throw new Error(`Invalid Equipment DNA evaluation: ${validation.errors.join(" ")}`);
    }
    return this.repository.createDraftEvaluation({ ...input, status: "draft" });
  }

  async activateEvaluation(input: {
    evaluationId: string;
    evidenceRecordIds: readonly string[];
    rationale: string;
  }): Promise<EquipmentDNAAttributeEvaluation> {
    const evaluation = await this.repository.findEvaluationById(input.evaluationId);
    if (!evaluation) {
      throw new Error(`Equipment DNA evaluation ${input.evaluationId} was not found.`);
    }
    const evidenceRecords = await this.repository.listEvidenceByIds(input.evidenceRecordIds);
    const activeCandidate = {
      ...evaluation,
      status: "active" as const,
      rationale: input.rationale,
      evidenceRecords
    };
    const existingActive = await this.repository.findCurrentActiveEvaluation({
      equipmentId: evaluation.equipmentId,
      equipmentVariantId: evaluation.equipmentVariantId,
      attributeKey: evaluation.attributeKey,
      attributeDefinitionVersion: evaluation.attributeDefinitionVersion
    });
    if (existingActive && existingActive.id !== evaluation.id) {
      throw new Error("Only one active evaluation may exist for a target, attribute key, and definition version.");
    }

    const validation = validateEquipmentDNAAttributeEvaluation(activeCandidate, evidenceRecords);
    const requirement = assessEvidenceRequirementCompatibility(evaluation.attributeKey, evidenceRecords);
    const conflict = detectEquipmentEvidenceConflict({
      attributeKey: evaluation.attributeKey,
      evidenceRecords,
      proposedValue: evaluation.value,
      currentEvaluation: existingActive
    });
    if (!validation.valid || !requirement.compatible || conflict.severity === "material") {
      throw new Error(
        [
          ...validation.errors,
          ...requirement.reasons,
          ...(conflict.severity === "material" ? conflict.reasons : [])
        ].join(" ")
      );
    }

    const confidence = assessEquipmentAttributeConfidence({
      evidenceRecords,
      evaluation: activeCandidate,
      conflict
    }).confidence;

    await this.repository.linkEvidenceToEvaluation(evaluation.id ?? input.evaluationId, input.evidenceRecordIds);
    return this.repository.updateEvaluationStatus({
      evaluationId: input.evaluationId,
      status: "active",
      confidence,
      rationale: input.rationale,
      evaluatedAt: new Date()
    });
  }

  async supersedeEvaluation(input: {
    priorEvaluationId: string;
    nextEvaluation: Omit<CreateEquipmentDNAAttributeEvaluationInput, "evaluationVersion" | "supersedesEvaluationId">;
  }): Promise<EquipmentDNAAttributeEvaluation> {
    const prior = await this.repository.findEvaluationById(input.priorEvaluationId);
    if (!prior) {
      throw new Error(`Equipment DNA evaluation ${input.priorEvaluationId} was not found.`);
    }

    await this.repository.updateEvaluationStatus({
      evaluationId: input.priorEvaluationId,
      status: "superseded"
    });

    const existingForTarget = prior.equipmentVariantId
      ? await this.repository.listCurrentEvaluationsForVariant(prior.equipmentVariantId)
      : prior.equipmentId
        ? await this.repository.listCurrentEvaluationsForEquipment(prior.equipmentId)
        : [];
    const nextVersion = nextEvaluationVersion(
      [prior, ...existingForTarget].filter(
        (evaluation) =>
          evaluation.attributeKey === prior.attributeKey &&
          evaluation.attributeDefinitionVersion === prior.attributeDefinitionVersion
      )
    );

    return this.repository.createDraftEvaluation({
      ...input.nextEvaluation,
      evaluationVersion: nextVersion,
      supersedesEvaluationId: prior.id
    });
  }

  async listCurrentEvaluationsForEquipment(equipmentId: string): Promise<EquipmentDNAAttributeEvaluation[]> {
    return this.repository.listCurrentEvaluationsForEquipment(equipmentId);
  }

  async listCurrentEvaluationsForVariant(equipmentVariantId: string): Promise<EquipmentDNAAttributeEvaluation[]> {
    return this.repository.listCurrentEvaluationsForVariant(equipmentVariantId);
  }

  assessConfidence = assessEquipmentAttributeConfidence;
  assessReadiness = assessEquipmentDNARecommendationReadiness;
  assessMaturity = assessEquipmentDNAMaturity;
}
