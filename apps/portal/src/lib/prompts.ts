import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma, PromptStatus } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface PromptFolderInfo {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  parentId: string | null;
  promptCount: number;
  createdAt: Date;
}

export interface PromptVersionInfo {
  id: string;
  version: number;
  title: string;
  description: string | null;
  systemPrompt: string;
  userPrompt: string;
  variables: Prisma.JsonValue | null;
  model: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
}

export interface PromptInfo {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  status: PromptStatus;
  version: number;
  folderId: string | null;
  ownerId: string;
  organizationId: string;
  currentVersionId: string | null;
  currentVersion: PromptVersionInfo | null;
  createdAt: Date;
}

export interface CreatePromptInput {
  title: string;
  description?: string;
  tags?: string[];
  folderId?: string;
  systemPrompt: string;
  userPrompt: string;
  variables?: Prisma.JsonValue;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface UpdatePromptInput {
  title?: string;
  description?: string;
  tags?: string[];
  folderId?: string;
  status?: PromptStatus;
}

export interface CreateFolderInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface ImportPromptData {
  title: string;
  description?: string;
  tags?: string[];
  versions: Array<{
    title?: string;
    description?: string;
    systemPrompt: string;
    userPrompt: string;
    variables?: Prisma.JsonValue;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }>;
}

// ============================================================================
// Folder CRUD
// ============================================================================

export async function createFolder(
  organizationId: string,
  input: CreateFolderInput
): Promise<PromptFolderInfo> {
  try {
    const folder = await prisma.promptFolder.create({
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        icon: input.icon,
        parentId: input.parentId,
        organizationId,
      },
      include: {
        _count: { select: { prompts: true } },
      },
    });

    logger.info("Folder created", { folderId: folder.id, organizationId });

    return {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      color: folder.color,
      icon: folder.icon,
      parentId: folder.parentId,
      promptCount: folder._count.prompts,
      createdAt: folder.createdAt,
    };
  } catch (error) {
    logger.error("Failed to create folder", { error, organizationId });
    throw error;
  }
}

export async function listFolders(
  organizationId: string
): Promise<PromptFolderInfo[]> {
  try {
    const folders = await prisma.promptFolder.findMany({
      where: { organizationId },
      include: {
        _count: { select: { prompts: true } },
      },
      orderBy: { name: "asc" },
    });

    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      color: f.color,
      icon: f.icon,
      parentId: f.parentId,
      promptCount: f._count.prompts,
      createdAt: f.createdAt,
    }));
  } catch (error) {
    logger.error("Failed to list folders", { error, organizationId });
    throw error;
  }
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  try {
    const folder = await prisma.promptFolder.findUnique({
      where: { id: folderId },
      select: { id: true },
    });

    if (!folder) {
      return false;
    }

    await prisma.promptFolder.delete({ where: { id: folderId } });
    logger.info("Folder deleted", { folderId });
    return true;
  } catch (error) {
    logger.error("Failed to delete folder", { error, folderId });
    throw error;
  }
}

// ============================================================================
// Prompt CRUD
// ============================================================================

export async function createPrompt(
  organizationId: string,
  ownerId: string,
  input: CreatePromptInput
): Promise<PromptInfo> {
  try {
    const prompt = await prisma.prompt.create({
      data: {
        title: input.title,
        description: input.description,
        tags: input.tags ?? [],
        organizationId,
        ownerId,
        folderId: input.folderId,
        versions: {
          create: {
            version: 1,
            title: input.title,
            description: input.description,
            systemPrompt: input.systemPrompt,
            userPrompt: input.userPrompt,
            variables: input.variables ?? undefined,
            model: input.model,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            status: "DRAFT",
            createdById: ownerId,
          },
        },
      },
      include: {
        currentVersion: true,
        _count: { select: { versions: true } },
      },
    });

    const firstVersion = await prisma.promptVersion.findFirst({
      where: { promptId: prompt.id },
      orderBy: { version: "asc" },
    });

    if (firstVersion) {
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { currentVersionId: firstVersion.id },
      });
    }

    logger.info("Prompt created", { promptId: prompt.id, organizationId });

    return {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      tags: prompt.tags,
      status: prompt.status,
      version: prompt.version,
      folderId: prompt.folderId,
      ownerId: prompt.ownerId,
      organizationId: prompt.organizationId,
      currentVersionId: firstVersion?.id ?? null,
      currentVersion: firstVersion
        ? {
            id: firstVersion.id,
            version: firstVersion.version,
            title: firstVersion.title,
            description: firstVersion.description,
            systemPrompt: firstVersion.systemPrompt,
            userPrompt: firstVersion.userPrompt,
            variables: firstVersion.variables,
            model: firstVersion.model,
            temperature: firstVersion.temperature,
            maxTokens: firstVersion.maxTokens,
            topP: firstVersion.topP,
            status: firstVersion.status,
            publishedAt: firstVersion.publishedAt,
            createdAt: firstVersion.createdAt,
          }
        : null,
      createdAt: prompt.createdAt,
    };
  } catch (error) {
    logger.error("Failed to create prompt", { error, organizationId, ownerId });
    throw error;
  }
}

