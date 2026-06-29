# Deployment Plan

**Phase 14 — Product Transformation**  
**Status:** Planning  

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Vercel                              │
│  apps/portal/ (Next.js)                                  │
│  ● Marketing Site (SSG + ISR)                            │
│  ● Auth Pages (SSR)                                      │
│  ● Dashboard (CSR)                                       │
│  ● API Rewrites → api.kairos.dev                         │
└─────────────────────────────────────────────────────────┘
                           │
                    DNS: api.kairos.dev
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 Docker Host (VPS / AWS / GCP)             │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Gateway  │  │Intelligen│  │   API    │  │  Worker  │ │
│  │  (Go)     │  │ce (Python│  │FastAPI   │  │(Python)  │ │
│  │  :8080    │  │:28080    │  │:8000     │  │          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│       │              │                            │      │
│       └──────────────┴────────────────────────────┘      │
│                          │                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Postgres │  │  Redis   │  │ ChromaDB │                │
│  │  :5432   │  │  :6379   │  │  :7777   │                │
│  └──────────┘  └──────────┘  └──────────┘                │
│                                                          │
│  ┌──────────┐  ┌──────────┐                               │
│  │Prometheus│  │ Grafana  │                               │
│  │  :9090   │  │  :3000   │                               │
│  └──────────┘  └──────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

## Infrastructure Components

### Frontend: Vercel

| Setting | Value |
|---------|-------|
| Framework | Next.js 15 |
| Node | 22.x |
| Build Command | `cd apps/portal && npm run build` |
| Output Directory | `apps/portal/.next` |
| Install Command | `cd apps/portal && npm ci` |
| Regions | IAD1 (us-east-1) default |
| Preview Deployments | Every PR |
| Production Branch | `main` |
| Environment Variables | Via Vercel Dashboard |

### Backend: Docker Host

| Provider | Option |
|----------|--------|
| Primary | AWS ECS Fargate (serverless containers) |
| Alternative | DigitalOcean App Platform |
| Alternative | Railway / Render |
| Self-hosted | Docker Compose on VPS (Hetzner, Linode) |

### Database: Postgres

| Provider | Option |
|----------|--------|
| Primary | Supabase (managed Postgres) |
| Alternative | AWS RDS |
| Alternative | Railway Postgres |
| Connection | TLS required, connection pooling via PgBouncer |

### Cache: Redis

| Provider | Option |
|----------|--------|
| Primary | Upstash (serverless Redis) |
| Alternative | Redis Cloud |
| Self-hosted | Docker Redis container |

### Vector Store: ChromaDB

| Provider | Option |
|----------|--------|
| Self-hosted | Docker container (current) |
| Alternative | Pinecone / Weaviate Cloud |

---

## Environment Configuration

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | kairos.dev | Public |
| Staging | staging.kairos.dev | Pre-release QA |
| Development | localhost:3000 | Local development |

### Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=https://kairos.dev
NEXT_PUBLIC_API_URL=https://api.kairos.dev

# Auth
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
RESEND_API_KEY=...

# API Keys
KEIRO_SECRET=...
KEIRO_API_SECRET=...

# LLM Providers
GEMINI_API_KEY=...
OPENAI_API_KEY=...
GROQ_API_KEY=...

# Database
DATABASE_URL=postgres://user:pass@host:5432/kairos
REDIS_URL=redis://host:6379

# Vector Store
CHROMA_HOST=chromadb
CHROMA_PORT=7777

# Storage
BLOB_STORAGE_URL=...

# Billing
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

# Monitoring
GRAFANA_PASSWORD=...
```

---

## CI/CD Pipeline

```yaml
pull_request:
  - lint (ESLint, Ruff, Go vet)
  - typecheck (TypeScript, mypy)
  - test (pytest, vitest)
  - build (Next.js, Docker)

push to main:
  - lint + typecheck + test + build
  - Deploy to Vercel Preview
  - Build and push Docker images

tag v*:
  - Deploy to Vercel Production
  - Deploy Docker images to production
  - Run migrations
  - Run smoke tests
```

---

## Database Migrations

| Tool | Purpose |
|------|---------|
| Prisma | Schema management, migrations, client generation |
| Migration files | `apps/portal/prisma/migrations/` |
| CI check | `prisma migrate dev` in preview |
| Production | `prisma migrate deploy` in release |

---

## Monitoring & Alerting

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| Uptime | Better Uptime | < 99.9% |
| API Latency P95 | Grafana | > 500ms |
| Error Rate | Grafana | > 1% |
| Rate Limit Hits | Grafana | > 10% of requests |
| Queries per Minute | Grafana | > 80% of tier limit |
| Cost per Query | Grafana | > $0.05 |
| Certificate Expiry | Better Uptime | < 30 days |

---

## Scaling Strategy

### Horizontal Scaling

| Service | Strategy |
|---------|----------|
| Next.js | Vercel auto-scaling (edge + serverless functions) |
| Go Gateway | Multiple containers behind load balancer |
| Python Intelligence | Multiple workers + task queue |
| FastAPI | Multiple uvicorn workers per container |
| Postgres | Read replicas for analytics queries |
| Redis | Cluster mode for large cache |

### Vertical Scaling

- Docker host: Start at 4 vCPU / 8GB RAM
- Increase based on Prometheus resource metrics
- Auto-scaling groups for production

---

## Backup Strategy

| Data | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Postgres | Daily | 30 days | pg_dump → S3 |
| Usage Records | Continuous | 90 days | In-database retention |
| Vector Embeddings | Weekly | 30 days | ChromaDB snapshot |
| Configuration | On change | Indefinite | Git + environment vars |

---

## Incident Response

| Severity | Response Time | Example |
|----------|--------------|---------|
| P0 | < 5 minutes | Complete outage |
| P1 | < 15 minutes | Degraded performance |
| P2 | < 1 hour | Non-critical bug |
| P3 | < 1 week | Minor issue |

## Security Checklist (Pre-Launch)

- [ ] TLS 1.3 enabled on all endpoints
- [ ] API keys hashed at rest (bcrypt)
- [ ] No secrets in source code (confirmed)
- [ ] Rate limiting enabled on all public endpoints
- [ ] CORS restricted to known origins
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (React escaping, CSP headers)
- [ ] CSRF protection (SameSite cookies, CSRF tokens)
- [ ] DDoS protection (Cloudflare)
- [ ] Dependency vulnerability scan (npm audit, pip audit)
- [ ] Penetration test (third-party)
- [ ] GDPR compliance reviewed
