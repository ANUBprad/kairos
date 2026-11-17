import { logger } from "@/lib/logger";
import type { FileParser, ExtractionResult } from "./types";

class TextParser implements FileParser {
  supports(fileType: string) {
    return ["txt", "text/plain"].includes(fileType);
  }

  async parse(buffer: ArrayBuffer): Promise<ExtractionResult> {
    if (buffer.byteLength === 0) {
      throw new Error("Cannot parse empty file (0 bytes)");
    }
    const text = new TextDecoder("utf-8").decode(buffer);
    return {
      text,
      metadata: { characters: text.length, language: "en" },
    };
  }
}

class MarkdownParser implements FileParser {
  supports(fileType: string) {
    return ["md", "markdown", "text/markdown"].includes(fileType);
  }

  async parse(buffer: ArrayBuffer): Promise<ExtractionResult> {
    if (buffer.byteLength === 0) {
      throw new Error("Cannot parse empty file (0 bytes)");
    }
    const text = new TextDecoder("utf-8").decode(buffer);
    return {
      text,
      metadata: { characters: text.length, language: "en" },
    };
  }
}

class CsvParser implements FileParser {
  supports(fileType: string) {
    return ["csv", "text/csv"].includes(fileType);
  }

  async parse(buffer: ArrayBuffer): Promise<ExtractionResult> {
    if (buffer.byteLength === 0) {
      throw new Error("Cannot parse empty file (0 bytes)");
    }
    const text = new TextDecoder("utf-8").decode(buffer);
    const { parse } = await import("csv-parse/sync");
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const rows = records.length;
    const cols = records.length > 0 ? Object.keys(records[0]).length : 0;

    return {
      text,
      metadata: { characters: text.length, rows, columns: cols },
    };
  }
}

class PdfParser implements FileParser {
  supports(fileType: string) {
    return ["pdf", "application/pdf"].includes(fileType);
  }

  async parse(buffer: ArrayBuffer): Promise<ExtractionResult> {
    if (buffer.byteLength === 0) {
      throw new Error("Cannot parse empty PDF (0 bytes)");
    }

    let PDFParse: new (opts: { data: ArrayBuffer }) => {
      getText(): Promise<{ text: string; total: number; pages: unknown[] }>;
      destroy?: () => Promise<void> | void;
    };
    try {
      const mod = await import("pdf-parse");
      PDFParse = mod.PDFParse as typeof PDFParse;
    } catch {
      throw new Error("pdf-parse module is not installed. Run: npm install pdf-parse");
    }

    if (!PDFParse) {
      throw new Error("pdf-parse does not export PDFParse. Check the installed version.");
    }

    const pdf = new PDFParse({ data: buffer });
    try {
      const result = await pdf.getText();

      if (result.text.trim().length === 0) {
        logger.warn("[Extraction] pdf-parse returned empty text", {
          total: result.total,
          pagesRendered: result.pages?.length,
        });
        throw new Error(
          "This PDF contains no extractable text. Scanned or image-only PDFs are not supported yet — upload a text-based PDF or paste the text as a source instead.",
        );
      }

      return {
        text: result.text,
        metadata: {
          pages: result.total,
          characters: result.text.length,
          language: "en",
        },
      };
    } finally {
      // pdf-parse v2 owns worker/resources; release them after both successful
      // extraction and parser errors so repeated uploads do not leak workers.
      await pdf.destroy?.();
    }
  }
}

class DocxParser implements FileParser {
  supports(fileType: string) {
    return ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(fileType);
  }

  async parse(buffer: ArrayBuffer): Promise<ExtractionResult> {
    if (buffer.byteLength === 0) {
      throw new Error("Cannot parse empty DOCX (0 bytes)");
    }
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return {
      text: result.value,
      metadata: { characters: result.value.length },
    };
  }
}

export const parsers: FileParser[] = [
  new TextParser(),
  new MarkdownParser(),
  new CsvParser(),
  new PdfParser(),
  new DocxParser(),
];