export async function getPrompt(promptId: string): Promise<PromptInfo | null> {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        currentVersion: true,
      },
    });

    if (!prompt) return null;

    return {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      tags: prompt.tags,
      status: prompt.status,
      version: prompt.version,
      folderId: prompt.folderId,
      ownerId: prompt.ownerId,
      organizationId: prompt.organizationId,
      currentVersionId: prompt.currentVersionId,
      currentVersion: prompt.currentVersion
        ? {
            id: prompt.currentVersion.id,
            version: prompt.currentVersion.version,
            title: prompt.currentVersion.title,
            description: prompt.currentVersion.description,
            systemPrompt: prompt.currentVersion.systemPrompt,
            userPrompt: prompt.currentVersion.userPrompt,
            variables: prompt.currentVersion.variables,
            model: prompt.currentVersion.model,
            temperature: prompt.currentVersion.temperature,
            maxTokens: prompt.currentVersion.maxTokens,
            topP: prompt.currentVersion.topP,
            status: prompt.currentVersion.status,
            publishedAt: prompt.currentVersion.publishedAt,
            createdAt: prompt.currentVersion.createdAt,
          }
        : null,
      createdAt: prompt.createdAt,
    };
  } catch (error) {
    logger.error("Failed to get prompt", { error, promptId });
    throw error;
  }
}

export async function listPrompts(
  organizationId: string,
  options: {
    folderId?: string;
    status?: PromptStatus;
    tags?: string[];
    search?: string;
  } = {}
): Promise<PromptInfo[]> {
  try {
    const where: Prisma.PromptWhereInput = {
      organizationId,
      ...(options.folderId !== undefined && {
        folderId: options.folderId,
      }),
      ...(options.status && { status: options.status }),
      ...(options.tags && options.tags.length > 0 && {
        tags: { hasSome: options.tags },
      }),
      ...(options.search && {
        OR: [
          { title: { contains: options.search, mode: "insensitive" } },
          { description: { contains: options.search, mode: "insensitive" } },
        ],
      }),
    };

    const prompts = await prisma.prompt.findMany({
      where,
      include: {
        currentVersion: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return prompts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      tags: p.tags,
      status: p.status,
      version: p.version,
      folderId: p.folderId,
      ownerId: p.ownerId,
      organizationId: p.organizationId,
      currentVersionId: p.currentVersionId,
      currentVersion: p.currentVersion
        ? {
            id: p.currentVersion.id,
            version: p.currentVersion.version,
            title: p.currentVersion.title,
            description: p.currentVersion.description,
            systemPrompt: p.currentVersion.systemPrompt,
            userPrompt: p.currentVersion.userPrompt,
            variables: p.currentVersion.variables,
            model: p.currentVersion.model,
            temperature: p.currentVersion.temperature,
            maxTokens: p.currentVersion.maxTokens,
            topP: p.currentVersion.topP,
            status: p.currentVersion.status,
            publishedAt: p.currentVersion.publishedAt,
            createdAt: p.currentVersion.createdAt,
          }
        : null,
      createdAt: p.createdAt,
    }));
  } catch (error) {
    logger.error("Failed to list prompts", { error, organizationId });
    throw error;
  }
}

export async function updatePrompt(
  promptId: string,
  input: UpdatePromptInput
): Promise<PromptInfo | null> {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: { id: true },
    });

    if (!prompt) return null;

    const updated = await prisma.prompt.update({
      where: { id: promptId },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.folderId !== undefined && { folderId: input.folderId }),
        ...(input.status !== undefined && { status: input.status }),
      },
      include: {
        currentVersion: true,
      },
    });

    logger.info("Prompt updated", { promptId });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      tags: updated.tags,
      status: updated.status,
      version: updated.version,
      folderId: updated.folderId,
      ownerId: updated.ownerId,
      organizationId: updated.organizationId,
      currentVersionId: updated.currentVersionId,
      currentVersion: updated.currentVersion
        ? {
            id: updated.currentVersion.id,
            version: updated.currentVersion.version,
            title: updated.currentVersion.title,
            description: updated.currentVersion.description,
            systemPrompt: updated.currentVersion.systemPrompt,
            userPrompt: updated.currentVersion.userPrompt,
            variables: updated.currentVersion.variables,
            model: updated.currentVersion.model,
            temperature: updated.currentVersion.temperature,
            maxTokens: updated.currentVersion.maxTokens,
            topP: updated.currentVersion.topP,
            status: updated.currentVersion.status,
            publishedAt: updated.currentVersion.publishedAt,
            createdAt: updated.currentVersion.createdAt,
          }
        : null,
      createdAt: updated.createdAt,
    };
  } catch (error) {
    logger.error("Failed to update prompt", { error, promptId });
    throw error;
  }
}

