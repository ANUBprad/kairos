import type { NextFunction, Request, Response } from "express";
import { ValidationError } from "../types/app-error.js";

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function asciiAt(buffer: Buffer, offset: number, text: string): boolean {
  if (buffer.length < offset + text.length) return false;
  return buffer.subarray(offset, offset + text.length).toString("ascii") === text;
}

function isPdf(buffer: Buffer): boolean {
  return startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
}

function isImage(buffer: Buffer): boolean {
  return (
    startsWith(buffer, [0xff, 0xd8, 0xff]) || // JPEG
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || // PNG
    asciiAt(buffer, 0, "GIF87a") ||
    asciiAt(buffer, 0, "GIF89a") ||
    (asciiAt(buffer, 0, "RIFF") && asciiAt(buffer, 8, "WEBP")) ||
    asciiAt(buffer, 0, "BM") || // BMP
    startsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) || // TIFF
    startsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a]) ||
    asciiAt(buffer, 4, "ftyp") // HEIC/HEIF/AVIF containers
  );
}

/** Rejects PDF uploads whose bytes are not actually a PDF header. */
export function requirePdfMagicBytes(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.file?.buffer || !isPdf(req.file.buffer)) {
    next(new ValidationError("Uploaded file is not a valid PDF"));
    return;
  }
  next();
}

/** Rejects image uploads whose bytes do not match a supported image signature. */
export function requireImageMagicBytes(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.file?.buffer || !isImage(req.file.buffer)) {
    next(new ValidationError("Uploaded file is not a valid image"));
    return;
  }
  next();
}
