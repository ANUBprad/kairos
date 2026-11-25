import OpenAI from "openai";
import {
    GEMINI_OCR_MODEL,
    OCR_PROVIDER,
    OPENAI_OCR_MODEL,
} from "../ai-config.js";
import { getSignedCloudinaryDownloadUrl } from "../cloudinary.js";
import { providerFetch } from "../provider-http.js";
import { safeFetchBuffer } from "../safe-fetch.js";

let client: OpenAI | null = null;

function getClient() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error(
            "OPENAI_API_KEY is not configured. Set OCR_PROVIDER=gemini with GEMINI_API_KEY, or configure an OpenAI key.",
        );
    }

    if (!client) {
        client = new OpenAI({ apiKey });
    }

    return client;
}

const OCR_INSTRUCTIONS = `You extract information from images for a research notebook used in Q&A.

Return plain text (markdown lists/headings allowed).
- Transcribe all readable text verbatim, preserving structure.
- For charts, diagrams, slides, or UI screenshots, describe labels, axes, and relationships clearly.
- For photos with little text, describe subjects and details someone might ask about.
- Do not wrap the answer in code fences.`;

export type ImageOcrResult = {
    text: string;
    model: string;
};

function summarizeProviderError(body: string): string {
    const compact = body.replace(/\s+/g, " ").trim();
    return compact.length > 400 ? `${compact.slice(0, 400)}…` : compact || "no response body";
}

async function runGeminiOcr(
    buffer: Buffer,
    mimeType: string,
): Promise<ImageOcrResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY is not configured. Set it to use Gemini OCR, or set OCR_PROVIDER=openai with OPENAI_API_KEY.",
        );
    }

    const normalizedMime = mimeType.startsWith("image/") ? mimeType : "image/jpeg";
    const response = await providerFetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_OCR_MODEL)}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: OCR_INSTRUCTIONS },
                            {
                                inline_data: {
                                    mime_type: normalizedMime,
                                    data: buffer.toString("base64"),
                                },
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 4096,
                },
            }),
        },
    );

    if (!response.ok) {
        const detail = summarizeProviderError(await response.text());
        if (response.status === 429 || /quota|rate limit/i.test(detail)) {
            throw new Error(
                `Gemini OCR quota or rate limit reached (${response.status}): ${detail}`,
            );
        }
        throw new Error(`Gemini OCR request failed (${response.status}): ${detail}`);
    }

    const payload = (await response.json()) as {
        candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
        }>;
    };
    const text = (payload.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("\n")
        .trim();

    if (!text) {
        throw new Error("No text or description could be extracted from the image");
    }

    return { text, model: GEMINI_OCR_MODEL };
}

async function runVisionOcr(imageUrl: string): Promise<ImageOcrResult> {
    const response = await getClient().chat.completions.create({
        model: OPENAI_OCR_MODEL,
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: OCR_INSTRUCTIONS },
                    {
                        type: "image_url",
                        image_url: { url: imageUrl, detail: "high" },
                    },
                ],
            },
        ],
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";

    if (!text) {
        throw new Error("No text or description could be extracted from the image");
    }

    return { text, model: OPENAI_OCR_MODEL };
}

/**
 * OCR / describe an image from an in-memory buffer using the configured vision provider.
 */
export async function extractTextFromImageBuffer(
    buffer: Buffer,
    mimeType: string,
): Promise<ImageOcrResult> {
    const normalizedMime =
        mimeType?.startsWith("image/") ? mimeType : "image/jpeg";

    if (OCR_PROVIDER === "gemini") {
        return runGeminiOcr(buffer, normalizedMime);
    }

    const dataUrl = `data:${normalizedMime};base64,${buffer.toString("base64")}`;
    return runVisionOcr(dataUrl);
}

async function downloadImage(url: string) {
    const { buffer, contentType } = await safeFetchBuffer(url, {
        maxBytes: 15 * 1024 * 1024,
        timeoutMs: 20_000,
        allowedContentTypes: ["image/"],
    });
    return {
        buffer,
        contentType: contentType.startsWith("image/") ? contentType : "image/jpeg",
    };
}

/**
 * Downloads an image from Cloudinary (with signed URL fallback) and runs vision OCR.
 */
export async function extractTextFromCloudinaryImage(input: {
    fileUrl: string;
    publicId?: string;
    mimeType?: string;
}): Promise<ImageOcrResult> {
    try {
        const { buffer, contentType } = await downloadImage(input.fileUrl);
        return extractTextFromImageBuffer(
            buffer,
            input.mimeType ?? contentType,
        );
    } catch (error) {
        const isUnauthorized =
            error instanceof Error && error.message.includes("(401)");

        if (!isUnauthorized || !input.publicId) {
            throw error;
        }

        const signedUrl = getSignedCloudinaryDownloadUrl(
            input.publicId,
            "image",
        );

        if (!signedUrl) {
            throw new Error(
                "Image download requires authentication. Add CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET, or re-upload the image.",
            );
        }

        const { buffer, contentType } = await downloadImage(signedUrl);
        return extractTextFromImageBuffer(
            buffer,
            input.mimeType ?? contentType,
        );
    }
}
