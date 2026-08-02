import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { formatEnvironmentReport, loadEnvironment, validateEnvironment } from "./env-check.mjs";

test("environment validator accepts a safe development URL", () => {
  const result = validateEnvironment({
    DATABASE_URL: "postgresql://user:secret@db.example.com:5432/postgres?schema=ninery_dev",
    PORT: "3001",
    NODE_ENV: "development"
  });

  assert.equal(result.ok, true);
});

test("environment validator rejects a missing DATABASE_URL", () => {
  const result = validateEnvironment({});
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("DATABASE_URL missing"));
});

test("DATABASE_URL is found in root .env", () => {
  const root = makeEnvWorkspace({
    rootEnv: 'DATABASE_URL="postgresql://root:secret@root.example.com:5432/postgres?schema=ninery_dev"'
  });
  const result = validateEnvironment(loadEnvironment({ root, processEnv: {} }));

  assert.equal(result.ok, true);
});

test("DATABASE_URL is found in packages/database/.env", () => {
  const root = makeEnvWorkspace({
    databaseEnv: 'DATABASE_URL="postgresql://database:secret@database.example.com:5432/postgres?schema=ninery_dev"'
  });
  const result = validateEnvironment(loadEnvironment({ root, processEnv: {} }));

  assert.equal(result.ok, true);
});

test("process.env DATABASE_URL takes priority over file values", () => {
  const root = makeEnvWorkspace({
    rootEnv: 'DATABASE_URL="postgresql://root:secret@root.example.com:5432/postgres?schema=ninery_dev"',
    databaseEnv: 'DATABASE_URL="postgresql://database:secret@database.example.com:5432/postgres?schema=ninery_dev"'
  });
  const env = loadEnvironment({
    root,
    processEnv: {
      DATABASE_URL: "postgresql://process:secret@process.example.com:5432/postgres?schema=ninery_dev"
    }
  });

  assert.match(env.DATABASE_URL, /process\.example\.com/);
  assert.equal(validateEnvironment(env).ok, true);
});

test("environment validator identifies placeholder password text", () => {
  const result = validateEnvironment({
    DATABASE_URL: "postgresql://USER:YOUR_PASSWORD@HOST:5432/postgres?schema=ninery_dev"
  });

  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("placeholder")));
});

test("environment report does not print secrets", () => {
  const secret = "super-secret-password";
  const result = validateEnvironment({
    DATABASE_URL: `postgresql://user:${secret}@db.example.com:5432/postgres?schema=ninery_dev`
  });
  const output = formatEnvironmentReport(result);

  assert.equal(output.includes(secret), false);
});

function makeEnvWorkspace({ rootEnv, databaseEnv }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ninery-env-"));
  fs.mkdirSync(path.join(root, "packages/database"), { recursive: true });
  if (rootEnv !== undefined) {
    fs.writeFileSync(path.join(root, ".env"), rootEnv);
  }
  if (databaseEnv !== undefined) {
    fs.writeFileSync(path.join(root, "packages/database/.env"), databaseEnv);
  }
  return root;
}
