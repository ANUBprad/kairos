import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    classifyPdfExtractionError,
    extractPdfFromBuffer,
    PDF_MAX_PAGES,
    PDF_MAX_TEXT_CHARS,
    PDF_MAX_UPLOAD_BYTES,
    PdfExtractionError,
    shouldRetryPdfDownloadWithSignedUrl,
} from "./pdf.js";

/** Builds a small, structurally valid PDF without any external dependency. */
function makePdf(pageTexts: string[]): Buffer {
    const objects: string[] = [];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push(
        `<< /Type /Pages /Kids [${pageTexts
            .map((_, index) => `${3 + index * 2} 0 R`)
            .join(" ")}] /Count ${pageTexts.length} >>`,
    );

    pageTexts.forEach((text, index) => {
        const contentIndex = 4 + index * 2;
        objects.push(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIndex} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`,
        );
        const escaped = text
            .replace(/\\/g, "\\\\")
            .replace(/\(/g, "\\(")
            .replace(/\)/g, "\\)");
        // Split long strings across text operations so pdf.js extracts all of them.
        const lines = escaped.match(/.{1,50}/g) ?? [escaped];
        const stream = lines
            .map(
                (line, lineIndex) =>
                    `BT /F1 12 Tf 72 ${720 - lineIndex * 5} Td (${line}) Tj ET`,
            )
            .join("\n");
        objects.push(
            `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
        );
    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
        offsets.push(Buffer.byteLength(pdf));
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = Buffer.byteLength(pdf);
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let index = 1; index <= objects.length; index += 1) {
        pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "latin1");
}

describe("PDF extraction", () => {
    it("classifies extraction failures as safe client errors", () => {
        const encrypted = classifyPdfExtractionError(
            new Error("Password exception: No password given"),
        );
        assert.equal(encrypted.code, "ENCRYPTED");
        assert.equal(encrypted.statusCode, 400);

        const scanned = classifyPdfExtractionError(
            new Error("No text could be extracted from the PDF"),
        );
        assert.equal(scanned.code, "NO_TEXT");

        const corrupt = classifyPdfExtractionError(
            new Error("Invalid PDF structure"),
        );
        assert.equal(corrupt.code, "CORRUPT");
    });

    it("preserves blank physical pages and extracted page text", async () => {
        const result = await extractPdfFromBuffer(
            makePdf(["First page", "", "Third page"]),
        );

        assert.equal(result.pageCount, 3);
        assert.deepEqual(result.pages, ["First page", "", "Third page"]);
        assert.equal(result.text, "First page\n\nThird page");
    });

    it("rejects oversized buffers, page counts, and extracted text", async () => {
        await assert.rejects(
            () => extractPdfFromBuffer(Buffer.alloc(PDF_MAX_UPLOAD_BYTES + 1)),
            (error: unknown) =>
                error instanceof PdfExtractionError &&
                error.code === "TOO_LARGE",
        );

        await assert.rejects(
            () =>
                extractPdfFromBuffer(
                    makePdf(Array(PDF_MAX_PAGES + 1).fill("short page")),
                ),
            (error: unknown) =>
                error instanceof PdfExtractionError &&
                error.code === "TOO_LARGE",
        );

        await assert.rejects(
            () =>
                extractPdfFromBuffer(
                    makePdf(
                        Array.from(
                            { length: 100 },
                            () => "x".repeat(Math.ceil(PDF_MAX_TEXT_CHARS / 100) + 10),
                        ),
                    ),
                ),
            (error: unknown) =>
                error instanceof PdfExtractionError &&
                error.code === "TOO_LARGE",
        );
    });

    it("fails closed for image-only and corrupt PDFs", async () => {
        await assert.rejects(
            () => extractPdfFromBuffer(makePdf(["", ""])),
            (error: unknown) =>
                error instanceof PdfExtractionError &&
                error.code === "NO_TEXT",
        );

        await assert.rejects(
            () => extractPdfFromBuffer(Buffer.from("not a pdf")),
            (error: unknown) =>
                error instanceof PdfExtractionError &&
                error.code === "CORRUPT",
        );
    });

    it("uses injected OCR for scanned PDFs and bounds its output", async () => {
        let ocrCalls = 0;
        const result = await extractPdfFromBuffer(makePdf(["", ""]), {
            ocr: async () => {
                ocrCalls += 1;
                return { text: "  Scanned page text  ", model: "test-ocr" };
            },
        });

        assert.equal(ocrCalls, 1);
        assert.equal(result.text, "Scanned page text");
        assert.equal(result.pageCount, 2);
        assert.deepEqual(result.pages, ["Scanned page text"]);
        assert.equal(result.ocrModel, "test-ocr");

        await assert.rejects(
            () =>
                extractPdfFromBuffer(makePdf(["", ""]), {
                    ocr: async () => ({ text: "x".repeat(PDF_MAX_TEXT_CHARS + 1) }),
                }),
            (error: unknown) =>
                error instanceof PdfExtractionError && error.code === "TOO_LARGE",
        );

        await assert.rejects(
            () =>
                extractPdfFromBuffer(makePdf(["", ""]), {
                    ocr: async () => {
                        throw new Error("provider detail with secret");
                    },
                }),
            (error: unknown) => {
                assert.ok(error instanceof PdfExtractionError);
                assert.equal(error.code, "OCR_FAILED");
                assert.equal(error.message.includes("secret"), false);
                return true;
            },
        );
    });

    it("does not run OCR on encrypted or malformed PDFs", async () => {
        let ocrCalls = 0;
        const ocr = async () => {
            ocrCalls += 1;
            return { text: "should not be used" };
        };

        await assert.rejects(
            () => extractPdfFromBuffer(Buffer.from("not a pdf"), { ocr }),
            (error: unknown) =>
                error instanceof PdfExtractionError && error.code === "CORRUPT",
        );
        assert.equal(ocrCalls, 0);
    });

    it("retries only private-asset download failures with a signed URL", () => {
        for (const status of [401, 403, 404]) {
            assert.equal(
                shouldRetryPdfDownloadWithSignedUrl(
                    new Error(`Remote fetch failed (${status})`),
                ),
                true,
            );
        }
        assert.equal(
            shouldRetryPdfDownloadWithSignedUrl(
                new Error("Remote fetch failed (500)"),
            ),
            false,
        );
        assert.equal(
            shouldRetryPdfDownloadWithSignedUrl(
                classifyPdfExtractionError(new Error("Invalid PDF structure")),
            ),
            false,
        );
    });
});
