export type StorageAccessMode = "public" | "authenticated";

export interface StorageUploadOptions {
  accessMode?: StorageAccessMode;
}

export interface StorageFile {
  key: string;
  url: string;
  provider: string;
}

export interface StorageProvider {
  upload(buffer: Buffer, fileName: string, path?: string, options?: StorageUploadOptions): Promise<StorageFile>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
  // Authenticated resources must not be handed a public URL; the media route
  // fetches through a short-lived signed URL server-side so the storage key
  // never reaches the browser.
  getSignedUrl(key: string): Promise<string>;
}