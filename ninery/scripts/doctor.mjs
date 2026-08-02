import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnvironment, validateEnvironment } from "./env-check.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function runDoctor({ root = rootDir } = {}) {
  const checks = [];
  const failures = [];
  const warnings = [];
  const pass = (message) => checks.push(message);
  const fail = (message) => failures.push(message);
  const warn = (message) => warnings.push(message);

  const node = spawnSync("node", ["--version"], { encoding: "utf8" });
  if (node.status === 0) pass(`Node detected (${node.stdout.trim()})`);
  else fail("Node is not available on PATH");

  const pnpm = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", "pnpm.cmd --version"], { encoding: "utf8" })
    : spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (pnpm.status === 0) pass(`pnpm detected (${pnpm.stdout.trim()})`);
  else fail("pnpm is not available on PATH");

  for (const folder of ["apps/web", "apps/api", "packages/database", "packages/player-intelligence", "packages/equipment-intelligence", "packages/recommendation-intelligence"]) {
    if (fs.existsSync(path.join(root, folder))) pass(`${folder} exists`);
    else fail(`${folder} is missing`);
  }

  for (const packageFile of ["apps/web/package.json", "apps/api/package.json", "packages/database/package.json"]) {
    if (fs.existsSync(path.join(root, packageFile))) pass(`${packageFile} exists`);
    else fail(`${packageFile} is missing`);
  }

  if (fs.existsSync(path.join(root, "node_modules"))) pass("node_modules present");
  else fail("node_modules missing; run pnpm install");

  if (fs.existsSync(path.join(root, "node_modules/@prisma/client")) || fs.existsSync(path.join(root, "packages/database/node_modules/@prisma/client"))) {
    pass("Prisma Client package available");
  } else {
    fail("Prisma Client unavailable; run pnpm db:generate after pnpm install");
  }

  const env = validateEnvironment(loadEnvironment({ root }));
  if (env.ok) pass("Environment configuration valid");
  else for (const item of env.failures) fail(`Environment: ${item}`);
  for (const item of env.warnings ?? []) warn(`Environment: ${item}`);

  const apiPackage = readPackage(root, "apps/api/package.json");
  const webPackage = readPackage(root, "apps/web/package.json");
  if (apiPackage?.scripts?.dev) pass("API development script configured");
  else fail("API development script missing");
  if (webPackage?.scripts?.dev) pass("Web development script configured");
  else fail("Web development script missing");

  if (fs.existsSync(path.join(root, "packages/database/prisma/schema.prisma"))) {
    warn("Database connectivity not tested by doctor");
  } else {
    fail("Prisma schema missing");
  }

  return { ok: failures.length === 0, checks, warnings, failures };
}

export function formatDoctorReport(result) {
  return [
    "Ninery Doctor",
    "",
    ...result.checks.map((check) => `✓ ${check}`),
    ...result.warnings.map((warning) => `! ${warning}`),
    ...result.failures.map((failure) => `✗ ${failure}`)
  ].join("\n");
}

function readPackage(root, relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch {
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runDoctor();
  console.log(formatDoctorReport(result));
  process.exitCode = result.ok ? 0 : 1;
}
