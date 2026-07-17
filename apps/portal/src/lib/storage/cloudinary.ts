import { v2 as cloudinary } from "cloudinary";
import type { StorageFile, StorageProvider } from "./types";

const UPLOAD_TIMEOUT_MS = 120_000;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryStorageProvider implements StorageProvider {
  async upload(buffer: Buffer, fileName: string, path?: string): Promise<StorageFile> {
    const publicId = path || fileName.replace(/\.[^.]+$/, "");

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        uploadStream.destroy(new Error(`Cloudinary upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`));
        reject(new Error(`Cloudinary upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`));
      }, UPLOAD_TIMEOUT_MS);

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "raw",
          access_mode: "public",
        },
        (err, result) => {
          clearTimeout(timer);
          if (err || !result) {
            reject(new Error(err?.message || "Cloudinary upload failed"));
            return;
          }
          resolve({
            key: result.public_id,
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
    await cloudinary.uploader.destroy(key, { resource_type: "raw" });
  }

  getUrl(key: string): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "demo";
    return `https://res.cloudinary.com/${cloudName}/raw/upload/${key}`;
  }
}
