export class BM25 {
  private documents: string[] = [];
  private docCount = 0;
  private avgDocLen = 0;
  private termDocFreq: Map<string, number> = new Map();
  private termInDoc: Map<string, Set<number>> = new Map();
  private built = false;

  private k1 = 1.2;
  private b = 0.75;

  build(documents: string[]): void {
    this.documents = documents;
    this.docCount = documents.length;
    this.termDocFreq.clear();
    this.termInDoc.clear();

    let totalLen = 0;

    for (let i = 0; i < documents.length; i++) {
      const terms = this.tokenize(documents[i]);
      totalLen += terms.length;
      const seen = new Set<string>();

      for (const term of terms) {
        const freq = this.termDocFreq.get(term) || 0;
        this.termDocFreq.set(term, freq + 1);

        if (!seen.has(term)) {
          seen.add(term);
          const docs = this.termInDoc.get(term) || new Set();
          docs.add(i);
          this.termInDoc.set(term, docs);
        }
      }
    }

    this.avgDocLen = this.docCount > 0 ? totalLen / this.docCount : 0;
    this.built = true;
  }

  score(query: string, docIndex: number): number {
    if (!this.built) return 0;
    const doc = this.documents[docIndex];
    if (!doc) return 0;

    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(doc);
    const docLen = docTerms.length;
    const termFreqs = new Map<string, number>();

    for (const term of docTerms) {
      termFreqs.set(term, (termFreqs.get(term) || 0) + 1);
    }

    let score = 0;
    for (const term of queryTerms) {
      const tf = termFreqs.get(term) || 0;
      if (tf === 0) continue;

      const df = this.termDocFreq.get(term) || 0;
      const idf = Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));

      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLen));
      score += idf * (numerator / denominator);
    }

    return score;
  }

  search(query: string, topK: number): Array<{ index: number; score: number }> {
    if (!this.built || this.docCount === 0) return [];

    const scores: Array<{ index: number; score: number }> = [];
    for (let i = 0; i < this.documents.length; i++) {
      const s = this.score(query, i);
      if (s > 0) {
        scores.push({ index: i, score: s });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && t.length < 100);
  }

  getStats() {
    return {
      docCount: this.docCount,
      avgDocLen: Math.round(this.avgDocLen),
      uniqueTerms: this.termDocFreq.size,
      built: this.built,
    };
  }
}
