# Evaluation Pipeline

```mermaid
flowchart TD
    A[Dataset] --> B[Queries]
    B --> C[Retrieval]
    C --> D[Evaluation]
    D --> E[Metrics]
    E --> F[Report]
```