export async function deletePrompt(promptId: string): Promise<boolean> {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: { id: true },
    });

    if (!prompt) return false;

    await prisma.prompt.delete({ where: { id: promptId } });
    logger.info("Prompt deleted", { promptId });
    return true;
  } catch (error) {
    logger.error("Failed to delete prompt", { error, promptId });
    throw error;
  }
}

export async function clonePrompt(
  promptId: string,
  userId: string
): Promise<PromptInfo> {
  try {
    const source = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: { versions: { orderBy: { version: "asc" } } },
    });

    if (!source) {
      throw new Error("Prompt not found");
    }

    const cloned = await prisma.prompt.create({
      data: {
        title: `${source.title} (Copy)`,
        description: source.description,
        tags: source.tags,
        status: "DRAFT",
        version: source.version,
        organizationId: source.organizationId,
        ownerId: userId,
        folderId: source.folderId,
        versions: {
          create: source.versions.map((v) => ({
            version: v.version,
            title: v.title,
            description: v.description,
            systemPrompt: v.systemPrompt,
            userPrompt: v.userPrompt,
            variables: (v.variables as Prisma.InputJsonValue) ?? undefined,
            metadata: (v.metadata as Prisma.InputJsonValue) ?? undefined,
            model: v.model,
            temperature: v.temperature,
            maxTokens: v.maxTokens,
            topP: v.topP,
            status: v.status,
            createdById: userId,
            publishedAt: v.publishedAt,
          })),
        },
      },
      include: {
        currentVersion: true,
      },
    });

    const firstVersion = await prisma.promptVersion.findFirst({
      where: { promptId: cloned.id },
      orderBy: { version: "asc" },
    });

    if (firstVersion) {
      await prisma.prompt.update({
        where: { id: cloned.id },
        data: { currentVersionId: firstVersion.id },
      });
    }

    logger.info("Prompt cloned", { sourcePromptId: promptId, clonedPromptId: cloned.id });

    return {
      id: cloned.id,
      title: cloned.title,
      description: cloned.description,
      tags: cloned.tags,
      status: cloned.status,
      version: cloned.version,
      folderId: cloned.folderId,
      ownerId: cloned.ownerId,
      organizationId: cloned.organizationId,
      currentVersionId: firstVersion?.id ?? null,
      currentVersion: firstVersion
        ? {
            id: firstVersion.id,
            version: firstVersion.version,
            title: firstVersion.title,
            description: firstVersion.description,
            systemPrompt: firstVersion.systemPrompt,
            userPrompt: firstVersion.userPrompt,
            variables: firstVersion.variables,
            model: firstVersion.model,
            temperature: firstVersion.temperature,
            maxTokens: firstVersion.maxTokens,
            topP: firstVersion.topP,
            status: firstVersion.status,
            publishedAt: firstVersion.publishedAt,
            createdAt: firstVersion.createdAt,
          }
        : null,
      createdAt: cloned.createdAt,
    };
  } catch (error) {
    logger.error("Failed to clone prompt", { error, promptId, userId });
    throw error;
  }
}

// ============================================================================
// Version Management
// ============================================================================

export async function createVersion(
  promptId: string,
  userId: string,
  input: {
    systemPrompt: string;
    userPrompt: string;
    variables?: Prisma.JsonValue;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<PromptVersionInfo> {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      select: { id: true, version: true, title: true, description: true },
    });

    if (!prompt) {
      throw new Error("Prompt not found");
    }

    const nextVersion = prompt.version + 1;

    const version = await prisma.promptVersion.create({
      data: {
        version: nextVersion,
        title: prompt.title,
        description: prompt.description,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        variables: (input.variables as Prisma.InputJsonValue) ?? undefined,
        model: input.model,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        status: "DRAFT",
        promptId,
        createdById: userId,
      },
    });

    await prisma.prompt.update({
      where: { id: promptId },
      data: { version: nextVersion },
    });

    logger.info("Version created", { promptId, version: nextVersion });

    return {
      id: version.id,
      version: version.version,
      title: version.title,
      description: version.description,
      systemPrompt: version.systemPrompt,
      userPrompt: version.userPrompt,
      variables: version.variables,
      model: version.model,
      temperature: version.temperature,
      maxTokens: version.maxTokens,
      topP: version.topP,
      status: version.status,
      publishedAt: version.publishedAt,
      createdAt: version.createdAt,
    };
  } catch (error) {
    logger.error("Failed to create version", { error, promptId, userId });
    throw error;
  }
}

