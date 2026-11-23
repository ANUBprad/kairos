# Read-only reconciliation queries

`001-read-only-reconciliation.sql` contains SELECT-only queries for reviewing
historical credit balances, payment entitlements, failed artifacts, legacy
rows, and OAuth nonce records after the Kairos remediation.

Use a verified production copy or a read replica. These queries are reporting
aids only. They intentionally do **not**:

- refund or reclaim historical credits;
- revoke, downgrade, or renew `PRO`/`PRO_PLUS` plans;
- rewrite payment records;
- drop the legacy `Test` table.

Any corrective action requires owner review and a separate, explicit plan.
