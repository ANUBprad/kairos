import { parsers } from "./parsers";
import type { ExtractionResult } from "./types";

export async function extractText(
  buffer: ArrayBuffer | SharedArrayBuffer,
  fileType: string,
): Promise<ExtractionResult> {
  if (buffer.byteLength === 0) {
    throw new Error("Cannot extract text from empty buffer (0 bytes)");
  }

  const parser = parsers.find((p) => p.supports(fileType));
  if (!parser) {
    throw new Error(`No parser available for file type: ${fileType}`);
  }
  return parser.parse(buffer as unknown as ArrayBuffer, fileType);
}

export type { ExtractionResult, FileParser } from "./types";
