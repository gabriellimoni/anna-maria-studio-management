import { Global, Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Global()
@Module({})
export class FirebaseModule implements OnApplicationBootstrap {
  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    if (admin.apps.length > 0) return;

    const credentials = this.config.get<string>('FIREBASE_CREDENTIALS');
    if (!credentials) {
      throw new Error('FIREBASE_CREDENTIALS env var is required');
    }

    const serviceAccount = JSON.parse(
      Buffer.from(credentials, 'base64').toString('utf8'),
    ) as admin.ServiceAccount;

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
}
