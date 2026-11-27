import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import {
  CREDIT_COSTS,
  DAILY_ALLOWANCE_CREDITS,
  debitCreditsInTransaction,
  ensureDailyCreditsInTransaction,
  getNextUtcCreditReset,
  getUtcCreditDay,
} from "./credit.services.js";
import { InsufficientCreditsError } from "../types/app-error.js";

type UserState = {
  credits: number;
  dailyCredits: number;
  dailyCreditDay: string;
};

function fakeTx(initial: UserState) {
  const state: UserState = { ...initial };
  const ledger: Array<Record<string, unknown>> = [];

  const client = {
    creditTransaction: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        ledger.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (ledger.some((row) => row.idempotencyKey === data.idempotencyKey)) {
          throw Object.assign(new Error("duplicate key"), { code: "P2002" });
        }
        ledger.push(data);
        return data;
      },
    },
    user: {
      findUnique: async () => ({ ...state }),
      findUniqueOrThrow: async () => ({ ...state }),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (where.id !== "user-1") return { count: 0 };
        const dayClause = where.dailyCreditDay as { lt?: string } | undefined;
        if (dayClause?.lt && !(state.dailyCreditDay < dayClause.lt)) return { count: 0 };
        const dailyMin = (where.dailyCredits as { gte?: number } | undefined)?.gte;
        if (dailyMin !== undefined && state.dailyCredits < dailyMin) return { count: 0 };
        const paidMin = (where.credits as { gte?: number } | undefined)?.gte;
        if (paidMin !== undefined && state.credits < paidMin) return { count: 0 };

        for (const [key, value] of Object.entries(data)) {
          if (key === "dailyCreditDay") state.dailyCreditDay = String(value);
          if (key === "dailyCredits") {
            const change = value as number | { decrement?: number };
            state.dailyCredits = typeof change === "number"
              ? change
              : state.dailyCredits - (change.decrement ?? 0);
          }
          if (key === "credits") {
            const change = value as number | { decrement?: number };
            state.credits = typeof change === "number"
              ? change
              : state.credits - (change.decrement ?? 0);
          }
        }
        return { count: 1 };
      },
    },
  };

  return {
    tx: client as unknown as Prisma.TransactionClient,
    state,
    ledger,
  };
}

describe("daily credit allowance", () => {
  const now = new Date("2026-11-27T23:59:59.000Z");
  const today = getUtcCreditDay(now);

  it("rolls over to exactly 100 daily credits without touching paid credits", async () => {
    const { tx, state, ledger } = fakeTx({
      credits: 250,
      dailyCredits: 17,
      dailyCreditDay: "2026-11-26",
    });

    const snapshot = await ensureDailyCreditsInTransaction(tx, "user-1", now);

    assert.equal(snapshot.dailyCredits, DAILY_ALLOWANCE_CREDITS);
    assert.equal(snapshot.paidCredits, 250);
    assert.equal(snapshot.credits, 350);
    assert.equal(snapshot.dailyCreditDay, today);
    assert.equal(snapshot.nextDailyResetAt, getNextUtcCreditReset(now));
    assert.equal(state.credits, 250);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]!.type, "DAILY_ALLOWANCE");
    assert.equal(ledger[0]!.amount, 83);
    assert.equal(ledger[0]!.idempotencyKey, `daily-reset:user-1:${today}`);
  });

  it("grants the allowance only once under concurrent rollover", async () => {
    const shared = fakeTx({
      credits: 40,
      dailyCredits: 3,
      dailyCreditDay: "2026-11-26",
    });

    await Promise.all([
      ensureDailyCreditsInTransaction(shared.tx, "user-1", now),
      ensureDailyCreditsInTransaction(shared.tx, "user-1", now),
    ]);

    assert.equal(shared.state.dailyCredits, 100);
    assert.equal(shared.state.credits, 40);
    assert.equal(shared.ledger.length, 1);
  });

  it("spends daily credits before paid credits and records the split", async () => {
    const { tx, state, ledger } = fakeTx({
      credits: 40,
      dailyCredits: 2,
      dailyCreditDay: "2099-01-01",
    });

    const result = await debitCreditsInTransaction(tx, {
      userId: "user-1",
      amount: CREDIT_COSTS.SOURCE_UPLOAD + 4,
      type: "ARTIFACT_GENERATE",
      description: "test mixed charge",
      idempotencyKey: "artifact-charge:mixed-unit",
    });

    assert.equal(state.dailyCredits, 0);
    assert.equal(state.credits, 37);
    assert.equal(result.snapshot.credits, 37);
    assert.equal(ledger[0]!.bucket, "MIXED");
    assert.equal(ledger[0]!.dailyAmount, 2);
    assert.equal(ledger[0]!.paidAmount, 3);
  });

  it("does not charge twice for an idempotent retry", async () => {
    const { tx, state, ledger } = fakeTx({
      credits: 10,
      dailyCredits: 100,
      dailyCreditDay: "2099-01-01",
    });
    const input = {
      userId: "user-1",
      amount: CREDIT_COSTS.SOURCE_UPLOAD,
      type: "SOURCE_UPLOAD" as const,
      description: "source charge",
      idempotencyKey: "source-charge:retry-unit",
    };

    await debitCreditsInTransaction(tx, input);
    await debitCreditsInTransaction(tx, input);

    assert.equal(ledger.length, 1);
    assert.equal(state.dailyCredits, 99);
    assert.equal(state.credits, 10);
  });

  it("reports both buckets and reset timing when credits are insufficient", async () => {
    const { tx } = fakeTx({
      credits: 1,
      dailyCredits: 0,
      dailyCreditDay: "2099-01-01",
    });

    await assert.rejects(
      debitCreditsInTransaction(tx, {
        userId: "user-1",
        amount: 5,
        type: "ARTIFACT_GENERATE",
        description: "too expensive",
      }),
      (error: unknown) => {
        assert.ok(error instanceof InsufficientCreditsError);
        const details = error.details as Record<string, unknown>;
        assert.equal(details.dailyCredits, 0);
        assert.equal(details.paidCredits, 1);
        assert.ok(typeof details.nextDailyResetAt === "string");
        return true;
      },
    );
  });
});
