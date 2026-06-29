# API Platform Plan

**Phase 14 — Product Transformation**  
**Status:** Planning  

---

## API Design Principles

| Principle | Implementation |
|-----------|---------------|
| Versioned | All endpoints under `/api/v1/` |
| RESTful | Resource-oriented, stateless |
| Authenticated | API keys + JWT bearer tokens |
| Rate Limited | Per-key and per-IP token buckets |
| Observable | Every request logged + metered |
| Backward Compatible | No breaking changes within v1 |

---

## Authentication

### API Key Authentication

```
Header: X-API-Key: kai_sk_<prefix>_<hash>
```

- Keys are generated with a `kai_sk_` prefix for easy identification
- Keys are hashed on storage (bcrypt/SHA-256)
- Keys can be scoped to specific projects
- Keys have an optional expiration
- Keys can be revoked instantly

### JWT Authentication

```
Header: Authorization: Bearer <jwt_token>
```

- Short-lived access tokens (15 minutes)
- Refresh tokens (7 days, rotating)
- Issued by NextAuth.js after login
- Used by the web dashboard

---

## API Endpoints

### Query Endpoint

```
POST /api/v1/query
```

**Request:**
```json
{
  "query": "What is our refund policy?",
  "project_id": "proj_abc123",
  "stream": false,
  "strategy": "auto"
}
```

**Response:**
```json
{
  "query_id": "qry_xyz789",
  "answer": "Our refund policy allows returns within 30 days...",
  "confidence": 0.94,
  "strategy": "hybrid",
  "latency_ms": 163,
  "cost": 0.0145,
  "chunks": [
    {
      "document": "policy.pdf",
      "page": 3,
      "text": "Customers may return items within 30 days...",
      "relevance": 0.92
    }
  ]
}
```

**Errors:**
| Code | Description |
|------|-------------|
| 400 | Invalid query (empty, too long) |
| 401 | Missing or invalid API key |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### Query Streaming

```
POST /api/v1/query
Content-Type: application/json
Accept: text/event-stream

{
  "query": "Explain our revenue trends",
  "project_id": "proj_abc123",
  "stream": true
}
```

**Response (SSE):**
```
event: chunk
data: {"type": "analysis", "content": "Analyzing query complexity..."}

event: chunk
data: {"type": "strategy", "content": "Selected: multi-hop retrieval"}

event: chunk
data: {"type": "retrieval", "content": "Found 3 relevant documents"}

event: chunk
data: {"type": "answer", "content": "Based on your Q3 financial data..."}

event: done
data: {"query_id": "qry_xyz789", "latency_ms": 1450, "cost": 0.032}
```

### Document Ingestion

```
POST /api/v1/ingest
Content-Type: multipart/form-data

file: <document.pdf>
project_id: proj_abc123
metadata: {"source": "finance", "tags": ["quarterly", "2026"]}
```

**Response:**
```json
{
  "job_id": "job_def456",
  "status": "processing",
  "document_id": "doc_ghi789",
  "estimated_time_seconds": 12
}
```

### Job Status

```
GET /api/v1/jobs/{job_id}
```

**Response:**
```json
{
  "job_id": "job_def456",
  "status": "completed",
  "progress": 1.0,
  "document_id": "doc_ghi789",
  "chunks": 47,
  "created_at": "2026-06-25T10:00:00Z",
  "completed_at": "2026-06-25T10:00:12Z"
}
```

### API Keys Management

```
GET    /api/v1/keys                    List all keys
POST   /api/v1/keys                    Create a new key
GET    /api/v1/keys/{key_id}           Get key details
DELETE /api/v1/keys/{key_id}           Revoke a key
GET    /api/v1/keys/{key_id}/usage     Get key usage stats
```

### Usage & Analytics

```
GET /api/v1/usage
  ?start_date=2026-06-01
  &end_date=2026-06-25
  &granularity=day
  &project_id=proj_abc123
```

**Response:**
```json
{
  "total_queries": 84291,
  "total_cost": 1222.34,
  "average_latency_ms": 163,
  "average_confidence": 0.87,
  "strategy_breakdown": {
    "simple": 42145,
    "complex": 25300,
    "multi_hop": 16846
  },
  "daily": [
    {"date": "2026-06-01", "queries": 2841, "cost": 41.20},
    {"date": "2026-06-02", "queries": 3012, "cost": 43.67}
  ]
}
```

### Billing

```
GET /api/v1/billing/plan              Current plan details
GET /api/v1/billing/invoices          Invoice history
POST /api/v1/billing/payment-method   Add payment method
POST /api/v1/billing/upgrade          Change plan
```

---

## Rate Limiting

| Tier | Rate Limit | Burst |
|------|-----------|-------|
| Free | 10 req/s | 20 |
| Developer | 100 req/s | 200 |
| Pro | 500 req/s | 1000 |
| Enterprise | Custom | Custom |

Headers returned:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1627200000
```

---

## SDK Support

| SDK | Status | Features |
|-----|--------|----------|
| Python | ✅ Existing (`sdk/keiro/`) | query, ingest, async, streaming |
| Go | 🔧 Planned | query, ingest, streaming |
| TypeScript | 🔧 Planned | query, ingest, streaming |
| REST | ✅ Always | curl, any HTTP client |

---

## Error Handling

All errors return a consistent format:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "API rate limit exceeded. Retry after 30 seconds.",
    "status": 429,
    "request_id": "req_abc123"
  }
}
```

Common error codes:
| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `invalid_api_key` | 401 | Missing or invalid API key |
| `rate_limit_exceeded` | 429 | Too many requests |
| `invalid_query` | 400 | Query validation failed |
| `project_not_found` | 404 | Project does not exist |
| `insufficient_quota` | 402 | Usage quota exceeded |
| `internal_error` | 500 | Server error (contact support) |
| `service_unavailable` | 503 | Temporary outage |

---

## API Versioning Strategy

- `/api/v1/` — Current stable version
- `/api/v2/` — Future breaking changes (with migration guide)
- Deprecated endpoints return `Sunset` header
- Minimum 6 months deprecation notice for breaking changes
- Changelog published for every API change

---

## OpenAPI Specification

The API will be documented via OpenAPI 3.1:

- `apps/portal/public/openapi.json` — Published spec
- `/api/v1/openapi.json` — Served by FastAPI
- Generated client libraries from spec
- Interactive playground at `/docs/api-playground`
