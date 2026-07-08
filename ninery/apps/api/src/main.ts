import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

@Module({})
class AppModule {}

export async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}

if (require.main === module) {
  void bootstrap();
}
