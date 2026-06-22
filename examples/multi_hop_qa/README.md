# Multi-Hop Question Answering Example

Demonstrates Kairos' multi-hop retrieval capability — chaining multiple retrievals to answer complex questions.

## Usage

```bash
cd examples/multi_hop_qa
pip install -r requirements.txt
python run.py
```

## What it demonstrates

- Iterative retrieval across multiple hops
- Query reformulation with context from previous hops
- Answer synthesis from multiple sources

## Expected output

```
Query: How does the Fed's interest rate decision affect emerging market economies?

Hop 1: Retrieve Fed rate decision mechanism
Hop 2: Retrieve impact on currency exchange rates
Hop 3: Retrieve effect on emerging market capital flows

Final Answer: The Fed's interest rate decisions affect emerging markets through...
```
