# Retrieval Flow

```mermaid
flowchart TD
    A[User Query] --> B[Query Processing]
    B --> C[Embedding]
    C --> D[Vector Search]
    D --> E[Reranking]
    E --> F[Results]
```