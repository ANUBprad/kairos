package cache_test

import (
	"Kairos/gateway/cache"
	"testing"
)

// buildVector returns a unit vector of length n where index i is 1.0.
func buildVector(n, i int) []float32 {
	v := make([]float32, n)
	v[i] = 1.0
	return v
}

func TestSemanticCacheReturnsHitAboveThreshold(t *testing.T) {
	store := cache.NewLRU(100, 30)
	embedCache := cache.NewEmbeddingCache(store)
	semCache := cache.NewSemanticCache(store, embedCache, 0.85)

	// Exact match -> cosine sim 1.0 > 0.85
	vec := buildVector(384, 0)
	semCache.Set("ns1", "what is kairos?", vec, "kairos response")

	response, ok := semCache.Get("ns1", vec)
	if !ok {
		t.Fatalf("expected cache hit for exact embedding match, got miss")
	}
	if response != "kairos response" {
		t.Errorf("expected response %q, got %q", "kairos response", response)
	}
}

func TestSemanticCacheRejectsBelowThreshold(t *testing.T) {
	store := cache.NewLRU(100, 30)
	embedCache := cache.NewEmbeddingCache(store)
	semCache := cache.NewSemanticCache(store, embedCache, 0.95)

	// Orthogonal vector -> cosine sim 0.0 < 0.95, must NOT be returned
	cached := buildVector(384, 0)
	query := buildVector(384, 1)
	semCache.Set("ns1", "cached query", cached, "cached response")

	response, ok := semCache.Get("ns1", query)
	if ok {
		t.Errorf("expected cache miss for below-threshold similarity, got response %q", response)
	}
	if response != "" {
		t.Errorf("expected empty response on miss, got %q", response)
	}
}

func TestSemanticCacheThresholdBoundary(t *testing.T) {
	store := cache.NewLRU(100, 30)
	embedCache := cache.NewEmbeddingCache(store)
	// Threshold 0.0 should accept any vector with positive cosine similarity.
	semCache := cache.NewSemanticCache(store, embedCache, 0.0)

	cached := buildVector(384, 0)
	// Query with cos-sim ~0.5 to the cached vector.
	query := make([]float32, 384)
	query[0] = 0.5
	query[1] = 0.8660254
	semCache.Set("ns1", "cached query", cached, "cached response")

	response, ok := semCache.Get("ns1", query)
	if !ok {
		t.Fatalf("expected hit with threshold 0.0, got miss")
	}
	if response != "cached response" {
		t.Errorf("expected response %q, got %q", "cached response", response)
	}
}

func TestSemanticCacheEvictionPrunesNamespaceIndex(t *testing.T) {
	// Each Set stores a response + an embedding, so 2 entries need 4 slots.
	// Capacity 3 keeps the second entry but evicts the first.
	store := cache.NewLRU(3, 30)
	embedCache := cache.NewEmbeddingCache(store)
	semCache := cache.NewSemanticCache(store, embedCache, 0.85)

	vecA := buildVector(384, 0)
	vecB := buildVector(384, 1)
	semCache.Set("ns1", "first query", vecA, "first response")
	semCache.Set("ns1", "second query", vecB, "second response")

	// The evicted entry must be pruned from the namespace index so a Get
	// for the first query degrades to a miss instead of a stale hit.
	if _, ok := semCache.Get("ns1", vecA); ok {
		t.Fatal("expected evicted entry to be a cache miss, got a hit")
	}
	if response, ok := semCache.Get("ns1", vecB); !ok || response != "second response" {
		t.Errorf("expected surviving entry to still hit, got ok=%v response=%q", ok, response)
	}
}

func TestSemanticCacheHitRateCounts(t *testing.T) {
	store := cache.NewLRU(100, 30)
	embedCache := cache.NewEmbeddingCache(store)
	semCache := cache.NewSemanticCache(store, embedCache, 0.85)

	vec := buildVector(384, 0)
	semCache.Set("ns1", "q", vec, "resp")

	if _, ok := semCache.Get("ns1", vec); !ok {
		t.Fatal("expected hit")
	}
	if _, ok := semCache.Get("ns1", buildVector(384, 1)); ok {
		t.Fatal("expected miss")
	}

	rate := semCache.HitRate()
	if rate != 0.5 {
		t.Errorf("expected hit rate 0.5, got %f", rate)
	}
}
