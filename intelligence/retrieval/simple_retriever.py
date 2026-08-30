# Hybrid retrieval with persistent BM25 index

import logging

from intelligence.embeddings.base_embedder import BaseEmbedder
from .retriever import BaseRetriever
from .persistent_bm25 import PersistentBM25Index
from intelligence.vectorstore.chroma_store import ChromaStore

logger = logging.getLogger(__name__)


class SimpleRetriever(BaseRetriever):
    def __init__(self, store: ChromaStore, embedder: BaseEmbedder):
        super().__init__(embedder, store)
        self.store = store
        self.embedder = embedder
        self._bm25_indices: dict[str, PersistentBM25Index] = {}
        self._corpora_versions: dict[str, int] = {}
        self.degraded_mode: bool = False

    def _get_or_build_index(
        self, namespace: str, all_docs: list[str]
    ) -> PersistentBM25Index:
        """Get cached BM25 index or build from corpus, with incremental updates."""
        corpus_version = self._corpora_versions.get(namespace, 0)
        current_version = self._get_corpus_version(namespace)

        if namespace not in self._bm25_indices:
            idx = PersistentBM25Index()
            doc_id_texts = [(f"doc_{i}", doc) for i, doc in enumerate(all_docs)]
            idx.add_documents(doc_id_texts)
            self._bm25_indices[namespace] = idx
            self._corpora_versions[namespace] = current_version
            return idx

        idx = self._bm25_indices[namespace]

        if current_version > corpus_version:
            idx = PersistentBM25Index()
            doc_id_texts = [(f"doc_{i}", doc) for i, doc in enumerate(all_docs)]
            idx.add_documents(doc_id_texts)
            self._bm25_indices[namespace] = idx
            self._corpora_versions[namespace] = current_version

        return idx

    def _get_corpus_version(self, namespace: str) -> int:
        """Simple versioning based on document count in ChromaDB."""
        try:
            collection = self.store.client.get_collection(name=namespace)
            return collection.count()
        except (ConnectionError, OSError, ValueError):
            return 0

    def _bm25_fallback(
        self, namespace: str, all_docs: list[str], query: str, top_k: int
    ) -> list[str]:
        """BM25-only retrieval used when ChromaDB is unreachable."""
        if not all_docs:
            return []
        bm25_index = self._get_or_build_index(namespace, all_docs)
        ranked = bm25_index.query(query, top_k=top_k)
        sparse_ids = [doc_id for doc_id, _ in ranked]
        texts = bm25_index.get_documents_by_ids(sparse_ids)
        return [chunk for chunk in texts if len(chunk.strip()) > 30]

    def retrieve_top_k(self, namespace: str, top_k: int, query: str) -> list[str]:
        self.degraded_mode = False
        query_embed = self.embedder.embed(query)

        try:
            dense_result = self.store.query(namespace, top_k, query_embed)
        except (ConnectionError, OSError) as e:
            logger.warning(
                "Vector store unreachable for namespace '%s', falling back to BM25: %s",
                namespace,
                e,
            )
            self.degraded_mode = True
            all_chunks = self._load_chunks_safe(namespace)
            return self._bm25_fallback(namespace, all_chunks, query, top_k)

        dense_documents = dense_result.get("documents")
        if not dense_documents or not dense_documents[0]:
            return []
        dense_chunks = dense_documents[0]
        dense_chunks = [chunk for chunk in dense_chunks if len(chunk.strip()) > 30]

        try:
            all_chunks_result = self.store.get_all_chunks(namespace)
        except (ConnectionError, OSError) as e:
            logger.warning(
                "Unable to load full corpus for namespace '%s', returning dense-only results: %s",
                namespace,
                e,
            )
            self.degraded_mode = True
            return dense_chunks

        all_docs = [chunk for chunk in all_chunks_result if len(chunk.strip()) > 30]

        if not all_docs:
            return dense_chunks

        bm25_index = self._get_or_build_index(namespace, all_docs)

        ranked = bm25_index.query(query, top_k=top_k)
        sparse_chunks = [doc_id for doc_id, _ in ranked]
        sparse_texts = bm25_index.get_documents_by_ids(sparse_chunks)

        rrf_scores = {}

        for rank, chunk in enumerate(dense_chunks, start=1):
            rrf_scores[chunk] = rrf_scores.get(chunk, 0) + 1 / (60 + rank)

        for rank, chunk in enumerate(sparse_texts, start=1):
            rrf_scores[chunk] = rrf_scores.get(chunk, 0) + 1 / (60 + rank)

        sorted_chunks = sorted(rrf_scores, key=lambda c: rrf_scores[c], reverse=True)

        return sorted_chunks[:top_k]

    def _load_chunks_safe(self, namespace: str) -> list[str]:
        """Best-effort corpus load; returns [] when ChromaDB is unreachable."""
        try:
            all_chunks_result = self.store.get_all_chunks(namespace)
        except (ConnectionError, OSError):
            return []
        return [chunk for chunk in all_chunks_result if len(chunk.strip()) > 30]
