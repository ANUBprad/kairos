from abc import abstractmethod, ABC
from intelligence.embeddings.base_embedder import BaseEmbedder
from intelligence.vectorstore.chroma_store import ChromaStore


class BaseRetriever(ABC):
    def __init__(self, embedder: BaseEmbedder, store: ChromaStore):
        self.store = store
        self.embedder = embedder

    @abstractmethod
    def retrieve_top_k(self, namespace: str, top_k: int, query: str):
        raise NotImplementedError
