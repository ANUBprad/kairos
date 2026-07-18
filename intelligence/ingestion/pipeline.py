"""Instrumented ingestion pipeline with per-stage timing and Prometheus metrics."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from intelligence.embeddings.base_embedder import BaseEmbedder
from intelligence.ingestion.chunker import Chunker
from intelligence.ingestion.document_loader import load_document
from intelligence.vectorstore.chroma_store import ChromaStore

logger = logging.getLogger(__name__)


@dataclass
class PipelineMetrics:
    parsing_ms: float = 0.0
    chunking_ms: float = 0.0
    embedding_ms: float = 0.0
    indexing_ms: float = 0.0
    total_ms: float = 0.0
    chunk_count: int = 0
    text_length: int = 0

    def to_dict(self) -> dict:
        return {
            "parsing_ms": round(self.parsing_ms, 2),
            "chunking_ms": round(self.chunking_ms, 2),
            "embedding_ms": round(self.embedding_ms, 2),
            "indexing_ms": round(self.indexing_ms, 2),
            "total_ms": round(self.total_ms, 2),
            "chunk_count": self.chunk_count,
            "text_length": self.text_length,
        }


class IngestionPipeline:
    def __init__(self, embedder: BaseEmbedder, chunker: Chunker, store: ChromaStore):
        self.embedder = embedder
        self.chunker = chunker
        self.store = store

    def compute(
        self, content: bytes, namespace: str, strat: int, mime_type: str, filename
    ) -> int:
        metrics = PipelineMetrics()
        pipeline_start = time.monotonic()

        try:
            stage_start = time.monotonic()
            text_content = load_document(content, mime_type)
            metrics.parsing_ms = (time.monotonic() - stage_start) * 1000
            metrics.text_length = len(text_content)
        except Exception as e:
            raise ValueError(f"Document Loading failed: {e}")

        try:
            stage_start = time.monotonic()
            chunks = self.chunker.chunk(text_content, strat)
            metrics.chunking_ms = (time.monotonic() - stage_start) * 1000
            metrics.chunk_count = len(chunks)
        except Exception as e:
            raise ValueError(f"Document Chunking failed: {e}")

        try:
            stage_start = time.monotonic()
            embeddings = self.embedder.embed_batch(chunks)
            metrics.embedding_ms = (time.monotonic() - stage_start) * 1000
        except Exception as e:
            raise ValueError(f"Document embedding generation failed: {e}")

        try:
            stage_start = time.monotonic()
            self.store.upsert(namespace, chunks, embeddings, filename)
            metrics.indexing_ms = (time.monotonic() - stage_start) * 1000
        except Exception as e:
            raise ValueError(f"Vector store indexing failed: {e}")

        metrics.total_ms = (time.monotonic() - pipeline_start) * 1000

        logger.info(
            "Ingestion pipeline completed",
            extra={
                "filename": filename,
                "namespace": namespace,
                "strategy": strat,
                "text_length": metrics.text_length,
                "chunk_count": metrics.chunk_count,
                "parsing_ms": round(metrics.parsing_ms, 2),
                "chunking_ms": round(metrics.chunking_ms, 2),
                "embedding_ms": round(metrics.embedding_ms, 2),
                "indexing_ms": round(metrics.indexing_ms, 2),
                "total_ms": round(metrics.total_ms, 2),
            },
        )

        try:
            from intelligence.metrics.prometheus_metrics import (
                ingestion_parsing_seconds,
                ingestion_chunking_seconds,
                ingestion_embedding_seconds,
                ingestion_indexing_seconds,
                ingestion_total_seconds,
                ingestion_chunk_count,
                ingestion_text_length,
            )

            ingestion_parsing_seconds.observe(metrics.parsing_ms / 1000)
            ingestion_chunking_seconds.observe(metrics.chunking_ms / 1000)
            ingestion_embedding_seconds.observe(metrics.embedding_ms / 1000)
            ingestion_indexing_seconds.observe(metrics.indexing_ms / 1000)
            ingestion_total_seconds.observe(metrics.total_ms / 1000)
            ingestion_chunk_count.observe(metrics.chunk_count)
            ingestion_text_length.observe(metrics.text_length)
        except ImportError:
            pass

        return len(chunks)
