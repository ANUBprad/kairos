# Deployment Guide

Complete guide for deploying Kairos to production using Vercel + Supabase.

---

## Prerequisites

- GitHub account
- Vercel account (free tier works)
- Supabase account (free tier works)
- OpenAI or Gemini API key

---

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from Settings > API
3. Go to **Settings > Database** and note the **Connection string** (Transaction mode)

### Enable pgvector

1. Go to **SQL Editor** in the Supabase dashboard
2. Run: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Verify: `SELECT * FROM pg_extension WHERE extname = 'vector';`

### Get Connection Strings

From **Settings > Database > Connection string**:

- **Transaction mode** (for Prisma `DATABASE_URL`):
  ```
  postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
  ```

- **Session mode** (for Prisma `DIRECT_URL`):
  ```
  postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
  ```

---

## 2. GitHub OAuth Setup

### Create OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** Kairos
   - **Homepage URL:** `https://your-domain.vercel.app`
   - **Authorization callback URL:** `https://your-domain.vercel.app/api/auth/callback/github`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it

### Update Vercel Environment

After deployment, update the OAuth app with the production URL:
- **Homepage URL:** `https://your-production-domain.vercel.app`
- **Authorization callback URL:** `https://your-production-domain.vercel.app/api/auth/callback/github`

---

## 3. Vercel Deployment

### Import Repository

1. Go to [vercel.com](https://vercel.com) and click **New Project**
2. Import your GitHub repository
3. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `apps/portal`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
4. Click **Deploy** (will fail until env vars are set)

### Set Environment Variables

Go to **Settings > Environment Variables** and add:

| Variable | Value | Environment |
|----------|-------|-------------|
| `DATABASE_URL` | Supabase transaction mode connection string | Production |
| `DIRECT_URL` | Supabase session mode connection string | Production |
| `BETTER_AUTH_SECRET` | Random 32-byte base64 string | Production |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://your-domain.vercel.app` | Production |
| `OPENAI_API_KEY` | Your OpenAI API key | Production |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | Production |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | Production |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name | Production |
| `CLOUDINARY_API_KEY` | Your Cloudinary API key | Production |
| `CLOUDINARY_API_SECRET` | Your Cloudinary API secret | Production |

### Generate BETTER_AUTH_SECRET

```bash
openssl rand -base64 32
```

### Deploy

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment
3. Wait for build to complete
4. Visit your deployment URL

---

## 4. First Deployment

### Run Database Migrations

After first deployment, the database schema needs to be applied:

1. Go to **Supabase SQL Editor**
2. Run the Prisma migration SQL, or
3. Connect to your database locally and run:
   ```bash
   DATABASE_URL="your-supabase-connection-string" npx prisma db push
   ```

### Create First User

1. Visit your deployment URL
2. Click **Sign Up**
3. Create an account with email/password
4. You become the organization owner

---

## 5. Custom Domain (Optional)

1. In Vercel, go to **Settings > Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_BETTER_AUTH_URL` to your custom domain
5. Update GitHub OAuth app callback URLs

---

## 6. Troubleshooting

### Build Fails

- **Error:** `EINVAL: invalid argument, readlink`
  - **Fix:** Delete `.next` directory and redeploy

- **Error:** `Prisma schema validation failed`
  - **Fix:** Ensure `DATABASE_URL` is set correctly

### Authentication Issues

- **Error:** `OAuth callback URL mismatch`
  - **Fix:** Ensure GitHub OAuth callback URL matches exactly:
    ```
    https://your-domain.vercel.app/api/auth/callback/github
    ```

- **Error:** `Invalid BETTER_AUTH_SECRET`
  - **Fix:** Regenerate with `openssl rand -base64 32`

### Database Issues

- **Error:** `relation "User" does not exist`
  - **Fix:** Run `npx prisma db push` with your production database URL

- **Error:** `pgvector extension not found`
  - **Fix:** Run `CREATE EXTENSION IF NOT EXISTS vector;` in Supabase SQL Editor

### File Upload Issues

- **Error:** `Cloudinary upload failed`
  - **Fix:** Verify `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`

---

## 7. Rollback Steps

### Rollback Vercel Deployment

1. Go to **Deployments** tab
2. Find the last working deployment
3. Click **...** > **Promote to Production**

### Rollback Database

If you need to rollback database changes:

1. Go to Supabase **SQL Editor**
2. Run the appropriate rollback SQL
3. Or restore from a backup in **Settings > Database > Backups**

---

## 8. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (transaction mode for Supabase) |
| `DIRECT_URL` | No | Direct connection string (session mode for Supabase) |
| `BETTER_AUTH_SECRET` | Yes | Secret for signing auth tokens |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | No | Public URL of the app (defaults to http://localhost:3000) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key for embeddings and chat |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key (alternative to OpenAI) |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth Client Secret |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name for file storage |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `AI_PROVIDER` | No | Default AI provider: `openai` or `gemini` (default: `openai`) |
| `OPENAI_CHAT_MODEL` | No | OpenAI chat model (default: `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | No | OpenAI embedding model (default: `text-embedding-3-small`) |
| `GEMINI_CHAT_MODEL` | No | Gemini chat model (default: `gemini-2.0-flash`) |
| `GEMINI_EMBEDDING_MODEL` | No | Gemini embedding model (default: `text-embedding-004`) |

*At least one AI provider API key is required.
