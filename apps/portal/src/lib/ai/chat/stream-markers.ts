export const GENERATION_FAILED_TEXT = "**Generation failed.**";
export const GENERATION_STOPPED_TEXT = "**Generation stopped.**";
// Server-side deterministic answer for a turn whose retrieval found no usable
// content. Emitted without ever calling the LLM and never carries fabricated
// citations.
export const EMPTY_RETRIEVAL_TEXT = "No relevant documents were found for this query. Ask about something already in this knowledge base, or upload documents covering it first.";
