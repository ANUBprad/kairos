
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { ValidationError } from "../types/app-error.js";
import { logger } from "./logger.js";

const UPLOAD_TIMEOUT_MS = 30_000;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Object ids must not be derived from the client filename alone: two users
 * uploading "notes.pdf" would otherwise target the same object and one could
 * overwrite the other's file. A random suffix makes each upload distinct, and
 * `overwrite: false` is a second line of defence.
 */
function buildUniquePublicId(filename: string): string {
    const base = filename
        .replace(/\.[^/.]+$/, "")
        .replace(/[^A-Za-z0-9_-]/g, "_")
        .slice(0, 80);
    return `${base || "upload"}_${randomUUID()}`;
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
// Never fall back to a hardcoded preset owned by a third party. The unsigned
// fallback is only used when signed credentials are unavailable, and then the
// operator must supply their own preset explicitly.
const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

type StorageErrorDetails = {
    code: string;
    provider: "cloudinary";
    operation: string;
    field?: string;
    missing?: string[];
    status?: number;
};

function storageError(
    message: string,
    details: StorageErrorDetails,
    cause?: unknown,
): ValidationError {
    const error = new ValidationError(message, details);
    if (cause !== undefined) Object.assign(error, { cause });
    return error;
}

function requireUploadPreset(): string {
    if (!uploadPreset?.trim()) {
        throw storageError(
            "CLOUDINARY_UPLOAD_PRESET is required for unsigned uploads when signed credentials are unavailable.",
            {
                code: "STORAGE_NOT_CONFIGURED",
                provider: "cloudinary",
                operation: "pdf.unsigned.upload",
                missing: ["CLOUDINARY_UPLOAD_PRESET"],
            },
        );
    }
    return uploadPreset;
}

/**
 * Validates the normalized fields Kairos actually needs. `bytes` is optional
 * because Cloudinary may omit it for some raw responses; keeping it optional
 * avoids rejecting an otherwise valid upload for a non-essential field.
 */
function normalizeUploadResult(
    result: CloudinaryUploadResponse | null | undefined,
    filename: string,
    fallbackBytes: number,
    operation: string,
): CloudinaryUploadResult {
    if (!result || typeof result !== "object") {
        throw storageError("Cloudinary returned an empty upload response.", {
            code: "STORAGE_RESPONSE_INVALID",
            provider: "cloudinary",
            operation,
            field: "response",
        });
    }
    if (
        typeof result.secure_url !== "string" ||
        !/^https:\/\//i.test(result.secure_url)
    ) {
        throw storageError("Cloudinary upload response is missing a secure URL.", {
            code: "STORAGE_RESPONSE_INVALID",
            provider: "cloudinary",
            operation,
            field: "secure_url",
        });
    }
    if (typeof result.public_id !== "string" || result.public_id.length === 0) {
        throw storageError("Cloudinary upload response is missing a public id.", {
            code: "STORAGE_RESPONSE_INVALID",
            provider: "cloudinary",
            operation,
            field: "public_id",
        });
    }

    const bytes =
        typeof result.bytes === "number" &&
        Number.isFinite(result.bytes) &&
        result.bytes >= 0
            ? result.bytes
            : fallbackBytes;

    return {
        secureUrl: result.secure_url,
        publicId: result.public_id,
        bytes,
        originalFilename: filename,
        resourceType: result.resource_type === "image" ? "image" : "raw",
    };
}

/** Normalized result returned after a successful Cloudinary upload. */
export type CloudinaryUploadResult = {
    secureUrl: string;
    publicId: string;
    bytes: number;
    originalFilename: string;
    resourceType: "raw" | "image";
};

type CloudinaryUploadResponse = {
    secure_url: string;
    public_id: string;
    bytes: number;
    resource_type?: string;
    error?: { message: string };
};

/**
 * Generates a signed, time-restricted Cloudinary download URL for a private asset.
 *
 * @param publicId - Cloudinary asset public identifier
 * @param resourceType - Resource type ("raw" or "image", defaults to "raw")
 * @returns Signed HTTPS asset URL string, or null if API keys are not configured
 */
export function getSignedCloudinaryDownloadUrl(
    publicId: string,
    resourceType: "raw" | "image" = "raw",
) {
    if (!cloudName || !apiKey || !apiSecret) {
        return null;
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    // `expires_at` is ignored by `cloudinary.url()`'s normal `s--...--` signing;
    // only `auth_token` honours it there. Use private_download_url instead so the
    // signed API URL carries a real `expires_at` and a signature over that value.
    // A leaked link then stops working after one hour.
    return cloudinary.utils.private_download_url(publicId, "", {
        resource_type: resourceType,
        type: "upload",
        expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
    });
}

/**
 * Uploads a PDF buffer to Cloudinary.
 * Tries signed upload via SDK first (if API credentials configured),
 * then falls back to unsigned upload preset via REST API.
 *
 * @param buffer - PDF file bytes from Multer
 * @param filename - Original filename (used in the multipart form)
 * @returns Upload metadata including secure URL and public id
 * @throws {ValidationError} When Cloudinary is not configured or upload is rejected
 */
export async function uploadPdfToCloudinary(
    buffer: Buffer,
    filename: string,
): Promise<CloudinaryUploadResult> {
    if (!cloudName) {
        throw storageError(
            "Cloudinary is not configured on the server. Set CLOUDINARY_CLOUD_NAME and either signed API credentials or an unsigned upload preset.",
            {
                code: "STORAGE_NOT_CONFIGURED",
                provider: "cloudinary",
                operation: "pdf.upload",
                missing: ["CLOUDINARY_CLOUD_NAME"],
            },
        );
    }

    // 1. Try signed upload if API Key and Secret are properly configured
    if (apiKey && apiSecret && apiKey !== apiSecret) {
        try {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
                secure: true,
            });

            const base64Data = `data:application/pdf;base64,${buffer.toString("base64")}`;
            const cleanId = buildUniquePublicId(filename);

            const result = await cloudinary.uploader.upload(base64Data, {
                resource_type: "raw",
                folder: "kairos/pdfs",
                public_id: cleanId,
                overwrite: false,
            });

            if (result?.secure_url) {
                return normalizeUploadResult(
                    result,
                    filename,
                    buffer.length,
                    "pdf.signed.upload",
                );
            }
        } catch (signedErr) {
            logger.warn("Cloudinary signed PDF upload failed, attempting unsigned upload", {
                provider: "cloudinary",
                operation: "pdf.signed.upload",
                err: signedErr,
            });
        }
    }

    // 2. Unsigned upload via fetch with upload preset
    const form = new FormData();
    form.append(
        "file",
        new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
        filename,
    );
    form.append("upload_preset", requireUploadPreset());
    form.append("folder", "kairos/pdfs");

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
        { method: "POST", body: form, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) },
    );

    let result: CloudinaryUploadResponse | undefined;
    try {
        result = (await response.json()) as CloudinaryUploadResponse;
    } catch (parseError) {
        throw storageError(
            "Cloudinary returned an unreadable upload response.",
            {
                code: "STORAGE_RESPONSE_INVALID",
                provider: "cloudinary",
                operation: "pdf.unsigned.upload",
                field: "response",
                status: response.status,
            },
            parseError,
        );
    }

    if (!response.ok) {
        const message =
            result?.error?.message ??
            `Cloudinary upload failed (${response.status})`;

        if (response.status === 403) {
            throw storageError(
                "Cloudinary rejected the upload. Check CLOUDINARY_UPLOAD_PRESET matches an unsigned preset in your dashboard.",
                {
                    code: "STORAGE_REJECTED",
                    provider: "cloudinary",
                    operation: "pdf.unsigned.upload",
                    status: 403,
                },
            );
        }

        throw storageError(message, {
            code: "STORAGE_PROVIDER_FAILED",
            provider: "cloudinary",
            operation: "pdf.unsigned.upload",
            status: response.status,
        });
    }

    return normalizeUploadResult(
        result,
        filename,
        buffer.length,
        "pdf.unsigned.upload",
    );
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".heic": "image/heic",
    ".heif": "image/heif",
};

