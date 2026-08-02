import test from "node:test";
import assert from "node:assert/strict";
import { EquipmentDNAService } from "../equipment-dna.service.js";
import { EquipmentDNARepository } from "../equipment-dna.repository.js";
import { normalizeEquipmentDNAScore } from "../normalization/score-normalization.js";
import { mapCharacteristicCode } from "../mapping/characteristic-mapping.js";
import { calculateEvidenceConfidence } from "../evidence-confidence.js";

class DecimalMock {
  constructor(private readonly value: number) {}
  toNumber() {
    return this.value;
  }
}

function createRepository(overrides: Partial<Record<keyof EquipmentDNARepository, unknown>> = {}) {
  const equipment = {
    id: "equipment-1",
    manufacturer: "Rawlings",
    model: "ICON",
    modelYear: 2026,
    certification: "USA",
    category: "bat",
    construction: "two_piece",
    material: "composite",
    barrelDiameter: new DecimalMock(2.625),
    status: "active"
  };
  const profile = {
    id: "dna-profile-1",
    equipmentId: "equipment-1",
    version: 1,
    certificationLevel: "gold",
    confidenceScore: "high",
    status: "active",
    publishedAt: new Date("2026-07-01")
  };
  const evidence = [
    {
      id: "evidence-1",
      dnaScoreId: "score-1",
      evidenceType: "user_feedback",
      title: "Player feedback",
      summary: "Player reported light swing and easy control.",
      sourceReference: null,
      reliability: "medium",
      status: "approved"
    }
  ];
  const scores = [
    ["score-1", "BAT_CONTROL", 9.5],
    ["score-2", "SWING_BALANCE", 8],
    ["score-3", "SWING_WEIGHT", 7],
    ["score-4", "BARREL_FORGIVENESS", 8.5],
    ["score-5", "SWEET_SPOT_SIZE", 9],
    ["score-6", "POWER_POTENTIAL", 8],
    ["score-7", "CONFIDENCE_BUILDING", 8.5],
    ["score-8", "TRANSITION_FRIENDLINESS", 6.5]
  ].map(([id, code, score]) => ({
    id,
    score: new DecimalMock(score as number),
    rationale: `${code} rationale`,
    characteristic: { code },
    evidence: id === "score-1" ? evidence : []
  }));
  const variants = [
    {
      id: "variant-1",
      equipmentId: "equipment-1",
      lengthInches: new DecimalMock(30),
      weightOunces: new DecimalMock(22),
      dropWeight: -8,
      msrp: new DecimalMock(399.99),
      sku: "RAW-ICON-USA-30-8"
    }
  ];
  const repository = {
    getEquipmentById: async () => equipment,
    getVariantById: async () => ({ ...variants[0], equipment }),
    getActiveDNAProfile: async () => profile,
    getDNAProfileByVersion: async () => profile,
    getDNAScores: async () => scores,
    getSpecifications: async () => [
      { specificationCode: "BARREL_DIAMETER", valueText: null, valueNumber: new DecimalMock(2.625), unit: "in", source: "seed", verifiedAt: null }
    ],
    getEvidence: async () => evidence,
    getFitProfiles: async () => [
      { fitType: "swing_profile", fitCode: "light_balanced", strength: 4, confidence: "high", rationale: "Light swing fit", version: 1 }
    ],
    getPersonalities: async () => [
      { personalityCode: "CONTROL_BUILDER", personalityName: "Control Builder", isPrimary: true, confidence: "high", derivationVersion: "v1", rationale: "Strong control profile" }
    ],
    getAvailableVariants: async () => variants,
    listEligibleEquipment: async () => [{ ...equipment, variants, dnaProfiles: [profile] }],
    listEquipmentByCertification: async () => [equipment],
    listComparableEquipment: async () => [],
    ...overrides
  } as unknown as EquipmentDNARepository;

  return repository;
}

test("loads a complete active Equipment DNA profile", async () => {
  const profile = await new EquipmentDNAService(createRepository()).getEquipmentDNA("equipment-1");

  assert.equal(profile.manufacturer, "Rawlings");
  assert.equal(profile.scores.batControl, 95);
  assert.equal(profile.missingCharacteristics.length, 0);
  assert.equal(profile.sourceLevel, "model");
});

