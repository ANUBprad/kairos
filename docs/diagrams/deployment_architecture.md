# Deployment Architecture

```mermaid
graph TD
    A[Client] --> B[Load Balancer]
    B --> C[Next.js App]
    C --> D[API Layer]
    D --> E[Database]
    D --> F[Vector Store]
```