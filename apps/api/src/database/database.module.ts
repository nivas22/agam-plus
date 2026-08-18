import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// Connection is created once per Nest app instance; apps/api/api/index.ts
// memoizes bootstrap() at module scope so this is naturally reused across
// warm Vercel invocations, mirroring the admin.apps.length guard in
// firebase.module.ts. maxPoolSize is kept low since each concurrent
// serverless instance opens its own pool.
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error('Missing MONGODB_URI environment variable.');
        }

        return {
          uri,
          dbName: config.get<string>('MONGODB_DB_NAME'),
          maxPoolSize: 5,
          minPoolSize: 0,
          serverSelectionTimeoutMS: 5000,
          bufferCommands: false,
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
