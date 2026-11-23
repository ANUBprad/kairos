# OpenBook

<video controls width="100%" src="https://drive.google.com/uc?export=download&id=19adu2Xg9RxNBiaCceqKLcQo8PyOK44Wl">
  Your browser does not support the video tag.
</video>

**OpenBook** is an interactive AI-powered research and study studio (inspired by NotebookLM) that turns your documents, PDFs, and web links into dynamic knowledge artifacts and interactive multi-speaker debate podcasts.

Unlike static audio overviews, OpenBook introduces a **Live "Interrupt & Ask"** capability: listeners can pause the podcast mid-episode to ask the AI co-hosts questions, receive an in-character audio response grounded in their source notes, and seamlessly resume the show.

---

### 📺 Watch the Live Demo

[![Watch Demo Video](https://img.shields.io/badge/▶_Watch_Live_Demo-X_(Twitter)-1DA1F2?style=for-the-badge&logo=x&logoColor=white)](https://x.com/swamiabhishek45/status/2090689196923212107?s=20)

> **Demo Video**: [https://x.com/swamiabhishek45/status/2090689196923212107?s=20](https://x.com/swamiabhishek45/status/2090689196923212107?s=20)

---

## Key Features

- **Multi-Host AI Debate Podcasts**: Transforms source materials into dynamic, intellectual audio debate shows featuring two AI hosts (Alex, the analytical host, and Jordan, the challenger) powered by ElevenLabs voice synthesis.
- **Live "Interrupt & Ask"**: Pause the audio show at any timestamp to ask specific questions. The hosts generate an immediate conversational response grounded in your workspace documents before continuing the episode.
- **Automated Learning Artifacts**:
  - Structured Executive Reports & Summaries
  - Interactive Study Quizzes with explanations
  - Revision Flashcards
  - Visual Mind Maps
  - Key Takeaways
- **Multi-Format Source Ingestion**:
  - PDF document uploads (parsed, chunked, and stored in Cloudinary)
  - Web links and articles scraped via Firecrawl
  - YouTube video transcripts
  - Raw text notes and research snippets
- **Grounded Semantic RAG**: Vector embeddings and semantic search powered by Pinecone to ensure citations and factual accuracy without hallucinations.
- **Event-Driven Background Processing**: Asynchronous artifact generation pipeline managed by Inngest.
- **Pro Tier & Subscriptions**: Integrated Razorpay subscription workflow with usage limits, plan upgrades, and gated premium features.

---

## Tech Stack

### Frontend (`/client`)
- **Framework**: Next.js (App Router), React, TypeScript
- **Styling**: Tailwind CSS, Radix UI, Lucide Icons
- **State & Data Fetching**: TanStack React Query
- **Audio Playback**: Custom HTML5 Audio Player with dynamic seeking and real-time waveform visualizers

### Backend (`/server`)
- **Runtime**: Node.js, Express, TypeScript
- **Database & ORM**: PostgreSQL with Prisma ORM
- **Authentication**: Better-Auth (with Google OAuth & Session Management)
- **Vector Database**: Pinecone
- **Asynchronous Jobs**: Inngest
- **File & Media Storage**: Cloudinary (PDFs & Podcast Audio)
- **Payment Gateway**: Razorpay

### AI & Speech Services
- **Voice Synthesis**: ElevenLabs REST API
- **LLM Reasoning & Extraction**: Google Gemini & OpenAI GPT-4o / GPT-4o-mini
- **Web Scraping**: Firecrawl & Tavily Search

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Client                         │
│   (Studio Panel, Podcast Viewer, Chat, Workspace Layout)    │
└──────────────┬──────────────────────────────▲───────────────┘
               │                              │
          REST / SSE                     HTTP Audio
               │                              │
┌──────────────▼──────────────────────────────┴───────────────┐
│                    Express Backend Server                   │
│   (Auth, Workspace Routes, Artifact API, Audio Streaming)   │
└──────┬──────────────┬──────────────┬──────────────┬─────────┘
       │              │              │              │
┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼───────┐
│  PostgreSQL ││   Pinecone  ││  Cloudinary ││  ElevenLabs  │
│  (Prisma)   ││  Vector DB  ││ Media Store ││     TTS      │
└─────────────┘└─────────────┘└─────────────┘└──────────────┘
                      ▲
                      │ Triggers Background Jobs
               ┌──────┴──────┐
               │   Inngest   │
               │   Worker    │
               └─────────────┘
```

---

## Getting Started

### Prerequisites
- **Node.js**: v18.18+ or v20+
- **PostgreSQL**: Local instance or hosted database (e.g. Neon, Supabase, Railway)
- **API Keys**: OpenAI, Google Gemini, ElevenLabs, Cloudinary, Pinecone, and Firecrawl

---

### 1. Clone the Repository
```bash
git clone https://github.com/swamiabhishek45/chaibooklm-2.git
cd openbook
```

Install root tooling (runs server, Inngest, and client together):

```bash
npm install
npm install --prefix server
npm install --prefix client
```

Optional Postgres via Docker Compose (`DATABASE_URL=postgresql://postgres:postgres@localhost:5435/chaibook`):

```bash
docker compose up -d
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for architecture, RAG evals, and CI commands.

---

### 2. Backend Setup (`/server`)

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Configure your `.env` file with your credentials (see [Environment Variables](#environment-variables)).

5. Apply the checked-in migrations and generate the Prisma client:
   ```bash
   cd server
   npm run prisma:migrate
   npm run prisma:generate
   cd ..
   ```

6. Start the backend development server and Inngest dev server (from repo root you can run `npm run dev` instead):
   ```bash
   # Terminal 1: Express Server
   npm run dev

   # Terminal 2: Inngest Dev Server
   npm run inngest
   ```

---

### 3. Frontend Setup (`/client`)

1. Navigate to the client directory:
   ```bash
   cd ../client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment configuration:
   ```bash
   cp .env.example .env.local
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```bash
   http://localhost:3000
   ```

---

## Environment Variables

### Server (`server/.env`)

| Variable | Description |
| :--- | :--- |
| `PORT` | Backend server port (default: `8081`) |
| `NODE_ENV` | `development`, `production` or `test` |
| `DEPLOYMENT_ENV` | Explicit `local`/`staging`/`production` identity. Staging rejects any `rzp_live_*` key at startup. Defaults from `NODE_ENV` when omitted. |
| `CLIENT_URL` | Frontend origin URL, or comma-separated allowed origins (e.g. `http://localhost:3000`) |
| `TRUST_PROXY` | Optional comma-separated trusted proxy addresses; leave unset to trust none (numeric hop counts are dev-only) |
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | **Disposable** PostgreSQL URL used only by integration tests. Never point at production or a shared DB. |
| `BETTER_AUTH_SECRET` | 32+ character random secret for session encryption |
| `BETTER_AUTH_URL` | Base server auth URL (`http://localhost:8081`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google login and Drive integration credentials |
| `GOOGLE_REDIRECT_URI` | Exact Google OAuth callback URL for this deployment |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub login and private repo import credentials |
| `GITHUB_REDIRECT_URI` | Exact GitHub OAuth callback URL for this deployment |
| `NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET` | Notion integration credentials |
| `NOTION_REDIRECT_URI` | Exact Notion OAuth callback URL for this deployment |
| `OPENAI_API_KEY` | OpenAI API key for text/chat generation |
| `GEMINI_API_KEY` | Google Gemini API key (sent via `x-goog-api-key`, never in the URL) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key for multi-speaker TTS |
| `COHERE_API_KEY` | Cohere API key for optional reranking |
| `TAVILY_API_KEY` | Tavily API key for web search |
| `MEM0_API_KEY` | Mem0 API key (optional memory features) |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX` | Pinecone index name |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLOUDINARY_UPLOAD_PRESET` | Your own Cloudinary unsigned preset; required only if signed credentials (API key/secret) are unavailable. There is no hardcoded fallback preset. |
| `FIRECRAWL_API_KEY` | Firecrawl API key for URL scraping |
| `RAZORPAY_KEY_ID` | Razorpay Key ID for payments (use `rzp_test_*` outside production) |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Required when Razorpay is enabled; webhooks fail HMAC verification without it |
| `OAUTH_STATE_SECRET` | Optional 32+ character secret to separate OAuth state HMAC from the auth secret |
| `INNGEST_*` | Optional Inngest Cloud configuration; unset to run durable jobs in-process |

### Client (`client/.env.local`)

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Public backend API URL (`http://localhost:8081`) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Better Auth server URL (`http://localhost:8081`) |

---

## Security and local operations

### CSRF requirement

State-changing requests to custom `/api` routes (`POST`, `PUT`, `PATCH`, `DELETE`) must carry either `Sec-Fetch-Site: same-origin` or an `Origin` header that exactly matches a configured `CLIENT_URL` origin. `Sec-Fetch-Site: none` (direct navigation) and requests with no `Origin` are rejected with `403 { "error": "CSRF origin check failed" }` by default; non-browser clients must send `Origin` explicitly. `/api/auth/*` (Better Auth), `/api/payment/webhook` (Razorpay HMAC), and `/api/inngest` (signing key) are exempt. See [CONTRIBUTING.md](./CONTRIBUTING.md#csrf--origin-checks) for details.

### Proxy configuration

Leave `TRUST_PROXY` unset to trust no proxies and ignore forwarded-IP headers. In production, set an explicit comma-separated proxy address/CIDR list so Express and Better Auth agree. Numeric hop counts are supported for local development only and are rejected in production. `CLIENT_URL` must use explicit http(s) origins: no wildcards, and no localhost/loopback origins in production.

### Local migrations and tests

Apply checked-in migrations with `npm run prisma:migrate --prefix server` (never `prisma db push`), generate the client with `npm run prisma:generate --prefix server`, and run unit tests with `npm run test:unit --prefix server`. See [CONTRIBUTING.md](./CONTRIBUTING.md#local-migrations-and-tests) for the full workflow.

Additional server suites (all require an isolated `TEST_DATABASE_URL` unless noted):

- `npm run test:integration --prefix server` — real-PostgreSQL concurrency, HTTP security, job recovery and provider-mocked payments.
- `npm run test:http --prefix server` — real Express routes/middleware (auth, IDOR, CSRF, uploads, OAuth callbacks, payment boundary).
- `npm run test:jobs --prefix server` — durable-job recovery/backlog scenarios.
- `npm run test:payments --prefix server` — provider-mocked Razorpay lifecycle (no live calls).

Generated podcast/interruption MP3s under `server/uploads/podcasts/` are gitignored, dev-only artifacts with no retention guarantee; Cloudinary is the durable store. Uploads are served only through the ownership-checked `GET /api/audio/:workspaceId/:artifactId` route — there is no unauthenticated static mount.

### Staging readiness

Isolated staging deployment steps, HTTP/security validation, provider integration status, background-job recovery evidence, operational runbook, licensing gate and the current release classification are documented in:

- [STAGING_DEPLOYMENT.md](./STAGING_DEPLOYMENT.md)
- [STAGING_SECURITY_TESTS.md](./STAGING_SECURITY_TESTS.md)
- [INTEGRATION_SECURITY.md](./INTEGRATION_SECURITY.md)
- [BACKGROUND_JOB_RECOVERY.md](./BACKGROUND_JOB_RECOVERY.md)
- [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md)
- [LICENSING_REVIEW.md](./LICENSING_REVIEW.md)
- [RELEASE_READINESS_REPORT.md](./RELEASE_READINESS_REPORT.md)

---

## Project Structure

```
openbook/
├── client/                     # Next.js Frontend
│   ├── app/                    # App Router pages & layouts
│   │   ├── (auth)/             # Login, signup & auth pages
│   │   └── (protected)/        # Protected workspace & dashboard pages
│   ├── components/             # Reusable UI components (Radix / Tailwind)
│   ├── features/
│   │   ├── learn/              # Studio panel, podcast viewer, artifacts
│   │   ├── sources/            # File uploads, link ingestion, source manager
│   │   ├── chat/               # Grounded RAG conversational interface
│   │   └── billing/            # Pricing modal & Razorpay checkout
│   └── lib/                    # API client & helper utilities
│
└── server/                     # Express & Prisma Backend
    ├── prisma/                 # Database schema & migrations
    ├── src/
    │   ├── controllers/        # Express route controllers
    │   ├── routes/             # API routing definitions
    │   ├── services/            # Business logic & AI generation pipelines
    │   ├── inngest/            # Event-driven background workers
    │   └── lib/                # Cloudinary, ElevenLabs, Pinecone & Gemini clients
    └── uploads/                # Local file storage fallback
```

---

## Data flow (high level)

1. Sources are chunked and embedded into Pinecone; metadata lives in Postgres.
2. Chat and artifacts retrieve context via `server/src/lib/rag/retrieve.ts`.
3. Long-running generation runs through Inngest workers.
4. Retrieval quality can be measured with `npm run eval:rag --prefix server` (see `server/evals/`).

## Key API Endpoints

- `GET /health`: Liveness plus database (and optional Pinecone) checks.
- `POST /api/payment/webhook`: Razorpay webhook (HMAC verified, idempotent).
- `POST /api/workspaces/:workspaceId/artifacts`: Generate a learning artifact (Summary, Quiz, Flashcards, Mindmap, Report, Podcast).
- `GET /api/audio/:workspaceId/:artifactId`: Direct byte-range audio streaming for generated podcasts.
- `POST /api/workspaces/:workspaceId/artifacts/:artifactId/podcast/interrupt`: Submit a live listener question to the AI podcast hosts.
- `POST /api/workspaces/:workspaceId/sources`: Ingest a source document (PDF, YouTube link, Web URL, text).
- `POST /api/workspaces/:workspaceId/chat`: Stream grounded RAG answers with citations.

---

## License and attribution

This project is derived from OpenBook by Swami Abhishek. The original README stated MIT licensing, while the original server manifest declared ISC and no upstream `LICENSE` file was present. Those notices are preserved; no additional license grant is asserted.

See [ATTRIBUTION.md](./ATTRIBUTION.md) for the full source and licensing notice.
