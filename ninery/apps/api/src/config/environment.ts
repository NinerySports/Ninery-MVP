export type ApiEnvironmentCheck = {
  ok: boolean;
  messages: string[];
};

export function validateApiEnvironment(env: NodeJS.ProcessEnv = process.env): ApiEnvironmentCheck {
  const messages: string[] = [];
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl || databaseUrl.trim() === "") {
    messages.push("DATABASE_URL is required.");
  } else {
    try {
      const parsed = new URL(databaseUrl);
      if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
        messages.push("DATABASE_URL must use the postgresql:// protocol.");
      }
      if (!parsed.hostname) {
        messages.push("DATABASE_URL must include a database host.");
      }
      if (databaseUrl.includes("YOUR_PASSWORD") || databaseUrl.includes("PASSWORD")) {
        messages.push("DATABASE_URL appears to contain placeholder credentials.");
      }
    } catch {
      messages.push("DATABASE_URL is not a valid URL.");
    }
  }

  const port = env.PORT;
  if (port !== undefined && (!/^\d+$/.test(port) || Number(port) <= 0 || Number(port) > 65535)) {
    messages.push("PORT must be a number between 1 and 65535.");
  }

  return {
    ok: messages.length === 0,
    messages
  };
}

export function getApiPort(env: NodeJS.ProcessEnv = process.env): number {
  return env.PORT ? Number(env.PORT) : 3001;
}

export function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}
