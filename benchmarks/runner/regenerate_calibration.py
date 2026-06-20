"""Regenerate calibration_dataset.jsonl from benchmark_results.jsonl (has latency)."""
import json

src = "benchmarks/results/benchmark_results.jsonl"
dst = "benchmarks/results/calibration_dataset.jsonl"

records = []
with open(src) as f:
    for line in f:
        line = line.strip()
        if line:
            records.append(json.loads(line))

with open(dst, "w") as f:
    for r in records:
        success = 0
        art = r.get("article_overlap")
        if art is not None and art >= 0.5:
            success = 1
        elif r.get("recall") is not None and r["recall"] >= 0.5:
            success = 1
        elif not r.get("planner_fallback") and not r.get("empty_retrieval"):
            success = 1

        f.write(json.dumps({
            "query_id": r["query_id"],
            "confidence": r["confidence"],
            "success": success,
            "fallback_triggered": int(r.get("planner_fallback", False)),
            "retrieval_type": r.get("retrieval_type", "UNKNOWN"),
            "latency_ms": r.get("total_latency_ms", 200.0),
            "top_k": r.get("top_k", 5),
            "rerank": r.get("rerank", False),
            "decompose": r.get("decompose", False),
        }) + "\n")

print(f"Regenerated {len(records)} records with latency")

# Verify
with open(dst) as f:
    sample = json.loads(f.readline())
print(f"Sample: {json.dumps(sample)}")
