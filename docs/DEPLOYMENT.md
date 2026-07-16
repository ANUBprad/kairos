# Deployment Guide

Complete guide for deploying Kairos to production.

---

## Deployment Options

| Option | Description | Best For |
|--------|-------------|----------|
| **Docker Compose** | Full stack with all services | Development, small deployments |
| **Vercel + Supabase** | Frontend on Vercel, DB on Supabase | Production web app |
| **Self-Hosted** | All services on your infrastructure | Enterprise, compliance |

---

## 1. Docker Compose Deployment (Recommended)

### Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+
- 8GB RAM minimum
- OpenAI or Gemini API key

### Quick Start

```bash
# Clone repository
git clone https://github.com/ANUBprad/kairos.git
cd kairos

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker compose up -d

# Verify services
docker compose ps
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Portal | 3000 | Next.js frontend |
| Gateway | 8080 | Go HTTP gateway |
| Intelligence | 28080 | Python RAG engine |
| ChromaDB | 7777 | Vector store |
| PostgreSQL | 5432 | Database |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3001 | Metrics dashboards |

### Environment Variables

```env
# Database (Required)
DATABASE_URL="postgresql://postgres:postgres@db:5432/kairos"
DIRECT_URL="postgresql://postgres:postgres@db:5432/kairos"

# AI Providers (At least one required)
OPENAI_API_KEY="sk-..."
GEMINI_API_KEY="AIza..."

# Auth (Required)
BETTER_AUTH_SECRET="your-secret-here"

# File Storage (Required for uploads)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Optional
PROMETHEUS_PORT=9090
GRAFANA_PASSWORD="admin"
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  portal:
    build:
      context: ./apps/portal
      dockerfile: ../../docker/Dockerfile.portal
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - DIRECT_URL=${DIRECT_URL}
      - BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
      - NEXT_PUBLIC_BETTER_AUTH_URL=${NEXT_PUBLIC_BETTER_AUTH_URL:-http://localhost:3000}
    depends_on:
      - db
      - intelligence
      - gateway

  gateway:
    build:
      context: ./gateway
      dockerfile: ../docker/Dockerfile.gateway
    ports:
      - "8080:8080"
    environment:
      - INTELLIGENCE_URL=intelligence:28080
    depends_on:
      - intelligence

  intelligence:
    build:
      context: .
      dockerfile: docker/Dockerfile.intelligence
    ports:
      - "28080:28080"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - CHROMA_HOST=chroma
      - DATABASE_URL=${DATABASE_URL}
    depends_on:
      - chroma
      - db

  chroma:
    image: chromadb/chroma:latest
    ports:
      - "7777:8000"
    volumes:
      - chroma_data:/chroma/chroma

  db:
    image: pgvector/pgvector:pg15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=kairos
    volumes:
      - pg_data:/var/lib/postgresql/data

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}

volumes:
  pg_data:
  chroma_data:
```

### Useful Commands

```bash
# View logs
docker compose logs -f portal
docker compose logs -f intelligence

# Restart a service
docker compose restart intelligence

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v

# Rebuild after changes
docker compose up -d --build
```

---

## 2. Vercel + Supabase Deployment

### Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Get connection strings from Settings > Database:
   - **Transaction mode** (for `DATABASE_URL`)
   - **Session mode** (for `DIRECT_URL`)

### GitHub OAuth Setup

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Create new OAuth App:
   - **Homepage URL:** `https://your-domain.vercel.app`
   - **Callback URL:** `https://your-domain.vercel.app/api/auth/callback/github`

### Vercel Configuration

