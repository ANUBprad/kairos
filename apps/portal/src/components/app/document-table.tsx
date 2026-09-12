"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
SearchX,
  Loader2,
  File,
  Plus,
  CheckSquare,
  Square,
  Trash,
  RotateCcw,
  Filter,
  Bot,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingBadge } from "@/components/app/processing-badge";
import { SourceTypeBadge } from "@/components/app/source-type-badge";
import { DocumentUploadDialog } from "@/components/app/document-upload-dialog";
import { SourceAddDialog } from "@/components/app/source-add-dialog";
import { DocumentPreviewDialog } from "@/components/app/document-preview-dialog";
import { RenameDocumentDialog } from "@/components/app/rename-document-dialog";
import { DeleteDocumentDialog } from "@/components/app/delete-document-dialog";
import { toast } from "sonner";
import {
  reprocessDocument,
  bulkDeleteDocuments,
  bulkReprocessDocuments,
} from "@/lib/actions/document";
import {
  SOURCE_TYPE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  SOURCE_TYPE_META,
  filterSources,
  canAddToBulkSelection,
} from "@/lib/source-library";
import { MAX_BULK_OPERATIONS } from "@/lib/source-contract";
import type { DocumentSourceType } from "@prisma/client";

interface DocumentItem {
  id: string;
  name: string;
  fileType: string;
  size: number | null;
  status: string;
  sourceType: DocumentSourceType;
  sourceUrl: string | null;
  storageUrl: string | null;
  uploadedBy: { id: string; name: string | null; image: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { chunks: number };
}

type SortField = "name" | "fileType" | "size" | "createdAt" | "status";
type SortDir = "asc" | "desc";

interface Props {
  items: DocumentItem[];
  kbId: string;
  kbName: string;
}

export function DocumentTable({ items, kbId, kbName }: Props) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sourceAddOpen, setSourceAddOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentItem | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<DocumentSourceType | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const pageSize = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSourceTypeFilter("");
    setStatusFilter("");
    setPage(0);
  };

  const filtered = useMemo(() => {
    const list = filterSources(items, { search, sourceType: sourceTypeFilter, status: statusFilter });
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "fileType":
          return a.fileType.localeCompare(b.fileType) * dir;
        case "size":
          return ((a.size ?? -1) - (b.size ?? -1)) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "createdAt":
          return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [items, search, sortField, sortDir, statusFilter, sourceTypeFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const allSelected = paged.length > 0 && paged.every((d) => selected.has(d.id));
  const someSelected = paged.some((d) => selected.has(d.id));

  const toggleSelect = (id: string) => {
    if (!selected.has(id) && !canAddToBulkSelection(selected.size)) {
      toast.warning(`You can select up to ${MAX_BULK_OPERATIONS} sources at once`);
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        paged.forEach((d) => next.delete(d.id));
        return next;
      });
    } else {
      const available = MAX_BULK_OPERATIONS - selected.size;
      const toAdd = paged.filter((d) => !selected.has(d.id)).slice(0, Math.max(0, available));
      if (toAdd.length === 0) {
        toast.warning(`You can select up to ${MAX_BULK_OPERATIONS} sources at once`);
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        toAdd.forEach((d) => next.add(d.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelected(new Set());

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleReprocess = async (doc: DocumentItem) => {
    try {
      const formData = new FormData();
      formData.set("id", doc.id);
      await reprocessDocument(formData);
      toast.success("Reprocessing started");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reprocess");
    }
  };

  const handleDownload = (doc: DocumentItem) => {
    if (doc.storageUrl) window.open(doc.storageUrl, "_blank");
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const formData = new FormData();
      selected.forEach((id) => formData.append("ids", id));
      await bulkDeleteDocuments(formData);
      toast.success(`${selected.size} source${selected.size !== 1 ? "s" : ""} deleted`);
      clearSelection();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkReprocess = async () => {
    if (selected.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    try {
      const formData = new FormData();
      selected.forEach((id) => formData.append("ids", id));
      await bulkReprocessDocuments(formData);
      toast.success(`Reprocessing ${selected.size} source${selected.size !== 1 ? "s" : ""}`);
      clearSelection();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reprocess");
    } finally {
      setBulkBusy(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-text-tertiary" />;
    return sortDir === "asc" ? (
      <ArrowUp size={12} className="text-brand" />
    ) : (
      <ArrowDown size={12} className="text-brand" />
    );
  };

  if (items.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">{kbName}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            No sources yet. Add your first source to get started.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <FileText size={32} className="text-brand" />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-text-primary">No sources yet</h2>
          <p className="mt-2 max-w-sm text-center text-sm text-text-secondary">
            Upload files, or add a URL or YouTube video to populate your knowledge base.
          </p>
          <Button variant="primary" className="mt-8" onClick={() => setSourceAddOpen(true)}>
            <Plus size={16} />
            Add source
          </Button>
        </div>
        <DocumentUploadDialog
          kbId={kbId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          existingFiles={items.map((d) => d.name)}
        />
        <SourceAddDialog
          kbId={kbId}
          open={sourceAddOpen}
          onOpenChange={setSourceAddOpen}
          onOpenFileUpload={() => setUploadOpen(true)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{kbName}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {items.length} source{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/app/knowledge-bases/${kbId}/chat`}>
            <Button variant="secondary">
              <Bot size={16} />
              Chat
            </Button>
          </Link>
          <Link href={`/app/knowledge-bases/${kbId}/studio`}>
            <Button variant="secondary">
              <Sparkles size={16} />
              Studio
            </Button>
          </Link>
          <Button variant="primary" onClick={() => setSourceAddOpen(true)}>
            <Plus size={16} />
            Add source
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search by name, type, URL..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            aria-label="Search sources"
            className="w-full rounded-[10px] border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-medium transition-colors ${
            statusFilter || sourceTypeFilter
              ? "border-brand/30 bg-brand/10 text-brand"
              : "border-border text-text-secondary hover:bg-surface-hover"
          }`}
        >
          <Filter size={13} />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap items-start gap-x-8 gap-y-4 rounded-xl border border-border p-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Source type
            </p>
            <div className="flex flex-wrap gap-2">
              {SOURCE_TYPE_OPTIONS.map((f) => {
                const active = sourceTypeFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => {
                      setSourceTypeFilter(f.value);
                      setPage(0);
                    }}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-brand/30 bg-brand/10 text-brand"
                        : "border-border text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Status
            </p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTER_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setStatusFilter(f.value);
                    setPage(0);
                  }}
                  aria-pressed={statusFilter === f.value}
                  className={`rounded-[8px] border px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "border-brand/30 bg-brand/10 text-brand"
                      : "border-border text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5">
          <span className="text-sm font-medium text-text-primary">
            {selected.size} selected
            {selected.size >= MAX_BULK_OPERATIONS && " (max)"}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={bulkBusy}
              onClick={handleBulkReprocess}
            >
              {bulkBusy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Reprocess
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={bulkBusy}
              className="!border-error/30 !text-error hover:!bg-error/10"
              onClick={handleBulkDelete}
            >
              <Trash size={13} />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkBusy}
              onClick={clearSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-20">
          <SearchX size={28} className="text-text-tertiary" />
          <p className="mt-3 text-sm font-medium text-text-primary">No sources match your filters</p>
          <p className="mt-1 text-xs text-text-tertiary">Try adjusting the search or filters.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="w-10 px-2 py-3">
                <button onClick={toggleSelectAll} className="mx-auto flex" aria-label={allSelected ? "Deselect all" : "Select all"}>
                  {allSelected ? (
                    <CheckSquare size={16} className="text-brand" />
                  ) : someSelected ? (
                    <CheckSquare size={16} className="text-brand opacity-50" />
                  ) : (
                    <Square size={16} className="text-text-tertiary" />
                  )}
                </button>
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
                onClick={() => toggleSort("name")}
              >
                <span className="inline-flex items-center gap-1.5">
                  Source
                  <SortIcon field="name" />
                </span>
              </th>
              <th
                className="hidden cursor-pointer px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary sm:table-cell"
                onClick={() => toggleSort("fileType")}
              >
                <span className="inline-flex items-center gap-1.5">
                  Type
                  <SortIcon field="fileType" />
                </span>
              </th>
              <th
                className="hidden cursor-pointer px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary md:table-cell"
                onClick={() => toggleSort("size")}
              >
                <span className="inline-flex items-center gap-1.5">
                  Size
                  <SortIcon field="size" />
                </span>
              </th>
              <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary lg:table-cell">
                Uploaded By
              </th>
              <th className="hidden px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary md:table-cell">
                Chunks
              </th>
              <th
                className="hidden cursor-pointer px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary lg:table-cell"
                onClick={() => toggleSort("createdAt")}
              >
                <span className="inline-flex items-center gap-1.5">
                  Upload Date
                  <SortIcon field="createdAt" />
                </span>
              </th>
              <th
                className="cursor-pointer px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
                onClick={() => toggleSort("status")}
              >
                <span className="inline-flex items-center gap-1.5">
                  Status
                  <SortIcon field="status" />
                </span>
              </th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.map((doc) => (
              <tr
                key={doc.id}
                className={`border-b border-border transition-colors last:border-0 hover:bg-surface-hover ${
                  selected.has(doc.id) ? "bg-brand/5" : ""
                }`}
              >
                <td className="px-2 py-3.5">
                  <button onClick={() => toggleSelect(doc.id)} className="mx-auto flex" aria-label={selected.has(doc.id) ? "Deselect document" : "Select document"}>
                    {selected.has(doc.id) ? (
                      <CheckSquare size={16} className="text-brand" />
                    ) : (
                      <Square size={16} className="text-text-tertiary" />
                    )}
                  </button>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/app/knowledge-bases/${kbId}/${doc.id}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 hover:bg-brand/20 transition-colors"
                    >
                      <File size={15} className="text-brand" />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/app/knowledge-bases/${kbId}/${doc.id}`}
                        className="truncate text-sm font-medium text-text-primary hover:text-brand transition-colors"
                      >
                        {doc.name}
                      </Link>
                      <p className="text-xs text-text-tertiary sm:hidden">
                        {SOURCE_TYPE_META[doc.sourceType as DocumentSourceType]?.label || doc.sourceType}
                        {doc.sourceType === "FILE" && ` (${doc.fileType.toUpperCase()})`}
                        {" · "}{formatSize(doc.size ?? 0)} · {doc._count.chunks} chunks
                      </p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-3 py-3.5 sm:table-cell">
                  <div className="flex items-center gap-2">
                    <SourceTypeBadge sourceType={doc.sourceType} />
                    {doc.sourceType === "FILE" && (
                      <span className="text-xs text-text-tertiary">{doc.fileType.toUpperCase()}</span>
                    )}
                  </div>
                </td>
                <td className="hidden px-3 py-3.5 md:table-cell">
                  <span className="text-sm text-text-secondary">{formatSize(doc.size ?? 0)}</span>
                </td>
                <td className="hidden px-3 py-3.5 lg:table-cell">
                  <span className="text-sm text-text-secondary">
                    {doc.uploadedBy?.name || "Unknown"}
                  </span>
                </td>
                <td className="hidden px-3 py-3.5 md:table-cell">
                  <span className="text-sm font-mono text-text-secondary tabular-nums">
                    {doc._count.chunks}
                  </span>
                </td>
                <td className="hidden px-3 py-3.5 lg:table-cell">
                  <span className="text-sm text-text-secondary">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  <ProcessingBadge status={doc.status} />
                </td>
                <td className="px-3 py-3.5 text-right">
                  <div className="relative inline-flex">
                    <button
                      onClick={() => setMenuOpen(menuOpen === doc.id ? null : doc.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
                      aria-label="Document actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen === doc.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-xl">
                          <Link
                            href={`/app/knowledge-bases/${kbId}/${doc.id}`}
                            onClick={() => setMenuOpen(null)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          >
                            <Eye size={15} />
                            View Details
                          </Link>
                          <button
                            onClick={() => { setPreviewId(doc.id); setMenuOpen(null); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          >
                            <FileText size={15} />
                            Preview Content
                          </button>
                          <button
                            onClick={() => { setRenameTarget(doc); setMenuOpen(null); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          >
                            <Pencil size={15} />
                            Rename
                          </button>
                          <button
                            onClick={() => { handleDownload(doc); setMenuOpen(null); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          >
                            <Download size={15} />
                            Download
                          </button>
                          <button
                            onClick={() => { handleReprocess(doc); setMenuOpen(null); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          >
                            <RefreshCw size={15} />
                            Reprocess
                          </button>
                          <div className="my-1 border-t border-border" />
                          <button
                            onClick={() => { setDeleteTarget(doc); setMenuOpen(null); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-error"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-text-tertiary">
            Showing {(page * pageSize) + 1}-
            {Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-30"
            >
              <ArrowUpDown size={14} className="rotate-90" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const start = Math.max(0, Math.min(page - 3, totalPages - 7));
              const p = start + i;
              if (p >= totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors ${
                    p === page
                      ? "bg-brand text-white"
                      : "text-text-secondary hover:bg-surface-hover"
                  }`}
                >
                  {p + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-30"
            >
              <ArrowUpDown size={14} className="-rotate-90" />
            </button>
          </div>
        </div>
      )}

      <DocumentUploadDialog
        kbId={kbId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        existingFiles={items.map((d) => d.name)}
      />
      <SourceAddDialog
        kbId={kbId}
        open={sourceAddOpen}
        onOpenChange={setSourceAddOpen}
        onOpenFileUpload={() => setUploadOpen(true)}
      />
      <DocumentPreviewDialog
        docId={previewId}
        onClose={() => setPreviewId(null)}
      />
      <RenameDocumentDialog
        document={renameTarget ? { id: renameTarget.id, name: renameTarget.name, knowledgeBaseId: kbId } : null}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteDocumentDialog
        document={deleteTarget ? { id: deleteTarget.id, name: deleteTarget.name, knowledgeBaseId: kbId } : null}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
