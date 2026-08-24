import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') ?? true,
  });

  app.useGlobalFilters(new ApiExceptionFilter());

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
