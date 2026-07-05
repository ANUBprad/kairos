# Release Checklist

Pre-deployment and post-deployment verification checklist for Kairos v1.0.0.

---

## Repository

- [ ] README.md contains all required sections
- [ ] LICENSE file exists (MIT)
- [ ] .gitignore excludes all sensitive files
- [ ] .env.example is complete and documented
- [ ] No secrets hardcoded in source code
- [ ] No temp files or build artifacts committed
- [ ] No `node_modules` or `.next` directories committed
- [ ] All TODO/FIXME comments addressed or documented

---

## Build & Validation

- [ ] `npm run lint` passes with no errors
- [ ] `npx tsc --noEmit` passes with no type errors
- [ ] `npm run build` succeeds
- [ ] `npx prisma validate` passes
- [ ] `npx prisma generate` succeeds

---

## Environment Variables

- [ ] `DATABASE_URL` configured (Supabase transaction mode)
- [ ] `DIRECT_URL` configured (Supabase session mode)
- [ ] `BETTER_AUTH_SECRET` generated (32-byte base64)
- [ ] `NEXT_PUBLIC_BETTER_AUTH_URL` set to production URL
- [ ] `OPENAI_API_KEY` or `GEMINI_API_KEY` configured
- [ ] `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` configured
- [ ] `CLOUDINARY_*` variables configured

---

## Database

- [ ] pgvector extension enabled
- [ ] Prisma schema applied (`prisma db push`)
- [ ] All tables created
- [ ] Indexes created
- [ ] Foreign keys working

---

## Authentication

- [ ] Email/password signup works
- [ ] Email/password login works
- [ ] GitHub OAuth signup works
- [ ] GitHub OAuth login works
- [ ] Session persistence works
- [ ] Logout works
- [ ] Protected routes redirect to login

---

## Core Features

### Document Management
- [ ] File upload works (PDF, DOCX, TXT, CSV, Markdown)
- [ ] File size limit enforced (10MB)
- [ ] Duplicate detection works (SHA-256)
- [ ] Document listing works
- [ ] Document deletion works
- [ ] Document reprocessing works

### Chunking
- [ ] Chunking Studio loads
- [ ] All 5 strategies work
- [ ] Chunk preview displays correctly
- [ ] Custom parameters apply

### Embeddings
- [ ] OpenAI embeddings generate
- [ ] Gemini embeddings generate
- [ ] pgvector storage works
- [ ] Embedding status updates

### Retrieval
- [ ] Vector search works
- [ ] BM25 search works
- [ ] Hybrid search works
- [ ] Query expansion works
- [ ] Multi-query works
- [ ] Reranking works
- [ ] Retrieval Lab displays results

### AI Chat
- [ ] RAG Chat loads
- [ ] Messages send and receive
- [ ] Streaming works
- [ ] Citations display
- [ ] Conversation history persists

### Evaluation
- [ ] Benchmark datasets create
- [ ] Benchmark runs execute
- [ ] Metrics calculate correctly
- [ ] Reports generate
- [ ] Comparison works
- [ ] Leaderboard generates
- [ ] Campaign runner works

---

## UI/UX

- [ ] No hydration errors
- [ ] No console errors
- [ ] No image warnings
- [ ] Theme toggle works (light/dark)
- [ ] Responsive on mobile
- [ ] Responsive on tablet
- [ ] Responsive on desktop
- [ ] Loading states display
- [ ] Error states display
- [ ] Empty states display

---

## Performance

- [ ] Initial page load < 3s
- [ ] Navigation between pages < 1s
- [ ] File upload starts within 2s
- [ ] Search results display within 2s
- [ ] AI responses stream smoothly

---

## Security

- [ ] No secrets in client-side code
- [ ] API routes require authentication
- [ ] Server actions require authentication
- [ ] CORS configured correctly
- [ ] CSP headers set
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy set

---

## Deployment

- [ ] Vercel build succeeds
- [ ] Vercel deployment is healthy
- [ ] Custom domain configured (optional)
- [ ] SSL certificate valid
- [ ] DNS records correct

---

## Post-Deployment

- [ ] Create first user account
- [ ] Upload test document
- [ ] Run test retrieval
- [ ] Run test benchmark
- [ ] Generate test report
- [ ] Verify GitHub OAuth works in production

---

## Monitoring

- [ ] Vercel Analytics enabled (optional)
- [ ] Error tracking configured (optional)
- [ ] Database backups configured
- [ ] Uptime monitoring configured (optional)

---

## Release

- [ ] Version bumped in package.json
- [ ] Git tag created: `v1.0.0`
- [ ] GitHub Release created
- [ ] Release notes written
- [ ] Repository topics added
- [ ] License file verified

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Reviewer | | | |
| Deployer | | | |
