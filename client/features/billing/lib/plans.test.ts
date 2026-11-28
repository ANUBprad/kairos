import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CREDIT_PACKS,
  PLAN_CREDIT_ALLOWANCES,
  PRICING_PLANS,
  calculateCreditsForInr,
  formatUtcInstant,
  resolveCreditWindow,
  snapToAllowedCreditAmount,
} from "./plans.js";

describe("credit window normalization", () => {
  it("prefers server window fields over legacy daily fields", () => {
    const resolved = resolveCreditWindow({
      credits: 250,
      dailyCredits: 70,
      paidCredits: 180,
      dailyAllowance: 100,
      dailyCreditDay: "legacy-day",
      nextDailyResetAt: "legacy-reset",
      serverTime: "2026-11-27T16:00:00.000Z",
      creditWindowStart: "2026-11-27T12:00:00.000Z",
      nextCreditResetAt: "2026-11-27T18:00:00.000Z",
      windowAllowance: 100,
      windowsPerDay: 4,
    });

    assert.equal(resolved.creditWindowStart, "2026-11-27T12:00:00.000Z");
    assert.equal(resolved.nextCreditResetAt, "2026-11-27T18:00:00.000Z");
    assert.equal(resolved.nextDailyResetAt, resolved.nextCreditResetAt);
    assert.equal(resolved.windowAllowance, 100);
    assert.equal(resolved.windowsPerDay, 4);
  });

  it("falls back to legacy fields when the new fields are absent", () => {
    const resolved = resolveCreditWindow({
      credits: 20,
      dailyCredits: 20,
      paidCredits: 0,
      dailyAllowance: 100,
      dailyCreditDay: "2026-11-27",
      nextDailyResetAt: "2026-11-28T00:00:00.000Z",
      serverTime: "2026-11-27T23:00:00.000Z",
    });

    assert.equal(resolved.creditWindowStart, "2026-11-27");
    assert.equal(resolved.nextCreditResetAt, "2026-11-28T00:00:00.000Z");
    assert.equal(resolved.windowAllowance, 100);
    assert.equal(resolved.windowsPerDay, 4);
    assert.equal(resolved.isDeveloper, false);
  });

  it("reads developer entitlement only from the server snapshot", () => {
    const resolved = resolveCreditWindow({
      credits: 0,
      dailyCredits: 0,
      paidCredits: 0,
      dailyAllowance: 100,
      dailyCreditDay: "",
      nextDailyResetAt: "",
      serverTime: "",
      isDeveloper: true,
      entitlement: { developer: true, bypassCredits: true, bypassFreeQuotas: true },
    });

    assert.equal(resolved.isDeveloper, true);
    assert.equal(resolved.bypassCredits, true);
    assert.equal(resolved.bypassFreeQuotas, true);
  });

  it("formats server-provided instants in UTC", () => {
    assert.equal(
      formatUtcInstant("2026-11-27T18:00:00.000Z"),
      "2026-11-27 at 18:00 UTC",
    );
    assert.equal(formatUtcInstant(""), "Not available");
    assert.equal(formatUtcInstant("not-a-date"), "Not available");
  });
});

describe("server-aligned credit pricing", () => {
  it("snaps custom amounts to allow-listed server prices", () => {
    assert.equal(snapToAllowedCreditAmount(50), 99);
    assert.equal(snapToAllowedCreditAmount(199), 199);
    assert.equal(snapToAllowedCreditAmount(500), 499);
    assert.equal(snapToAllowedCreditAmount(Number.NaN), 99);
  });

  it("only awards credits for allow-listed amounts", () => {
    assert.equal(calculateCreditsForInr(99), 100);
    assert.equal(calculateCreditsForInr(999), 1300);
    assert.equal(calculateCreditsForInr(50), 100);
  });

  it("keeps display mirrors aligned with server-owned pricing", () => {
    assert.deepEqual(
      CREDIT_PACKS.map(({ id, amountInr, credits, bonusPercent }) => [
        id,
        amountInr,
        credits,
        bonusPercent,
      ]),
      [
        ["starter", 99, 100, 0],
        ["learner", 199, 220, 10],
        ["researcher", 499, 600, 20],
        ["power", 999, 1300, 30],
      ],
    );
    assert.deepEqual(
      PRICING_PLANS.map(({ id, priceInr, access }) => [id, priceInr, access]),
      [
        ["FREE", 0, "No purchase required"],
        ["PRO", 299, "One-time 30-day access"],
        ["PRO_PLUS", 699, "One-time 30-day access"],
      ],
    );
    assert.deepEqual(PLAN_CREDIT_ALLOWANCES, { PRO: 500, PRO_PLUS: 1500 });
  });
});
