"""Benchmark: Document parsing pipeline."""

from __future__ import annotations

import io
import time
from dataclasses import dataclass

from benchmarks.performance.conftest import BenchmarkResult, generate_random_text


def _build_pdf_bytes(text: str) -> bytes:
    """Build a minimal valid PDF containing the given text."""
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    c.setFont("Helvetica", 10)
    y = 750
    for line in text.split("\n"):
        if y < 50:
            c.showPage()
            y = 750
        c.drawString(72, y, line[:80])
        y -= 14
    c.save()
    return buf.getvalue()


def bench_pdf_parsing(iterations: int = 50) -> BenchmarkResult:
    """Benchmark PDF text extraction with pypdf."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return BenchmarkResult(name="pdf_parsing", iterations=0, times=[])

    text = generate_random_text(10000)
    pdf_bytes = _build_pdf_bytes(text)

    times = []
    for _ in range(iterations):
        reader = PdfReader(io.BytesIO(pdf_bytes))
        start = time.perf_counter()
        extracted = ""
        for page in reader.pages:
            extracted += page.extract_text()
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(name="pdf_parsing", iterations=iterations, times=times)


def bench_text_decoding(iterations: int = 200) -> BenchmarkResult:
    """Benchmark plain text decoding."""
    text = generate_random_text(50000).encode("utf-8")

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        text.decode("utf-8")
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(name="text_decoding", iterations=iterations, times=times)


def bench_document_loader(iterations: int = 50) -> BenchmarkResult:
    """Benchmark the full document_loader.load_document function."""
    from intelligence.ingestion.document_loader import load_document

    text = generate_random_text(10000)
    pdf_bytes = _build_pdf_bytes(text)

    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        load_document(pdf_bytes, "application/pdf")
        end = time.perf_counter()
        times.append(end - start)

    return BenchmarkResult(name="document_loader_full", iterations=iterations, times=times)


def run_all(iterations: int = 50) -> list[BenchmarkResult]:
    results = []
    results.append(bench_pdf_parsing(iterations))
    results.append(bench_text_decoding(iterations))
    results.append(bench_document_loader(iterations))
    return results


if __name__ == "__main__":
    for r in run_all():
        s = r.summary()
        print(f"{s['name']}: mean={s['mean_ms']:.2f}ms, p95={s['p95_ms']:.2f}ms, p99={s['p99_ms']:.2f}ms")
