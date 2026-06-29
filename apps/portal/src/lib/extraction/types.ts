export interface ExtractionResult {
  text: string;
  metadata: {
    pages?: number;
    characters: number;
    language?: string;
    [key: string]: unknown;
  };
}

export interface FileParser {
  supports(fileType: string): boolean;
  parse(buffer: ArrayBuffer, fileType: string): Promise<ExtractionResult>;
}
