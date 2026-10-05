import { v2 as cloudinary } from "cloudinary";
import type { StorageFile, StorageProvider } from "./types";

const UPLOAD_TIMEOUT_MS = 120_000;
const SIGNED_URL_TTL_SECONDS = 86_400;
const AUTHENTICATED_KEY_PREFIX = "authenticated:";

// Older keys identify upload-type assets. Keep their delivery type intact.
function cloudinaryObject(key: string) {
  return key.startsWith(AUTHENTICATED_KEY_PREFIX)
    ? { publicId: key.slice(AUTHENTICATED_KEY_PREFIX.length), type: "authenticated" as const }
    : { publicId: key, type: "upload" as const };
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryStorageProvider implements StorageProvider {
  async upload(
    buffer: Buffer,
    fileName: string,
    path?: string,
    options?: { accessMode?: "public" | "authenticated" },
  ): Promise<StorageFile> {
    const publicId = path || fileName.replace(/\.[^.]+$/, "");
    const accessMode = options?.accessMode ?? "public";

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        uploadStream.destroy(new Error(`Cloudinary upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`));
        reject(new Error(`Cloudinary upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`));
      }, UPLOAD_TIMEOUT_MS);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "raw",
          type: accessMode === "authenticated" ? "authenticated" : "upload",
        },
        (err, result) => {
          clearTimeout(timer);
          if (err || !result) {
            reject(new Error(err?.message || "Cloudinary upload failed"));
            return;
          }
          resolve({
            key: accessMode === "authenticated" ? `${AUTHENTICATED_KEY_PREFIX}${result.public_id}` : result.public_id,
            url: result.secure_url,
            provider: "cloudinary",
          });
        },
      );

      uploadStream.on("error", (streamErr) => {
        clearTimeout(timer);
        reject(new Error(streamErr.message || "Cloudinary upload stream error"));
      });

      uploadStream.end(buffer);
    });
  }

  async delete(key: string): Promise<void> {
    const { publicId, type } = cloudinaryObject(key);
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw", type });
  }

  getUrl(key: string): string {
    const { publicId, type } = cloudinaryObject(key);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "demo";
    return cloudinary.url(publicId, { cloud_name: cloudName, resource_type: "raw", type, secure: true });
  }

  async getSignedUrl(key: string): Promise<string> {
    const { publicId, type } = cloudinaryObject(key);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "demo";
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!apiSecret) {
      throw new Error("CLOUDINARY_API_SECRET is not configured");
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + SIGNED_URL_TTL_SECONDS;
    const options = {
      cloud_name: cloudName,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: apiSecret,
      resource_type: "raw" as const,
      type,
      expires_at: expiresAt,
      secure: true,
    };
    return cloudinary.utils.private_download_url(publicId, "", options);
  }
}
