import { NestFactory } from "@nestjs/core";
import { pathToFileURL } from "node:url";
import { AppModule } from "./app.module.js";
import { getApiPort, isProduction, validateApiEnvironment } from "./config/environment.js";

export async function bootstrap() {
  const environment = validateApiEnvironment();
  if (!environment.ok) {
    console.error("Ninery API environment check failed");
    for (const message of environment.messages) {
      console.error(`- ${message}`);
    }
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.create(AppModule);

  app.enableCors({
  origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

  const port = getApiPort();
  await app.listen(port);

  const baseUrl = `http://localhost:${port}`;
  const developmentRoutesEnabled = !isProduction();
  console.log("");
  console.log("Ninery API started");
  console.log("");
  console.log(`Local:`);
  console.log(baseUrl);
  console.log("");
  console.log(`Health:`);
  console.log(`${baseUrl}/health`);
  if (developmentRoutesEnabled) {
    console.log("");
    console.log(`Demo:`);
    console.log(`${baseUrl}/dev/demo/recommendation`);
    console.warn("Development authorization is active. Replace with family-membership authorization before public launch.");
  }
  console.log("");
  console.log(`Environment: ${process.env.NODE_ENV ?? "development"}`);
  console.log(`Development routes enabled: ${developmentRoutesEnabled ? "yes" : "no"}`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;

if (entrypoint === import.meta.url) {
  void bootstrap();
}
