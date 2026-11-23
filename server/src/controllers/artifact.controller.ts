import fs from "fs";
import path from "path";
import type { Request, Response } from "express";
import {
    createArtifactForWorkspace,
    deleteArtifactForWorkspace,
    getArtifactForWorkspace,
    listArtifactsForWorkspace,
    retryArtifactForWorkspace,
} from "../services/artifact.services.js";
import { processPodcastInterruption } from "../services/podcast-interruption.services.js";
import { findArtifactByIdAndWorkspaceId } from "../repository/artifact.repository.js";
import { getWorkspaceByIdForUser } from "../services/workspace.services.js";
import { NotFoundError } from "../types/app-error.js";
import {
    artifactIdParamSchema,
    createArtifactSchema,
    podcastInterruptionSchema,
} from "../validators/artifact.validator.js";
import { workspaceIdParamSchema } from "../validators/workspace.validator.js";
import {
    InvalidByteRangeError,
    parseByteRange,
} from "../lib/http-range.js";

/**
 * Handles HTTP GET request to list all learning artifacts in a workspace.
 *
 * @param req - Express request with workspaceId URL param
 * @param res - Express response returning array of artifact records
 */
export async function listArtifacts(req: Request, res: Response) {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const artifacts = await listArtifactsForWorkspace(
        workspaceId,
        req.session.user.id,
    );
    res.json(artifacts);
}

/**
 * Handles HTTP GET request to retrieve a single artifact by ID.
 *
 * @param req - Express request with workspaceId and artifactId params
 * @param res - Express response returning artifact record
 */
export async function getArtifact(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    const artifact = await getArtifactForWorkspace(
        workspaceId,
        artifactId,
        req.session.user.id,
    );
    res.json(artifact);
}

/**
 * Handles HTTP POST request to initiate background generation of a learning artifact (summary, quiz, podcast, etc.).
 *
 * @param req - Express request with creation payload
 * @param res - Express response returning 201 Created with PENDING artifact record
 */
export async function createArtifact(req: Request, res: Response) {
    const { workspaceId } = workspaceIdParamSchema.parse(req.params);
    const input = createArtifactSchema.parse(req.body);
    const artifact = await createArtifactForWorkspace(
        workspaceId,
        req.session.user.id,
        input,
    );
    res.status(201).json(artifact);
}

/**
 * Handles HTTP DELETE request to remove an artifact from a workspace.
 *
 * @param req - Express request with workspaceId and artifactId params
 * @param res - Express response returning 204 No Content
 */
export async function deleteArtifact(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    await deleteArtifactForWorkspace(
        workspaceId,
        artifactId,
        req.session.user.id,
    );
    res.status(204).send();
}

/**
 * Handles HTTP POST request to retry generation for a failed artifact.
 */
export async function retryArtifact(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    const artifact = await retryArtifactForWorkspace(
        workspaceId,
        artifactId,
        req.session.user.id,
    );
    res.json(artifact);
}

/**
 * Handles HTTP POST request for live "Interrupt & Ask" interactions during podcast audio playback.
 *
 * @param req - Express request containing listener question and current playback timestamp
 * @param res - Express response returning synthesized interruption dialogue and audio URL
 */
export async function interruptPodcast(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    const { question, timestamp } = podcastInterruptionSchema.parse(req.body);

    const interruption = await processPodcastInterruption({
        artifactId,
        workspaceId,
        userId: req.session.user.id,
        question,
        timestamp,
    });

    res.json(interruption);
}

function respondInvalidRange(res: Response, totalSize: number): void {
    res.setHeader("Content-Range", `bytes */${totalSize}`);
    res.status(416).end();
}

/**
 * Handles HTTP GET request for direct byte-range audio streaming of generated podcasts and interruptions.
 * Supports HTTP 206 Partial Content for instant seeking and audio scrubbing.
 *
 * @param req - Express request with workspaceId, artifactId, and optional interruptionId query param
 * @param res - Express binary audio stream response
 * @throws {NotFoundError} When podcast or interruption audio cannot be located
 */
