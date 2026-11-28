import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "../types/app-error.js";
import { runWithRequestId } from "../lib/observability/request-context.js";
import {
    PDF_MAX_UPLOAD_BYTES,
    PdfExtractionError,
} from "../lib/sources/pdf.js";
import {
    uploadPdfSource,
    type PdfUploadDeps,
} from "./source.services.js";

/** Minimal structurally valid PDF with no text layer (scanned-page stand-in). */
function makeBlankPdf(pageCount = 1): Buffer {
    const objects: string[] = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        `<< /Type /Pages /Kids [${Array.from(
            { length: pageCount },
            (_, index) => `${3 + index} 0 R`,
        ).join(" ")}] /Count ${pageCount} >>`,
    ];
    for (let index = 0; index < pageCount; index += 1) {
        objects.push(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>",
        );
    }

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

function file(bytes: Buffer, name = "notes.pdf"): Express.Multer.File {
    return {
        buffer: bytes,
        originalname: name,
        mimetype: "application/pdf",
        size: bytes.byteLength,
    } as Express.Multer.File;
}

function calls() {
    return {
        workspace: 0,
        find: 0,
        quota: 0,
        extract: 0,
        upload: 0,
        create: 0,
        created: [] as Array<Record<string, any>>,
    };
}

type State = ReturnType<typeof calls>;

function baseDeps(state: State, overrides: Record<string, unknown> = {}) {
    return {
        getWorkspace: async () => {
            state.workspace += 1;
            return {};
        },
        findActiveSource: async () => {
            state.find += 1;
            return null;
        },
        assertQuota: async () => {
            state.quota += 1;
        },
        extractPdf: async () => {
            state.extract += 1;
            return { text: "Extracted text", pages: ["Extracted text"], pageCount: 1 };
        },
        uploadPdf: async () => {
            state.upload += 1;
            return {
                secureUrl: "https://cdn.example.com/file.pdf",
                publicId: "pdf-id",
                bytes: 12,
                originalFilename: "notes.pdf",
                resourceType: "raw" as const,
            };
        },
        createSource: async (data: Record<string, any>) => {
            state.create += 1;
            state.created.push(data);
            return { id: "source-new" };
        },
        ...overrides,
    } as unknown as PdfUploadDeps;
}

