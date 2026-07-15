import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await prisma.activityLog.findFirst({
    where: { userId, action: "REFERRAL_CODE" },
    select: { metadata: true },
  });

  if (existing?.metadata && typeof existing.metadata === "object") {
    return (existing.metadata as Record<string, string>).code ?? generateReferralCode();
  }

  const code = generateReferralCode();
  await prisma.activityLog.create({
    data: {
      userId,
      action: "REFERRAL_CODE",
      metadata: { code },
    },
  });
  return code;
}

export async function createReferralInvite(
  userId: string,
  email: string,
): Promise<{ token: string; url: string }> {
  const code = await getOrCreateReferralCode(userId);
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await prisma.activityLog.create({
    data: {
      userId,
      action: "REFERRAL_INVITE",
      metadata: { email, tokenHash, code },
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";
  return { token, url: `${baseUrl}/signup?ref=${code}` };
}

export async function getReferralStats(userId: string) {
  const code = await getOrCreateReferralCode(userId);

  const invites = await prisma.activityLog.count({
    where: { userId, action: "REFERRAL_INVITE" },
  });

  const signups = await prisma.activityLog.count({
    where: {
      userId,
      action: "REFERRAL_signup",
    },
  });

  return { code, invites, signups, conversions: signups };
}
