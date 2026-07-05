export interface EducationalContent {
  id: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  tags: string[];
}

export const EDUCATIONAL_CONTENT: EducationalContent[] = [
  {
    id: "recall-at-k",
    title: "Recall@K (Recall at K)",
    category: "retrieval-metrics",
    summary: "Proportion of relevant documents retrieved among the top-K results.",
    body: `Recall@K measures how many of the total relevant documents the system was able to retrieve within its top K results.

Formula: Recall@K = (Number of relevant documents in top K) / (Total number of relevant documents)

Example: If there are 5 relevant documents total, and the system retrieves 3 of them in the top 10 results, then Recall@10 = 3/5 = 0.6.

Recall is important when missing relevant information could lead to incorrect answers. High recall means the system is casting a wide net. However, maximizing recall alone can introduce noise (low precision).

In RAG systems, Recall@K is critical because the LLM can only answer based on the context you provide. If you miss relevant documents, the LLM may hallucinate or give incomplete answers.`,
    tags: ["recall", "retrieval", "metric", "fundamental"],
  },
  {
    id: "precision-at-k",
    title: "Precision@K (Precision at K)",
    category: "retrieval-metrics",
    summary: "Proportion of retrieved documents that are relevant among the top-K.",
    body: `Precision@K measures how many of the top K retrieved results are actually relevant.

Formula: Precision@K = (Number of relevant documents in top K) / K

Example: If the system returns 10 results and 4 are relevant, Precision@10 = 4/10 = 0.4.

Precision matters when you want to minimize noise in the context window. High precision means every retrieved chunk is useful. However, maximizing precision alone may cause you to miss relevant information (low recall).

The precision-recall tradeoff is fundamental in information retrieval. Improving one often reduces the other. The optimal balance depends on your use case.`,
    tags: ["precision", "retrieval", "metric", "fundamental"],
  },
  {
    id: "mrr",
    title: "MRR (Mean Reciprocal Rank)",
    category: "retrieval-metrics",
    summary: "Average of reciprocal ranks of the first relevant document for each query.",
    body: `MRR measures how quickly the system finds the first relevant result.

Formula: MRR = (1/N) × Σ(1 / rank_of_first_relevant)

Example: If for 3 queries, the first relevant result appears at ranks 1, 3, and 2, then MRR = (1/1 + 1/3 + 1/2) / 3 = (1 + 0.333 + 0.5) / 3 = 0.611.

MRR is especially important for question answering, where users typically expect the answer to be in the first result. A high MRR (close to 1.0) means the system almost always puts relevant content at the top.

This metric only considers the first relevant document, not all relevant documents. It is complementary to Recall@K.`,
    tags: ["mrr", "reciprocal-rank", "retrieval", "metric"],
  },
  {
    id: "ndcg",
    title: "nDCG (Normalized Discounted Cumulative Gain)",
    category: "retrieval-metrics",
    summary: "Measures ranking quality accounting for multiple relevance levels.",
    body: `nDCG evaluates ranking quality by considering both relevance and position.

Formula: nDCG@K = DCG@K / IDCG@K

Where DCG@K = Σ (rel_i / log2(i + 1)) and IDCG is the ideal DCG (best possible ranking).

nDCG is more sophisticated than Precision@K because it:
• Rewards relevant documents appearing earlier (log discount)
• Can handle graded relevance (not just binary relevant/not)
• Normalizes scores to 0-1 range for comparison across queries

A perfect ranking achieves nDCG = 1.0. This is the gold standard metric for ranking quality in information retrieval research.`,
    tags: ["ndcg", "ranking", "retrieval", "metric", "advanced"],
  },
  {
    id: "hit-rate",
    title: "Hit Rate",
    category: "retrieval-metrics",
    summary: "Proportion of queries where at least one relevant document was retrieved.",
    body: `Hit Rate measures whether the system finds anything relevant at all for each query.

Formula: Hit Rate = (Queries with at least one relevant result) / (Total queries)

Example: If 9 out of 10 queries find relevant content, Hit Rate = 0.9.

Hit Rate is a binary measure — it doesn't care about ranking quality, only whether the retrieval succeeded. A low hit rate means the system is failing entirely for some queries, which is a critical problem to address before optimizing other metrics.

In production RAG systems, hit rate below 0.95 typically indicates a serious gap in retrieval coverage.`,
    tags: ["hit-rate", "retrieval", "metric", "coverage"],
  },
  {
    id: "bm25",
    title: "BM25 (Best Matching 25)",
    category: "retrieval-algorithms",
    summary: "A bag-of-words ranking function used for keyword search.",
    body: `BM25 is a probabilistic retrieval function that ranks documents based on query term frequency.

The BM25 score between a query Q and document D is:
BM25(D, Q) = Σ [IDF(q_i) × (tf(q_i, D) × (k_1 + 1)) / (tf(q_i, D) + k_1 × (1 - b + b × |D| / avgdl))]

where:
• tf(q_i, D) = term frequency of query term q_i in document D
• IDF(q_i) = inverse document frequency of q_i
• |D| = length of document D
• avgdl = average document length
• k_1 = saturation parameter (typically 1.2)
• b = length normalization parameter (typically 0.75)

Why use BM25 over pure vector search?
• Captures exact keyword matches that semantic search might miss
• Works well for domain-specific terminology and proper nouns
• Provides complementary results to embedding-based search
• Deterministic and interpretable — you know why a document matched

In Kairos, BM25 is used as part of the Hybrid strategy. It builds an inverted index from all document chunks and scores queries in real-time.`,
    tags: ["bm25", "keyword", "search", "algorithm", "foundational"],
  },
  {
    id: "reciprocal-rank-fusion",
    title: "RRF (Reciprocal Rank Fusion)",
    category: "retrieval-algorithms",
    summary: "A method for combining multiple ranked lists into a single ranking.",
    body: `RRF (Reciprocal Rank Fusion) combines multiple ranked lists by computing a fusion score for each document.

RRF Score(d) = Σ (1 / (k + rank_i(d)))

where:
• rank_i(d) = rank of document d in result set i
• k = a constant (typically 60) that prevents very high scores for top-ranked items

Why RRF over simple score averaging?
• RRF does not require normalized scores from different retrieval methods
• BM25 scores and cosine similarities are on different scales — RRF handles this naturally
• RRF is robust to outliers in any single ranking
• It has theoretical foundations in information retrieval research

In Kairos, RRF combines Vector Search and BM25 Keyword Search in the Hybrid strategy. You can adjust the fusion parameter k and the weight of each source.`,
    tags: ["rrf", "fusion", "hybrid", "ranking", "algorithm"],
  },
  {
    id: "embedding",
    title: "Embeddings (Vector Representations)",
    category: "fundamental-concepts",
    summary: "Numerical representations of text that capture semantic meaning.",
    body: `Embeddings convert text into fixed-length numerical vectors (arrays of numbers) where semantically similar text has similar vectors.

Key properties:
• Similarity is measured by cosine distance between vectors
• "King" - "Man" + "Woman" ≈ "Queen" (analogical reasoning)
• Models are trained on massive text corpora (billions of documents)

Why embeddings matter for RAG:
• They enable semantic search — finding documents by meaning, not just keywords
• They capture synonyms and related concepts automatically
• Different embedding models offer different tradeoffs:
  - OpenAI text-embedding-3-small: 1536 dimensions, fast, cost-effective
  - OpenAI text-embedding-3-large: 3072 dimensions, higher accuracy
  - Gemini text-embedding-004: 768 dimensions, Google ecosystem

The embedding quality directly affects retrieval quality. Better embeddings lead to better Recall@K and MRR.`,
    tags: ["embedding", "vector", "semantic", "concept", "fundamental"],
  },
  {
    id: "chunk-overlap",
    title: "Chunk Overlap",
    category: "chunking",
    summary: "Overlap between adjacent chunks to preserve context boundaries.",
    body: `Chunk overlap adds a sliding window between consecutive chunks to ensure information near chunk boundaries isn't lost.

Why overlap matters:
• Sentences or concepts that span chunk boundaries would otherwise be split and lose context
• Overlap ensures each chunk has sufficient context for the retrieval model to match against
• The optimal overlap is typically 10-20% of chunk size

Tradeoffs:
• More overlap = more chunks = more storage and slower search
• Less overlap = risk of losing information at boundaries
• Common setting: 1000 token chunks with 200 token overlap (20%)

In Kairos, overlap is configurable per knowledge base. The Chunking Studio lets you experiment with different values.`,
    tags: ["chunking", "overlap", "preprocessing", "configuration"],
  },
  {
    id: "reranking",
    title: "Reranking (Cross-Encoder Scoring)",
    category: "retrieval-algorithms",
    summary: "A second-pass ranking that uses deeper relevance assessment.",
    body: `Reranking adds a second stage after initial retrieval where a more expensive model scores each chunk for relevance.

Two-stage retrieval:
Stage 1 (Retrieval): Fast, cheap — find top-K candidates using embeddings or BM25
Stage 2 (Reranking): Slower, more accurate — score each candidate using a cross-encoder or LLM

Why reranking improves results:
• Initial retrieval uses bi-encoders (query and document embedded separately) — fast but loses interaction
• Reranking uses cross-encoders (query and document processed together) — slower but more accurate
• Cross-encoders can capture nuanced relevance that embedding similarity misses

In Kairos, the Reranking strategy uses an LLM to score each chunk's relevance to the query on a 0-1 scale, then reorders results based on these scores.`,
    tags: ["reranking", "cross-encoder", "two-stage", "ranking", "advanced"],
  },
  {
    id: "context-compression",
    title: "Context Compression",
    category: "retrieval-algorithms",
    summary: "Reducing the retrieved context to fit within the LLM's context window.",
    body: `Context compression removes redundant, overlapping, or irrelevant information from retrieved chunks before sending them to the LLM.

Compression techniques:
1. Deduplication: Remove chunks with identical or near-identical content
2. Merge Overlapping: Combine chunks with high Jaccard similarity (>60%)
3. Trim Redundancy: Remove sentences that repeat information from other sentences
4. Token Budget: Truncate to fit within the LLM's maximum context window

Why compression matters:
• LLMs have limited context windows (typically 4K-128K tokens)
• More context doesn't always mean better answers — noise hurts quality
• Compression reduces latency and cost by sending fewer tokens
• A 50% compression rate is common with minimal quality loss

In Kairos, compression is displayed as Original Tokens → Compressed Tokens → Reduction %.`,
    tags: ["compression", "context", "optimization", "advanced"],
  },
  {
    id: "query-expansion",
    title: "Query Expansion",
    category: "retrieval-algorithms",
    summary: "Generating alternative query phrasings to improve retrieval coverage.",
    body: `Query expansion uses an LLM to generate alternative ways to express the same information need.

How it works:
1. Original query: "Who founded Kairos?"
2. LLM generates alternatives: "Kairos founder", "Who created Kairos", "Kairos origin", "Kairos founding"
3. Each variation is searched independently
4. Results are merged with deduplication

Why query expansion helps:
• Users may not use the exact terminology present in documents
• Different phrasings can retrieve different relevant chunks
• Coverage of edge cases and synonyms improves recall

In Kairos, query expansion is optional and configurable in the Retrieval Lab. When enabled, it shows the expanded queries in the explainable pipeline view.`,
    tags: ["query-expansion", "llm", "retrieval", "advanced"],
  },
  {
    id: "hybrid-search",
    title: "Hybrid Search (Vector + Keyword)",
    category: "retrieval-algorithms",
    summary: "Combining semantic and lexical search for better coverage.",
    body: `Hybrid search combines the strengths of semantic (vector) search and lexical (keyword) search.

Why hybrid outperforms either alone:
• Vector search excels at synonyms, paraphrases, and conceptual matches
• BM25 excels at exact term matches, proper nouns, and domain-specific jargon
• Together, they cover more query types than either alone

The fusion process:
1. Run vector search and BM25 search independently
2. Normalize scores from both sources
3. Apply Reciprocal Rank Fusion (RRF) to combine rankings
4. Return the merged, re-ranked results

In Kairos, you can adjust the weight of each component (vector vs keyword) to tune the balance for your specific use case. A 50/50 balance is a good starting point.`,
    tags: ["hybrid", "vector", "bm25", "fusion", "strategy"],
  },
  {
    id: "chunking-strategies",
    title: "Chunking Strategies",
    category: "chunking",
    summary: "Different approaches to dividing documents into retrievable pieces.",
    body: `Chunking is the process of dividing documents into smaller pieces (chunks) that can be individually retrieved.

Kairos supports 5 chunking strategies:

1. Recursive: Tries sentence, then paragraph, then character boundaries. Best general-purpose.
2. Sentence: Splits on sentence boundaries. Ideal for factual Q&A where each sentence is self-contained.
3. Fixed: Fixed-size chunks with overlap. Most predictable but may split content mid-sentence.
4. Markdown: Respects Markdown headings. Best for documentation and structured content.
5. Semantic: Groups semantically related paragraphs using embedding similarity. Best for narrative content.

Strategy comparison:
• Recursive: Best balance for general use
• Sentence: Best for precision (each chunk is one idea)
• Markdown: Best for hierarchical content
• Semantic: Best recall for complex topics

Choosing the right strategy depends on your document type and use case.`,
    tags: ["chunking", "strategy", "preprocessing", "comparison"],
  },
  {
    id: "multi-query",
    title: "Multi-Query Retrieval",
    category: "retrieval-algorithms",
    summary: "Searching multiple semantic variations of a query independently.",
    body: `Multi-query retrieval generates diverse semantic interpretations of a query and searches each one independently.

How it differs from Query Expansion:
• Query Expansion: Generates alternative phrasings (synonyms, rewordings)
• Multi-Query: Generates different facets or perspectives of the question

Example:
Query: "How does Kairos handle document retrieval?"
Multi-Query variations:
1. "Kairos retrieval pipeline architecture"
2. "Document chunking and indexing in Kairos"
3. "Kairos search and ranking algorithms"

Each variation may retrieve completely different relevant documents. Results are merged with deduplication, and chunks retrieved by multiple queries get a score boost.

Multi-query is particularly effective for complex, multi-faceted questions.`,
    tags: ["multi-query", "variations", "retrieval", "advanced"],
  },
  {
    id: "top-k",
    title: "Top-K (Number of Retrieved Chunks)",
    category: "configuration",
    summary: "The number of most relevant chunks to retrieve for each query.",
    body: `Top-K controls how many chunks are retrieved from the vector store for each query.

How to choose Top-K:
• Low (1-3): Fast, low cost, but may miss relevant information. Best for simple, factual queries.
• Medium (4-10): Good balance. Most common setting. Recommended for general use.
• High (10-20): Slower, higher cost, but better recall. Best for complex, research-oriented queries.

Impact on metrics:
• Higher K typically increases Recall@K but decreases Precision@K
• Higher K increases latency and token usage
• The optimal K depends on your chunk size and document structure

Rule of thumb: Start with K = 5 for QA and K = 10 for research/analysis tasks.`,
    tags: ["top-k", "configuration", "parameter", "optimization"],
  },
  {
    id: "faithfulness",
    title: "Faithfulness (Answer Consistency)",
    category: "generation-metrics",
    summary: "Measures whether the generated answer is consistent with the retrieved context.",
    body: `Faithfulness evaluates whether the LLM's response stays true to the provided context without hallucinating.

How it's measured: The generated answer is decomposed into individual claims. Each claim is checked for support in the retrieved context using keyword overlap or LLM-based verification.

Formula: Faithfulness = (Supported claims) / (Total claims)

Score interpretation:
• 1.0: Every claim in the answer is supported by the context
• 0.7-0.9: Minor unsupported details, generally reliable
• Below 0.7: Significant hallucination — the LLM is inventing information

Why faithfulness matters: Low faithfulness indicates the LLM is hallucinating. This is the most critical generation quality metric for production RAG systems.

In Kairos, faithfulness is measured using a keyword-overlap approach where each sentence in the answer is checked against the retrieved context.`,
    tags: ["faithfulness", "hallucination", "generation", "metric", "critical"],
  },
  {
    id: "confidence-interval",
    title: "Confidence Intervals (95% CI)",
    category: "statistics",
    summary: "The range within which the true metric value lies with 95% confidence.",
    body: `A confidence interval gives a range of plausible values for a metric, accounting for random variation.

Formula (t-distribution):
CI = mean ± t(α/2, n-1) × (stdDev / √n)

where:
• mean = sample mean
• t(α/2, n-1) = critical value from t-distribution
• stdDev = sample standard deviation
• n = sample size

Why confidence intervals matter for experiments:
• A single run may have high variance — the CI tells you the plausible range
• Non-overlapping CIs between two strategies strongly suggest one is better
• Wide CIs indicate high variance — you need more test queries

In Kairos, 95% confidence intervals are computed for all metrics using the t-distribution.`,
    tags: ["statistics", "confidence-interval", "analysis", "advanced"],
  },
];
