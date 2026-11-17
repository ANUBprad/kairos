import type { StorageProvider } from "./types";
import { CloudinaryStorageProvider } from "./cloudinary";
import { LocalStorageProvider } from "./local";

function createProvider(): StorageProvider {
  const cloudinaryValues = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  ];
  const configuredCloudinary = cloudinaryValues.filter(Boolean).length;

  if (configuredCloudinary === cloudinaryValues.length) {
    return new CloudinaryStorageProvider();
  }

  if (configuredCloudinary > 0) {
    throw new Error(
      "Cloudinary is only partially configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET together, or clear all three to use local development storage.",
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Cloudinary is required in production. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET. Local disk storage is intended for development only.",
    );
  }

  return new LocalStorageProvider();
}

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    _provider = createProvider();
  }
  return _provider;
}

export { CloudinaryStorageProvider, LocalStorageProvider };
export type { StorageFile, StorageProvider } from "./types";
