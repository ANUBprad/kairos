-- Close the schema drift that a fresh `prisma migrate deploy` still had vs
-- schema.prisma. Six models used in production code were never materialized in
-- the migration chain (DocumentVersion, DocumentActivity, Invitation,
-- Notification, ShareLink, WorkspaceSettings) and two legacy tables (ApiKey,
-- AuditLog) predate their own schema. Everything below is guarded: IF NOT
-- EXISTS / catalog checks so it is safe to run on a fresh DB and on an
-- existing DB that was previously migrated (or db push'd) from a newer schema.
-- No destructive statement: nothing is dropped, truncated, or deleted. On an
-- existing DB where rows predate the migrated columns, NOT NULL constraints
-- are applied only when no rows contradict them (ponytail: data that cannot be
-- backfilled is left NULL rather than guessed, keeping the fresh-DB contract
-- while never failing on legacy rows).

-- 1. Enum types referenced by the new tables (guarded: PG has no
--    CREATE TYPE IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvitationStatus' AND typtype = 'e') THEN
    CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SharePermission' AND typtype = 'e') THEN
    CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'EDIT', 'ADMIN');
  END IF;
END $$;

-- 2. DocumentVersion (production-written: preserve-version, upload)
CREATE TABLE IF NOT EXISTS "DocumentVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileType" VARCHAR(64) NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "storageUrl" TEXT,
    "metadata" JSONB,
    "changeNote" TEXT,
    "documentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DocumentVersion_documentId_version_idx" ON "DocumentVersion"("documentId", "version");

-- 3. DocumentActivity (production-written: document actions, embedding runs)
CREATE TABLE IF NOT EXISTS "DocumentActivity" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "details" JSONB,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DocumentActivity_documentId_createdAt_idx" ON "DocumentActivity"("documentId", "createdAt");

-- 4. Invitation (production-written: organizations.ts, invitation actions)
CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_organizationId_email_key" ON "Invitation"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token");

-- 5. Notification (production-written: notifications.ts)
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- 6. ShareLink (production-read: rbac.ts share-link resolution)
CREATE TABLE IF NOT EXISTS "ShareLink" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "resourceType" VARCHAR(64) NOT NULL,
    "resourceId" VARCHAR(255) NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "expiresAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShareLink_token_key" ON "ShareLink"("token");
CREATE INDEX IF NOT EXISTS "ShareLink_token_idx" ON "ShareLink"("token");
CREATE INDEX IF NOT EXISTS "ShareLink_resourceType_resourceId_idx" ON "ShareLink"("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "ShareLink_organizationId_idx" ON "ShareLink"("organizationId");

-- 7. WorkspaceSettings (production-read: rbac.ts workspace setting lookup)
CREATE TABLE IF NOT EXISTS "WorkspaceSettings" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "value" JSONB,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceSettings_organizationId_key_key" ON "WorkspaceSettings"("organizationId", "key");

-- 8. New-table foreign keys (guarded: add only when missing).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentVersion_documentId_fkey') THEN
    ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentVersion_uploadedById_fkey') THEN
    ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentActivity_documentId_fkey') THEN
    ALTER TABLE "DocumentActivity" ADD CONSTRAINT "DocumentActivity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentActivity_userId_fkey') THEN
    ALTER TABLE "DocumentActivity" ADD CONSTRAINT "DocumentActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_organizationId_fkey') THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invitation_invitedById_fkey') THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShareLink_organizationId_fkey') THEN
    ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ShareLink_createdById_fkey') THEN
    ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceSettings_organizationId_fkey') THEN
    ALTER TABLE "WorkspaceSettings" ADD CONSTRAINT "WorkspaceSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 9. ApiKey: the schema evolved (removed revokedAt, added enabled/scopes/
--    organizationId) but no migration recorded the change. Add the new columns
--    guarded; apply NOT NULL only when no legacy row contradicts it.
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "scopes" TEXT[] NOT NULL DEFAULT ARRAY['read','write']::TEXT[];
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_organizationId_fkey') THEN
    ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "ApiKey" WHERE "organizationId" IS NULL) THEN
    ALTER TABLE "ApiKey" ALTER COLUMN "organizationId" SET NOT NULL;
  END IF;
  -- keyPrefix drifted from VARCHAR(16) (init) to VARCHAR(8) (schema). Narrow
  -- only when every existing value already fits (prefixes are 8 chars by
  -- construction); a legacy row with a longer prefix is left untouched.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ApiKey' AND column_name = 'keyPrefix'
      AND NOT (data_type = 'character varying' AND character_maximum_length = 8)
  ) AND NOT EXISTS (SELECT 1 FROM "ApiKey" WHERE length("keyPrefix") > 8) THEN
    ALTER TABLE "ApiKey" ALTER COLUMN "keyPrefix" TYPE VARCHAR(8) USING "keyPrefix"::VARCHAR(8);
  END IF;
END $$;

-- 10. AuditLog: the schema replaced actorId/actorType with userId/
--     organizationId/requestId/userAgent and narrowed resource to NOT NULL.
--     Leftover actorId/actorType are deliberately kept (dropping columns on a
--     live log table is destructive with no gain). Apply NOT NULL constraints
--     only against tables with no contradicting legacy rows.
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "requestId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

CREATE INDEX IF NOT EXISTS "AuditLog_userId_action_idx" ON "AuditLog"("userId", "action");
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_organizationId_fkey') THEN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- resource became required in the schema (init left it nullable). Backfill
  -- only the empty value for legacy rows then tighten; a NULL userId or
  -- organizationId is left as-is because it cannot be backfilled honestly.
  IF EXISTS (
    SELECT 1 FROM "AuditLog" WHERE "resource" IS NULL
  ) THEN
    UPDATE "AuditLog" SET "resource" = '' WHERE "resource" IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "AuditLog" WHERE "resource" IS NULL) THEN
    ALTER TABLE "AuditLog" ALTER COLUMN "resource" SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "AuditLog" WHERE "userId" IS NULL) THEN
    ALTER TABLE "AuditLog" ALTER COLUMN "userId" SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "AuditLog" WHERE "organizationId" IS NULL) THEN
    ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET NOT NULL;
  END IF;
END $$;

-- 11. User: schema @@index([email]) missing from the deploy chain.
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- 12. ActivityLog: schema index is (userId, action); the chain only ever
--     created (userId, createdAt). Add the required one; the old index is
--     deliberately kept (query pattern coverage, non-destructive).
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_action_idx" ON "ActivityLog"("userId", "action");

-- 13. Organization.ownerId: schema declares onDelete: Cascade but init created
--     RESTRICT. Realign the referential action (guarded: only when RESTRICT,
--     so an already-Cascade DB is left untouched).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'Organization_ownerId_fkey'
      AND c.contype = 'f'
      AND c.confdeltype = 'r'
  ) THEN
    ALTER TABLE "Organization" DROP CONSTRAINT "Organization_ownerId_fkey";
    ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 14. Document.status: DB default stayed PROCESSING (init) while the
--     application default is QUEUED (schema @default(QUEUED), applied
--     client-side by Prisma). Align the DB default now that 'QUEUED' exists in
--     the enum (F1 added it); existing rows are unaffected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'status'
      AND column_default IS NOT NULL
      AND column_default NOT LIKE '%QUEUED%'
  ) THEN
    ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'QUEUED'::"DocumentStatus";
  END IF;
END $$;