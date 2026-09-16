# Study Dashboard & Mastery Loop — Read-Only Audit

Mission scope: audit-only. This file is the sole deliverable. No product code, tests, schema,
migrations, or configuration were modified. All findings are labeled **OBSERVED** (read from code),
**DERIVED** (reasoned from the code), or **RECOMMENDATION** (the audit's suggestion).

Baseline: `HEAD == origin/main == 40679997` (`feat(artifacts): unify provenance rendering across all viewers`).

---

## 1. Executive Summary

The study loop is a small, deliberately simple system: one migration (`20260916000000_add_study_loop`),
three tables (`QuizAttempt`, `QuizAttemptAnswer`, `FlashcardReview`), one server-side study layer
(`src/lib/study/*`), two authenticated server actions, and study surfaces in exactly three places —
the home dashboard (two global stat cards), the Studio artifact list (per-artifact one-liners), and
the two artifact viewers (Quiz / Flashcards). It is well-guarded against cross-tenant access, treats
attempts and review state as immutable/owned data, and is the most thoroughly tested subsystem in
the repo for its size.

The audit found **no P0 or P1 findings**. There are no data-loss, security, or core-functionality
defects. The gaps are about *surfacing*: the two dashboard study stats are dead-end cards, there is
no page that aggregates study state, the Live Activity feed has no study event types, there is no
way to abandon an in-progress quiz attempt, and KNOWN cards are never re-queued (deliberately, not
by accident).

The single recommended next slice is **A. A dedicated Study Dashboard** — a read-only surface built
entirely on projections that already exist (`getStudyProgressForUser`, `getStudyCountsForProject`,
`getQuizAttemptHistoryForUser`). It needs **zero schema changes, zero new dependencies**, and it
closes the largest concrete gap this audit observed: the study loop has no home page of its own.

## 2. Current Study Architecture

**OBSERVED** — persistence is three tables, all created additively in a single migration:

- `QuizAttempt` — `schema.prisma:359-380`. `PENDING` → `COMPLETED` status, `score`, `totalQuestions`,
  `completedAt`. `artifact onDelete: Cascade`, `knowledgeBase onDelete: Cascade`, `user onDelete: Cascade`.
  Indexes: `[artifactId]`, `[knowledgeBaseId, userId]` (`migration.sql:108-121`).
- `QuizAttemptAnswer` — `schema.prisma:386-396`. One graded row per question; `@@unique([attemptId, questionId])`.
  The model comment states the grading contract: the client never supplies correctness; the correct
  option and explanation stay in the immutable artifact and are resolved at read time.
- `FlashcardReview` — `schema.prisma:402-424`. One row per (user, artifact, card); `@@unique([userId, artifactId, cardId])`;
  `status`, `knownCount`, `againCount`, `reviewCount`, `lastReviewedAt`. Indexes `[artifactId]`, `[knowledgeBaseId, userId]`.

**OBSERVED** — the study layer is server-side pure logic plus Prisma:

- `src/lib/study/review-status.ts` — verdict vocabulary `AGAIN | KNOWN`, deterministic transitions,
  explicit "no spaced repetition" comment.
- `src/lib/study/quiz.ts` — `startQuizAttemptForUser`, `submitQuizAttemptForUser`, `getQuizAttemptForUser`,
  `getQuizAttemptHistoryForUser`, plus grading helpers (`gradeQuizAnswers`, `assertAllQuestionsAnswered`).
- `src/lib/study/flashcards.ts` — `getFlashcardsReviewDataForUser`-family reads, `markFlashcardReviewForUser`
  (read → upsert), `summarizeFlashcardDeckProgress`.
- `src/lib/study/progress.ts` — `getStudyProgressForUser` (per-artifact projection), `getStudyCountsForProject`
  (project-level totals for the dashboard).
- `src/lib/actions/study-quiz.ts`, `study-flashcards.ts` — `requireSession()`-gated server actions that
  delegate to the study layer.
- Tenancy primitive `canAccessKnowledgeBase(userId, kbId)` in `src/lib/ai/chat/access.ts` guards every
  study-layer entry point.

**OBSERVED** — UI surfaces:

- Home dashboard `src/app/app/page.tsx` + `dashboard-client.tsx:98,241-252` — two stat cards
  ("Quizzes Taken", "Cards Known") fed by `getStudyCountsForProject`.
- Studio list `src/components/app/studio/artifact-studio.tsx` (re-pulls projection on dialog close) and
  `artifact-list.tsx:94-107` — per-artifact "Took it N× · best X/Y" and "A/B reviewed · C known · D learning".
- Viewers `quiz-artifact-viewer.tsx`, `flashcards-artifact-viewer.tsx` — in the Studio dialog and on the
  artifact detail page (via `ArtifactContent` in `artifact-detail-client.tsx:95-99`).

## 3. Quiz Lifecycle Audit

**OBSERVED** — full lifecycle:

1. `startQuizAttemptForUser` (`quiz.ts:145-166`) — authz → loads the quiz (type/status/content checks,
   `ARTIFACT_NOT_QUIZ`/`ARTIFACT_NOT_COMPLETED`/`ARTIFACT_CONTENT_INVALID`) → reuses the user's existing
   `PENDING` attempt or creates one. A completed attempt is never resumed.
2. `submitQuizAttemptForUser` (`quiz.ts:171-226`) — finds the attempt **scoped by `userId`**, re-checks
   tenancy **against the attempt's own row** (not the caller-supplied kbId), loads the immutable content,
   validates completeness/ranges/duplicates, grades server-side, then atomically claims
   `PENDING → COMPLETED` via `updateMany(status: PENDING)` inside `$transaction` and writes the answer rows.
   A second submit is rejected (`QUIZ_ATTEMPT_COMPLETED`, no-op).
3. Read paths: `getQuizAttemptForUser` (latest, resumed across refresh) and `getQuizAttemptHistoryForUser`
   (completed only, newest-first).
4. UI (`quiz-artifact-viewer.tsx`) — results view shows per-question correctness, "Correct answer: …"
   and the explanation (`:424,427`); history strip shows "Taken N× · best M/L" (`:211-214`); "Try again"
   starts a fresh attempt (`:361`).

**DERIVED** — the design is sound: completion is a single atomic write, correctness is computed
server-side, and the grading contract (client never supplies `isCorrect`) is enforced at the storage
boundary. Attempt rows are immutable after completion.

**DERIVED** — two surfaced limitations:

- **No abandon/restart.** A `PENDING` attempt is silently reused on every start. Because submit requires
  *all* questions answered, a user who starts a quiz and walks away is stuck with a resumable attempt
  and no way to discard it and restart clean.
- **Attempt growth is unbounded.** Every "Try again" appends a new `QuizAttempt` + N `QuizAttemptAnswer`
  rows, kept forever under the Cascade FKs. Harmless at current scale.

## 4. Flashcard Lifecycle Audit

**OBSERVED** — full lifecycle:

1. `getFlashcardsReviewForUser` (`flashcards.ts:94-117`) — authz → validates the deck → reads the user's
   rows and pads untouched cards with a default `NEW` so the UI always gets full deck coverage.
2. `markFlashcardReviewForUser` (`flashcards.ts:124-176`) — validates card range (`FLASHCARD_INVALID_CARD`),
   reads the current row, computes the next status (`nextFlashcardReviewStatus`), upserts on the
   `(userId, artifactId, cardId)` unique key, incrementing `knownCount`/`againCount`/`reviewCount`.
3. `summarizeFlashcardDeckProgress` (`flashcards.ts:53-73`) — derived progress: `reviewedCount`
   (cards with `reviewCount > 0`), `knownCount` (status KNOWN), `learningCount`, `complete`
   (`reviewedCount === cardCount`).
4. UI (`flashcards-artifact-viewer.tsx`) — per-card status chip, live progress summary, reveal-then-verdict
   flow (AGAIN / "Know it"), deck-complete banner with "Review again" which restarts at card 0 (`:225-239`).

**DERIVED** — completion is derived, not stored: a deck is "complete" once every card has been reviewed
at least once, regardless of correctness. Re-reviewing a KNOWN card after an AGAIN verdict drops it to
LEARNING, which *un*-completes nothing (completeness only tracks coverage), but the dashboard-level
"Cards Known" count does drop the card (it counts current `status == KNOWN` rows).

**DERIVED** — the read-then-upsert in `markFlashcardReviewForUser` is documented in-code as
last-write-wins under concurrency (`flashcards.ts:119-123`, `ponytail:` comment naming the ceiling and
the `{ increment }` upgrade path). The UI serializes per card, so this is theoretical today.

## 5. Existing Progress Projection

**OBSERVED** — two projection shapes, both computed, nothing stored:

- `getStudyProgressForUser(userId, kbId)` (`progress.ts:35-85`) — two `groupBy` queries
  (completed quiz attempts per artifact; flashcard reviews per [artifact, status]) merged into
  `Record<artifactId, ArtifactStudyProgress>` with `attempts`, `bestScore`, `totalQuestions`,
  `knownCount`, `reviewCount`, `lastStudiedAt`. *Deliberately* returns nothing for untouched artifacts
  (caller renders "not started"), verified by `study-progress.integration.test.ts:225`.
- `getStudyCountsForProject(userId, projectId)` (`progress.ts:94-107`) — two `count`s scoped through
  `knowledgeBase: { projectId }`: `quizzesTaken` (COMPLETED attempts), `cardsKnown` (rows currently KNOWN).

**OBSERVED** — consumers:

- Home dashboard `src/app/app/page.tsx:4,49` → `getStudyCountsForProject`.
- Studio projection `src/lib/actions/artifacts.ts:159-166` → `getStudyProgressForUser` merged into
  `LearningArtifactWithStudy.study`; rendered in `artifact-list.tsx:94-107`.

**DERIVED** — a semantic wart, harmless today: in the merged projection, the flashcard branch adds the
flashcard review count into the shared `attempts` field (`progress.ts:76`). For a FLASHCARDS artifact
with no quiz attempts, `attempts` therefore holds the number of flashcard reviews, used only as a
greater-than-zero gate by `artifact-list.tsx:103` (`attempts > 0 ? flashcardsStudyLine : "Not reviewed yet"`).
The rendered counts come from `reviewCount`/`knownCount`, which are correct. Internal field reuse, not a
user-visible bug; it becomes a real wart if a future surface displays `attempts` for flashcard artifacts.

## 6. Current Dashboard UX

**OBSERVED** — study touch points on the dashboards:

- Home ("Mission Control", `dashboard-client.tsx:214-253`): six stat cards; the last two are
  **Quizzes Taken** and **Cards Known**. They are plain `StatCard`s — not links, no tooltip, no drill-down.
  The hero health ring (`:106-108`) scores 20 points each for kb/docs/chunks/experiments/benchmark and
  **ignores study activity entirely**.
- Quick Action grid (`:258-263`): Upload / RAG Chat / Evaluation / Manage Documents — **no Study entry**.
- Live Activity (`:278`): the `ActivityFeed` type union (`activity-feed.tsx:22`) contains only
  `experiment | upload | evaluation | chat | chunking | embedding | indexing` — **no quiz/flashcard types**,
  and the feed is fed by localStorage demo data, not by study actions. Study activity is invisible there.
- Recent Work / Knowledge Bases grids (`:332-372`): artifact-bound; per-KB drilldown goes to the Sources
  table. **No KB-level study view exists** (checked `[kbId]/page.tsx`, `[kbId]/studio/page.tsx`).
- Studio (`artifact-list.tsx:94-107`): the richest per-artifact study text lives here ("Took it 3× ·
  best 9/10", "12/20 reviewed · 8 known · 4 learning") but only as one text line per row.

**DERIVED** — the study loop's only aggregate surface is two dead-end numbers on the home dashboard.
Everything knowable about study state already exists as server projections, but there is no place that
shows it.

## 7. Mastery Model Assessment

**OBSERVED** — the model is deliberately minimal, and it is coherent:

- Quiz: per-attempt score; best score and attempt count live in the projection.
- Flashcards: deterministic `NEW → LEARNING → KNOWN` (`review-status.ts`), KNOWN returns to LEARNING on
  an AGAIN verdict but never back to NEW.
- "Known" is a state per (user, artifact, card), recomputed by the projection at read time — always
  consistent with the stored rows.

**DERIVED** — there is no composite mastery score (no 0-100 "mastery" metric, no weighted
quiz+flashcard number), no mastery threshold, and no per-KB or per-project mastery rollup. Given the
product posture (a RAG/Chat research tool, not an LMS), this is a reasonable default and **should not
be invented without a user-facing reason**. The observable consequence of a weaker model is that the
dashboard cannot answer "how well do I know this KB?" — only "how many times have I interacted".

**RECOMMENDATION** — if a lightweight mastery indicator is ever wanted, it should be a **derived
read-time ratio** (e.g., quiz best score, flashcard KNOWN/total per artifact) reusing the existing
projection — not new columns or a stored score.

## 8. Spaced Repetition Assessment

**OBSERVED** — there is none, by explicit design:

- Model comment `schema.prisma:398-401`: "Deliberately no spaced repetition".
- `review-status.ts` transfer table identifies the same. No intervals, due dates, ease factors, or
  scheduling tables anywhere in the study migration.

**DERIVED** — a KNOWN card is never re-queued by the system time-based; "Review again"
(`flashcards-artifact-viewer.tsx:225-239`) replays the deck from card 0 in order. Retention research
argues this is the biggest pedagogical gap, but the audit treats the schema comment as the product
decision: **not building SRS is a deliberate, documented ceiling, not an oversight.** There is no
schema or data-model debt that makes a future SRS harder — adding it later only requires new columns
or a small schedule table plus a query change, all additive.

## 9. Tenancy & Security Audit

**OBSERVED** — the tenancy posture is consistent and good:

- Every study-layer public function begins with `canAccessKnowledgeBase(userId, kbId)` and maps any
  failure to `NOT_FOUND` (no existence leak across orgs/KBs). Tested: `study-quiz.integration.test.ts:273`,
  `study-flashcards.integration.test.ts:204`, `study-progress.integration.test.ts:232`.
- Cross-user isolation: quiz attempts are located with `userId` in the `where`; `submitQuizAttemptForUser`
  re-checks tenancy off the attempt's own KB, so a forged kbId cannot widen scope. Tested:
  `study-quiz.integration.test.ts:257`, `study-flashcards.integration.test.ts:182`.
- `FlashcardReview` unique key embeds `userId`; upsert is scoped to the caller.
- Server actions use `requireSession()`; browser-supplied `isCorrect` never exists in the API surface.
- Artifact reads use KB-scoped `getLearningArtifactInKb` (`persistence.ts:44-52`), so a foreign id
  resolves to "missing".
- Deletion is `deleteMany({ id, knowledgeBaseId })` (`persistence.ts:58-68`) — a foreign id is a safe no-op.

**DERIVED** — no P0/P1 security findings. One hardening note at the "nice to have" level: `score`,
`totalQuestions`, `status`, and `completedAt` for the *latest* attempt are exposed through
`getQuizAttemptForUser` to any member of the KB for an artifact in that KB — expected and safe (any
member may take the quiz).

## 10. Deletion & Regeneration Semantics

**OBSERVED** — both semantics are correct and explicitly covered by tests:

- **Deletion**: KB-scoped hard delete (`persistence.ts:58-68`); study rows go with it via FK
  `onDelete: Cascade` on all three tables. Verified: attempt+answer cascade `study-quiz.integration.test.ts:392`,
  review cascade `study-flashcards.integration.test.ts:242`.
- **Regeneration**: `regenerateLearningArtifactForUser` (`engine.ts:242-275`) creates a **brand-new
  artifact row** with `parentArtifactId` lineage; the original is never mutated. A fresh id means a
  clean study slate. Verified: `study-quiz.integration.test.ts:357`, `study-flashcards.integration.test.ts:255`.
- The Studio lists the regenerated artifact with `study: null` and re-pulls the projection on dialog
  close (`artifact-studio.tsx:92-94,111,120-129`).

**DERIVED** — because study state is keyed to the artifact id, regeneration intentionally resets all
progress, and deletion cleans up every trace. Both match the stated intent in the test names; no orphan
rows or cross-tenancy residue are reachable. No finding.

## 11. Query & Performance Audit

**OBSERVED** — the heavy paths:

- `getStudyProgressForUser`: two `groupBy`s scoped by `(userId, knowledgeBaseId)` — row count is bounded
  by distinct artifacts per KB (quiz) and by artifact-status groups (cards), both served by the
  `[knowledgeBaseId, userId]` indexes.
- `getStudyCountsForProject`: two `count`s with a relation filter `knowledgeBase: { projectId }`.
  Resolved as `knowledgeBaseId IN (SELECT … WHERE projectId = …)`, which the `(knowledgeBaseId, userId)`
  index accelerates per KB. Reasonable at current scale.
- Studio list page: `listLearningArtifactsForWorkspace` runs artifact list + progress projection
  (`artifacts.ts:159-166`); the two couple run in parallel. Per FLASHCARDS row, `flashcardsStudyLine`
  parses the artifact JSON content (`artifact-list.tsx:37-47`); quiz rows don't parse content. Fine at
  expected artifact counts.

**DERIVED** — no hot-loop or N+1 problems appear at realistic scale. The projection queries are the 
only ones that would degrade with very large per-user/per-KB activity; if that ever matters, the
indexed `(knowledgeBaseId, userId)` coverage is already in place. No recommendation required beyond
waiting for evidence.

## 12. Test Coverage Audit

**OBSERVED** — the study subsystem carries the strongest test density in the repo:

- Unit: `study-grading.test.ts` — grading correctness, out-of-range/duplicate/incomplete submission,
  status transition matrix (3 + 8 assertions).
- Integration (real DB): `study-quiz.integration.test.ts` (13 tests), `study-flashcards.integration.test.ts`
  (8), `study-progress.integration.test.ts` (7), plus the earlier `flashcard-completion.integration.test.ts`.
  Covered: lifecycle start/submit/reload, immutability of completed attempts, per-user isolation,
  cross-org/KB `NOT_FOUND`, artifact type/status guards, content-parse failure, cascade on delete,
  clean slate on regeneration, progress aggregation, dashboard counts.
- Server-action wiring and viewer components are exercised through the app's integration suite (baseline
  at `40679997`: 689 tests passing).

**DERIVED** — the persistence and projection layer is thoroughly covered. Gaps are at the *surface*
level, which matches the general shape of the codebase (component-level tests are not a convention
here): no test covers the quiz viewer results/history rendering or the "abandon" behavior — but
"abandon" doesn't exist as a feature, so there is nothing to test yet. Not a finding; an observation
supporting the recommended slice below.

## 13. Findings

Severity conventions: **P0** data loss / security / availability. **P1** user-visible incorrect
behavior. **P2** meaningful gap or degraded experience. **P3** polish / internal / documented ceiling.

### P0 (0)
None.

### P1 (0)
None.

### P2

- **F1 — Dashboard study stats are dead-end numbers.** `dashboard-client.tsx:241-252` renders
  Quizzes Taken / Cards Known as plain `StatCard`s with no link, tooltip, or drill-down; the Quick
  Action grid has no Study entry (`:258-263`). A user cannot reach any study surface from the only
  aggregate view.
- **F2 — No page exists that aggregates study state.** Study state is knowable only as two home
  numbers and per-artifact one-liners in Studio. There is no per-KB or cross-KB view of deck coverage,
  quiz scores, or "what's in progress", even though every projection needed already exists server-side.
- **F3 — Study activity is invisible in the Live Activity feed.** `activity-feed.tsx:22` has no
  quiz/flashcard event types and the feed is demo/localStorage-driven; completing a quiz or reviewing
  a deck never appears alongside the upload/experiment events the dashboard claims to surface live.
- **F4 — No abandon/restart for in-progress quiz attempts.** `quiz.ts:156-159` silently reuses a
  `PENDING` attempt; the UI offers no discard. A user who starts a quiz mid-session carries a resumable
  attempt forever with no way to restart clean.
- **F5 — Hero health ring ignores study activity.** `dashboard-client.tsx:106-108` scores health purely
  on kb/docs/chunks/experiments/benchmark; a project that is fully studied but thin on experiments
  reads as unhealthy.

### P3

- **F6 — Internal field reuse: `attempts` holds flashcard review-count for FLASHCARDS artifacts**
  (`progress.ts:76`, gating at `artifact-list.tsx:103`). Harmless today (only used as a >0 gate), a
  trap for a future surface that prints `attempts`.
- **F7 — `markFlashcardReviewForUser` is read-then-upsert, last-write-wins under concurrent marks.**
  `flashcards.ts:119-123` documents this `ponytail:` ceiling and names the `{ increment }` upgrade.
  UI serializes per card; multi-tab edge only.
- **F8 — Misleading fallback for legacy invalid quiz content at read time.** `quiz.ts:122-123` falls
  back to `correctAnswer: 0, explanation: ""` when content can't be parsed on reload, so a COMPLETED
  attempt on a legacy/unparseable quiz renders a wrong "Correct answer" line. Attempt immutability plus
  one-shot content writes make this practically unreachable today.
- **F9 — Attempt growth is unbounded by design.** Every "Try again" appends attempt+answer rows with no
  retention horizon. Fine at current scale; worth a sweep if quizzing becomes heavy.
- **F10 — Deliberate: no spaced repetition.** Documented in schema + `review-status.ts`. Recorded so a
  future product decision is informed, not recommended here.

## 14. Candidate Next Slices

The following slices were evaluated factually against the observed code. No arbitrary numeric ranking
is used; the selection in §15 is driven by evidence in §6 and §13.

- **A. Dedicated Study Dashboard** — a read-only page/route that surfaces existing projections
  (per-KB decks, coverage, quiz best scores, in-progress state). Data is already computed; this is a
  presentation slice. **Schema: zero. Deps: zero.** Closes F1, F2, F5; partially F3.
- **B. Review Queue** — a screen that lists decks needing review and routes into the existing viewers.
  Depends on a definition of "due". Without SRS this means "incomplete or low-coverage decks", which
  the projections already answer. **Schema: zero. Deps: zero.** Closes F2 partially.
- **C. Lightweight Mastery** — a derived read-time per-artifact indicator (quiz best %, flashcard
  KNOWN/total) rendered beside existing lines. No new storage. **Schema: zero. Deps: zero.** Low value
  on its own; pairs naturally with A.
- **D. Advanced Mastery** — stored mastery scores, thresholds, decay curves. Requires new columns and
  writes. **Schema: change.** Rejected by posture: unrequested complexity, no user-facing reason yet.
- **E. Spaced Repetition** — full scheduling. Requires schedule/ease/inverval storage and a due-query,
  and it reverses a documented product decision (§8). **Schema: change.** Explicitly deferred.
- **F. Study Activity History** — persist/emit quiz + flashcard events into real activity data so the
  feed (or a study log) can show them. **Schema: change or new event source.** High honesty value,
  but F3 is cosmetic until A/B exist to point at.
- **G. Study Recommendations** — "review these decks / retake these quizzes" driven by projections.
  Heuristic over the same projections; **Schema: zero. Deps: zero.** Premature before a study surface
  exists.

## 15. Recommended Next Implementation Slice

**RECOMMENDATION — Slice A: a dedicated Study Dashboard.**

Why (evidence):

1. Every projection it needs already exists and is already paid for: `getStudyCountsForProject`
   (home dashboard), `getStudyProgressForUser` (Studio list), `getQuizAttemptHistoryForUser` (viewer).
   The slice is pure aggregation + presentation.
2. Closure against findings: A directly closes F1, F2, F5 and demotes F3 — the two dashboard numbers
   get a destination, a study aggregate page exists, and the health model can include study coverage.
3. Non-goal-compliant: it does not add a mastery score, SRS, activity storage, or gamification; it
   surfaces real derived state and links to the existing viewers.
4. Smallest working diff: one route + one read component reusing the existing server queries; no
   new schema, no new dependency, no change to the study layer.

**Schema:** zero changes.

Suggested shape (not built in this audit): a route under the knowledge base (e.g.,
`/app/knowledge-bases/[kbId]/study`) listing decks and quizzes with coverage/score projections, each
row linking to the existing artifact detail page; plus making the two home stat cards link into the
nearest KB study surfaces.

## 16. Explicit Non-Goals

- Claim-level artifact citations (from the provenance mission) are **deferred** — tracked in
  `docs/ARTIFACT_PROVENANCE_AUDIT.md`, out of scope here.
- No spaced repetition is recommended or implied (§8, F10) — a documented product decision.
- No mastery scores, streaks, gamification, LMS features, or social/shared study.
- No retention of attempts, no new event/audit storage (F9 deferred until evidence of scale).
- No change to quiz grading, flashcard status transitions, or the projection semantics — all sound.

## 17. Schema Assessment

**Schema: zero changes** required for the recommended slice and for every deferred decision (SRS,
mastery, activity history would each need their own additive change later, none of which the current
schema forecloses). The existing indexes cover the projection queries; model comments encode the study
contract; the migration is additive and idempotent.

## 18. Dependency Assessment

**Dependencies: zero** new. The slice uses `next/link`, existing UI components (`Button`, cards,
badges), and the existing server-action/study-layer surface. No new npm packages, no new services.

## 19. Validation Performed

- `git rev-parse HEAD` == `git rev-parse origin/main` == `40679997`; working tree clean except 11
  untracked `docs/*` audit reports (untouched).
- Read (primary sources): migration SQL (full), `schema.prisma` study models, all five study lib
  files, both study server actions, tenancy guard, home dashboard + `dashboard-client`, Studio +
  `artifact-list`, both viewers, artifact detail page + studio page, `artifacts`/`persistence`/`detail`/
  `engine` modules, activity feed, and the full study test inventory (unit + 3 integration files).
- Prior-mission baseline at this HEAD: 689 tests passing, `tsc --noEmit` clean, lint exit 0, prisma
  validate OK (unchanged in this audit-only task — no code paths modified).
- This task modified exactly one file: `docs/STUDY_DASHBOARD_MASTERY_AUDIT.md`, staged alone and
  committed as `docs(study): audit dashboard and mastery loop`.

## 20. Conclusion

The Study Dashboard & Mastery Loop is small, correct, well-tested, and honestly scoped: no P0/P1
defects, no tenancy leaks, no data-loss paths, explicit non-goals where the features don't exist. Its
weakness is presentation, not substance — the loop's state is computed and verifiable but only ever
shown as two numbers and a few list lines. The recommended next slice is a dedicated Study Dashboard
built from projections that already exist, with zero schema and zero dependency impact.