function resolveImageMimeType(filename: string, mimeType?: string) {
    if (mimeType?.startsWith("image/")) {
        return mimeType;
    }

    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    return IMAGE_MIME_BY_EXT[ext] ?? "image/jpeg";
}

/**
 * Uploads an image buffer to Cloudinary (`resource_type: image`).
 */
export async function uploadImageToCloudinary(
    buffer: Buffer,
    filename: string,
    mimeType?: string,
): Promise<CloudinaryUploadResult> {
    if (!cloudName) {
        throw new ValidationError("Cloudinary is not configured on the server");
    }

    const contentType = resolveImageMimeType(filename, mimeType);

    if (apiKey && apiSecret && apiKey !== apiSecret) {
        try {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
                secure: true,
            });

            const base64Data = `data:${contentType};base64,${buffer.toString("base64")}`;
            const cleanId = buildUniquePublicId(filename);

            const result = await cloudinary.uploader.upload(base64Data, {
                resource_type: "image",
                folder: "kairos/images",
                public_id: cleanId,
                overwrite: false,
            });

            if (result?.secure_url) {
                return {
                    secureUrl: result.secure_url,
                    publicId: result.public_id,
                    bytes: result.bytes || buffer.length,
                    originalFilename: filename,
                    resourceType: "image",
                };
            }
        } catch (signedErr) {
            logger.warn("Cloudinary signed image upload failed, attempting unsigned upload", {
                err: signedErr,
            });
        }
    }

    const form = new FormData();
    form.append(
        "file",
        new Blob([new Uint8Array(buffer)], { type: contentType }),
        filename,
    );
    form.append("upload_preset", requireUploadPreset());
    form.append("folder", "kairos/images");

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: form, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) },
    );

    const result = (await response.json()) as CloudinaryUploadResponse;

    if (!response.ok) {
        const message =
            result.error?.message ??
            `Cloudinary image upload failed (${response.status})`;

        if (response.status === 403) {
            throw new ValidationError(
                "Cloudinary rejected the image upload. Check CLOUDINARY_UPLOAD_PRESET in server/.env.",
            );
        }

        throw new ValidationError(message);
    }

    return {
        secureUrl: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        originalFilename: filename,
        resourceType: "image",
    };
}

