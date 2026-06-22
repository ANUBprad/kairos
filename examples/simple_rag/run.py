"""Simple RAG example — demonstrates basic retrieval-augmented generation."""
from __future__ import annotations


def main() -> None:
    print("=" * 60)
    print("Kairos — Simple RAG Example")
    print("=" * 60)

    # In a real scenario, this would:
    # 1. Initialize Kairos retriever
    # 2. Load documents into ChromaDB
    # 3. Execute a query with simple retrieval
    # 4. Generate response with an LLM

    queries = [
        "What is the capital of France?",
        "Explain the concept of machine learning.",
        "What are the main types of renewable energy?",
    ]

    for query in queries:
        print(f"\nQuery: {query}")
        print(f"Answer: [Kairos would retrieve and generate an answer for: '{query}']")
        print("---")

    print("\nTo run with actual retrievers, configure ChromaDB and an LLM provider.")
    print("See the full documentation at https://github.com/anomalyco/kairos")


if __name__ == "__main__":
    main()
