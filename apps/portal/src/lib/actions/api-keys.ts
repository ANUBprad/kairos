"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import {
  createApiKey,
  getUserApiKeys,
  disableApiKey,
  deleteApiKey,
  rotateApiKey,
  type CreateApiKeyInput,
} from "@/lib/api-keys";
import type { ResourceType } from "@/lib/rbac";

// ============================================================================
// API Key Actions
// ============================================================================

export async function createNewApiKey(
  name: string,
  permissions: { resource: ResourceType; resourceIds?: string[] }[],
  expiresInDays?: number
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const input: CreateApiKeyInput = {
      name,
      scopes: ["read", "write"], // Default scopes for the API key
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
    };

    // For demo mode, use a default organization ID
    const organizationId = "demo-org";

    const result = await createApiKey(
      session.user.id,
      organizationId,
      input
    );

    revalidatePath("/app/settings/api-keys");
    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to create API key", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create API key",
    };
  }
}

export async function listApiKeys() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const apiKeys = await getUserApiKeys(session.user.id);
    return { success: true, apiKeys };
  } catch (error) {
    logger.error("Failed to list API keys", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list API keys",
    };
  }
}

export async function deactivateApiKey(apiKeyId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await disableApiKey(session.user.id, apiKeyId);
    revalidatePath("/app/settings/api-keys");
    return { success: true };
  } catch (error) {
    logger.error("Failed to disable API key", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disable API key",
    };
  }
}

export async function removeApiKey(apiKeyId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    await deleteApiKey(session.user.id, apiKeyId);
    revalidatePath("/app/settings/api-keys");
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete API key", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete API key",
    };
  }
}

export async function rotateExistingApiKey(apiKeyId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    // For demo mode, use a default organization ID
    const organizationId = "demo-org";

    const result = await rotateApiKey(
      session.user.id,
      organizationId,
      apiKeyId
    );
    revalidatePath("/app/settings/api-keys");
    return { success: true, key: result?.key, keyPrefix: result?.keyPrefix, id: result?.id };
  } catch (error) {
    logger.error("Failed to rotate API key", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rotate API key",
    };
  }
}
