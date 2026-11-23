import {
    countUserMessages,
    countUserSources,
    countUserWorkspaces,
    findUserPlanDetails,
    findUserTotalArtifacts,
    incrementUserArtifactCount as incrementUserArtifactCountRepo,
} from "../repository/user.repository.js";
import {
    assertHasCredits,
    CREDIT_COSTS,
    deductCredits,
    getCreditHistory,
    getUserCredits,
} from "./credit.services.js";
import { ForbiddenError } from "../types/app-error.js";
import type { PlanType, Prisma } from "../generated/prisma/client.js";

export const PLAN_LIMITS: Record<
    PlanType,
    {
        WORKSPACES: number;
        MESSAGES: number | null;
        SOURCES: number;
        ARTIFACTS: number;
    }
> = {
    FREE: {
        WORKSPACES: 1,
        MESSAGES: 10,
        SOURCES: 3,
        ARTIFACTS: 3,
    },
    PRO: {
        WORKSPACES: 3,
        MESSAGES: null, // Unlimited chats
        SOURCES: 15,
        ARTIFACTS: 10,
    },
    PRO_PLUS: {
        WORKSPACES: 10,
        MESSAGES: null, // Unlimited chats
        SOURCES: 30,
        ARTIFACTS: 25,
    },
};

export interface LimitDetails {
    limitType: "workspaces" | "artifacts" | "sources" | "messages";
    current: number;
    max: number | null;
    plan: PlanType;
}

/** Limit types that can be enforced from inside a creation transaction. */
export type TransactionalLimitType = "artifacts" | "sources" | "messages";

function effectivePlan(user: {
    plan: PlanType;
    planExpiresAt: Date | null;
}): PlanType {
    if (
        user.plan !== "FREE" &&
        user.planExpiresAt !== null &&
        new Date(user.planExpiresAt) <= new Date()
    ) {
        return "FREE";
    }
    return user.plan;
}

function maxFor(plan: PlanType, limitType: TransactionalLimitType): number | null {
    const limits = PLAN_LIMITS[plan];
    if (limitType === "sources") return limits.SOURCES;
    if (limitType === "artifacts") return limits.ARTIFACTS;
    return limits.MESSAGES;
}

function quotaExceededError(
    plan: PlanType,
    limitType: TransactionalLimitType,
    current: number,
    max: number | null,
): ForbiddenError {
    const nextPlan = plan === "FREE" ? "Pro" : "Pro+";
    return new ForbiddenError(
        `${plan} plan limit reached: You can create a maximum of ${max} ${limitType} on the ${plan} plan. Upgrade to ${nextPlan} for more.`,
        {
            code: "LIMIT_REACHED",
            limitType,
            current,
            max,
            plan,
        } satisfies LimitDetails & { code: string },
    );
}

/**
 * Serializes quota checks for a user inside a transaction where raw SQL is
 * available (PostgreSQL advisory lock). Fakes without `$queryRaw` simply rely
 * on the transactional count re-check below.
 */
