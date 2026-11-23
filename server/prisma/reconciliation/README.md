# Read-only reconciliation queries

`001-read-only-reconciliation.sql` contains SELECT-only queries for reviewing
historical credit balances, payment entitlements, suspicious legacy payment
rows, failed artifacts, the legacy `Test` table, and expired OAuth state/nonces
after the Kairos remediation.

Use a verified production copy or a read replica. These queries are reporting
aids only. They intentionally do **not**:

- perform any automatic `UPDATE`, `DELETE`, backfill, refund, credit grant, or
  plan revocation;
- refund or reclaim historical credits;
- rewrite or "guess" the meaning of legacy payment records;
- revoke, downgrade, or renew `PRO`/`PRO_PLUS` plans;
- drop, alter, or otherwise touch the legacy `Test` table (query 7 only counts
  its rows).

Any corrective action requires owner review and a separate, explicit plan.

## Query index

| Query | What it surfaces | Owner review focus |
| --- | --- | --- |
| 1 | Credit balance vs. credit ledger sum | Explain deltas; historical debits predate the ledger. |
| 2 | Successful payments with a null plan | Confirm these were genuine credit packs. |
| 3 | Amounts outside the server-owned allow-list | Identify non-standard legacy prices. |
| 4 | Duplicate Razorpay payment ids | Verify no order was settled twice. |
| 5 | Failed artifacts without charge/refund pairing | Confirm historical behavior; no auto-refund. |
| 6 | Refunds without a matching charge | Confirm ledger integrity. |
| 7 | Row count of legacy `Test` table | Confirm it still exists; never drop it here. |
| 8 | **Expired** OAuth state/nonces (`expiresAt < NOW()`) | Operational awareness only; no deletion. |
| 9 | `PENDING` pack-like rows with `plan = 'PRO'` | Legacy default created ambiguous rows; decide case by case, never assume PRO. |
| 10 | Zero credits with `PRO`/`PRO_PLUS` plan | Cannot be a valid subscription; check for a mis-recorded purchase. |
| 11 | Amount/plan/credits triples matching no exact pack or subscription mapping (and non-INR rows) | Treat every hit as ambiguous; settlement now rejects them. |
| 12 | `SUCCESS` rows with suspicious entitlement combinations (subscription plan with pack credits, pack amount with a plan, subscription amount with null plan, or plan with zero credits) | Compare with the credit ledger and user plan expiry before any manual correction. |

## Owner review checklist

1. Run the file against a read replica or verified copy; confirm it contains only
   `SELECT` statements.
2. Query 9: for each `PENDING` `plan='PRO'` row with a pack amount or zero
   credits, determine from provider records whether it was a credit pack or a
   subscription. Do not settle these rows automatically; the settlement path
   now fails closed.
3. Query 10: verify whether any zero-credit subscription row represents a real
   purchase that needs a separate, documented correction.
4. Query 11: treat each inconsistent amount/plan/credits combination as
   ambiguous evidence, not as an instruction to backfill.
5. Query 12: for each suspicious `SUCCESS` row, compare the user's credit
   transactions and `planExpiresAt` before deciding whether any action is owed.
6. Query 7: leave the legacy `Test` table untouched until a separate
   data/reference review explicitly approves its removal.
7. Record all decisions and execute any corrective change in a separate,
   reviewed migration or operational runbook — never by editing this file.
