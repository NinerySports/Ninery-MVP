process.env.NODE_ENV = "production";
const { bootstrap } = await import("../dist/main.js");
await bootstrap();