test("missing characteristics are not converted to zero and reduce completeness", async () => {
  const repository = createRepository({
    getDNAScores: async () => [
      { id: "score-1", score: new DecimalMock(9), rationale: null, characteristic: { code: "BAT_CONTROL" }, evidence: [] }
    ]
  });
  const profile = await new EquipmentDNAService(repository).getEquipmentDNA("equipment-1");

  assert.equal(profile.scores.balance, undefined);
  assert.ok(profile.profileCompleteness < 100);
  assert.ok(profile.missingCharacteristics.includes("balance"));
});

test("normalizes 1-10 scores to 0-100", () => {
  assert.equal(normalizeEquipmentDNAScore(9.5), 95);
  assert.equal(normalizeEquipmentDNAScore(87), 87);
});

test("loads a selected equipment variant and marks model-level intelligence", async () => {
  const profile = await new EquipmentDNAService(createRepository()).getEquipmentVariantDNA("variant-1");

  assert.equal(profile.variantId, "variant-1");
  assert.equal(profile.selectedVariant?.lengthInches, 30);
  assert.equal(profile.sourceLevel, "model");
});

test("draft profile is not public recommendation eligible", async () => {
  const repository = createRepository({
    getActiveDNAProfile: async () => ({
      id: "draft-profile",
      equipmentId: "equipment-1",
      version: 1,
      certificationLevel: "silver",
      confidenceScore: "medium",
      status: "draft",
      publishedAt: null
    })
  });
  const profile = await new EquipmentDNAService(repository).getEquipmentDNA("equipment-1", { includeDraft: true });

  assert.equal(profile.eligibility.eligible, false);
  assert.ok(profile.eligibility.reasons.includes("No active DNA profile"));
});

test("inactive equipment is not recommendation eligible", async () => {
  const repository = createRepository({
    getEquipmentById: async () => ({
      id: "equipment-1",
      manufacturer: "Rawlings",
      model: "ICON",
      modelYear: 2026,
      certification: "USA",
      category: "bat",
      construction: null,
      material: null,
      barrelDiameter: null,
      status: "archived"
    })
  });
  const profile = await new EquipmentDNAService(repository).getEquipmentDNA("equipment-1");

  assert.equal(profile.eligibility.eligible, false);
  assert.ok(profile.eligibility.reasons.includes("Equipment is not active"));
});

test("certification filter works through eligible listing", async () => {
  let seenCertification = "";
  const repository = createRepository({
    listEligibleEquipment: async (filters: { certification?: string }) => {
      seenCertification = filters.certification ?? "";
      return [];
    }
  });

  await new EquipmentDNAService(repository).listRecommendationEligibleEquipment({ certification: "USA" });

  assert.equal(seenCertification, "USA");
});

test("evidence confidence is deterministic", () => {
  const first = calculateEvidenceConfidence({
    scoreCount: 8,
    scoresWithEvidence: 4,
    evidence: [{ id: "e1", evidenceType: "user_feedback", title: "Feedback", summary: "Good control", reliability: "medium", status: "approved" }],
    certificationLevel: "gold",
    profileCompleteness: 90,
    published: true
  });
  const second = calculateEvidenceConfidence({
    scoreCount: 8,
    scoresWithEvidence: 4,
    evidence: [{ id: "e1", evidenceType: "user_feedback", title: "Feedback", summary: "Good control", reliability: "medium", status: "approved" }],
    certificationLevel: "gold",
    profileCompleteness: 90,
    published: true
  });

  assert.deepEqual(first, second);
});

test("explanations include characteristic codes and evidence", async () => {
  const explanation = await new EquipmentDNAService(createRepository()).getEquipmentDNAExplanation("equipment-1", "batControl");

  assert.equal(explanation?.characteristicCode, "BAT_CONTROL");
  assert.ok((explanation?.evidence.length ?? 0) > 0);
});

test("stable characteristic codes drive mapping", () => {
  assert.equal(mapCharacteristicCode("BAT_CONTROL"), "batControl");
  assert.equal(mapCharacteristicCode("Bat Control™"), undefined);
});

test("comparable equipment comparison is deterministic", async () => {
  const service = new EquipmentDNAService(createRepository());
  const first = await service.compareEquipmentDNA("equipment-1", "equipment-2");
  const second = await service.compareEquipmentDNA("equipment-1", "equipment-2");

  assert.deepEqual(first, second);
});
