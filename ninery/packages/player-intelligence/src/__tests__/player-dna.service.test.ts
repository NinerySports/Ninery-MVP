import test from "node:test";
import assert from "node:assert/strict";
import { createDemoPlayerDNAInput } from "../demo-fixture.js";
import { InMemoryPlayerDNARepository } from "../player-dna.repository.js";
import { PlayerDNAService } from "../player-dna.service.js";

test("same inputs and rule version produce identical deterministic outputs", async () => {
  const input = createDemoPlayerDNAInput();
  const first = await new PlayerDNAService().generatePlayerDNA(input, {
    profileId: "profile-1",
    generatedAt: "2026-07-01T00:00:00.000Z"
  });
  const second = await new PlayerDNAService().generatePlayerDNA(input, {
    profileId: "profile-1",
    generatedAt: "2026-07-01T00:00:00.000Z"
  });

  assert.deepEqual(first.scores, second.scores);
  assert.deepEqual(first.categories, second.categories);
  assert.deepEqual(first.explanations, second.explanations);
});

test("historical Player DNA profile is not overwritten", async () => {
  const repository = new InMemoryPlayerDNARepository();
  const service = new PlayerDNAService(repository);
  const input = createDemoPlayerDNAInput();

  await service.generatePlayerDNA(input, { profileId: "history-1", generatedAt: "2026-07-01T00:00:00.000Z" });
  await service.generatePlayerDNA(input, { profileId: "history-2", generatedAt: "2026-07-02T00:00:00.000Z" });

  const history = await service.getPlayerDNAHistory(input.player.id);
  const latest = await service.getLatestPlayerDNA(input.player.id);

  assert.equal(history.length, 2);
  assert.equal(latest?.profileId, "history-2");
});

test("explanations contain applied rule IDs and source codes", async () => {
  const service = new PlayerDNAService();
  const profile = await service.generatePlayerDNA(createDemoPlayerDNAInput(), {
    profileId: "explain-1",
    generatedAt: "2026-07-01T00:00:00.000Z"
  });
  const explanation = await service.explainPlayerDNAAttribute(profile.profileId, "batControl");

  assert.ok(explanation);
  assert.ok(explanation.ruleIds.length > 0);
  assert.ok(explanation.sourceCodes.length > 0);
});

test("demo fixture tends toward control, light feel, confidence, and moderated transition readiness", async () => {
  const profile = await new PlayerDNAService().generatePlayerDNA(createDemoPlayerDNAInput(), {
    profileId: "demo-profile",
    generatedAt: "2026-07-01T00:00:00.000Z"
  });

  assert.ok(profile.scores.batControl > 65);
  assert.equal(profile.categories.preferredSwingFeel, "light");
  assert.ok(profile.scores.confidence > 70);
  assert.ok(profile.scores.powerPotential >= 50);
  assert.ok(profile.scores.transitionReadiness < 75);
});
