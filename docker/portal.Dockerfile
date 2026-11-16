# syntax=docker/dockerfile:1

# Portal web app and durable-processing worker. The build context is the
# repository root because next.config.ts sets outputFileTracingRoot to the repo
# root and the Prisma schema lives under apps/portal.
FROM node:22-bookworm-slim AS base
WORKDIR /app/apps/portal
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma detects the OpenSSL version to pick its query engine. Without the
# openssl package it falls back to the 1.1.x engine, which cannot connect on
# bookworm, so install it in every stage that runs Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
# postinstall runs `prisma generate`, so the schema must exist before npm ci.
COPY apps/portal/package.json apps/portal/package-lock.json ./
COPY apps/portal/prisma ./prisma
RUN npm ci

FROM deps AS builder
COPY apps/portal/ ./
# Build-time placeholders only: no database is contacted while building, but
# Prisma resolves the datasource env names and Next traces server code.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
ENV DIRECT_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
# NEXT_PUBLIC_* values are inlined into the client bundle, so they must be
# supplied at build time. Override them with the URLs/keys the browser uses.
ARG NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
RUN npx prisma generate && npm run build

# Next.js standalone server. server.js lands under standalone/apps/portal
# because outputFileTracingRoot is the repo root, and it resolves node_modules
# from the standalone root.
FROM base AS portal
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/portal/.next/standalone /app
COPY --from=builder /app/apps/portal/.next/static /app/apps/portal/.next/static
COPY --from=builder /app/apps/portal/public /app/apps/portal/public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# The worker executes TypeScript through tsx (a devDependency) and imports the
# same modules as the app, so it reuses the builder stage. The standalone bundle
# above does not include scripts/worker.ts or its dependency graph.
FROM builder AS worker
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "worker"]
