import { BadRequestException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import {
  EquipmentDNANotFoundError,
  EquipmentDNAService,
  equipmentCategoryValues,
  equipmentCertificationValues,
  equipmentDNAAttributes,
  equipmentStatusValues,
  type EquipmentDNAAttribute,
  type EquipmentDNAFilters,
  type EquipmentCategoryFilter,
  type EquipmentCertificationFilter,
  type EquipmentStatusFilter
} from "@ninery/equipment-intelligence";

@Controller()
export class EquipmentController {
  constructor(private readonly equipmentDNAService: EquipmentDNAService) {}

  @Get("equipment/:equipmentId/dna")
  async getEquipmentDNA(
    @Param("equipmentId", new ParseUUIDPipe()) equipmentId: string,
    @Query("includeDraft") includeDraft?: string
  ) {
    return this.handle(() => this.equipmentDNAService.getEquipmentDNA(equipmentId, { includeDraft: includeDraft === "true" }));
  }

  @Get("equipment/variants/:variantId/dna")
  async getEquipmentVariantDNA(
    @Param("variantId", new ParseUUIDPipe()) variantId: string,
    @Query("includeDraft") includeDraft?: string
  ) {
    return this.handle(() => this.equipmentDNAService.getEquipmentVariantDNA(variantId, { includeDraft: includeDraft === "true" }));
  }

  @Get("equipment/:equipmentId/dna/explanations/:attribute")
  async explainEquipmentDNAAttribute(
    @Param("equipmentId", new ParseUUIDPipe()) equipmentId: string,
    @Param("attribute") attribute: string
  ) {
    if (!equipmentDNAAttributes.includes(attribute as EquipmentDNAAttribute)) {
      throw new BadRequestException("Unknown Equipment DNA attribute.");
    }

    const explanation = await this.handle(() =>
      this.equipmentDNAService.getEquipmentDNAExplanation(equipmentId, attribute as EquipmentDNAAttribute)
    );

    if (!explanation) {
      throw new NotFoundException("Equipment DNA explanation was not found.");
    }

    return explanation;
  }

  @Get("equipment/eligible")
  async listEligibleEquipment(
    @Query("certification") certification?: string,
    @Query("category") category?: string,
    @Query("status") status?: string,
    @Query("minimumCompleteness") minimumCompleteness?: string,
    @Query("minimumEvidenceConfidence") minimumEvidenceConfidence?: string,
    @Query("modelYear") modelYear?: string,
    @Query("variantLength") variantLength?: string,
    @Query("dropWeight") dropWeight?: string,
    @Query("includeDraft") includeDraft?: string
  ) {
    const filters: EquipmentDNAFilters = {
      certification: parseOptionalEnum(certification, equipmentCertificationValues, "certification"),
      category: parseOptionalEnum(category, equipmentCategoryValues, "category"),
      status: parseOptionalEnum(status, equipmentStatusValues, "status"),
      minimumCompleteness: parseOptionalNumber(minimumCompleteness, "minimumCompleteness"),
      minimumEvidenceConfidence: parseOptionalNumber(minimumEvidenceConfidence, "minimumEvidenceConfidence"),
      modelYear: parseOptionalNumber(modelYear, "modelYear"),
      variantLength: parseOptionalNumber(variantLength, "variantLength"),
      dropWeight: parseOptionalNumber(dropWeight, "dropWeight"),
      includeDraft: includeDraft === "true"
    };

    return this.equipmentDNAService.listRecommendationEligibleEquipment(filters);
  }

  @Get("equipment/:sourceEquipmentId/compare/:targetEquipmentId")
  async compareEquipmentDNA(
    @Param("sourceEquipmentId", new ParseUUIDPipe()) sourceEquipmentId: string,
    @Param("targetEquipmentId", new ParseUUIDPipe()) targetEquipmentId: string
  ) {
    return this.handle(() => this.equipmentDNAService.compareEquipmentDNA(sourceEquipmentId, targetEquipmentId));
  }

  private async handle<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof EquipmentDNANotFoundError) {
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }
}

function parseOptionalNumber(value: string | undefined, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new BadRequestException(`${name} must be numeric.`);
  }

  return parsed;
}

function parseOptionalEnum(
  value: string | undefined,
  values: readonly EquipmentCertificationFilter[],
  name: string
): EquipmentCertificationFilter | undefined;
function parseOptionalEnum(
  value: string | undefined,
  values: readonly EquipmentCategoryFilter[],
  name: string
): EquipmentCategoryFilter | undefined;
function parseOptionalEnum(
  value: string | undefined,
  values: readonly EquipmentStatusFilter[],
  name: string
): EquipmentStatusFilter | undefined;
function parseOptionalEnum<T extends string>(value: string | undefined, values: readonly T[], name: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!values.includes(value as T)) {
    throw new BadRequestException(`${name} must be one of: ${values.join(", ")}.`);
  }

  return value as T;
}
