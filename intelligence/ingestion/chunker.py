from math import sqrt
from intelligence.embeddings.base_embedder import BaseEmbedder
from semantic_text_splitter import TextSplitter


def calculate_cosine_similarity(embed_a: list[float], embed_b: list[float]):
    dot_prod = 0
    a_sq_sum = 0
    b_sq_sum = 0

    for i in range(len(embed_a)):
        dot_prod += embed_a[i] * embed_b[i]
        a_sq_sum += embed_a[i] ** 2
        b_sq_sum += embed_b[i] ** 2

    a_mag, b_mag = sqrt(a_sq_sum), sqrt(b_sq_sum)
    if a_mag == 0 or b_mag == 0:
        return 0.0
    cosine_sim = dot_prod / (a_mag * b_mag)
    return cosine_sim


class Chunker:
    def __init__(self, embedder: BaseEmbedder, chunk_size: int, overlap: int):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.embedder = embedder
        self.text_splitter = TextSplitter(
            capacity=self.chunk_size, overlap=self.overlap
        )

    def chunk(self, text: str, strategy: int) -> list[str]:
        if not text or not text.strip():
            return [text] if text else []

        if strategy == 0 or strategy == 1:
            return self._fixed_size(text)

        if strategy == 2:
            return self._structural(text)

        if strategy == 3:
            return self._semantic(text)

        else:
            raise ValueError("Enter correct strategy")

    def _fixed_size(self, text: str):
        return self.text_splitter.chunks(text)

    def _structural(self, text: str):
        chunks = text.split("\f")
        # Apply secondary size-based split to prevent unbounded single chunks
        result = []
        for chunk in chunks:
            if len(chunk) > self.chunk_size:
                result.extend(self.text_splitter.chunks(chunk))
            else:
                result.append(chunk)
        return result

    def _semantic(self, text: str):
        sentences = text.split(". ")
        if not sentences:
            return [text]
        embeddings = self.embedder.embed_batch(sentences)
        chunks = []
        chunk = [sentences[0]]
        for k in range(1, len(embeddings)):
            sim = calculate_cosine_similarity(embeddings[k - 1], embeddings[k])
            if sim > 0.90:
                chunk.append(sentences[k])
            else:
                chunks.append(". ".join(chunk))
                chunk = [sentences[k]]
        if chunk:
            chunks.append(". ".join(chunk))
        return chunks
