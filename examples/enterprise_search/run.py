"""Enterprise Search example — multi-domain document search."""
from __future__ import annotations

from typing import Dict, List


DOMAIN_QUERIES: Dict[str, List[str]] = {
    "Finance": [
        "What is the current federal funds rate target?",
        "Explain quantitative easing.",
        "What is the difference between GAAP and IFRS?",
    ],
    "Legal": [
        "What is GDPR?",
        "Explain the burden of proof in criminal cases.",
        "What is the difference between civil and common law?",
    ],
    "Healthcare": [
        "How do mRNA vaccines work?",
        "What is the difference between type 1 and type 2 diabetes?",
        "Explain the gut-brain axis.",
    ],
}


def main() -> None:
    print("=" * 60)
    print("Kairos — Enterprise Search Example")
    print("=" * 60)

    for domain, queries in DOMAIN_QUERIES.items():
        print(f"\n## Domain: {domain}")
        print(f"   Namespace: {domain.lower()}")
        for query in queries:
            print(f"\n  Query: {query}")
            print(f"  [Kairos would search namespace '{domain.lower()}' and return results]")

    print("\n" + "=" * 60)
    print("Kairos supports namespace-isolated retrieval for multi-tenant deployments.")
    print("Each domain/tenant gets isolated document collections with shared infrastructure.")


if __name__ == "__main__":
    main()
