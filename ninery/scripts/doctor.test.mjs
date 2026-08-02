import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runDoctor } from "./doctor.mjs";

test("doctor detects missing node_modules", () => {
  const root = makeWorkspace({ apiDev: true, webDev: true, nodeModules: false, prismaClient: false });
  const result = runDoctor({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("node_modules missing")));
});

test("doctor detects unavailable Prisma Client", () => {
  const root = makeWorkspace({ apiDev: true, webDev: true, nodeModules: true, prismaClient: false });
  const result = runDoctor({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("Prisma Client unavailable")));
});

test("doctor reports missing API dev script", () => {
  const root = makeWorkspace({ apiDev: false, webDev: true, nodeModules: true, prismaClient: true });
  const result = runDoctor({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((failure) => failure.includes("API development script missing")));
});

function makeWorkspace(options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ninery-doctor-"));
  for (const folder of ["apps/web", "apps/api", "packages/database/prisma", "packages/player-intelligence", "packages/equipment-intelligence", "packages/recommendation-intelligence"]) {
    fs.mkdirSync(path.join(root, folder), { recursive: true });
  }
  if (options.nodeModules) fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  if (options.prismaClient) fs.mkdirSync(path.join(root, "node_modules/@prisma/client"), { recursive: true });
  fs.writeFileSync(path.join(root, "packages/database/prisma/schema.prisma"), "");
  fs.writeFileSync(path.join(root, "apps/api/package.json"), JSON.stringify({ scripts: options.apiDev ? { dev: "tsx watch src/main.ts" } : {} }));
  fs.writeFileSync(path.join(root, "apps/web/package.json"), JSON.stringify({ scripts: options.webDev ? { dev: "next dev" } : {} }));
  return root;
}
