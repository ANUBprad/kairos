# Internal Security Audit — P0 Foundation Phase

Read-only trace at baseline `a040ab03caf29a168e018c56c19ccaf9013fb8be` before any fix.

Severity: **CRITICAL** = exploitable without meaningful preconditions; **HIGH** = exploitable by an
authenticated user within the product's own data plane.

## A. Knowledge base authorization boundary

- `apps/portal/src/lib/ai/chat/access.ts:6` — `canAccessKnowledgeBase(userId, kbId)` is the canonical
  predicate (kb → project → organization → members). Returns `false` for missing KB and for missing
  membership, so foreign KB and none exist are indistinguishable (no existence leak). **CORRECT.**
- `apps/portal/src/lib/actions/knowledge-base.ts:13` — `assertMemberAccess(kbId, userId)` delegates to it. **CORRECT** (from PR `51e312a4`).
- `apps/portal/src/lib/actions/retrieval-lab.ts:17` — `assertKbAccess(kbId, _userId)` checks only
  existence; caller identity is discarded. **HIGH — any authenticated user gains KB CRUD / retrieval ops.**
- `apps/portal/src/lib/actions/evaluation.ts:25` — identical existence-only copy; **HIGH**, same root cause.
- `apps/portal/src/lib/actions/evaluation.ts:38,47` — `assertDatasetAccess` / `assertRunAccess`
  existence-only; **HIGH** (folded into P0-C).
- Tests: `src/__tests__/knowledge-base-access.test.ts` (wiring, static) and
  `knowledge-base-access.integration.test.ts` (real DB, requires `KAIROS_TEST_DATABASE_URL`; exercises
  OWNER/ADMIN/MEMBER/VIEWER, outsider, foreign-org, missing KB, identity-dependent result).

## B. Retrieval-lab dataset/run access

- Server actions call broken `assertKbAccess` → KB scope is unenforced. `fetchRun` (`retrieval-lab.ts:93`)
  reads a run then checks the KB it belongs to — bypassable via the run only if the run's KB itself is
  accessible; the deeper run-scoping gap rides the P0-A fix as far as KB scope and the P0-C run assertion
  for the rest. No dedicated retrieval-lab tests exist beyond the wiring greps.

## C. Evaluation LFI / path traversal chain

- Portal `apps/portal/src/app/api/v1/evaluation/run/route.ts` forwards user-supplied `namespace` and
  `dataset_path` to intelligence REST (`INTELLIGENCE_REST_URL`, default `http://localhost:8000`) with a
  shared `KAIROS_API_SECRET`. No org scoping, no dataset identity resolution, `dataset_path` forwarded raw.
- Intelligence `intelligence/api/routes/evaluation.py` → `RunConfig` → `benchmarks/dataset/loader.py`
  `load_dataset` opens `path_obj` directly — arbitrary file read / traversal on the intelligence container.
- **HIGH chain for a documented route; the forwarding route is the trust boundary to fix.**

## D. Organization membership tenancy

- `apps/portal/src/lib/organizations.ts` `addMember` performs **no permission check** — any established
  session can add members (including ADMIN/OWNER-role grants) to any org, and can self-assign elevated
  roles. **CRITICAL privilege escalation.**
- `updateMemberRole` / `removeMember` gate on OWNER but never verify the target `memberId` belongs to the
  caller's `organizationId` (cross-org tamper surface).
- `acceptInvitation` calls `addMember` without a caller identity — the fix must be conditional on the
  presence of a granting identity, not unconditional.
- `apps/portal/src/lib/rbac.ts` provides the reusable model: `getMembership`, `isRoleSufficient`,
  `hasPermission`/`requirePermission`, roles OWNER > ADMIN > MEMBER > VIEWER, permission `manage_members`.
- Invitation actions: `apps/portal/src/lib/actions/invitation.ts`.

## E. Audit logs / observability

- Out of P0 scope. Gap doc H3/H4/H5: unscoped audit logs, unscoped traces, alerts/incidents/drift IDORs.
- Note `createAuditLog` (`rbac.ts`) and migration-era `AuditLog` disagree on shape (actorId vs userId/
  organizationId) — re-entered in G.

