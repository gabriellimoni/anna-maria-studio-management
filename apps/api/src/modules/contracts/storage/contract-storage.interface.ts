export const CONTRACT_STORAGE = 'CONTRACT_STORAGE';

export interface ContractStorageProvider {
  save(key: string, buffer: Buffer, contentType: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  createReadStream(key: string): NodeJS.ReadableStream;
  delete(key: string): Promise<void>;
}
