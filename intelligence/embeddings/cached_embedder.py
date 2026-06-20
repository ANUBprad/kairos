from __future__ import annotations

from intelligence.cache.embedding_cache import EmbeddingCache, CacheStats
from intelligence.embeddings.base_embedder import BaseEmbedder


class CachedEmbedder(BaseEmbedder):
    def __init__(self, inner: BaseEmbedder, cache: EmbeddingCache | None = None):
        self._inner = inner
        self._cache = cache or EmbeddingCache()

    def embed(self, text: str) -> list[float]:
        cached = self._cache.get(text)
        if cached is not None:
            return cached
        result = self._inner.embed(text)
        self._cache.set(text, result)
        return result

    def embed_batch(self, text: list[str]) -> list[list[float]]:
        results: list[list[float]] = []
        uncached: list[tuple[int, str]] = []
        for i, t in enumerate(text):
            cached = self._cache.get(t)
            if cached is not None:
                results.append(cached)
            else:
                results.append(None)  # type: ignore[arg-type]
                uncached.append((i, t))
        if uncached:
            batch_results = self._inner.embed_batch([t for _, t in uncached])
            for (idx, t), emb in zip(uncached, batch_results):
                self._cache.set(t, emb)
                results[idx] = emb
        return results  # type: ignore[return-value]

    @property
    def cache_stats(self) -> CacheStats:
        return self._cache.stats

    @property
    def _inner_embedder(self) -> BaseEmbedder:
        return self._inner
