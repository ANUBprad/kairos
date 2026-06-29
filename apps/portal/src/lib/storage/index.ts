import type { StorageProvider } from "./types";
import { CloudinaryStorageProvider } from "./cloudinary";

function createProvider(): StorageProvider {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.",
    );
  }

  return new CloudinaryStorageProvider();
}

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    _provider = createProvider();
  }
  return _provider;
}

export { CloudinaryStorageProvider };
export type { StorageFile, StorageProvider } from "./types";
