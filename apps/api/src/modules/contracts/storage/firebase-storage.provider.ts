import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { ContractStorageProvider } from './contract-storage.interface';

@Injectable()
export class FirebaseStorageProvider implements ContractStorageProvider {
  private _bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']> | null = null;
  private readonly bucketName: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.bucketName = this.config.get<string>('FIREBASE_STORAGE_BUCKET');
  }

  private get bucket() {
    if (!this._bucket) {
      this._bucket = admin.storage().bucket(this.bucketName);
    }
    return this._bucket;
  }

  async save(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const file = this.bucket.file(key);
    await file.save(buffer, {
      contentType,
      resumable: false,
      metadata: { cacheControl: 'private, max-age=0, no-store' },
    });
    return key;
  }

  async read(key: string): Promise<Buffer> {
    try {
      const [buf] = await this.bucket.file(key).download();
      return buf;
    } catch {
      throw new NotFoundException(`Storage object not found: ${key}`);
    }
  }

  createReadStream(key: string): NodeJS.ReadableStream {
    return this.bucket.file(key).createReadStream();
  }

  async delete(key: string): Promise<void> {
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }
}
