import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FIREBASE_AUTH } from './firebase.constants';

// Firebase is used only to verify Google ID tokens at login (see
// auth.service.ts). Application data lives in MongoDB (see database.module.ts) —
// this module no longer exposes a Firestore provider.
@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_ADMIN_APP',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const projectId = config.get<string>('FIREBASE_PROJECT_ID');
        const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
        const privateKey = config
          .get<string>('FIREBASE_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n');

        if (!projectId || !clientEmail || !privateKey) {
          throw new Error('Missing Firebase service account environment variables.');
        }

        if (!admin.apps.length) {
          return admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
          });
        }
        return admin.apps[0];
      },
    },
    {
      provide: FIREBASE_AUTH,
      inject: ['FIREBASE_ADMIN_APP'],
      useFactory: (app: admin.app.App) => app.auth(),
    },
  ],
  exports: [FIREBASE_AUTH],
})
export class FirebaseModule {}
