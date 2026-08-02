import assert from "node:assert/strict";
import test from "node:test";
import { getApiPort, validateApiEnvironment } from "./environment.js";

test("API starts with default port 3001", () => {
  assert.equal(getApiPort({}), 3001);
});

test("API honors a valid PORT override", () => {
  assert.equal(getApiPort({ PORT: "4010" }), 4010);
});

test("API environment validator rejects missing DATABASE_URL", () => {
  const result = validateApiEnvironment({});
  assert.equal(result.ok, false);
});
