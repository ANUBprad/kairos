import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_CREDIT_AMOUNTS_INR,
  calculateCreditsForInr,
  CREDIT_PACKS,
  HISTORICAL_CREDIT_PACK_PRICES,
  HISTORICAL_PLAN_PRICES,
  PLAN_ACCESS_DESCRIPTION,
  PLAN_PRICES,
  historicalCreditPackCreditsForInr,
} from "./pricing.js";

describe("server-owned pricing", () => {
  it("uses the approved current pack prices and credits", () => {
    assert.deepEqual(CREDIT_PACKS.map((pack) => [pack.id, pack.amountInr, pack.credits]), [
      ["starter", 99, 100],
      ["learner", 199, 220],
      ["researcher", 499, 600],
      ["power", 999, 1300],
    ]);
    assert.deepEqual(ALLOWED_CREDIT_AMOUNTS_INR, [99, 199, 499, 999]);
  });

  it("keeps pack identity, bonus and popularity semantics unchanged", () => {
    assert.deepEqual(CREDIT_PACKS.map((pack) => pack.id), [
      "starter",
      "learner",
      "researcher",
      "power",
    ]);
    assert.deepEqual(CREDIT_PACKS.map((pack) => pack.name), [
      "Starter Pack",
      "Learner Pack",
      "Researcher Pack",
      "Power Pack",
    ]);
    assert.deepEqual(CREDIT_PACKS.map((pack) => pack.bonusPercent), [0, 10, 20, 30]);
    assert.deepEqual(
      CREDIT_PACKS.map((pack) => "isPopular" in pack && pack.isPopular),
      [false, true, false, false],
    );
  });

  it("only accepts allow-listed current top-up amounts", () => {
    for (const pack of CREDIT_PACKS) {
      assert.equal(calculateCreditsForInr(pack.amountInr), pack.credits);
    }
    // Old prices are no longer orderable.
    for (const pack of HISTORICAL_CREDIT_PACK_PRICES) {
      if (!ALLOWED_CREDIT_AMOUNTS_INR.includes(pack.amountInr)) {
        assert.throws(
          () => calculateCreditsForInr(pack.amountInr),
          /Unsupported top-up amount/,
        );
      }
    }
    assert.throws(() => calculateCreditsForInr(1), /Unsupported top-up amount/);
    assert.throws(() => calculateCreditsForInr(-99), /Unsupported top-up amount/);
    assert.throws(() => calculateCreditsForInr(75), /Unsupported top-up amount/);
  });

  it("prices plans server-side with explicit plan keys and one-time access", () => {
    assert.equal(PLAN_PRICES.PRO.pricePaise, 29900);
    assert.equal(PLAN_PRICES.PRO.label, "₹299 one-time / 30 days");
    assert.equal(PLAN_PRICES.PRO.credits, 500);
    assert.equal(PLAN_PRICES.PRO_PLUS.pricePaise, 69900);
    assert.equal(PLAN_PRICES.PRO_PLUS.label, "₹699 one-time / 30 days");
    assert.equal(PLAN_PRICES.PRO_PLUS.credits, 1500);
    assert.equal("FREE" in PLAN_PRICES, false);
    for (const plan of Object.values(PLAN_PRICES)) {
      assert.equal(plan.access, PLAN_ACCESS_DESCRIPTION);
      assert.match(plan.access, /One-time 30-day access/);
    }
  });

  it("retains historical prices only for legacy order classification", () => {
    assert.deepEqual(HISTORICAL_CREDIT_PACK_PRICES.map((pack) => pack.amountInr), [
      50, 100, 250, 500,
    ]);
    assert.equal(
      historicalCreditPackCreditsForInr(HISTORICAL_CREDIT_PACK_PRICES[0].amountInr),
      HISTORICAL_CREDIT_PACK_PRICES[0].credits,
    );
    assert.equal(historicalCreditPackCreditsForInr(123), null);
    assert.equal(HISTORICAL_PLAN_PRICES.PRO.pricePaise, 19900);
    assert.equal(HISTORICAL_PLAN_PRICES.PRO_PLUS.pricePaise, 49900);
  });
});
