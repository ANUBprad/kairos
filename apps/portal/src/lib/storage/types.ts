export interface StorageFile {
  key: string;
  url: string;
  provider: string;
}

export interface StorageProvider {
  upload(buffer: Buffer, fileName: string, path?: string): Promise<StorageFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