## F. Gateway / gRPC / REST boundary

- `gateway/middleware/auth.go` — gateway's HTTP edge enforces a single shared `KAIROS_SECRET`
  (constant-time `hmac.Equal`), requires non-empty `X-Namespace`. Namespace check (`namespace.go`) is
  format-only (`^[a-zA-Z0-9]+$`, ≤63 chars).
- `intelligence/server/grpc_server.py` — gRPC server binds `0.0.0.0` (default port 28080) with only a
  metrics interceptor. **Protected IntelligenceService RPCs are unauthenticated — HIGH.** Only
  `/grpc.health.v1.Health` is meant to be public.
- Gateway is the sole gRPC client (`gateway/intelligence/python_client.go`), already sending `x-trace-id`
  metadata — an existing propagation seam to extend for a shared-secret token.
- `intelligence/api/app.py` + `auth/api_key.py` — REST edge: `X-API-Key` against `KAIROS_API_SECRET`;
  middleware attached only when a secret is configured; production without secret refuses to start.
  This is the existing service auth mechanism to reuse, not invent around.
- CI `test.yml` e2e only asserts `/health`; no test exercises protected gRPC RPCs directly (P0-D must add).

## G. Prisma migration chain

- `apps/portal/prisma/migrations/` vs `schema.prisma` (53 models) are grossly out of sync. `_init`
  creates ~13 tables; **no migration creates** ExperimentRun, BenchmarkDataset, BenchmarkRun,
  ProviderHealth, Conversation, Message, MessageCitation, DocumentChunk, DocumentEmbedding, Trace, etc.
- `20260805000000_add_hotpath_indexes` creates indexes on tables that no migration ever created →
  **fresh `prisma migrate deploy` fails**. `20260913000000_add_embedding_vectors` ALTERs `DocumentEmbedding`
  (never created) → also fails a fresh deploy.
- Existing dev DBs were built with `prisma db push` (schema-shaped), so applied history is unaffected by a
  corrected additive migration; `20260909000000_add_retrieval_config` etc. target real (pushed) tables.
- Discrepancies to reconcile in the catch-up migration: init `ApiKey` has no `organizationId`; init
  `AuditLog` uses `actorId`/`actorType` while current schema uses `userId`/`organizationId`.
- **HIGH operational blocker:** no fresh deploy or spatial/intelligence DB path works from migrations; the
  portal CI (`portal.yml`) only runs `prisma validate` (static), so this was never caught.

## Tooling / verification facts

- Portal tests: `node:test`, run via `npx tsx --test "src/__tests__/*.test.ts"` (from `apps/portal`).
  No `test` script in `package.json`; CI (`portal.yml`) does not run them. 377 tests, mostly static greps + pure logic.
- Integration target needs `KAIROS_TEST_DATABASE_URL`; local Postgres is via Docker (engine available).
- Python: `pytest tests/`; Go: `go test ./...` + `go vet ./...` (CI `evaluate.yml`/`lint.yml`).

## P0 mapping

| P0 | Root cause | Fix boundary |
|---|---|---|
| A | Existence-only `assertKbAccess` in retrieval-lab + evaluation | Delegate both to `canAccessKnowledgeBase(userId, kbId)`; keep caller-compatible signature |
| B | `addMember` without permission check; role grant not bounded by caller role | Guard on granted identity: membership + `manage_members` + `isRoleSufficient(caller, granted)`; org-scope `memberId` in role/remove |
| C | Blind `namespace`/`dataset_path` forwarding → `load_dataset` open | Portal resolves dataset identity via org-scoped DB lookup, forbids absolute/user paths; cover traversal/absolute/foreign/nonexistent/forged cases |
| D | gRPC IntelligenceService RPCs unauthenticated | Shared-secret gRPC auth interceptor reusing the REST API-key mechanism; keep gRPC health public; gateway propagates token |
| E | Fresh `migrate deploy` breaks on missing tables | Make hotpath indexes conditional; additive last catch-up migration to reconcile schema↔migrations; validate on fresh Postgres |