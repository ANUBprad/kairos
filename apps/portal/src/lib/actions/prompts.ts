"use server";

import { getServerSession } from "@/lib/server/auth-utils";
import {
  createFolder,
  listFolders,
  deleteFolder,
  createPrompt,
  getPrompt,
  listPrompts,
  updatePrompt,
  deletePrompt,
  clonePrompt,
  createVersion,
  listVersions,
  publishVersion,
  rollbackToVersion,
  searchPrompts,
  exportPrompt,
  importPrompt,
  type CreateFolderInput,
  type CreatePromptInput,
  type UpdatePromptInput,
  type ImportPromptData,
} from "@/lib/prompts";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

// ============================================================================
// Folder Actions
// ============================================================================

export async function createPromptFolder(input: CreateFolderInput) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const folder = await createFolder("demo-org", input);
    revalidatePath("/app/prompts");
    return { success: true, folder };
  } catch (error) {
    logger.error("Failed to create prompt folder", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create folder",
    };
  }
}

export async function listPromptFolders() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const folders = await listFolders("demo-org");
    return { success: true, folders };
  } catch (error) {
    logger.error("Failed to list prompt folders", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list folders",
    };
  }
}

export async function deletePromptFolder(folderId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const deleted = await deleteFolder(folderId);
    revalidatePath("/app/prompts");
    return { success: true, deleted };
  } catch (error) {
    logger.error("Failed to delete prompt folder", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete folder",
    };
  }
}

// ============================================================================
// Prompt Actions
// ============================================================================

export async function createNewPrompt(input: CreatePromptInput) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const prompt = await createPrompt("demo-org", session.user.id, input);
    revalidatePath("/app/prompts");
    return { success: true, prompt };
  } catch (error) {
    logger.error("Failed to create prompt", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create prompt",
    };
  }
}

export async function getPromptDetails(promptId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const prompt = await getPrompt(promptId);
    return { success: true, prompt };
  } catch (error) {
    logger.error("Failed to get prompt details", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get prompt details",
    };
  }
}

export async function listAllPrompts(
  options: {
    folderId?: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    tags?: string[];
    search?: string;
  } = {}
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const prompts = await listPrompts("demo-org", options);
    return { success: true, prompts };
  } catch (error) {
    logger.error("Failed to list prompts", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list prompts",
    };
  }
}

export async function updatePromptDetails(promptId: string, input: UpdatePromptInput) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const prompt = await updatePrompt(promptId, input);
    revalidatePath("/app/prompts");
    return { success: true, prompt };
  } catch (error) {
    logger.error("Failed to update prompt", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update prompt",
    };
  }
}

export async function deletePromptAction(promptId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const deleted = await deletePrompt(promptId);
    revalidatePath("/app/prompts");
    return { success: true, deleted };
  } catch (error) {
    logger.error("Failed to delete prompt", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete prompt",
    };
  }
}

export async function clonePromptAction(promptId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const prompt = await clonePrompt(promptId, session.user.id);
    revalidatePath("/app/prompts");
    return { success: true, prompt };
  } catch (error) {
    logger.error("Failed to clone prompt", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clone prompt",
    };
  }
}

// ============================================================================
// Version Actions
// ============================================================================

export async function createNewVersion(
  promptId: string,
  input: {
    systemPrompt: string;
    userPrompt: string;
    variables?: unknown;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const version = await createVersion(promptId, session.user.id, {
      ...input,
      variables: input.variables as Prisma.JsonValue | undefined,
    });
    revalidatePath("/app/prompts");
    return { success: true, version };
  } catch (error) {
    logger.error("Failed to create version", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create version",
    };
  }
}

export async function listPromptVersions(promptId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const versions = await listVersions(promptId);
    return { success: true, versions };
  } catch (error) {
    logger.error("Failed to list versions", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list versions",
    };
  }
}

export async function publishPromptVersion(versionId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const version = await publishVersion(versionId);
    revalidatePath("/app/prompts");
    return { success: true, version };
  } catch (error) {
    logger.error("Failed to publish version", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to publish version",
    };
  }
}

export async function rollbackPromptVersion(promptId: string, version: number) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const rolledBack = await rollbackToVersion(promptId, version);
    revalidatePath("/app/prompts");
    return { success: true, version: rolledBack };
  } catch (error) {
    logger.error("Failed to rollback version", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to rollback version",
    };
  }
}

// ============================================================================
// Search & Import/Export
// ============================================================================

export async function searchAllPrompts(query: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const prompts = await searchPrompts("demo-org", query);
    return { success: true, prompts };
  } catch (error) {
    logger.error("Failed to search prompts", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search prompts",
    };
  }
}

export async function exportPromptData(promptId: string) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const data = await exportPrompt(promptId);
    return { success: true, data };
  } catch (error) {
    logger.error("Failed to export prompt", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to export prompt",
    };
  }
}

export async function importPromptData(data: ImportPromptData) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const prompt = await importPrompt("demo-org", session.user.id, data);
    revalidatePath("/app/prompts");
    return { success: true, prompt };
  } catch (error) {
    logger.error("Failed to import prompt", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import prompt",
    };
  }
}
