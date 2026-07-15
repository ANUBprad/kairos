import { prisma } from "@/lib/prisma";
import { getUserPlan } from "@/lib/billing/entitlements";
import { PLANS } from "@/lib/billing/plans";

export interface CreditBalance {
  plan: string;
  credits: number;
  used: number;
  remaining: number;
  unlimited: boolean;
}

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const plan = await getUserPlan(userId);
  const limits = PLANS[plan].limits;
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const usage = await prisma.usageRecord.findUnique({
    where: { userId_meter_period: { userId, meter: "credits", period } },
    select: { quantity: true },
  });

  const used = usage?.quantity ?? 0;
  const total = limits.credits;
  const unlimited = total === -1;

  return {
    plan,
    credits: total,
    used,
    remaining: unlimited ? -1 : Math.max(0, total - used),
    unlimited,
  };
}

export async function deductCredits(
  userId: string,
  amount: number,
): Promise<{ success: boolean; remaining: number }> {
  const balance = await getCreditBalance(userId);
  if (balance.unlimited) {
    await incrementCredits(userId, amount);
    return { success: true, remaining: -1 };
  }
  if (balance.remaining < amount) {
    return { success: false, remaining: balance.remaining };
  }
  await incrementCredits(userId, amount);
  return { success: true, remaining: balance.remaining - amount };
}

export async function incrementCredits(userId: string, amount: number): Promise<void> {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.usageRecord.upsert({
    where: { userId_meter_period: { userId, meter: "credits", period } },
    update: { quantity: { increment: amount } },
    create: { userId, meter: "credits", period, quantity: amount },
  });
}

export async function getMonthlySavings(userId: string): Promise<number> {
  const plan = await getUserPlan(userId);
  if (plan === "FREE") return 0;
  const balance = await getCreditBalance(userId);
  const costPerCredit = plan === "STARTER" ? 0.0036 : plan === "PRO" ? 0.0016 : 0.00118;
  return Math.round(balance.used * costPerCredit * 100);
}