export async function getVersion(
  promptId: string,
  version: number
): Promise<PromptVersionInfo | null> {
  try {
    const v = await prisma.promptVersion.findUnique({
      where: { promptId_version: { promptId, version } },
    });

    if (!v) return null;

    return {
      id: v.id,
      version: v.version,
      title: v.title,
      description: v.description,
      systemPrompt: v.systemPrompt,
      userPrompt: v.userPrompt,
      variables: v.variables,
      model: v.model,
      temperature: v.temperature,
      maxTokens: v.maxTokens,
      topP: v.topP,
      status: v.status,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
    };
  } catch (error) {
    logger.error("Failed to get version", { error, promptId, version });
    throw error;
  }
}

export async function listVersions(
  promptId: string
): Promise<PromptVersionInfo[]> {
  try {
    const versions = await prisma.promptVersion.findMany({
      where: { promptId },
      orderBy: { version: "desc" },
    });

    return versions.map((v) => ({
      id: v.id,
      version: v.version,
      title: v.title,
      description: v.description,
      systemPrompt: v.systemPrompt,
      userPrompt: v.userPrompt,
      variables: v.variables,
      model: v.model,
      temperature: v.temperature,
      maxTokens: v.maxTokens,
      topP: v.topP,
      status: v.status,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
    }));
  } catch (error) {
    logger.error("Failed to list versions", { error, promptId });
    throw error;
  }
}

export async function publishVersion(
  versionId: string
): Promise<PromptVersionInfo> {
  try {
    const version = await prisma.promptVersion.findUnique({
      where: { id: versionId },
      select: { id: true, promptId: true, version: true },
    });

    if (!version) {
      throw new Error("Version not found");
    }

    const [updated] = await prisma.$transaction([
      prisma.promptVersion.update({
        where: { id: versionId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      }),
      prisma.prompt.update({
        where: { id: version.promptId },
        data: { currentVersionId: versionId },
      }),
    ]);

    logger.info("Version published", { promptId: version.promptId, version: version.version });

    return {
      id: updated.id,
      version: updated.version,
      title: updated.title,
      description: updated.description,
      systemPrompt: updated.systemPrompt,
      userPrompt: updated.userPrompt,
      variables: updated.variables,
      model: updated.model,
      temperature: updated.temperature,
      maxTokens: updated.maxTokens,
      topP: updated.topP,
      status: updated.status,
      publishedAt: updated.publishedAt,
      createdAt: updated.createdAt,
    };
  } catch (error) {
    logger.error("Failed to publish version", { error, versionId });
    throw error;
  }
}

export async function rollbackToVersion(
  promptId: string,
  version: number
): Promise<PromptVersionInfo> {
  try {
    const targetVersion = await prisma.promptVersion.findUnique({
      where: { promptId_version: { promptId, version } },
    });

    if (!targetVersion) {
      throw new Error("Version not found");
    }

    await prisma.prompt.update({
      where: { id: promptId },
      data: { currentVersionId: targetVersion.id },
    });

    logger.info("Rolled back to version", { promptId, version });

    return {
      id: targetVersion.id,
      version: targetVersion.version,
      title: targetVersion.title,
      description: targetVersion.description,
      systemPrompt: targetVersion.systemPrompt,
      userPrompt: targetVersion.userPrompt,
      variables: targetVersion.variables,
      model: targetVersion.model,
      temperature: targetVersion.temperature,
      maxTokens: targetVersion.maxTokens,
      topP: targetVersion.topP,
      status: targetVersion.status,
      publishedAt: targetVersion.publishedAt,
      createdAt: targetVersion.createdAt,
    };
  } catch (error) {
    logger.error("Failed to rollback version", { error, promptId, version });
    throw error;
  }
}

// ============================================================================
// Search & Import/Export
// ============================================================================

export async function searchPrompts(
  organizationId: string,
  query: string
): Promise<PromptInfo[]> {
  try {
    const prompts = await prisma.prompt.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { tags: { hasSome: [query] } },
        ],
      },
      include: {
        currentVersion: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return prompts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      tags: p.tags,
      status: p.status,
      version: p.version,
      folderId: p.folderId,
      ownerId: p.ownerId,
      organizationId: p.organizationId,
      currentVersionId: p.currentVersionId,
      currentVersion: p.currentVersion
        ? {
            id: p.currentVersion.id,
            version: p.currentVersion.version,
            title: p.currentVersion.title,
            description: p.currentVersion.description,
            systemPrompt: p.currentVersion.systemPrompt,
            userPrompt: p.currentVersion.userPrompt,
            variables: p.currentVersion.variables,
            model: p.currentVersion.model,
            temperature: p.currentVersion.temperature,
            maxTokens: p.currentVersion.maxTokens,
            topP: p.currentVersion.topP,
            status: p.currentVersion.status,
            publishedAt: p.currentVersion.publishedAt,
            createdAt: p.currentVersion.createdAt,
          }
        : null,
      createdAt: p.createdAt,
    }));
  } catch (error) {
    logger.error("Failed to search prompts", { error, organizationId, query });
    throw error;
  }
}

