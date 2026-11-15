# Advanced Features and Reliability Audit

This is the current implementation audit for the ingestion, navigation, advanced-feature, and CI cleanup branch. It supersedes older snapshots in `EVALUATION_REGRESSION_PRODUCTIZATION_AUDIT.md` where they describe mock data or migration gaps that have since been replaced.

## Ingestion and processing

- **PDFs:** development uses signed local-disk storage when Cloudinary is not configured; production requires all three Cloudinary credentials. The PDF parser releases its worker/resources after extraction. Scanned/image-only PDFs still need OCR and are not claimed to be supported as searchable text.
- **YouTube:** imports available captions/transcripts, supporting legacy XML, JSON3, and srv3 timedtext responses, plus watch, shorts, embed, and live URLs. It does not download video audio or transcribe videos with no accessible captions.
- **Processing:** upload, source-edit, repoint, and retry actions now await extraction, chunking, and embedding before returning. A source-list refresh marks jobs abandoned in any in-progress stage as `ERROR` after 30 minutes; the existing retry action can then restart them.
- **Remaining reliability limitation:** this is not a durable worker queue. Very long-running requests can still hit hosting request-duration limits. A database-backed worker/queue is the next step if Kairos is deployed to a serverless environment with short execution limits.

## Navigation and first-time experience

- The first-run home screen has one clear route into the Library and explains the source-to-research flow.
- The sidebar keeps the five everyday workspace destinations visible and advanced sections collapsed.
- Removed duplicate sidebar quick actions that repeated Library/Studio navigation, and removed the empty workspace menu for single-workspace accounts.
- Removed the undocumented keyboard shortcut handler; its shortcuts overlapped the command palette and sent some keys to unrelated destinations.
- The command palette no longer advertises navigation as executable actions. Core workspace destinations are shown by default; advanced routes remain searchable.
- The preview-only Experiment Builder is no longer in navigation. Its page now states that choices are not saved or applied to runs, and its fake “Run in Evaluation” action is removed.
- Trace Explorer and Incident Center list rows no longer link to detail routes that do not exist.

## Advanced features reviewed

### Data-backed in the current code

- **Leaderboards:** ranks persisted, completed benchmark runs and has an honest empty state.
- **Model Comparison:** derives per-model request/latency data from trace statistics and token/cost data from the cost ledger.
- **Analytics:** reads trace, cost, and drift server actions; empty states distinguish “not collected” from zero.
- **Experiment Planner:** derives coverage, Pareto frontiers, and candidate recommendations from completed runs.
- **Experiment Lineage:** derives manifests, provenance, diffs, and citations from persisted benchmark runs.
- **Review Queue, Quality Gates, Alerting, Drift Detection, Incident Center, Provider Health, Storage, and Pipeline Inspector:** each has a route and server-action-backed implementation. Their end-to-end behavior still needs local verification against the user's configured database and providers.

### Preview or incomplete surfaces

- **Experiment Builder:** local-only preview state; no persistence or run handoff. Hidden from navigation until the settings can be applied to an actual benchmark.
- **Trace detail and Incident detail:** no detail routes exist. The dead row links have been removed rather than leaving users with 404s.
- **Scanned PDF OCR:** not implemented.
- **YouTube audio transcription:** not implemented; accessible captions are required.

All 35 remaining sidebar destinations have matching route page files. Route existence is not treated as proof that every server-side workflow is healthy.

## CI issues addressed in this branch

The previously failing CI run showed these issues; the branch includes targeted fixes:

1. Regression-tracking call sites now pass the acting user ID required by the API.
2. The regression-tracking workflow supplies both `DATABASE_URL` and `DIRECT_URL`.
3. The migration-chain test overrides both URLs when deploying into its isolated throwaway database; otherwise Prisma can apply migrations to the parent test database while the test inspects an empty child database.
4. Failed benchmark questions retain error result rows for diagnosis; the failure-lifecycle test now asserts that behavior rather than expecting the rows to disappear.
5. Unowned standalone benchmark datasets follow the documented global-dataset policy; creator-owned standalone datasets remain private.
6. Benchmark chat generation uses the configured chat provider, independently of the embedding provider.
7. The experiments API accepts unowned global standalone datasets while continuing to reject foreign and fabricated dataset IDs.
8. Gateway gRPC deadlines now honor `KAIROS_PROVIDER_TIMEOUT_SECONDS` (with per-RPC defaults and a 600-second cap), matching the Docker E2E model timeout; a Go gateway test job now exercises this behavior.

CI on this branch is still the source of truth for whether these changes pass. Do not describe the suite as green until the latest branch run completes successfully.

## Remaining dependency risk

A previous install/audit report flagged 20 dependency vulnerabilities, including 3 critical. They have not been force-upgraded in this branch: dependency remediation needs a separate package-by-package review and regression run rather than an unreviewed `npm audit fix --force`.
