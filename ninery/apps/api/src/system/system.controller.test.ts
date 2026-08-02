import assert from "node:assert/strict";
import test from "node:test";
import { SystemController } from "./system.controller.js";

test("health endpoint returns safe status data", async () => {
  const controller = new SystemController({ $queryRaw: async () => 1 } as never);
  const response = await controller.health();

  assert.equal(response.status, "ok");
  assert.equal(response.service, "ninery-api");
  assert.equal(response.database, "connected");
  assert.ok(response.timestamp);
});

test("version endpoint returns service and version data", () => {
  const controller = new SystemController({ $queryRaw: async () => 1 } as never);
  const response = controller.version();

  assert.equal(response.service, "ninery-api");
  assert.equal(response.version, "0.1.0");
});
