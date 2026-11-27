# Kairos

Kairos is an AI-powered research workspace for collecting sources, exploring information with grounded chat, and turning research into useful learning artifacts.

It brings source ingestion, retrieval, AI-assisted study tools, and background generation together in one workspace.

## What it does

- **Bring research together:** work with PDFs, web pages, YouTube transcripts, notes, and connected sources.
- **Ask questions with context:** retrieve relevant source material and return answers with citations.
- **Create learning artifacts:** generate summaries, reports, quizzes, flashcards, mind maps, key takeaways, and podcasts.
- **Explore ideas through audio:** generate multi-host podcast discussions and ask follow-up questions while listening.
- **Manage workspaces and sources:** keep research material and generated artifacts organized.
- **Use connected services:** integrate supported AI, search, storage, vector retrieval, authentication, and payment providers.

Availability of individual integrations and generated features depends on the environment and its configured provider credentials.

## Technology

| Layer | Technologies |
| --- | --- |
| Web application | Next.js, React, TypeScript |
| API | Node.js, Express, TypeScript |
| Data | PostgreSQL, Prisma |
| Authentication | Better Auth |
| Retrieval | Pinecone and embedding/LLM providers |
| Background work | Inngest and durable-job recovery |
| File and media storage | Cloudinary |
| Payments | Razorpay |
| UI | Tailwind CSS, Radix UI, Lucide |

## Architecture

```text
Browser
  │
  ▼
Next.js client
  │ HTTP / streaming
  ▼
Express API ───── PostgreSQL (Prisma)
  │
  ├────────────── Vector retrieval
  ├────────────── File and media storage
  ├────────────── AI / search providers
  └────────────── Durable jobs and background workers
```

## Getting started

### Requirements

- Node.js 20 or later
- npm
- PostgreSQL (or Docker)
- Provider credentials for the integrations you want to use

### 1. Clone and install

```bash
git clone https://github.com/ANUBprad/kairos.git
cd kairos

npm install
npm install --prefix server
npm install --prefix client
```

### 2. Configure the environment

Create local environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env.local
```

Set the required database, authentication, frontend URL, and provider values in the appropriate files. See the example files for the current variable names and descriptions. Never commit real credentials.

#### AI providers

Kairos uses Gemini by default for chat, artifacts, summaries, podcast turns, OCR, and embeddings. Set `GEMINI_API_KEY`; OpenAI is available only as an explicit legacy option through `CHAT_PROVIDER`, `EMBEDDING_PROVIDER`, and `OCR_PROVIDER`.

Document and query embeddings must use the same provider, model, and dimensions. Every stored vector carries that identity, and Pinecone queries are filtered by it. Changing `EMBEDDING_PROVIDER`, `GEMINI_EMBEDDING_MODEL`, `OPENAI_EMBEDDING_MODEL`, or `EMBEDDING_DIMENSIONS` requires a dedicated `PINECONE_INDEX` and a re-import of sources. Vector dimension mismatches fail with an actionable startup/index error rather than mixing incompatible embeddings.

#### OAuth callbacks

Local development uses these integration callbacks:

- `http://localhost:8081/api/integrations/google-drive/callback`
- `http://localhost:8081/api/integrations/github/callback`
- `http://localhost:8081/api/integrations/notion/callback`

If a `GOOGLE_REDIRECT_URI`, `GITHUB_REDIRECT_URI`, or `NOTION_REDIRECT_URI` value is omitted, Kairos derives it from `SERVER_URL` or `BETTER_AUTH_URL`. Deployed environments must set each variable to the exact callback registered with the provider; no production hostname is committed here.

### 3. Start PostgreSQL

Use your own PostgreSQL instance, or start the repository's local database service:

```bash
docker compose up -d
```

Make sure `DATABASE_URL` in `server/.env` points to that local database.

### 4. Apply migrations and generate Prisma Client

From the repository root:

```bash
npm run prisma:migrate --prefix server
npm run prisma:generate --prefix server
```

Use checked-in migrations. Do not use `prisma db push` to bypass migration history.

### 5. Run the application

```bash
npm run dev
```

The root development command starts the API, Inngest development server, and web client. Open [http://localhost:3000](http://localhost:3000).

## Tests and quality checks

Run commands from the repository root:

```bash
npm run typecheck --prefix server
npm run test:unit --prefix server
npm run test:integration --prefix server
npm run build --prefix server
npm run build --prefix client
```

Integration tests require an isolated disposable PostgreSQL database through `TEST_DATABASE_URL`. Never point test commands at a shared or production database.

## Project layout

```text
kairos/
├── client/       Next.js application
├── server/       Express API, Prisma schema, migrations and workers
├── e2e/          End-to-end tests
├── scripts/      Repository and deployment safety checks
├── security/     Dependency security evidence
├── render.staging.yaml
└── render.yaml
```

## Engineering documentation

- [Contributing and local development](CONTRIBUTING.md)
- [Staging deployment guide](STAGING_DEPLOYMENT.md)
- [Staging security test plan](STAGING_SECURITY_TESTS.md)
- [Integration and payment security](INTEGRATION_SECURITY.md)
- [Background job recovery](BACKGROUND_JOB_RECOVERY.md)
- [Operations runbook](OPERATIONS_RUNBOOK.md)
- [Monitoring and alerting](MONITORING_AND_ALERTING.md)
- [Database migrations and rollback](MIGRATION_AND_ROLLBACK.md)
- [Security remediation reference](SECURITY_REMEDIATION.md)
- [Dependency security remediation](DEPENDENCY_SECURITY_REMEDIATION.md)
- [Licensing review](LICENSING_REVIEW.md)
- [Current release readiness](RELEASE_READINESS_REPORT.md)
- [Source attribution and notices](ATTRIBUTION.md)

## Deployment and release status

The repository is private. The isolated staging configuration is maintained separately in `render.staging.yaml`; do not deploy the production-containing `render.yaml` as part of staging validation.

The latest recorded engineering classification is **C — READY FOR STAGING DEPLOYMENT**. Hosted staging deployment and live acceptance checks remain blocked until authorized platform access and staging resources are available. This is not a production-readiness claim.

Public redistribution remains blocked pending sufficient licensing evidence. Existing source notices are preserved in [ATTRIBUTION.md](ATTRIBUTION.md); this README does not assert an additional license grant.
