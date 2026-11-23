-- Read-only reconciliation queries for the Kairos security/schema remediation.
--
-- Run against a verified copy of the target database. These statements only
-- SELECT data. Do not use them to automatically refund credits, revoke plans,
-- rewrite payment rows, or drop the legacy "Test" table.

-- 1. Credit balance vs. ledger sum. Differences may be legitimate for users
--    whose historical debits predate the ledger. Review before any action.
SELECT
    u.id AS user_id,
    u.email,
    u.credits AS current_credits,
    COALESCE(SUM(ct.amount), 0) AS ledger_net,
    u.credits - COALESCE(SUM(ct.amount), 0) AS unexplained_delta
FROM "user" u
LEFT JOIN "credit_transaction" ct ON ct."userId" = u.id
GROUP BY u.id, u.email, u.credits
HAVING u.credits <> COALESCE(SUM(ct.amount), 0)
ORDER BY ABS(u.credits - COALESCE(SUM(ct.amount), 0)) DESC;

-- 2. Successful payments whose recorded plan is null. Credit packs are meant
--    to have null plans, so join to entitlement state and review, never assume.
SELECT
    pr.id,
    pr."userId",
    pr."razorpayOrderId",
    pr."razorpayPaymentId",
    pr.plan,
    pr."creditsPurchased",
    pr.amount,
    u.plan AS current_user_plan,
    u."planExpiresAt"
FROM "payment_record" pr
JOIN "user" u ON u.id = pr."userId"
WHERE pr.status = 'SUCCESS'
ORDER BY pr."createdAt" DESC;

-- 3. Payment amounts outside the current server-owned allow-list (paise).
SELECT
    id,
    "razorpayOrderId",
    amount,
    plan,
    status,
    "createdAt"
FROM "payment_record"
WHERE amount NOT IN (5000, 10000, 25000, 50000, 19900, 49900)
ORDER BY "createdAt" DESC;

-- 4. Repeated payment identifiers; any rows here need manual review.
SELECT "razorpayPaymentId", COUNT(*) AS row_count
FROM "payment_record"
WHERE "razorpayPaymentId" IS NOT NULL
GROUP BY "razorpayPaymentId"
HAVING COUNT(*) > 1;

-- 5. Failed artifacts with no recorded debit or refund. Historical rows are
--    expected here; the remediation deliberately does not refund them.
SELECT
    a.id AS artifact_id,
    a."workspaceId",
    w."userId",
    a.status,
    a."refundedAt",
    (charge.id IS NOT NULL) AS has_charge,
    (refund.id IS NOT NULL) AS has_refund
FROM "learning_artifact" a
JOIN "workspace" w ON w.id = a."workspaceId"
LEFT JOIN "credit_transaction" charge
  ON charge."idempotencyKey" = 'artifact-charge:' || a.id
LEFT JOIN "credit_transaction" refund
  ON refund."idempotencyKey" = 'artifact-refund:' || a.id
WHERE a.status = 'FAILED'
ORDER BY a."updatedAt" DESC;

-- 6. Refunds without a matching charge; must be empty after remediation.
SELECT refund."userId", refund."idempotencyKey", refund.amount
FROM "credit_transaction" refund
WHERE refund.type = 'REFUND'
  AND refund."idempotencyKey" LIKE 'artifact-refund:%'
  AND NOT EXISTS (
      SELECT 1
      FROM "credit_transaction" charge
      WHERE charge."idempotencyKey" =
        'artifact-charge:' || SUBSTRING(refund."idempotencyKey" FROM LENGTH('artifact-refund:') + 1)
  );

-- 7. Legacy orphan table. Preserve until a data/reference review is complete.
SELECT COUNT(*) AS legacy_test_rows FROM "Test";

-- 8. Stale unexpired OAuth nonce records for operational awareness.
SELECT
    nonce,
    "userId",
    provider,
    "expiresAt",
    "consumedAt"
FROM "oauth_state_nonce"
WHERE "expiresAt" < NOW()
ORDER BY "expiresAt" DESC
LIMIT 100;
