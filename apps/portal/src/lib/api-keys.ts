/**
 * API Key Management for Kairos Enterprise
 *
 * Provides secure API key generation, validation, and management.
 * Keys are hashed before storage and never exposed after creation.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

// ============================================================================
// Types
// ============================================================================

export type ApiKeyScope =
  | "read"
  | "write"
  | "admin"
  | "experiment"
  | "artifacts"
  | "manage_keys";

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  enabled: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date;
}

export interface CreateApiKeyResult {
  key: string;
  keyPrefix: string;
  id: string;
}

// ============================================================================
// Constants
// ============================================================================

const API_KEY_PREFIX = "kai_";
const API_KEY_LENGTH = 32;
const MAX_API_KEYS_PER_USER = 50;

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a new API key with the given prefix
 */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const randomPart = randomBytes(API_KEY_LENGTH).toString("hex");
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const keyHash = hashApiKey(key);
  const keyPrefix = key.substring(0, 8);

  return { key, keyHash, keyPrefix };
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate an API key against a hash
 */
export function validateApiKey(key: string, hash: string): boolean {
  const keyHash = hashApiKey(key);
  const keyBuffer = Buffer.from(keyHash, "hex");
  const hashBuffer = Buffer.from(hash, "hex");

  if (keyBuffer.length !== hashBuffer.length) {
    return false;
  }

  return timingSafeEqual(keyBuffer, hashBuffer);
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  organizationId: string,
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  const userKeyCount = await prisma.apiKey.count({
    where: { userId, enabled: true },
  });

  if (userKeyCount >= MAX_API_KEYS_PER_USER) {
    throw new Error(`Maximum ${MAX_API_KEYS_PER_USER} active API keys per user`);
  }

  const { key, keyHash, keyPrefix } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      name: input.name,
      keyHash,
      keyPrefix,
      scopes: input.scopes,
      userId,
      organizationId,
      expiresAt: input.expiresAt,
    },
  });

  logger.info("API key created", {
    keyId: apiKey.id,
    userId,
    organizationId,
    name: input.name,
  });

  return {
    key,
    keyPrefix,
    id: apiKey.id,
  };
}

/**
 * Validate and retrieve an API key
 */
export async function validateAndRetrieveApiKey(
  key: string
): Promise<{ userId: string; organizationId: string; scopes: string[] } | null> {
  try {
    // Find by prefix (first 8 chars)
    const prefix = key.substring(0, 8);
    const potentialKeys = await prisma.apiKey.findMany({
      where: {
        keyPrefix: prefix,
        enabled: true,
      },
      select: {
        id: true,
        keyHash: true,
        userId: true,
        organizationId: true,
        scopes: true,
        expiresAt: true,
      },
    });

    for (const apiKey of potentialKeys) {
      if (validateApiKey(key, apiKey.keyHash)) {
        // Check expiration
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          return null;
        }

        // Update last used timestamp (fire and forget)
        prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        }).catch((err) => {
          logger.error("Failed to update API key last used", { error: err });
        });

        return {
          userId: apiKey.userId,
          organizationId: apiKey.organizationId,
          scopes: apiKey.scopes,
        };
      }
    }

    return null;
  } catch (error) {
    logger.error("API key validation failed", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Get all API keys for a user (without exposing secrets)
 */
export async function getUserApiKeys(
  userId: string,
  organizationId?: string
): Promise<ApiKeyInfo[]> {
  const where: Record<string, unknown> = { userId };
  if (organizationId) {
    where.organizationId = organizationId;
  }

  const keys = await prisma.apiKey.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      enabled: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return keys;
}

/**
 * Disable an API key
 */
export async function disableApiKey(
  userId: string,
  keyId: string
): Promise<boolean> {
  const key = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { userId: true },
  });

  if (!key || key.userId !== userId) {
    return false;
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { enabled: false },
  });

  logger.info("API key disabled", { keyId, userId });
  return true;
}

/**
 * Delete an API key
 */
export async function deleteApiKey(
  userId: string,
  keyId: string
): Promise<boolean> {
  const key = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { userId: true },
  });

  if (!key || key.userId !== userId) {
    return false;
  }

  await prisma.apiKey.delete({
    where: { id: keyId },
  });

  logger.info("API key deleted", { keyId, userId });
  return true;
}

/**
 * Rotate an API key (disable old, create new)
 */
export async function rotateApiKey(
  userId: string,
  organizationId: string,
  keyId: string
): Promise<CreateApiKeyResult | null> {
  const oldKey = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { userId: true, name: true, scopes: true },
  });

  if (!oldKey || oldKey.userId !== userId) {
    return null;
  }

  // Disable old key
  await disableApiKey(userId, keyId);

  // Create new key with same settings
  return createApiKey(userId, organizationId, {
    name: `${oldKey.name} (rotated)`,
    scopes: oldKey.scopes as ApiKeyScope[],
  });
}