async function lockQuotaForUser(
    tx: Prisma.TransactionClient,
    userId: string,
): Promise<void> {
    const queryRaw = (tx as unknown as {
        $queryRaw?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
    }).$queryRaw;
    if (typeof queryRaw === "function") {
        await queryRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`;
    }
}

/**
 * Re-checks a plan quota using data read inside the caller's transaction.
 * Pre-checks in the API are advisory; this is the authoritative boundary check
 * performed in the same transaction that creates the record and debits credits.
 */
export async function assertQuotaInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    limitType: TransactionalLimitType,
): Promise<void> {
    await lockQuotaForUser(tx, userId);

    const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
            plan: true,
            planExpiresAt: true,
            totalArtifactsCreated: true,
        },
    });
    const plan = user ? effectivePlan(user) : "FREE";
    const max = maxFor(plan, limitType);
    if (max === null) return;

    let current = 0;
    if (limitType === "sources") {
        current = await tx.source.count({
            where: { workspace: { userId } },
        });
    } else if (limitType === "messages") {
        current = await tx.message.count({
            where: { role: "USER", conversation: { workspace: { userId } } },
        });
    } else {
        current = user?.totalArtifactsCreated ?? 0;
    }

    if (current >= max) {
        throw quotaExceededError(plan, limitType, current, max);
    }
}

/**
 * Atomically consumes one artifact quota slot. The conditional counter update
 * makes exact-boundary concurrency safe even without serializable isolation:
 * two transactions can never both take the last slot.
 */
export async function consumeArtifactQuotaInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
): Promise<void> {
    await lockQuotaForUser(tx, userId);

    const user = await tx.user.findUnique({
        where: { id: userId },
        select: { plan: true, planExpiresAt: true, totalArtifactsCreated: true },
    });
    const plan = user ? effectivePlan(user) : "FREE";
    const max = maxFor(plan, "artifacts") ?? 0;
    const current = user?.totalArtifactsCreated ?? 0;

    const consumed = await tx.user.updateMany({
        where: { id: userId, totalArtifactsCreated: { lt: max } },
        data: { totalArtifactsCreated: { increment: 1 } },
    });
    if (consumed.count !== 1) {
        throw quotaExceededError(plan, "artifacts", current, max);
    }
}

async function assertUserQuota(
    userId: string,
    limitType: TransactionalLimitType,
): Promise<void> {
    const { plan, limits } = await getUserPlan(userId);
    const max =
        limitType === "sources"
            ? limits.SOURCES
            : limitType === "artifacts"
              ? limits.ARTIFACTS
              : limits.MESSAGES;
    if (max === null) return;

    const current =
        limitType === "sources"
            ? await countUserSources(userId)
            : limitType === "artifacts"
              ? (await findUserTotalArtifacts(userId))?.totalArtifactsCreated ?? 0
              : await countUserMessages(userId);

    if (current >= max) {
        throw quotaExceededError(plan, limitType, current, max);
    }
}

/**
 * Retrieves the subscription plan details, expiration state, and associated resource limits for a user.
 *
 * @param userId - Unique identifier of the user
 * @returns An object containing the effective plan type, expiration date, pro flags, and plan limits
 */
export async function getUserPlan(userId: string) {
    const user = await findUserPlanDetails(userId);

    const subscriptionPlan: PlanType = user?.plan ?? "FREE";
    const planExpiresAt = user?.planExpiresAt ?? null;
    const subscriptionExpired =
        subscriptionPlan !== "FREE" &&
        planExpiresAt !== null &&
        new Date(planExpiresAt) <= new Date();

    const plan: PlanType = subscriptionExpired ? "FREE" : subscriptionPlan;
    const isPro = plan === "PRO" || plan === "PRO_PLUS";
    const isProPlus = plan === "PRO_PLUS";

    return {
        plan,
        subscriptionPlan,
        subscriptionExpired,
        planExpiresAt,
        isPro,
        isProPlus,
        limits: PLAN_LIMITS[plan],
    };
}

/**
 * Computes a user's current resource consumption against their plan limits across workspaces, sources, artifacts, and messages.
 *
 * @param userId - Unique identifier of the user
 * @returns Comprehensive usage metrics with current counts, maximum limits, and exceeded flags
 */
export async function getUserUsage(userId: string) {
    const {
        plan,
        subscriptionPlan,
        subscriptionExpired,
        isPro,
        isProPlus,
        planExpiresAt,
        limits,
    } = await getUserPlan(userId);

    const [workspaceCount, sourceCount, userArtifacts, messageCount, credits, creditHistory] =
        await Promise.all([
            countUserWorkspaces(userId),
            countUserSources(userId),
            findUserTotalArtifacts(userId),
            countUserMessages(userId),
            getUserCredits(userId),
            getCreditHistory(userId, 50),
        ]);

    const totalArtifactsCreated = userArtifacts?.totalArtifactsCreated ?? 0;

    return {
        credits,
        creditHistory,
        plan,
        subscriptionPlan,
        subscriptionExpired,
        isPro,
        isProPlus,
        planExpiresAt,
        workspaces: {
            count: workspaceCount,
            limit: limits.WORKSPACES,
            exceeded: workspaceCount >= limits.WORKSPACES,
        },
        sources: {
            count: sourceCount,
            limit: limits.SOURCES,
            exceeded: sourceCount >= limits.SOURCES,
        },
        artifacts: {
            count: totalArtifactsCreated,
            limit: limits.ARTIFACTS,
            exceeded: totalArtifactsCreated >= limits.ARTIFACTS,
        },
        messages: {
            count: messageCount,
            limit: limits.MESSAGES,
            exceeded:
                limits.MESSAGES !== null && messageCount >= limits.MESSAGES,
        },
    };
}

/**
 * Enforces workspace creation quotas based on the user's active subscription plan.
 *
 * @param userId - Unique identifier of the user
 * @throws {ForbiddenError} When the workspace limit for the user's plan is reached
 */
export async function assertCanCreateWorkspace(userId: string): Promise<void> {
    const { plan, limits } = await getUserPlan(userId);

    const count = await countUserWorkspaces(userId);
    if (count >= limits.WORKSPACES) {
        const nextPlan = plan === "FREE" ? "Pro" : "Pro+";
        throw new ForbiddenError(
            `${plan} plan limit reached: You can create a maximum of ${limits.WORKSPACES} workspace${limits.WORKSPACES > 1 ? "s" : ""} on the ${plan} plan. Upgrade to ${nextPlan} for more workspaces.`,
            {
                code: "LIMIT_REACHED",
                limitType: "workspaces",
                current: count,
                max: limits.WORKSPACES,
                plan,
            } satisfies LimitDetails & { code: string },
        );
    }
}

/**
 * Checks the credit balance before doing expensive work. The debit itself is
 * deferred until the persisted entity exists so failed work can be refunded
 * against a durable ledger entry.
 */
export async function assertCanCreateSource(userId: string): Promise<void> {
    await assertHasCredits(userId, CREDIT_COSTS.SOURCE_UPLOAD);
    await assertUserQuota(userId, "sources");
}

/** Charges a source exactly once after its record has been created. */
export async function chargeForSource(userId: string, sourceId: string) {
    return deductCredits({
        userId,
        amount: CREDIT_COSTS.SOURCE_UPLOAD,
        type: "SOURCE_UPLOAD",
        description: "Uploaded a source document",
        metadata: { sourceId },
        idempotencyKey: `source-charge:${sourceId}`,
    });
}

/** Returns the authoritative credit cost and ledger type for an artifact. */
export function getArtifactCharge(artifactType?: string) {
    const isPodcast = artifactType === "PODCAST";
    return {
        cost: isPodcast
            ? CREDIT_COSTS.AUDIO_DEBATE
            : CREDIT_COSTS.ARTIFACT_GENERATE,
        type: isPodcast ? "AUDIO_DEBATE" : "ARTIFACT_GENERATE",
        description: isPodcast
            ? "Generated an Audio Debate Podcast"
            : `Generated ${artifactType || "study"} artifact`,
    } as const;
}

/** Checks the artifact credit balance without charging. */
export async function assertCanCreateArtifact(
    userId: string,
    artifactType?: string,
): Promise<void> {
    await assertHasCredits(userId, getArtifactCharge(artifactType).cost);
    await assertUserQuota(userId, "artifacts");
}

/** Charges an artifact exactly once after its record has been created. */
export async function chargeForArtifact(
    userId: string,
    artifactId: string,
    artifactType?: string,
) {
    const charge = getArtifactCharge(artifactType);
    return deductCredits({
        userId,
        amount: charge.cost,
        type: charge.type,
        description: charge.description,
        metadata: { artifactId },
        idempotencyKey: `artifact-charge:${artifactId}`,
    });
}

/**
 * Validates feature access for artifact types. Any user with enough credits
 * can generate an Audio Debate Podcast.
 */
export async function assertCanCreateArtifactType(
    userId: string,
    artifactType: string,
): Promise<void> {
    // Feature gating is credit-based: checked in assertCanCreateArtifact
}

/**
 * Increments the total artifact creation counter for a user in the database.
 *
 * @param userId - Unique identifier of the user
 */
export async function incrementArtifactCount(userId: string): Promise<void> {
    await incrementUserArtifactCountRepo(userId);
}

/** Checks the chat credit balance without charging. */
export async function assertCanSendMessage(userId: string): Promise<void> {
    await assertHasCredits(userId, CREDIT_COSTS.CHAT_MESSAGE);
    await assertUserQuota(userId, "messages");
}

/** Charges a chat message exactly once after the user message is persisted. */
export async function chargeForChatMessage(userId: string, messageId: string) {
    return deductCredits({
        userId,
        amount: CREDIT_COSTS.CHAT_MESSAGE,
        type: "CHAT_MESSAGE",
        description: "Sent a chat message",
        metadata: { messageId },
        idempotencyKey: `chat-charge:${messageId}`,
    });
}