describe("PDF upload ingestion", () => {
    it("creates one charged source only after storage is confirmed", async () => {
        const state = calls();
        const result = await uploadPdfSource(
            "w1",
            "u1",
            file(Buffer.from("%PDF-1.4 fake")),
            "  My notes  ",
            baseDeps(state),
        );

        assert.deepEqual(result, { id: "source-new" });
        assert.deepEqual(
            {
                workspace: state.workspace,
                find: state.find,
                quota: state.quota,
                extract: state.extract,
                upload: state.upload,
                create: state.create,
            },
            { workspace: 1, find: 1, quota: 1, extract: 1, upload: 1, create: 1 },
        );
        const created = state.created[0]!;
        assert.equal(created.type, "PDF");
        assert.equal(created.title, "My notes");
        assert.equal(created.content, "Extracted text");
        assert.equal(created.metadata.fileUrl, "https://cdn.example.com/file.pdf");
        assert.equal(created.metadata.publicId, "pdf-id");
        assert.ok(created.metadata.contentHash);
        assert.equal(created.status, "PENDING");
    });

    it("does not create or charge a source when storage fails", async () => {
        const state = calls();
        await assert.rejects(
            () =>
                uploadPdfSource(
                    "w1",
                    "u1",
                    file(Buffer.from("%PDF-1.4 fake")),
                    undefined,
                    baseDeps(state, {
                        uploadPdf: async () => {
                            state.upload += 1;
                            throw Object.assign(new Error("secret-storage-body"), {
                                status: 403,
                            });
                        },
                    }),
                ),
            (error: unknown) => {
                assert.ok(error instanceof ValidationError);
                assert.match(error.message, /could not be stored/i);
                assert.equal(error.message.includes("secret"), false);
                return true;
            },
        );
        assert.equal(state.create, 0);
    });

    it("logs safe structured storage diagnostics with the request id", async () => {
        const originalWarn = console.warn;
        const warnings: string[] = [];
        console.warn = (line?: unknown) => {
            warnings.push(String(line));
        };

        try {
            await runWithRequestId("pdf-storage-test-request", () =>
                assert.rejects(
                    () =>
                        uploadPdfSource(
                            "w1",
                            "u1",
                            file(Buffer.from("%PDF-1.4 fake")),
                            undefined,
                            baseDeps(calls(), {
                                uploadPdf: async () => {
                                    throw new ValidationError(
                                        "Cloudinary is not configured",
                                        {
                                            code: "STORAGE_NOT_CONFIGURED",
                                            provider: "cloudinary",
                                            missing: ["CLOUDINARY_CLOUD_NAME"],
                                        },
                                    );
                                },
                            }),
                        ),
                    ValidationError,
                ),
            );
        } finally {
            console.warn = originalWarn;
        }

        assert.equal(warnings.length, 1);
        const log = JSON.parse(warnings[0]!);
        assert.equal(log.level, "warn");
        assert.match(log.message, /PDF storage failed/);
        assert.equal(log.errorMessage, "Cloudinary is not configured");
        assert.equal(log.requestId, "pdf-storage-test-request");
        assert.equal(log.provider, "cloudinary");
        assert.equal(log.operation, "pdf.upload");
        assert.equal(log.category, "configuration");
        assert.equal(log.errorName, "ValidationError");
        assert.equal(log.errorCode, "STORAGE_NOT_CONFIGURED");
        assert.deepEqual(log.missing, ["CLOUDINARY_CLOUD_NAME"]);
        assert.doesNotMatch(JSON.stringify(log), /stack|file contents/i);
    });

    it("rejects an incomplete storage result", async () => {
        const state = calls();
        await assert.rejects(
            () =>
                uploadPdfSource(
                    "w1",
                    "u1",
                    file(Buffer.from("%PDF-1.4 fake")),
                    undefined,
                    baseDeps(state, {
                        uploadPdf: async () =>
                            ({ secureUrl: "", publicId: "" }) as any,
                    }),
                ),
            /could not be stored/i,
        );
        assert.equal(state.create, 0);
    });

    it("does not upload or charge when parsing fails", async () => {
        const state = calls();
        await assert.rejects(
            () =>
                uploadPdfSource(
                    "w1",
                    "u1",
                    file(Buffer.from("not a pdf")),
                    undefined,
                    baseDeps(state, {
                        extractPdf: async () => {
                            state.extract += 1;
                            throw new PdfExtractionError(
                                "CORRUPT",
                                "The uploaded file is not a readable PDF.",
                            );
                        },
                    }),
                ),
            /not a readable PDF/i,
        );
        assert.equal(state.upload, 0);
        assert.equal(state.create, 0);
    });

    it("does not upload or charge an encrypted PDF", async () => {
        const state = calls();
        await assert.rejects(
            () =>
                uploadPdfSource(
                    "w1",
                    "u1",
                    file(Buffer.from("%PDF-1.4 fake")),
                    undefined,
                    baseDeps(state, {
                        extractPdf: async () => {
                            state.extract += 1;
                            throw new PdfExtractionError(
                                "ENCRYPTED",
                                "Encrypted PDFs are not supported. Upload a version without a password.",
                            );
                        },
                    }),
                ),
            /encrypted/i,
        );
        assert.equal(state.upload, 0);
        assert.equal(state.create, 0);
    });

    it("does not upload or charge when no text is extracted", async () => {
        const state = calls();
        await assert.rejects(
            () =>
                uploadPdfSource(
                    "w1",
                    "u1",
                    file(makeBlankPdf()),
                    undefined,
                    baseDeps(state, {
                        extractPdf: async () => {
                            state.extract += 1;
                            return { text: "   ", pages: [""], pageCount: 1 };
                        },
                    }),
                ),
            /no text could be extracted/i,
        );
        assert.equal(state.upload, 0);
        assert.equal(state.create, 0);
    });

    it("rejects oversized uploads before parsing, storage, or charging", async () => {
        const state = calls();
        await assert.rejects(
            () =>
                uploadPdfSource(
                    "w1",
                    "u1",
                    file(Buffer.alloc(PDF_MAX_UPLOAD_BYTES + 1)),
                    undefined,
                    baseDeps(state),
                ),
            /too large/i,
        );
        assert.equal(state.extract, 0);
        assert.equal(state.upload, 0);
        assert.equal(state.create, 0);
    });

    it("uses the injected OCR path for a scanned PDF", async () => {
        const state = calls();
        let ocrCalls = 0;
        const result = await uploadPdfSource(
            "w1",
            "u1",
            file(makeBlankPdf(2)),
            undefined,
            baseDeps(state, {
                extractPdf: undefined,
                ocr: async () => {
                    ocrCalls += 1;
                    return { text: "OCR page text", model: "test-ocr-model" };
                },
            }),
        );

        assert.deepEqual(result, { id: "source-new" });
        assert.equal(ocrCalls, 1);
        const created = state.created[0]!;
        assert.equal(created.content, "OCR page text");
        assert.equal(created.metadata.ocrModel, "test-ocr-model");
        assert.equal(created.metadata.pageCount, 2);
        assert.equal(state.create, 1);
    });

    it("reuses an active source for an identical upload without recharging", async () => {
        const state = calls();
        const existing = { id: "source-existing" };
        const result = await uploadPdfSource(
            "w1",
            "u1",
            file(Buffer.from("%PDF-1.4 fake")),
            undefined,
            baseDeps(state, {
                findActiveSource: async (
                    workspaceId: string,
                    type: string,
                    key: string,
                    value: string,
                ) => {
                    state.find += 1;
                    assert.equal(workspaceId, "w1");
                    assert.equal(type, "PDF");
                    assert.equal(key, "contentHash");
                    assert.match(value, /^[0-9a-f]{64}$/);
                    return existing as any;
                },
                assertQuota: async () => {
                    throw new Error("duplicate upload must not check quota");
                },
                extractPdf: async () => {
                    throw new Error("duplicate upload must not parse");
                },
                uploadPdf: async () => {
                    throw new Error("duplicate upload must not store");
                },
                createSource: async () => {
                    state.create += 1;
                    return {};
                },
            }),
        );

        assert.deepEqual(result, existing);
        assert.equal(state.create, 0);
    });
});