export async function exportPrompt(
  promptId: string
): Promise<{ prompt: Omit<PromptInfo, "currentVersion">; versions: PromptVersionInfo[] } | null> {
  try {
    const prompt = await prisma.prompt.findUnique({
      where: { id: promptId },
      include: {
        versions: { orderBy: { version: "asc" } },
      },
    });

    if (!prompt) return null;

    return {
      prompt: {
        id: prompt.id,
        title: prompt.title,
        description: prompt.description,
        tags: prompt.tags,
        status: prompt.status,
        version: prompt.version,
        folderId: prompt.folderId,
        ownerId: prompt.ownerId,
        organizationId: prompt.organizationId,
        currentVersionId: prompt.currentVersionId,
        createdAt: prompt.createdAt,
      },
      versions: prompt.versions.map((v) => ({
        id: v.id,
        version: v.version,
        title: v.title,
        description: v.description,
        systemPrompt: v.systemPrompt,
        userPrompt: v.userPrompt,
        variables: v.variables,
        model: v.model,
        temperature: v.temperature,
        maxTokens: v.maxTokens,
        topP: v.topP,
        status: v.status,
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
      })),
    };
  } catch (error) {
    logger.error("Failed to export prompt", { error, promptId });
    throw error;
  }
}

export async function importPrompt(
  organizationId: string,
  userId: string,
  data: ImportPromptData
): Promise<PromptInfo> {
  try {
    const prompt = await prisma.prompt.create({
      data: {
        title: data.title,
        description: data.description,
        tags: data.tags ?? [],
        status: "DRAFT",
        organizationId,
        ownerId: userId,
        versions: {
          create: data.versions.map((v, i) => ({
            version: i + 1,
            title: v.title ?? data.title,
            description: v.description ?? data.description,
            systemPrompt: v.systemPrompt,
            userPrompt: v.userPrompt,
            variables: (v.variables as Prisma.InputJsonValue) ?? undefined,
            model: v.model,
            temperature: v.temperature,
            maxTokens: v.maxTokens,
            status: "DRAFT",
            createdById: userId,
          })),
        },
      },
      include: {
        currentVersion: true,
      },
    });

    const firstVersion = await prisma.promptVersion.findFirst({
      where: { promptId: prompt.id },
      orderBy: { version: "asc" },
    });

    if (firstVersion) {
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { currentVersionId: firstVersion.id },
      });
    }

    logger.info("Prompt imported", { promptId: prompt.id, organizationId });

    return {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      tags: prompt.tags,
      status: prompt.status,
      version: prompt.version,
      folderId: prompt.folderId,
      ownerId: prompt.ownerId,
      organizationId: prompt.organizationId,
      currentVersionId: firstVersion?.id ?? null,
      currentVersion: firstVersion
        ? {
            id: firstVersion.id,
            version: firstVersion.version,
            title: firstVersion.title,
            description: firstVersion.description,
            systemPrompt: firstVersion.systemPrompt,
            userPrompt: firstVersion.userPrompt,
            variables: firstVersion.variables,
            model: firstVersion.model,
            temperature: firstVersion.temperature,
            maxTokens: firstVersion.maxTokens,
            topP: firstVersion.topP,
            status: firstVersion.status,
            publishedAt: firstVersion.publishedAt,
            createdAt: firstVersion.createdAt,
          }
        : null,
      createdAt: prompt.createdAt,
    };
  } catch (error) {
    logger.error("Failed to import prompt", { error, organizationId, userId });
    throw error;
  }
}
