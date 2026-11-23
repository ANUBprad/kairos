-- Read-only reconciliation queries for the Kairos security/schema remediation.
--
-- REPORT-ONLY. Every statement below is a SELECT. NO automatic UPDATE, DELETE,
-- backfill, refund, credit grant, plan revocation or data rewrite is performed
-- by this file. The legacy "Test" table is left untouched: query 7 only counts
-- its rows and nothing here drops or modifies it.
--
-- Owner review checklist:
--   * Queries 1-2: explain credit balance vs. ledger deltas and confirm that
--     successful null-plan payments really were credit packs.
--   * Queries 3-4: review off-allow-list amounts and duplicate payment ids.
--   * Queries 5-6: confirm failed-artifact charges/refunds are paired.
--   * Query 7: confirm the legacy Test table still exists before any cleanup.
--   * Query 8: note expired OAuth state/nonces for operational cleanup.
--   * Query 9: PENDING pack-like rows with a legacy PRO plan. Decide case by
--     case whether the order was a pack or a subscription; never assume PRO.
--   * Query 10: zero-credit rows with a subscription plan; verify whether the
--     subscription was really purchased before any manual correction.
--   * Query 11: rows whose amount/plan/credit triple matches no exact
--     server-owned pack or subscription mapping; treat as ambiguous.
--   * Query 12: SUCCESS rows with suspicious entitlement combinations; compare
--     against the user's credit ledger and plan expiry before acting.
--
-- Run against a verified copy of the target database or a read replica. Any
-- corrective action requires owner review and a separate, explicit plan.

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
--    This is a read-only count; "Test" is never dropped or modified here.
SELECT COUNT(*) AS legacy_test_rows FROM "Test";

-- 8. Expired OAuth state/nonce records for operational awareness. These nonces
--    are past "expiresAt"; this query does not consume or delete them.
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

-- 9. PENDING credit-pack-like rows that carry a legacy PRO plan. Historical
--    migrations defaulted plan to 'PRO', so a ₹50/₹100/₹250/₹500 pack (5000,
--    10000, 25000, 50000 paise) or a row with zero recorded credits may be
--    mislabeled. Settlement now rejects these; the owner must decide manually.
SELECT
    pr.id,
    pr."userId",
    pr."razorpayOrderId",
    pr.plan,
    pr."creditsPurchased",
    pr.amount,
    pr.currency,
    pr.status,
    u.plan AS current_user_plan,
    u."planExpiresAt"
FROM "payment_record" pr
JOIN "user" u ON u.id = pr."userId"
WHERE pr.status = 'PENDING'
  AND pr.plan = 'PRO'
  AND (
      pr.amount IN (5000, 10000, 25000, 50000)
      OR pr."creditsPurchased" = 0
  )
ORDER BY pr."createdAt" DESC;

-- 10. Records with zero credits but a subscription plan. These can never be a
--     valid subscription under the current server-owned mapping and are now
--     rejected at settlement; review whether a real purchase was mis-recorded.
SELECT
    pr.id,
    pr."userId",
    pr."razorpayOrderId",
    pr.plan,
    pr."creditsPurchased",
    pr.amount,
    pr.currency,
    pr.status,
    u.plan AS current_user_plan
FROM "payment_record" pr
JOIN "user" u ON u.id = pr."userId"
WHERE pr.plan IN ('PRO', 'PRO_PLUS')
  AND pr."creditsPurchased" = 0
ORDER BY pr."createdAt" DESC;

-- 11. Rows whose amount/plan/credits combination matches neither an exact
--     credit pack (null plan) nor an exact subscription mapping. Currency other
--     than INR is also flagged. Treat every hit as ambiguous, never auto-fix.
SELECT
    pr.id,
    pr."userId",
    pr."razorpayOrderId",
    pr.plan,
    pr."creditsPurchased",
    pr.amount,
    pr.currency,
    pr.status,
    pr."createdAt"
FROM "payment_record" pr
WHERE pr.currency <> 'INR'
   OR NOT (
        (pr.plan IS NULL AND (
            (pr.amount = 5000  AND pr."creditsPurchased" = 100)
         OR (pr.amount = 10000 AND pr."creditsPurchased" = 220)
         OR (pr.amount = 25000 AND pr."creditsPurchased" = 600)
         OR (pr.amount = 50000 AND pr."creditsPurchased" = 1300)
        ))
        OR (pr.plan = 'PRO'      AND pr.amount = 19900 AND pr."creditsPurchased" = 500)
        OR (pr.plan = 'PRO_PLUS' AND pr.amount = 49900 AND pr."creditsPurchased" = 1500)
   )
ORDER BY pr."createdAt" DESC;

-- 12. SUCCESS rows with suspicious entitlement combinations: a subscription
--     plan holding credit-pack credits, a pack amount holding a plan, a
--     subscription amount with no plan, or a plan with zero credits. The owner
--     must compare each hit with the credit ledger and user plan expiry before
--     considering any manual correction.
SELECT
    pr.id,
    pr."userId",
    pr."razorpayOrderId",
    pr."razorpayPaymentId",
    pr.plan,
    pr."creditsPurchased",
    pr.amount,
    pr.currency,
    pr."createdAt",
    u.plan AS current_user_plan,
    u."planExpiresAt"
FROM "payment_record" pr
JOIN "user" u ON u.id = pr."userId"
WHERE pr.status = 'SUCCESS'
  AND (
      (pr.plan IN ('PRO', 'PRO_PLUS') AND pr."creditsPurchased" IN (100, 220, 600, 1300))
      OR (pr.amount IN (5000, 10000, 25000, 50000) AND pr.plan IS NOT NULL)
      OR (pr.amount IN (19900, 49900) AND pr.plan IS NULL)
      OR (pr.plan IN ('PRO', 'PRO_PLUS') AND pr."creditsPurchased" = 0)
  )
ORDER BY pr."createdAt" DESC;
