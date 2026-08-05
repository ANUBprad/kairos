"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PremiumCard } from "@/components/ui/premium-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Database,
  Upload,
  Plus,
  Download,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Tag,
  Hash,
  FileText,
  Loader2,
  Trash2,
  Search,
  AlertTriangle,
} from "lucide-react";
import {
  listGoldenDatasets,
  getGoldenDataset,
  createGoldenDataset,
  deleteGoldenDataset,
  importGoldenDataset,
  exportGoldenDataset,
  addGoldenDatasetEntry,
  bulkAddGoldenDatasetEntries,
  deleteGoldenDatasetEntry,
  validateGoldenDataset,
} from "@/lib/actions/golden-datasets";
import type {
  GoldenDatasetInfo,
  GoldenDatasetEntryInfo,
  CreateDatasetInput,
  CreateEntryInput,
  ImportDatasetInput,
} from "@/lib/golden-datasets";

type Difficulty = "EASY" | "MEDIUM" | "HARD" | "EXPERT";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; variant: "success" | "info" | "warning" }> = {
  EASY: { label: "Easy", variant: "success" },
  MEDIUM: { label: "Medium", variant: "info" },
  HARD: { label: "Hard", variant: "warning" },
  EXPERT: { label: "Expert", variant: "warning" },
};

