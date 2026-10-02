# Deployment Guide

Guide for deploying Kairos.

---

## Deployment Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Docker Compose** | Full stack with all services | Development, small deployments |
| **Vercel + Supabase** | Portal frontend on Vercel, DB on Supabase | Production web app |
| **Self-Hosted** | All services on your infrastructure | Enterprise, compliance |

---

## 1. Docker Compose Deployment (Recommended)

### Prerequisites

- Docker Engine 20.10+ and Docker Compose v2+
- 8GB RAM minimum
- A PostgreSQL instance reachable via `DATABASE_URL`
- At least one AI provider configured (OpenAI, Gemini, or Ollama)

### Quick Start

```bash
git clone https://github.com/ANUBprad/kairos.git
cd kairos

cp .env.example .env
# Edit .env: set DATABASE_URL, BETTER_AUTH_SECRET and an AI provider key

docker compose up -d
docker compose ps   # wait for services to become healthy
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | App database and production vector store (pgvector) — matches the default `DATABASE_URL` |
| Gateway | 8080 | Go HTTP gateway (legacy v1) |
| Intelligence | 28080 / 8001 | Python RAG engine, gRPC / metrics (legacy v1) |
| ChromaDB | 7777 | Vector store for the v1 stack only (legacy) |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Metrics dashboards (conflicts with a locally-run Portal on 3000) |

The **Portal** is not part of the compose stack; run it locally:

```bash
cd apps/portal
npm install
npx prisma migrate deploy
npm run dev
```

The Portal is self-contained: it calls neither the gateway nor the intelligence
engine, and it stores its vectors in PostgreSQL via pgvector. `npx prisma
migrate deploy` is what creates the pgvector extension, the pinned
`vector(768)` column and the HNSW index — Prisma's datamodel cannot express
them. Its retrieval embeddings must be 768-dimensional (Gemini
`text-embedding-004` or `embedding-001`); ingestion rejects a wider model before
calling a provider.

PostgreSQL is provided by the compose stack at `localhost:5432/kairos` (user `postgres`/`postgres`), matching the default `DATABASE_URL`. To point the Portal at a different database, set `DATABASE_URL`/`DIRECT_URL` in `.env` and run `npx prisma migrate deploy` against it instead.

### Environment Variables

```env
# Database (Required)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kairos"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/kairos"

# Auth (Required)
BETTER_AUTH_SECRET="your-secret-here"     # openssl rand -base64 32

# AI Providers (at least one)
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="AIza..."
# KAIROS_LLM_PROVIDER selects between openai/gemini/ollama

# Authentication for /api/v1/* (Required)
KAIROS_API_SECRET="your-api-secret"

# File Storage (required for artifact media uploads)
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

See [`.env.example`](.env.example) for the complete reference.

### Useful Commands

```bash
docker compose logs -f gateway intelligence
docker compose restart intelligence
docker compose down
docker compose up -d --build   # rebuild after changes
```

---

## 2. Vercel + Supabase Deployment

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Enable the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Get connection strings from Settings > Database:
   - **Transaction mode** for `DATABASE_URL`
   - **Session mode** for `DIRECT_URL`

### GitHub OAuth Setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Create a new OAuth App:
   - **Homepage URL:** `https://your-domain.vercel.app`
   - **Callback URL:** `https://your-domain.vercel.app/api/auth/callback/github`

### Vercel Configuration

1. Import the repository at [vercel.com](https://vercel.com)
2. Configure:
   - **Framework:** Next.js
   - **Root Directory:** `apps/portal`
   - **Build Command:** `npm run build`
3. Add the environment variables listed below

### Environment Variables for Vercel

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase transaction-mode connection string |
| `DIRECT_URL` | Supabase session-mode connection string |
| `BETTER_AUTH_SECRET` | Random 32-byte base64 string |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://your-domain.vercel.app` |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | Your AI provider keys |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

> A Vercel deployment serves the Portal only. The Portal calls neither the Go
> gateway nor the Python intelligence engine, so `docker compose up -d
> intelligence gateway` is **not** required for it. Those services, and
> ChromaDB, are the legacy v1 stack and run only if you intend to use that
> stack's clients.
>
> On Supabase, enable the `vector` extension before `npx prisma migrate deploy`
> (`create extension if not exists vector;`), or let the
> `20260913000000_add_embedding_vectors` migration create it if your project
> allows it. The database must be able to hold `vector(768)`, so set
> `GEMINI_EMBEDDING_MODEL` to `text-embedding-004` or `embedding-001`.

---

## 3. Self-Hosted Deployment

### Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker and Docker Compose
- Domain name with SSL and a reverse proxy (nginx/caddy)

### Server Setup

```bash
sudo apt update && sudo apt upgrade -y

curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install docker-compose-plugin

git clone https://github.com/ANUBprad/kairos.git /opt/kairos
cd /opt/kairos

cp .env.example .env
nano .env          # set DATABASE_URL, secrets, provider keys

docker compose up -d
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/gateway {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /api/intelligence {
        proxy_pass http://localhost:28080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 4. Production Checklist

- [ ] Generate strong `BETTER_AUTH_SECRET` and `KAIROS_API_SECRET` (`openssl rand -base64 32`)
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS with a valid SSL certificate
- [ ] Configure CORS for your production domain only
- [ ] Enable rate limiting
- [ ] Review Cloudinary security settings
- [ ] Set up automated database backups and test restoration
- [ ] Configure Prometheus scraping and Grafana dashboards
- [ ] Set up log aggregation / alerting rules
- [ ] Keep the gateway ↔ intelligence gRPC channel off the public internet: serve it with `KAIROS_GRPC_TLS_CERT`/`KAIROS_GRPC_TLS_KEY` (plus `KAIROS_GRPC_TLS_CA` for mTLS) or keep `KAIROS_GRPC_BIND_HOST` on loopback — the service refuses to start otherwise in production
- [ ] Set `KAIROS_ALLOWED_NAMESPACES` so the shared gateway credential cannot select every namespace

---

## 5. Troubleshooting

### Build Fails

```bash
docker system prune -a
docker compose build --no-cache
```

### Database Connection Issues

```bash
psql "$DATABASE_URL" -c "SELECT 1"
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Intelligence Engine Issues

```bash
docker compose logs intelligence
curl http://localhost:28080/health
docker compose restart intelligence
```

### Vector Store Issues

```bash
curl http://localhost:7777/api/v1/heartbeat
curl http://localhost:7777/api/v1/collections
```

---

## 6. Monitoring

### Prometheus

`prometheus.yml` scrapes the gateway (`gateway:8080`) and intelligence (`intelligence:28080`) targets.

### Grafana

A starter dashboard is provisioned from `docker/grafana/dashboards/kairos.json` on container start (config in `docker/grafana/provisioning/`).