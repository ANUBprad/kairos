import type { FileParser, ExtractionResult } from "./types";

class TextParser implements FileParser {
  supports(fileType: string) {
    return ["txt", "text/plain"].includes(fileType);
  }

  async parse(buffer: ArrayBuffer): Promise<ExtractionResult> {
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
    const { PDFParse } = await import("pdf-parse");
    const pdf = new PDFParse({ data: buffer });
    const result = await pdf.getText();
    return {
      text: result.text,
      metadata: {
        pages: result.total,
        characters: result.text.length,
        language: "en",
      },
    };
  }
}

class DocxParser implements FileParser {
  supports(fileType: string) {
    return ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(fileType);
  }

  async parse(buffer: ArrayBuffer): Promise<ExtractionResult> {
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
