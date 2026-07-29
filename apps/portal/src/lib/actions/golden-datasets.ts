"use server";

import { requireSession } from "@/lib/server/auth-utils";
import {
  createDataset,
  getDataset,
  listDatasets,
  updateDataset,
  deleteDataset,
  addEntry,
  bulkAddEntries,
  updateEntry,
  deleteEntry,
  importDataset,
  exportDataset,
  createVersion,
  validateDataset,
  getDatasetStats,
  type CreateDatasetInput,
  type CreateEntryInput,
  type ImportDatasetInput,
  type DatasetStats,
} from "@/lib/golden-datasets";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

const DEMO_ORG = "demo-org";

export async function createGoldenDataset(input: CreateDatasetInput) {
  const session = await requireSession();

  try {
    const dataset = await createDataset(DEMO_ORG, session.user.id, input);
    revalidatePath("/app/datasets");
    return { success: true, dataset };
  } catch (error) {
    logger.error("Failed to create golden dataset", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to create dataset" };
  }
}

export async function getGoldenDataset(datasetId: string) {
  const session = await requireSession();

  try {
    const result = await getDataset(datasetId);
    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to get golden dataset", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to get dataset" };
  }
}

export async function listGoldenDatasets(
  options: { difficulty?: string; tags?: string[]; search?: string } = {}
) {
  const session = await requireSession();

  try {
    const datasets = await listDatasets(DEMO_ORG, options);
    return { success: true, datasets };
  } catch (error) {
    logger.error("Failed to list golden datasets", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to list datasets" };
  }
}

export async function updateGoldenDataset(datasetId: string, input: Partial<CreateDatasetInput>) {
  const session = await requireSession();

  try {
    const dataset = await updateDataset(datasetId, input);
    revalidatePath("/app/datasets");
    return { success: true, dataset };
  } catch (error) {
    logger.error("Failed to update golden dataset", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to update dataset" };
  }
}

export async function deleteGoldenDataset(datasetId: string) {
  const session = await requireSession();

  try {
    const deleted = await deleteDataset(datasetId);
    revalidatePath("/app/datasets");
    return { success: deleted };
  } catch (error) {
    logger.error("Failed to delete golden dataset", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete dataset" };
  }
}

export async function addGoldenDatasetEntry(datasetId: string, input: CreateEntryInput) {
  const session = await requireSession();

  try {
    const entry = await addEntry(datasetId, input);
    revalidatePath("/app/datasets");
    return { success: true, entry };
  } catch (error) {
    logger.error("Failed to add golden dataset entry", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to add entry" };
  }
}

export async function bulkAddGoldenDatasetEntries(datasetId: string, entries: CreateEntryInput[]) {
  const session = await requireSession();

  try {
    const result = await bulkAddEntries(datasetId, entries);
    revalidatePath("/app/datasets");
    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to bulk add golden dataset entries", {
      userId: session.user.id,
      datasetId,
      count: entries.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to bulk add entries" };
  }
}

export async function updateGoldenDatasetEntry(entryId: string, input: Partial<CreateEntryInput>) {
  const session = await requireSession();

  try {
    const entry = await updateEntry(entryId, input);
    revalidatePath("/app/datasets");
    return { success: true, entry };
  } catch (error) {
    logger.error("Failed to update golden dataset entry", {
      userId: session.user.id,
      entryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to update entry" };
  }
}

export async function deleteGoldenDatasetEntry(entryId: string) {
  const session = await requireSession();

  try {
    const deleted = await deleteEntry(entryId);
    revalidatePath("/app/datasets");
    return { success: deleted };
  } catch (error) {
    logger.error("Failed to delete golden dataset entry", {
      userId: session.user.id,
      entryId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete entry" };
  }
}

export async function importGoldenDataset(input: ImportDatasetInput) {
  const session = await requireSession();

  try {
    const dataset = await importDataset(DEMO_ORG, session.user.id, input);
    revalidatePath("/app/datasets");
    return { success: true, dataset };
  } catch (error) {
    logger.error("Failed to import golden dataset", {
      userId: session.user.id,
      name: input.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to import dataset" };
  }
}

export async function exportGoldenDataset(datasetId: string) {
  const session = await requireSession();

  try {
    const data = await exportDataset(datasetId);
    return { success: true, data };
  } catch (error) {
    logger.error("Failed to export golden dataset", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to export dataset" };
  }
}

export async function createGoldenDatasetVersion(datasetId: string) {
  const session = await requireSession();

  try {
    const dataset = await createVersion(datasetId);
    revalidatePath("/app/datasets");
    return { success: true, dataset };
  } catch (error) {
    logger.error("Failed to create golden dataset version", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to create version" };
  }
}

export async function validateGoldenDataset(datasetId: string) {
  const session = await requireSession();

  try {
    const result = await validateDataset(datasetId);
    return { success: true, ...result };
  } catch (error) {
    logger.error("Failed to validate golden dataset", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to validate dataset" };
  }
}

export async function getGoldenDatasetStats(datasetId: string): Promise<{
  success: boolean;
  stats?: DatasetStats;
  error?: string;
}> {
  const session = await requireSession();

  try {
    const stats = await getDatasetStats(datasetId);
    return { success: true, stats };
  } catch (error) {
    logger.error("Failed to get golden dataset stats", {
      userId: session.user.id,
      datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: error instanceof Error ? error.message : "Failed to get dataset stats" };
  }
}
