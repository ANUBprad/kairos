"""Multi-Hop QA example — iterative retrieval for complex reasoning."""
from __future__ import annotations

from typing import Dict, List


def simulate_hop(query: str, hop_num: int, context: str = "") -> Dict[str, str]:
    print(f"\n  Hop {hop_num}: Searching for: '{query}'")
    return {"result": f"[Simulated documents for hop {hop_num}]", "reformulated": query}


def main() -> None:
    multi_hop_queries: List[Dict[str, List[str]]] = [
        {
            "How does the Fed's interest rate decision affect emerging market economies?": [
                "Fed interest rate decision mechanism 2024",
                "Impact of US rate changes on emerging market currencies",
                "Capital flow dynamics in emerging markets",
            ]
        },
        {
            "How do copyright laws affect AI training data in different jurisdictions?": [
                "Copyright law fundamentals for digital content",
                "AI training data legal framework in the US",
                "EU AI Act provisions for training data",
            ]
        },
    ]

    print("=" * 60)
    print("Kairos — Multi-Hop QA Example")
    print("=" * 60)

    for item in multi_hop_queries:
        query = list(item.keys())[0]
        hops = item[query]

        print(f"\nQuery: {query}")
        print(f"  Planning: 3 hops required")

        for i, hop_query in enumerate(hops, 1):
            simulate_hop(hop_query, i)

        print(f"\n  [Kairos would synthesize across {len(hops)} hops into a final answer]")
        print("---")

    print("\nMulti-hop retrieval enables answering questions that require")
    print("reasoning across multiple documents and concepts.")


if __name__ == "__main__":
    main()
