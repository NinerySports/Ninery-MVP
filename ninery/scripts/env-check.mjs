import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnvFile(filePath = path.join(rootDir, ".env")) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
  return env;
}

export function loadEnvironment({ root = rootDir, processEnv = process.env } = {}) {
  return {
    ...loadEnvFile(path.join(root, "packages/database/.env")),
    ...loadEnvFile(path.join(root, ".env")),
    ...processEnv
  };
}

export function validateEnvironment(env = loadEnvironment()) {
  const checks = [];
  const warnings = [];
  const failures = [];
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim() === "") {
    failures.push("DATABASE_URL missing");
  } else {
    checks.push("DATABASE_URL present");
    if (/YOUR_|PASSWORD|CHANGE_ME|REPLACE_ME/i.test(databaseUrl)) {
      failures.push("DATABASE_URL contains placeholder text");
    } else {
      checks.push("No placeholder values detected");
    }

    try {
      const parsed = new URL(databaseUrl);
      if (["postgresql:", "postgres:"].includes(parsed.protocol)) {
        checks.push("PostgreSQL protocol detected");
      } else {
        failures.push("DATABASE_URL must use postgresql://");
      }
      if (parsed.hostname) checks.push("Database host configured");
      else failures.push("Database host missing");

      const schema = parsed.searchParams.get("schema");
      if (schema === "ninery_dev") {
        checks.push("Development schema configured");
      } else if (!schema) {
        warnings.push("DATABASE_URL has no schema parameter; ninery_dev is recommended for local development");
      } else {
        checks.push(`Schema configured (${schema})`);
      }

      if (parsed.hostname.includes("supabase.co") && !parsed.hostname.includes("pooler")) {
        warnings.push("Supabase direct host detected; the documented local setup prefers the Session pooler");
      }
    } catch {
      failures.push("DATABASE_URL is malformed");
    }
  }

  const port = env.PORT;
  if (port !== undefined && port !== "" && (!/^\d+$/.test(port) || Number(port) <= 0 || Number(port) > 65535)) {
    failures.push("PORT must be a number between 1 and 65535");
  } else if (port) {
    checks.push("PORT valid");
  }

  if (env.NODE_ENV) checks.push("NODE_ENV configured");
  if (env.WEB_ORIGIN) checks.push("WEB_ORIGIN configured");

  return { ok: failures.length === 0, checks, warnings, failures };
}

export function formatEnvironmentReport(result) {
  return [
    "Environment check",
    "",
    ...result.checks.map((check) => `✓ ${check}`),
    ...(result.warnings ?? []).map((warning) => `! ${warning}`),
    ...result.failures.map((failure) => `✗ ${failure}`)
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateEnvironment();
  console.log(formatEnvironmentReport(result));
  process.exitCode = result.ok ? 0 : 1;
}