function DatasetsClientInner() {
  const [datasets, setDatasets] = useState<GoldenDatasetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<{
    dataset: GoldenDatasetInfo;
    entries: GoldenDatasetEntryInfo[];
  } | null>(null);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: Array<{ entryId: string; issues: string[] }>;
  } | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const fetchDatasets = useCallback(async () => {
    try {
      const result = await listGoldenDatasets({ search: searchQuery || undefined });
      if (result.success) {
        setDatasets(result.datasets!);
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const loadDataset = async (datasetId: string) => {
    setEntriesLoading(true);
    setSelectedDatasetId(datasetId);
    try {
      const result = await getGoldenDataset(datasetId);
      if (result.success && "dataset" in result) {
        setSelectedDataset({
          dataset: result.dataset!,
          entries: result.entries || [],
        });
      }
    } finally {
      setEntriesLoading(false);
    }
  };

  const handleCreateDataset = async (input: CreateDatasetInput) => {
    setActionLoading(true);
    try {
      const result = await createGoldenDataset(input);
      if (result.success) {
        setShowCreateModal(false);
        await fetchDatasets();
      }
      return result;
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportDataset = async (input: ImportDatasetInput) => {
    setActionLoading(true);
    try {
      const result = await importGoldenDataset(input);
      if (result.success) {
        setShowImportModal(false);
        await fetchDatasets();
      }
      return result;
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDataset = async () => {
    if (!selectedDatasetId) return;
    setActionLoading(true);
    try {
      const result = await deleteGoldenDataset(selectedDatasetId);
      if (result.success) {
        setSelectedDatasetId(null);
        setSelectedDataset(null);
        setShowDeleteConfirm(false);
        await fetchDatasets();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (datasetId: string) => {
    setActionLoading(true);
    try {
      const result = await exportGoldenDataset(datasetId);
      if (result.success && result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${result.data.name.replace(/\s+/g, "-").toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!selectedDatasetId) return;
    setActionLoading(true);
    try {
      const result = await validateGoldenDataset(selectedDatasetId);
      if (result.success && "valid" in result) {
        setValidationResult({
          valid: result.valid!,
          errors: result.errors || [],
        });
        setShowValidation(true);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const filteredDatasets = datasets;

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Golden Datasets"
          description="Curated question-answer pairs for evaluating and benchmarking retrieval quality."
          purpose="Build and manage ground truth datasets to measure retrieval accuracy, faithfulness, and coverage."
          relatedPages={[
            { label: "Evaluation", href: "/app/evaluation" },
            { label: "Benchmark Explorer", href: "/app/benchmark-explorer" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedDatasetId && selectedDataset) {
    return (
      <DatasetDetailView
        dataset={selectedDataset.dataset}
        entries={selectedDataset.entries}
        loading={entriesLoading}
        actionLoading={actionLoading}
        onBack={() => {
          setSelectedDatasetId(null);
          setSelectedDataset(null);
          setValidationResult(null);
          setShowValidation(false);
        }}
        onExport={() => handleExport(selectedDatasetId)}
        onDelete={() => setShowDeleteConfirm(true)}
        onValidate={handleValidate}
        validation={validationResult}
        showValidation={showValidation}
        onCloseValidation={() => setShowValidation(false)}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Golden Datasets"
        description="Curated question-answer pairs for evaluating and benchmarking retrieval quality."
        purpose="Build and manage ground truth datasets to measure retrieval accuracy, faithfulness, and coverage."
        relatedPages={[
          { label: "Evaluation", href: "/app/evaluation" },
          { label: "Benchmark Explorer", href: "/app/benchmark-explorer" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search datasets..."
            className="w-full rounded-lg border border-border bg-bg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
          <Upload size={14} />
          Import Dataset
        </Button>
        <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus size={14} />
          Create Dataset
        </Button>
      </div>

      {filteredDatasets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Database size={40} className="mb-3 text-text-tertiary" />
          <p className="text-sm font-medium text-text-secondary">No datasets yet</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Create a new dataset or import one to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDatasets.map((dataset) => (
            <PremiumCard
              key={dataset.id}
              variant="interactive"
              onClick={() => loadDataset(dataset.id)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary line-clamp-1">
                    {dataset.name}
                  </h3>
                  <Badge variant={DIFFICULTY_CONFIG[dataset.difficulty as Difficulty]?.variant ?? "default"}>
                    {DIFFICULTY_CONFIG[dataset.difficulty as Difficulty]?.label ?? dataset.difficulty}
                  </Badge>
                </div>
                {dataset.description && (
                  <p className="text-xs text-text-tertiary line-clamp-2">
                    {dataset.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Hash size={12} />
                    {dataset.entryCount} {dataset.entryCount === 1 ? "entry" : "entries"}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={12} />
                    v{dataset.version}
                  </span>
                </div>
                {dataset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dataset.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="default">
                        <Tag size={10} className="mr-1" />
                        {tag}
                      </Badge>
                    ))}
                    {dataset.tags.length > 3 && (
                      <Badge variant="default">+{dataset.tags.length - 3}</Badge>
                    )}
                  </div>
                )}
              </div>
            </PremiumCard>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateDatasetModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateDataset}
          isLoading={actionLoading}
        />
      )}

      {showImportModal && (
        <ImportDatasetModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSubmit={handleImportDataset}
          isLoading={actionLoading}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteDataset}
        title="Delete Dataset"
        description="This will permanently delete this dataset and all its entries. This action cannot be undone."
        confirmLabel="Delete"
        isLoading={actionLoading}
      />
    </div>
  );
}

// ============================================================================
// Dataset Detail View
// ============================================================================

function DatasetDetailView({
  dataset,
  entries,
  loading,
  actionLoading,
  onBack,
  onExport,
  onDelete,
  onValidate,
  validation,
  showValidation,
  onCloseValidation,
}: {
  dataset: GoldenDatasetInfo;
  entries: GoldenDatasetEntryInfo[];
  loading: boolean;
  actionLoading: boolean;
  onBack: () => void;
  onExport: () => void;
  onDelete: () => void;
  onValidate: () => void;
  validation: { valid: boolean; errors: Array<{ entryId: string; issues: string[] }> } | null;
  showValidation: boolean;
  onCloseValidation: () => void;
}) {
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft size={16} />
          Back
        </Button>
      </div>

      <PremiumCard variant="elevated">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-text-primary">{dataset.name}</h1>
              <Badge variant={DIFFICULTY_CONFIG[dataset.difficulty as Difficulty]?.variant ?? "default"}>
                {DIFFICULTY_CONFIG[dataset.difficulty as Difficulty]?.label ?? dataset.difficulty}
              </Badge>
            </div>
            {dataset.description && (
              <p className="text-sm text-text-secondary max-w-2xl">{dataset.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span>{dataset.entryCount} entries</span>
              <span>Version {dataset.version}</span>
              <span>Updated {new Date(dataset.updatedAt).toLocaleDateString()}</span>
            </div>
            {dataset.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {dataset.tags.map((tag) => (
                  <Badge key={tag} variant="default">
                    <Tag size={10} className="mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 size={14} />
            </Button>
          </div>
        </div>
      </PremiumCard>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => setShowBulkAdd(true)}>
          <Plus size={14} />
          Bulk Add
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowAddEntry(true)}>
          <Plus size={14} />
          Add Entry
        </Button>
        <Button variant="secondary" size="sm" onClick={onExport} disabled={actionLoading}>
          <Download size={14} />
          Export
        </Button>
        <Button variant="secondary" size="sm" onClick={onValidate} disabled={actionLoading}>
          <CheckCircle2 size={14} />
          Validate
        </Button>
      </div>

      {showValidation && validation && (
        <PremiumCard variant="elevated">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : (
                <XCircle size={16} className="text-error" />
              )}
              <h3 className="text-sm font-semibold text-text-primary">
                Validation {validation.valid ? "Passed" : "Failed"}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onCloseValidation}>
              <XCircle size={14} />
            </Button>
          </div>
          {!validation.valid && (
            <div className="space-y-2">
              {validation.errors.map((err) => (
                <div
                  key={err.entryId}
                  className="flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 p-3 text-xs"
                >
                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-error" />
                  <div>
                    <span className="font-medium text-text-primary">Entry {err.entryId.slice(0, 8)}</span>
                    <ul className="mt-1 text-text-secondary">
                      {err.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          )}
          {validation.valid && (
            <p className="text-xs text-text-secondary">
              All {entries.length} entries passed validation.
            </p>
          )}
        </PremiumCard>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <FileText size={40} className="mb-3 text-text-tertiary" />
          <p className="text-sm font-medium text-text-secondary">No entries yet</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Add entries to build your golden dataset.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary line-clamp-2">
                      {entry.question}
                    </p>
                    <p className="text-xs text-text-tertiary line-clamp-2">
                      {entry.expectedAnswer}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteEntryId(entry.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  {entry.category && (
                    <span className="flex items-center gap-1">
                      <FileText size={10} />
                      {entry.category}
                    </span>
                  )}
                  {entry.tags.length > 0 && (
                    <div className="flex gap-1">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="default" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAddEntry && (
        <AddEntryModal
          open={showAddEntry}
          onClose={() => setShowAddEntry(false)}
          onSubmit={async (input) => {
            const result = await addGoldenDatasetEntry(dataset.id, input);
            if (result.success) {
              setShowAddEntry(false);
              window.location.reload();
            }
            return result;
          }}
          isLoading={actionLoading}
        />
      )}

      {showBulkAdd && (
        <BulkAddModal
          open={showBulkAdd}
          onClose={() => setShowBulkAdd(false)}
          onSubmit={async (entries) => {
            const result = await bulkAddGoldenDatasetEntries(dataset.id, entries);
            if (result.success) {
              setShowBulkAdd(false);
              window.location.reload();
            }
            return result;
          }}
          isLoading={actionLoading}
        />
      )}

      {deleteEntryId && (
        <ConfirmDialog
          open={!!deleteEntryId}
          onClose={() => setDeleteEntryId(null)}
          onConfirm={async () => {
            await deleteGoldenDatasetEntry(deleteEntryId);
            setDeleteEntryId(null);
            window.location.reload();
          }}
          title="Delete Entry"
          description="This will permanently delete this entry from the dataset."
          confirmLabel="Delete"
          isLoading={actionLoading}
        />
      )}
    </div>
  );
}

// ============================================================================
// Create Dataset Modal
// ============================================================================

function CreateDatasetModal({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateDatasetInput) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      difficulty,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Create Dataset</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/5 p-3 text-xs text-error">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Customer Support QA"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this dataset evaluate?"
              rows={3}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    difficulty === d
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-bg text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {DIFFICULTY_CONFIG[d].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </span>
              ) : (
                "Create Dataset"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Import Dataset Modal
// ============================================================================

function ImportDatasetModal({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: ImportDatasetInput) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [tags, setTags] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      setParseError(null);
      try {
        const parsed = JSON.parse(content);
        if (!name && parsed.name) setName(parsed.name);
        if (!description && parsed.description) setDescription(parsed.description);
        if (parsed.difficulty) setDifficulty(parsed.difficulty);
        if (parsed.tags?.length) setTags(parsed.tags.join(", "));
      } catch {
        setParseError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setParseError(null);

    try {
      const parsed = JSON.parse(jsonInput);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(entries)) {
        setParseError("JSON must be an array of entries or an object with an 'entries' array");
        return;
      }

      const result = await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        difficulty,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        entries,
      });

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch {
      setParseError("Invalid JSON format");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Import Dataset</h2>

        {(error || parseError) && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/5 p-3 text-xs text-error">
            <AlertTriangle size={14} />
            {error || parseError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Upload JSON File
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand/10 file:text-brand hover:file:bg-brand/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Or Paste JSON <span className="text-error">*</span>
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setParseError(null);
              }}
              placeholder='[{"question": "...", "expectedAnswer": "..."}]'
              rows={8}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dataset name"
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
              >
                {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_CONFIG[d].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this dataset evaluate?"
              rows={2}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Comma-separated tags"
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isLoading || !name.trim() || !jsonInput.trim()}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Importing...
                </span>
              ) : (
                "Import Dataset"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Add Entry Modal
// ============================================================================

function AddEntryModal({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateEntryInput) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [expectedAnswer, setExpectedAnswer] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = await onSubmit({
      question: question.trim(),
      expectedAnswer: expectedAnswer.trim(),
      category: category.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      context: context.trim() || undefined,
    });
    if (!result.success && result.error) {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Add Entry</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/5 p-3 text-xs text-error">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Question <span className="text-error">*</span>
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="The question to evaluate"
              rows={3}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Expected Answer <span className="text-error">*</span>
            </label>
            <textarea
              value={expectedAnswer}
              onChange={(e) => setExpectedAnswer(e.target.value)}
              placeholder="The correct answer"
              rows={4}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Context
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Source context for this entry (optional)"
              rows={3}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., billing, support"
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Comma-separated"
                className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isLoading || !question.trim() || !expectedAnswer.trim()}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Adding...
                </span>
              ) : (
                "Add Entry"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Bulk Add Modal
// ============================================================================

function BulkAddModal({
  open,
  onClose,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (entries: CreateEntryInput[]) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}) {
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!open) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonInput(event.target?.result as string);
      setParseError(null);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setParseError(null);

    try {
      const parsed = JSON.parse(jsonInput);
      const entries = Array.isArray(parsed) ? parsed : parsed.entries;
      if (!Array.isArray(entries)) {
        setParseError("JSON must be an array of entries or an object with an 'entries' array");
        return;
      }

      const result = await onSubmit(entries);
      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch {
      setParseError("Invalid JSON format");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Bulk Add Entries</h2>

        {(error || parseError) && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/20 bg-error/5 p-3 text-xs text-error">
            <AlertTriangle size={14} />
            {error || parseError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Upload JSON File
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm text-text-primary file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand/10 file:text-brand hover:file:bg-brand/20"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Paste JSON <span className="text-error">*</span>
            </label>
            <textarea
              value={jsonInput}
              onChange={(e) => {
                setJsonInput(e.target.value);
                setParseError(null);
              }}
              placeholder='[{"question": "...", "expectedAnswer": "..."}]'
              rows={12}
              className="w-full rounded-lg border border-border bg-bg px-4 py-2.5 text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1" disabled={isLoading || !jsonInput.trim()}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Adding...
                </span>
              ) : (
                "Bulk Add Entries"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { DatasetsClientInner as DatasetsClient };
