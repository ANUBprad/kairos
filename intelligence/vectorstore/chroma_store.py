from chromadb import HttpClient, Include
from chromadb.errors import NotFoundError, InvalidArgumentError


class ChromaStore:
    def __init__(self, host: str, port: int):
        self.HOST = host
        self.PORT = port
        self.client = HttpClient(host=self.HOST, port=self.PORT)

    def upsert(self, namespace: str, chunks: list, embeddings: list, filename: str):
        collection = self.client.get_or_create_collection(name=namespace)

        ids = [f"{filename}_{idx}" for idx in range(len(chunks))]
        metadatas = [
            {"source": filename, "chunk_index": idx} for idx in range(len(chunks))
        ]
        collection.upsert(
            ids=ids, documents=chunks, metadatas=metadatas, embeddings=embeddings
        )

    def query(
        self, namespace: str, top_k: int, query_embed, return_embeddings: bool = False
    ):
        try:
            collection = self.client.get_collection(name=namespace)
        except NotFoundError as e:
            raise ValueError(f"Unable to find the namespace. Error: {e}") from e
        except (InvalidArgumentError, ConnectionError, OSError, ValueError) as e:
            raise ConnectionError(
                f"Vector store unavailable for namespace '{namespace}': {e}"
            ) from e

        include: Include = ["documents", "distances", "metadatas"]

        if return_embeddings:
            include.append("embeddings")

        try:
            retrieved_result = collection.query(
                query_embeddings=query_embed,
                n_results=top_k,
                include=include,
            )
        except (ConnectionError, OSError, ValueError) as e:
            raise ConnectionError(
                f"Vector store unavailable for namespace '{namespace}': {e}"
            ) from e

        return retrieved_result

    def get_all_chunks(self, namespace: str):
        try:
            collection = self.client.get_collection(name=namespace)
            all_chunks = collection.get()
        except NotFoundError as e:
            raise ValueError(
                f"Unable to find the namespace. Error: {e}"
            ) from e
        except (ConnectionError, OSError, ValueError) as e:
            raise ConnectionError(
                f"Vector store unavailable for namespace '{namespace}': {e}"
            ) from e
        if not all_chunks.get("documents"):
            return []
        return all_chunks["documents"]
