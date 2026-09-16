import type {
  TransitionExtendedShadowStudy,
  TransitionShadowStudyStatus
} from "../extended-shadow/index.js";
import type {
  TransitionShadowAuditEvent,
  TransitionShadowAdminRepository,
  TransitionShadowStudyListFilters
} from "./transition-shadow-admin.types.js";
import { classifyTransitionShadowStudy } from "./transition-shadow-admin.policy.js";
import { TransitionShadowAdminError } from "./transition-shadow-admin.types.js";

export class InMemoryTransitionShadowAdminRepository implements TransitionShadowAdminRepository {
  readonly players = new Map<string, { readonly id: string; readonly status?: string; readonly label?: string; readonly synthetic?: boolean }>();
  readonly equipment = new Map<string, { readonly id: string; readonly label?: string; readonly synthetic?: boolean }>();
  readonly variants = new Map<string, { readonly id: string; readonly equipmentId: string; readonly label?: string; readonly synthetic?: boolean }>();
  readonly playerDNA = new Set<string>();
  private readonly studies = new Map<string, TransitionExtendedShadowStudy>();
  private readonly auditEvents: TransitionShadowAuditEvent[] = [];

  async getPlayer(playerId: string) {
    return this.players.get(playerId);
  }

  async hasPlayerDNA(playerId: string) {
    return this.playerDNA.has(playerId);
  }

  async getEquipment(equipmentId: string) {
    return this.equipment.get(equipmentId);
  }

  async getEquipmentVariant(variantId: string) {
    return this.variants.get(variantId);
  }

  async getStudy(studyId: string) {
    return this.studies.get(studyId);
  }

  async listStudies(filters: TransitionShadowStudyListFilters = {}) {
    let rows = [...this.studies.values()];
    if (!filters.includeSynthetic) rows = rows.filter((study) => classifyTransitionShadowStudy(study) === "genuine_internal_observation");
    if (filters.status) rows = rows.filter((study) => study.status === filters.status);
    if (filters.playerId) rows = rows.filter((study) => study.playerId === filters.playerId);
    if (filters.currentEquipmentId) rows = rows.filter((study) => study.currentEquipmentId === filters.currentEquipmentId);
    if (filters.proposedEquipmentId) rows = rows.filter((study) => study.proposedEquipmentId === filters.proposedEquipmentId);
    if (filters.evidenceClassification) rows = rows.filter((study) => classifyTransitionShadowStudy(study) === filters.evidenceClassification);
    if (filters.modelVersion) rows = rows.filter((study) => study.prediction?.transitionModelVersion === filters.modelVersion);
    if (filters.createdFrom) rows = rows.filter((study) => study.createdAt >= filters.createdFrom!);
    if (filters.createdTo) rows = rows.filter((study) => study.createdAt <= filters.createdTo!);
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.studyKey.localeCompare(b.studyKey))
      .slice(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? rows.length));
  }

  async findActiveStudyByKey(studyKey: string) {
    return [...this.studies.values()].find((study) => study.studyKey === studyKey && active(study.status));
  }

  async createStudy(study: TransitionExtendedShadowStudy) {
    if (await this.findActiveStudyByKey(study.studyKey)) throw new TransitionShadowAdminError("ACTIVE_STUDY_EXISTS", "Active study already exists.");
    this.studies.set(study.id, study);
    return study;
  }

  async updateStudy(study: TransitionExtendedShadowStudy, expectedUpdatedAt?: Date) {
    const existing = this.studies.get(study.id);
    if (expectedUpdatedAt && existing && existing.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new TransitionShadowAdminError("CONCURRENCY_CONFLICT", "Study changed before the requested operation completed.");
    this.studies.set(study.id, study);
    return study;
  }

  async writeAuditEvent(event: TransitionShadowAuditEvent) {
    this.auditEvents.push(event);
  }

  async listAuditEvents(studyId?: string) {
    return this.auditEvents
      .filter((event) => !studyId || event.studyId === studyId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
  }
}

function active(status: TransitionShadowStudyStatus) {
  return status === "draft" || status === "prediction_captured" || status === "observation_active";
}
