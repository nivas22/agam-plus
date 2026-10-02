import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

async function bootstrap() {
  // rawBody keeps the unparsed request bytes around for the WhatsApp webhook,
  // whose X-Hub-Signature-256 HMAC is computed over exactly what Meta sent.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') ?? true,
  });

  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
