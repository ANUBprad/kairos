from sentence_transformers import CrossEncoder
import heapq


class CrossEncoderReranker:
    def __init__(self, cross_encoding_model: CrossEncoder):
        self.cross_encoder = cross_encoding_model

    def rerank(self, query: str, chunks: list[str], top_k: int):
        if not chunks:
            return []

        query_chunk_pair = [(query, chunk) for chunk in chunks]
        scores = self.cross_encoder.predict(query_chunk_pair)

        top_k = min(top_k, len(chunks))
        top_indices = heapq.nlargest(top_k, range(len(scores)), key=lambda i: scores[i])
        return [chunks[i] for i in top_indices]
