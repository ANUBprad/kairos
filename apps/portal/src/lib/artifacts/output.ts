import type { z } from "zod";

export interface ParseSuccess<T> {
  ok: true;
  data: T;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

// Extracts the first balanced JSON object from model output, tolerating code
// fences and surrounding prose. Returns null when there is nothing parseable.
export function extractJsonObject(content: string): unknown | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = fenced ? fenced[1] : content;

  const start = body.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const slice = body.slice(start, i + 1);
        try {
          return JSON.parse(slice);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function parseStructuredOutput<S extends z.ZodTypeAny>(
  schema: S,
  content: string,
): ParseResult<z.infer<S>> {
  const raw = extractJsonObject(content);
  if (raw === null) {
    return { ok: false, error: "No valid JSON object found in model output" };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: "Model output did not match the artifact schema" };
  }
  return { ok: true, data: result.data };
}