# Background job recovery (Phase 06)

**Status: PASSED against disposable PostgreSQL; live Inngest validation
`BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED`.**

## 1. Model

Durable jobs live in the `durable_job` table and move through
`PENDING → PROCESSING → DELIVERED | DEAD`:

- The outbox (`server/src/lib/outbox.ts`) uses deterministic unique keys, so a
  repeated enqueue cannot create a duplicate row.
- `PENDING → PROCESSING` is an atomic claim; exactly one concurrent worker wins.
- Failed jobs are released back to `PENDING` with bounded exponential backoff
  and **no refund**. Only a terminal `DEAD` job compensates, and only if the
  associated artifact/source is not already `READY`.
- `DELIVERED` jobs are never requeued or rewound.
- `recoverAbandonedDurableJobs()` re-dispatches due `PENDING` jobs and returns
  stale `PROCESSING` leases to `PENDING` after a bounded lease period.

## 2. Periodic sweeper

`server/src/lib/job-sweeper.ts` adds `createDurableJobSweeper(intervalMs)`:

- Each tick processes at most 50 jobs (`PROCESSING_SWEEP_LIMIT`), preserving the
  existing bound for large backlogs.
- An in-flight guard prevents overlapping ticks from multiplying work.
- The server entrypoint starts the sweeper and stops it on shutdown, so a
  deployment does not require an external scheduler for basic recovery.
- A crash/restart is handled by startup recovery plus the next tick: stale
  `PROCESSING` rows are returned to `PENDING` and re-dispatched.

Inngest remains opt-in (`INNGEST_*`). With no configuration, dispatch uses the
in-process local fallback; `DELIVERED` still depends only on the committed
outbox row, not on the dispatch return value. Phase 06 upgraded `inngest` to
4.26.2 and forced its nested `zod` copy to 4.6.7 to close critical/high
advisories; typecheck, build and the real-PostgreSQL job suite pass, but live
Inngest dispatch remains **BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED**.

## 3. `job-recovery.integration.test.ts` — 6/6 PASS

Run with `npm run test:jobs` (or the full `npm run test:integration`) against a
disposable `TEST_DATABASE_URL`. Real PostgreSQL, no provider credentials.

| Scenario | Result |
| --- | --- |
| Backlogs of 1, 50, 51, 100 and 250 jobs drained in bounded 50-job passes | No job lost; every row `DELIVERED`, at most one attempt each, within `maxAttempts`, with `deliveredAt` set |
| Periodic sweeper on a 250-job backlog | Each tick ≤ 50; 7 ticks touched all 250; failed local workers stayed `PENDING` with an error and were **never** falsely `DELIVERED` |
| Stale `PROCESSING` after simulated restart | Recovered to `PENDING`, retried once, then delivered; duplicate delivery did not double-complete or create a refund |
| Late job reaching `DEAD` for an already `READY` artifact | Artifact stayed `READY`, `refundedAt` null, no refund ledger row |
| Poison job | `RETRY → RETRY → DEAD` at `maxAttempts=3`; exactly one compensating refund; repeated release could not refund twice |
| Concurrency | Three simultaneous claims → exactly one winner; duplicate recovery cannot rewind `DELIVERED`; a future `availableAt` job is not claimed early |

## 4. Financial safety evidence

The job tests assert against PostgreSQL that:

- no `artifact-refund:*` row is created for successful or late-but-`READY`
  jobs;
- a terminal poison job produces exactly one refund and a `FAILED` artifact;
- duplicate completion attempts do not create extra charges or refunds.

## 5. Live validation required (owner)

- Deploy with a dedicated staging Inngest environment (or confirm in-process
  fallback + sweeper behaviour on Render).
- Kill/restart a worker mid-job and confirm recovery from the outbox.
- Deliver the same event twice and confirm single completion.
- Confirm no double charge/refund/completion in the staging ledger.

Until those are executed, live background-job behaviour is
**PARTIALLY VERIFIED** (local PostgreSQL evidence only).

## 6. Phase 07 re-verification

No background-job logic was changed in Phase 07. After all Phase 07 hardening
edits, the full `npm run test:integration` suite was rerun against the disposable
`kairos_phase07` PostgreSQL database: **47/47 pass** (`INTEGRATION_FINAL_EXIT=0`),
including the 6 durable-job recovery tests and the 12 artifact/round-3
concurrency tests. The backup/restore drill also verified a `DELIVERED` job row
survived restore with no stale `PROCESSING` or premature `DEAD` rows.

Worker crash/restart, DB interruption, provider outage and live Inngest
event execution on a deployed staging service remain **BLOCKED —
CREDENTIALS/PERMISSIONS REQUIRED**; the in-process fallback is not a durable
replacement for a hosted worker across full service replacement.
