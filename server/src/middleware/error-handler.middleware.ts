import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../types/app-error.js";
import { getZodFieldErrors } from "../utils/zod-error.js";
import { logger } from "../lib/logger.js";

/**
 * Global Express error handling middleware. Formats Application errors, Zod validation failures,
 * Multer upload errors, and Cloudinary permission errors into standardized JSON responses.
 *
 * @param error - Encountered error or exception
 * @param _req - Express request object
 * @param res - Express response object
 * @param _next - Express next function
 */
export function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    const requestId = req.requestId;
    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            error: error.message,
            ...(requestId ? { requestId } : {}),
            ...(error.details ? { details: error.details } : {}),
        });
        return;
    }

    if (error instanceof ZodError) {
        res.status(400).json({
            error: "Validation failed",
            details: getZodFieldErrors(error),
        });
        return;
    }

    if (error instanceof multer.MulterError) {
        res.status(400).json({ error: error.message });
        return;
    }

    if (
        error instanceof Error &&
        (error.message === "Only PDF files are allowed" ||
            error.message === "Only image files are allowed")
    ) {
        res.status(400).json({ error: error.message });
        return;
    }

    const cloudinaryError = error as Error & { http_code?: number; name?: string };
    if (
        cloudinaryError.name === "UnexpectedResponse" &&
        cloudinaryError.http_code === 403
    ) {
        // Operational guidance is logged for the owner, never returned to a
        // client: dashboard paths and key-permission details are internal.
        logger.warn("Cloudinary rejected an upload (403)", {
            httpCode: cloudinaryError.http_code,
            name: cloudinaryError.name,
        });
        res.status(400).json({ error: "Cloudinary rejected the upload." });
        return;
    }

    // Operational SQL/enum hints are logged only. Structured errors above may
    // carry safe details; unexpected 500s must never leak internals to clients.
    logger.error("Unhandled request error", {
        error: error instanceof Error ? error.message : String(error),
        requestId,
    });
    res.status(500).json({
        error: "Internal server error",
        ...(requestId ? { requestId } : {}),
    });
}