/**
 * Uploads an MP3 audio buffer to Cloudinary.
 * Tries signed upload via SDK first (if API credentials configured),
 * then falls back to unsigned upload preset via REST API.
 *
 * @param buffer - MP3 audio file bytes
 * @param filename - Filename for the audio file (e.g. podcast.mp3)
 * @returns Upload result with secure URL
 */
export async function uploadAudioToCloudinary(
    buffer: Buffer,
    filename: string,
): Promise<CloudinaryUploadResult> {
    if (!cloudName) {
        throw new ValidationError("Cloudinary is not configured on the server");
    }

    // 1. Try signed upload if API Key and Secret are properly configured
    if (apiKey && apiSecret && apiKey !== apiSecret) {
        try {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
                secure: true,
            });

            const base64Data = `data:audio/mp3;base64,${buffer.toString("base64")}`;
            const cleanId = buildUniquePublicId(filename);

            const result = await cloudinary.uploader.upload(base64Data, {
                resource_type: "video",
                folder: "kairos/podcasts",
                public_id: cleanId,
                overwrite: false,
                format: "mp3",
            });

            if (result?.secure_url) {
                return {
                    secureUrl: result.secure_url,
                    publicId: result.public_id,
                    bytes: result.bytes || buffer.length,
                    originalFilename: filename,
                    resourceType: "raw",
                };
            }
        } catch (signedErr) {
            logger.warn("Cloudinary signed upload failed, attempting unsigned upload", {
                err: signedErr,
            });
        }
    }

    // 2. Unsigned upload via fetch with upload preset
    const form = new FormData();
    form.append(
        "file",
        new Blob([new Uint8Array(buffer)], { type: "audio/mpeg" }),
        filename,
    );
    form.append("upload_preset", requireUploadPreset());
    form.append("folder", "kairos/podcasts");

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        { method: "POST", body: form, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) },
    );

    const result = (await response.json()) as CloudinaryUploadResponse;

    if (!response.ok) {
        // Fallback to raw upload if video/upload fails on preset
        const rawResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
            { method: "POST", body: form, signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS) },
        );
        const rawResult = (await rawResponse.json()) as CloudinaryUploadResponse;
        if (!rawResponse.ok) {
            const message =
                rawResult.error?.message ??
                result.error?.message ??
                `Cloudinary audio upload failed (${response.status})`;
            throw new ValidationError(message);
        }
        return {
            secureUrl: rawResult.secure_url,
            publicId: rawResult.public_id,
            bytes: rawResult.bytes,
            originalFilename: filename,
            resourceType: "raw",
        };
    }

    return {
        secureUrl: result.secure_url,
        publicId: result.public_id,
        bytes: result.bytes,
        originalFilename: filename,
        resourceType: "raw",
    };
}