export async function streamPodcastAudio(req: Request, res: Response) {
    const { workspaceId, artifactId } = artifactIdParamSchema.parse(req.params);
    const interruptionId = req.query.interruptionId as string | undefined;

    // Verify workspace ownership before touching audio content so a leaked
    // workspace/artifact id cannot be used to stream another user's podcast.
    await getWorkspaceByIdForUser(workspaceId, req.session.user.id);

    const artifact = await findArtifactByIdAndWorkspaceId(
        artifactId,
        workspaceId,
    );

    if (!artifact) {
        throw new NotFoundError("Artifact not found");
    }

    const content = (artifact.content as Record<string, unknown>) || {};
    const podcast = (content.podcast as Record<string, unknown>) || {};

    let audioBase64: string | undefined;
    let audioUrl: string | undefined;

    if (interruptionId) {
        const interruptions =
            (podcast.interruptions as Array<Record<string, unknown>>) || [];
        const item = interruptions.find((i) => i.id === interruptionId);
        if (item) {
            audioBase64 = item.audioBase64 as string | undefined;
            audioUrl = item.audioUrl as string | undefined;
        }
    } else {
        audioBase64 =
            (podcast.audioBase64 as string | undefined) ||
            ((artifact.metadata as Record<string, unknown>)?.audioBase64 as string | undefined);
        audioUrl = podcast.audioUrl as string | undefined;
    }

    // 1. If audioBase64 is stored in database, stream directly with Range support
    if (audioBase64) {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        const totalSize = audioBuffer.length;
        const range = req.headers.range;

        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Accept-Ranges", "bytes");

        let byteRange: { start: number; end: number } | null;
        try {
            byteRange = parseByteRange(range, totalSize);
        } catch (error) {
            if (error instanceof InvalidByteRangeError) {
                respondInvalidRange(res, totalSize);
                return;
            }
            throw error;
        }

        if (byteRange) {
            const chunkSize = byteRange.end - byteRange.start + 1;
            res.status(206);
            res.setHeader(
                "Content-Range",
                `bytes ${byteRange.start}-${byteRange.end}/${totalSize}`,
            );
            res.setHeader("Content-Length", chunkSize);
            res.end(audioBuffer.subarray(byteRange.start, byteRange.end + 1));
            return;
        }

        res.setHeader("Content-Length", totalSize);
        res.end(audioBuffer);
        return;
    }

    // 2. If audioUrl points to local file in uploads/podcasts/
    if (audioUrl && audioUrl.includes("/uploads/podcasts/")) {
        const filename = path.basename(audioUrl.split("?")[0]);
        const filePath = path.join(process.cwd(), "uploads", "podcasts", filename);
        if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath);
            const totalSize = stat.size;
            const range = req.headers.range;

            res.setHeader("Content-Type", "audio/mpeg");
            res.setHeader("Accept-Ranges", "bytes");

            let byteRange: { start: number; end: number } | null;
            try {
                byteRange = parseByteRange(range, totalSize);
            } catch (error) {
                if (error instanceof InvalidByteRangeError) {
                    respondInvalidRange(res, totalSize);
                    return;
                }
                throw error;
            }

            if (byteRange) {
                const chunkSize = byteRange.end - byteRange.start + 1;
                res.status(206);
                res.setHeader(
                    "Content-Range",
                    `bytes ${byteRange.start}-${byteRange.end}/${totalSize}`,
                );
                res.setHeader("Content-Length", chunkSize);
                fs.createReadStream(filePath, {
                    start: byteRange.start,
                    end: byteRange.end,
                }).pipe(res);
                return;
            }

            res.setHeader("Content-Length", totalSize);
            fs.createReadStream(filePath).pipe(res);
            return;
        }
    }

    // 3. If external remote URL (Cloudinary / CDN), redirect
    if (audioUrl && (audioUrl.startsWith("http://") || audioUrl.startsWith("https://"))) {
        res.redirect(audioUrl);
        return;
    }

    throw new NotFoundError("Audio content not found for this podcast.");
}

