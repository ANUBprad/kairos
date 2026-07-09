export type {
  RetrievalChunk,
  RetrievalStep,
  PromptConstruction,
  RetrievalTrace,
  SimilarityMatrix,
  WhyNotRetrieved,
  RetrievalComparison,
  Citation,
} from "./types";

export {
  RetrievalTraceBuilder,
  cosineSimilarity,
  rankChunksBySimilarity,
  filterChunksAboveThreshold,
  getChunkOverlap,
  getChunksOnlyInA,
} from "./retrieval-trace";

export {
  buildSimilarityMatrix,
  getHeatmapCells,
  similarityToColor,
  similarityToOpacity,
  getSimilarityDistribution,
} from "./similarity-heatmap";

export {
  inspectChunk,
  inspectChunks,
  getChunkSummary,
  truncateContent,
  highlightSimilarity,
} from "./chunk-explorer";

export {
  analyzePrompt,
  formatPromptForDisplay,
  extractCitationsFromPrompt,
  getPromptTokenBreakdown,
} from "./prompt-viewer";

export {
  findCitationsInAnswer,
  getCitationCoverage,
  formatCitationOverlay,
  getUnclaimedChunks,
} from "./citation-overlay";

export {
  analyzeWhyNotRetrieved,
  categorizeNotRetrieved,
  getWhyNotRetrievedInsights,
} from "./why-not-retrieved";

export {
  compareRetrievalTraces,
  getComparisonSummary,
  getComparisonInsights,
} from "./retrieval-comparison";