1. Import repository at [vercel.com](https://vercel.com)
2. Configure:
   - **Framework:** Next.js
   - **Root Directory:** `apps/portal`
   - **Build Command:** `npm run build`
3. Set environment variables in Settings

### Environment Variables for Vercel

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Supabase transaction mode connection string |
| `DIRECT_URL` | Supabase session mode connection string |
| `BETTER_AUTH_SECRET` | Random 32-byte base64 string |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://your-domain.vercel.app` |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

### Generate Auth Secret

```bash
openssl rand -base64 32
```

---

## 3. Self-Hosted Deployment

### Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- Docker and Docker Compose
- Domain name with SSL
- Reverse proxy (nginx/caddy)

### Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Clone repository
git clone https://github.com/ANUBprad/kairos.git /opt/kairos
cd /opt/kairos

# Configure environment
cp .env.example .env
nano .env  # Add your configuration

# Start services
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
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    location /api/intelligence {
        proxy_pass http://localhost:28080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
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

### Security

- [ ] Generate strong `BETTER_AUTH_SECRET`
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure CORS for production domain only
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Review Cloudinary security settings

### Database

- [ ] Enable pgvector extension
- [ ] Set up automated backups
- [ ] Configure connection pooling
- [ ] Set up monitoring
- [ ] Test backup restoration

### Monitoring

- [ ] Configure Prometheus scraping
- [ ] Set up Grafana dashboards
- [ ] Configure alerting rules
- [ ] Set up log aggregation
- [ ] Monitor resource usage

### Performance

- [ ] Enable response caching
- [ ] Configure connection limits
- [ ] Set up CDN for static assets
- [ ] Optimize database queries
- [ ] Enable compression

### Backup & Recovery

- [ ] Automated database backups
- [ ] Document backup restoration process
- [ ] Test disaster recovery
- [ ] Set up off-site backups

---

## 5. Troubleshooting

### Build Fails

```bash
# Clean Docker cache
docker system prune -a

# Rebuild from scratch
docker compose build --no-cache
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker compose exec db pg_isready

# Test connection
docker compose exec db psql -U postgres -d kairos -c "SELECT 1"

# Enable pgvector
docker compose exec db psql -U postgres -d kairos -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Intelligence Engine Issues

```bash
# Check logs
docker compose logs intelligence

# Test health endpoint
curl http://localhost:28080/health

# Restart service
docker compose restart intelligence
```

### Vector Store Issues

```bash
# Check ChromaDB status
curl http://localhost:7777/api/v1/heartbeat

# List collections
curl http://localhost:7777/api/v1/collections
```

---

## 6. Rollback Procedures

### Rollback Vercel Deployment

1. Go to Vercel Dashboard > Deployments
2. Find last working deployment
3. Click **...** > **Promote to Production**

### Rollback Docker Deployment

```bash
# List images
docker images

# Tag previous version
docker tag kairos-portal:previous kairos-portal:latest

# Restart with previous version
docker compose up -d
```

### Rollback Database

```bash
# From backup
docker compose exec db psql -U postgres -d kairos < backup.sql

# Or restore from Supabase dashboard
```

---

## 7. Scaling

### Horizontal Scaling

```yaml
# docker-compose.yml
services:
  portal:
    deploy:
      replicas: 3
  
  gateway:
    deploy:
      replicas: 2
  
  intelligence:
    deploy:
      replicas: 3
```

### Vertical Scaling

Increase resources for individual services:

```yaml
services:
  intelligence:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
```

### Load Balancing

Use a load balancer (HAProxy, Traefik) for multiple instances:

```yaml
# traefik.yml
http:
  routers:
    portal:
      rule: "Host(`your-domain.com`)"
      service: portal
      tls:
        certResolver: letsencrypt
  services:
    portal:
      loadBalancer:
        servers:
          - url: "http://portal1:3000"
          - url: "http://portal2:3000"
```

---

## 8. Monitoring & Alerting

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'gateway'
    static_configs:
      - targets: ['gateway:8080']
  
  - job_name: 'intelligence'
    static_configs:
      - targets: ['intelligence:28080']
```

### Grafana Dashboards

Import pre-built dashboards:
1. Portal dashboard: `grafana/dashboards/portal.json`
2. Gateway dashboard: `grafana/dashboards/gateway.json`
3. Intelligence dashboard: `grafana/dashboards/intelligence.json`

### Alert Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: kairos
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
      
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
```
