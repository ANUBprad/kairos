# Kairos — Release readiness

**Current engineering classification: C — READY FOR STAGING DEPLOYMENT.**

**Independent licensing classification: E — PUBLIC REDISTRIBUTION BLOCKED — LICENSING EVIDENCE INSUFFICIENT.**

## Current state

- Repository: `ANUBprad/kairos` (private), branch: `main`.
- Latest verified baseline before this documentation cleanup: `68764dcde7683f7fb5e539497c4c693d74ae5ae5`.
- Phase 10 found no authorized Render deployment access. No staging deployment or hosted acceptance test was performed.
- The only permitted staging blueprint is `render.staging.yaml`, containing `kairos-server-staging` and `kairos-client-staging`. Do not deploy the production-containing `render.yaml`.
- Phase 10 local evidence: staging and redirect guards passed; server typecheck/build passed; unit tests 163/163; integration tests 49/49 against a disposable PostgreSQL database; 14 migrations applied and status clean.
- Live HTTPS, hosted authentication/OAuth, Razorpay test-mode, provider calls, hosted worker recovery, monitoring, backup automation and separate-target restore remain unverified or blocked.
- No production deployment, production database operation, real payment/refund, real customer data, real email or public release is authorized by this status.

## Required before staging acceptance

1. Obtain authorized access to the Render workspace.
2. Provision isolated staging services, database, OAuth applications and staging-only provider credentials.
3. Deploy only `render.staging.yaml`.
4. Apply and verify migrations on the confirmed staging database.
5. Execute and record the live security, payment, provider and worker acceptance checks in [STAGING_SECURITY_TESTS.md](STAGING_SECURITY_TESTS.md) and [INTEGRATION_SECURITY.md](INTEGRATION_SECURITY.md).
6. Configure monitoring, alerts, automated backups and a restore rehearsal into a separate target.
7. Update this status only when supported by actual hosted evidence.

## Licensing gate

The repository remains private. The upstream licensing evidence is conflicting/incomplete, and the existing attribution notices must remain intact. Do not publish, redistribute, add a new license grant, or imply that the licensing issue is resolved. See [LICENSING_REVIEW.md](LICENSING_REVIEW.md) and [ATTRIBUTION.md](ATTRIBUTION.md).

## Operational references

Use the focused documents linked from the root [README.md](README.md): deployment, security tests, integrations, background jobs, operations, monitoring, migrations, and dependency security. Historical phase-by-phase summaries are intentionally not maintained as separate top-level files; this document is the single current release-status summary.
