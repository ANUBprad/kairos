"""Adaptive RAG example — demonstrates query classification and routing."""
from __future__ import annotations

from typing import Dict, List


class DemoClassifier:
    def classify(self, query: str) -> Dict[str, object]:
        simple_keywords = ["what is", "who is", "define", "capital of"]
        complex_keywords = ["explain", "relationship", "compare", "analyze"]
        multi_hop_keywords = ["how does", "why does", "chain", "sequence"]

        query_lower = query.lower()
        if any(kw in query_lower for kw in multi_hop_keywords):
            return {"type": "multi_hop", "confidence": 0.82}
        if any(kw in query_lower for kw in complex_keywords):
            return {"type": "complex", "confidence": 0.78}
        return {"type": "simple", "confidence": 0.95}


def main() -> None:
    classifier = DemoClassifier()

    queries = [
        "What is Python?",
        "Explain the relationship between inflation and unemployment.",
        "How does a bill become a law in the US Congress?",
        "Who wrote Romeo and Juliet?",
        "Compare machine learning and deep learning.",
    ]

    print("=" * 60)
    print("Kairos — Adaptive RAG Example")
    print("=" * 60)

    for query in queries:
        result = classifier.classify(query)
        query_type = result["type"]
        confidence = result["confidence"]

        strategy_map: Dict[str, str] = {
            "simple": "direct retrieval (top_k=3)",
            "complex": "diversity retrieval + rerank (top_k=5)",
            "multi_hop": "iterative multi-hop (top_k=5, hops=3)",
        }

        print(f"\nQuery: {query}")
        print(f"  Classified as: {query_type} (confidence: {confidence:.2f})")
        print(f"  Strategy: {strategy_map.get(query_type, 'unknown')}")
        print(f"  [Kairos would retrieve and generate an answer]")
        print("---")


if __name__ == "__main__":
    main()
