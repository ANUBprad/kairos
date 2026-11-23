import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_CREDIT_AMOUNTS_INR,
  calculateCreditsForInr,
  CREDIT_PACKS,
  PLAN_PRICES,
} from "./pricing.js";

describe("server-owned pricing", () => {
  it("only accepts allow-listed top-up amounts", () => {
    assert.deepEqual(ALLOWED_CREDIT_AMOUNTS_INR, [50, 100, 250, 500]);
    assert.equal(calculateCreditsForInr(100), 220);
    assert.throws(() => calculateCreditsForInr(1), /Unsupported top-up amount/);
    assert.throws(() => calculateCreditsForInr(-50), /Unsupported top-up amount/);
    assert.throws(() => calculateCreditsForInr(75), /Unsupported top-up amount/);
  });

  it("prices plans server-side with explicit plan keys", () => {
    assert.equal(PLAN_PRICES.PRO.pricePaise, 19900);
    assert.equal(PLAN_PRICES.PRO_PLUS.pricePaise, 49900);
    assert.equal("FREE" in PLAN_PRICES, false);
  });

  it("keeps pack amounts and credits in sync", () => {
    for (const pack of CREDIT_PACKS) {
      assert.equal(calculateCreditsForInr(pack.amountInr), pack.credits);
    }
  });
});
