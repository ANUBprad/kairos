from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest

from intelligence.cache.embedding_cache import EmbeddingCache
from intelligence.embeddings.cached_embedder import CachedEmbedder


class TestEmbeddingCache:
    def test_get_miss_returns_none(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        assert cache.get("missing") is None

    def test_set_and_get(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        cache.set("k1", [0.1, 0.2])
        assert cache.get("k1") == [0.1, 0.2]

    def test_get_moves_to_end(self) -> None:
        cache = EmbeddingCache(maxsize=3, ttl_seconds=0)
        for k in ["a", "b", "c"]:
            cache.set(k, [1.0])
        cache.get("a")
        cache.set("d", [1.0])
        assert cache.get("b") is None
        assert cache.get("a") == [1.0]
        assert cache.get("c") == [1.0]
        assert cache.get("d") == [1.0]

    def test_lru_eviction(self) -> None:
        cache = EmbeddingCache(maxsize=2, ttl_seconds=0)
        cache.set("a", [1.0])
        cache.set("b", [2.0])
        cache.set("c", [3.0])
        assert cache.get("a") is None
        assert cache.get("b") == [2.0]
        assert cache.get("c") == [3.0]

    def test_ttl_expiration(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=1)
        cache.set("k1", [42.0])
        assert cache.get("k1") == [42.0]
        time.sleep(1.1)
        assert cache.get("k1") is None

    def test_ttl_zero_never_expires(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        cache.set("k1", [42.0])
        time.sleep(0.1)
        assert cache.get("k1") == [42.0]

    def test_update_existing_key(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        cache.set("k1", [1.0])
        cache.set("k1", [2.0])
        assert cache.get("k1") == [2.0]

    def test_stats_initial(self) -> None:
        cache = EmbeddingCache(maxsize=100, ttl_seconds=0)
        s = cache.stats
        assert s.hits == 0
        assert s.misses == 0
        assert s.size == 0
        assert s.maxsize == 100

    def test_stats_tracks_hits_and_misses(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        cache.set("a", [1.0])
        cache.get("a")
        cache.get("b")
        s = cache.stats
        assert s.hits == 1
        assert s.misses == 1
        assert s.size == 1

    def test_stats_after_eviction(self) -> None:
        cache = EmbeddingCache(maxsize=2, ttl_seconds=0)
        cache.set("a", [1.0])
        cache.set("b", [2.0])
        cache.set("c", [3.0])
        assert cache.stats.size == 2

    def test_clear_resets_all(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        cache.set("a", [1.0])
        cache.get("a")
        cache.get("b")
        cache.clear()
        s = cache.stats
        assert s.hits == 0
        assert s.misses == 0
        assert s.size == 0

    def test_hit_rate_zero_when_no_ops(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        assert cache.hit_rate == 0.0

    def test_hit_rate_perfect(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        cache.set("a", [1.0])
        cache.get("a")
        assert cache.hit_rate == 1.0

    def test_hit_rate_mixed(self) -> None:
        cache = EmbeddingCache(maxsize=10, ttl_seconds=0)
        cache.set("a", [1.0])
        cache.get("a")
        cache.get("b")
        assert cache.hit_rate == 0.5

    def test_concurrent_access(self) -> None:
        import threading

        cache = EmbeddingCache(maxsize=100, ttl_seconds=0)
        errors: list[Exception] = []

        def worker(key: str) -> None:
            try:
                for _ in range(100):
                    existing = cache.get(key)
                    if existing is None:
                        cache.set(key, [float(ord(key[0]))])
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=worker, args=(chr(ord("a") + i),))
            for i in range(10)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(errors) == 0


class TestCachedEmbedder:
    def test_delegates_embed_on_miss(self) -> None:
        inner = MagicMock()
        inner.embed.return_value = [1.0, 2.0]
        cached = CachedEmbedder(inner)
        result = cached.embed("hello")
        inner.embed.assert_called_once_with("hello")
        assert result == [1.0, 2.0]

    def test_returns_cached_on_hit(self) -> None:
        inner = MagicMock()
        inner.embed.return_value = [1.0, 2.0]
        cached = CachedEmbedder(inner)
        cached.embed("hello")
        inner.embed.reset_mock()
        result = cached.embed("hello")
        inner.embed.assert_not_called()
        assert result == [1.0, 2.0]

    def test_cache_stats_exposed(self) -> None:
        inner = MagicMock()
        inner.embed.return_value = [1.0]
        cached = CachedEmbedder(inner)
        cached.embed("a")
        cached.embed("a")
        cached.embed("b")
        s = cached.cache_stats
        assert s.hits == 1
        assert s.misses == 2

    def test_embed_batch_mixed(self) -> None:
        inner = MagicMock()
        inner.embed.side_effect = lambda t: [float(len(t))]
        inner.embed_batch.side_effect = lambda texts: [[float(len(t))] for t in texts]
        cached = CachedEmbedder(inner)
        first = cached.embed_batch(["a", "bb", "ccc"])
        assert first == [[1.0], [2.0], [3.0]]
        inner.embed_batch.reset_mock()
        second = cached.embed_batch(["a", "bb", "ddd"])
        assert second == [[1.0], [2.0], [3.0]]
        inner.embed_batch.assert_called_once_with(["ddd"])

    def test_inner_embedder_property(self) -> None:
        inner = MagicMock()
        cached = CachedEmbedder(inner)
        assert cached._inner_embedder is inner


class TestCachedEmbedderConfig:
    def test_cache_config_in_server_config(self) -> None:
        from intelligence.server.config import ServerConfig

        cfg = ServerConfig.from_env()
        assert cfg.cache_maxsize == 4096
        assert cfg.cache_ttl_seconds == 300

    def test_cache_config_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KAIROS_CACHE_MAXSIZE", "512")
        monkeypatch.setenv("KAIROS_CACHE_TTL_SECONDS", "60")
        from intelligence.server.config import ServerConfig

        cfg = ServerConfig.from_env()
        assert cfg.cache_maxsize == 512
        assert cfg.cache_ttl_seconds == 60
