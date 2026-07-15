import { prisma } from "@/lib/prisma";
import { PLANS, type PlanType, type PlanLimits } from "./plans";

export type EntitlementCheck = {
  allowed: boolean;
  current: number;
  limit: number;
  plan: PlanType;
};

export async function getUserPlan(userId: string): Promise<PlanType> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  if (!sub || sub.status !== "ACTIVE") return "FREE";
  return sub.plan as PlanType;
}

export async function getUserLimits(userId: string): Promise<PlanLimits> {
  const plan = await getUserPlan(userId);
  return PLANS[plan].limits;
}

export async function checkEntitlement(
  userId: string,
  meter: string,
): Promise<EntitlementCheck> {
  const limits = await getUserLimits(userId);
  const plan = await getUserPlan(userId);

  const limitMap: Record<string, number> = {
    knowledgeBases: limits.knowledgeBases,
    documents: limits.documents,
    aiChats: limits.aiChats,
    uploads: limits.uploadsPerDay,
    apiKeys: limits.apiKeys,
    teamMembers: limits.teamMembers,
    agents: limits.agents,
    credits: limits.credits,
  };

  const limit = limitMap[meter] ?? -1;
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, plan };
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const usage = await prisma.usageRecord.findUnique({
    where: { userId_meter_period: { userId, meter, period } },
    select: { quantity: true },
  });

  const current = usage?.quantity ?? 0;
  return { allowed: current < limit, current, limit, plan };
}

export async function incrementUsage(
  userId: string,
  meter: string,
  quantity = 1,
): Promise<void> {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  await prisma.usageRecord.upsert({
    where: { userId_meter_period: { userId, meter, period } },
    update: { quantity: { increment: quantity } },
    create: { userId, meter, period, quantity },
  });
}

export async function getUsage(
  userId: string,
  meter: string,
): Promise<{ current: number; limit: number; plan: PlanType }> {
  const limits = await getUserLimits(userId);
  const plan = await getUserPlan(userId);

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const usage = await prisma.usageRecord.findUnique({
    where: { userId_meter_period: { userId, meter, period } },
    select: { quantity: true },
  });

  const limitMap: Record<string, number> = {
    knowledgeBases: limits.knowledgeBases,
    documents: limits.documents,
    aiChats: limits.aiChats,
    uploads: limits.uploadsPerDay,
    apiKeys: limits.apiKeys,
    agents: limits.agents,
  };

  return {
    current: usage?.quantity ?? 0,
    limit: limitMap[meter] ?? -1,
    plan,
  };
}

export async function getAllUsage(userId: string) {
  const limits = await getUserLimits(userId);
  const plan = await getUserPlan(userId);
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const records = await prisma.usageRecord.findMany({
    where: { userId, period },
    select: { meter: true, quantity: true },
  });

  const usageMap: Record<string, number> = {};
  for (const r of records) usageMap[r.meter] = r.quantity;

  return {
    plan,
    period,
    knowledgeBases: { current: usageMap["knowledgeBases"] ?? 0, limit: limits.knowledgeBases },
    documents: { current: usageMap["documents"] ?? 0, limit: limits.documents },
    aiChats: { current: usageMap["aiChats"] ?? 0, limit: limits.aiChats },
    uploads: { current: usageMap["uploads"] ?? 0, limit: limits.uploadsPerDay },
    storageMB: { current: usageMap["storageMB"] ?? 0, limit: limits.storageMB },
    agents: { current: usageMap["agents"] ?? 0, limit: limits.agents },
    credits: { current: usageMap["credits"] ?? 0, limit: limits.credits },
  };
}
