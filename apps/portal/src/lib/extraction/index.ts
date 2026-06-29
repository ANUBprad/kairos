import { parsers } from "./parsers";
import type { ExtractionResult } from "./types";

export async function extractText(
  buffer: ArrayBuffer,
  fileType: string,
): Promise<ExtractionResult> {
  const parser = parsers.find((p) => p.supports(fileType));
  if (!parser) {
    throw new Error(`No parser available for file type: ${fileType}`);
  }
  return parser.parse(buffer, fileType);
}

export type { ExtractionResult, FileParser } from "./types";
