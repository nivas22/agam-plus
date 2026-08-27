import type { IncomingMessage, ServerResponse } from 'http';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

// Vercel-only entrypoint: adapts the standard Nest app (src/main.ts) to a
// single serverless function. Delete this file (and vercel.json) if the
// API moves to a long-running host like AWS/GCP — src/ needs no changes.
// Kept in sync with src/main.ts's app.enableCors/useGlobalFilters, since
// Vercel runs this file instead of main.ts's bootstrap.
const server = express();
let appInitialized: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') ?? true,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!appInitialized) {
    appInitialized = bootstrap();
  }
  await appInitialized;
  server(req, res);
}
