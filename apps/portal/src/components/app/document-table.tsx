"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
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
  File,
  CheckSquare,
  Square,
  Trash,
  RotateCcw,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessingBadge } from "@/components/app/processing-badge";
import { DocumentUploadDialog } from "@/components/app/document-upload-dialog";
import { DocumentPreviewDialog } from "@/components/app/document-preview-dialog";
import { RenameDocumentDialog } from "@/components/app/rename-document-dialog";
import { DeleteDocumentDialog } from "@/components/app/delete-document-dialog";
import { toast } from "sonner";
import {
  reprocessDocument,
  bulkDeleteDocuments,
  bulkReprocessDocuments,
} from "@/lib/actions/document";

interface DocumentItem {
  id: string;
  name: string;
  fileType: string;
  size: number;
  status: string;
  storageUrl: string | null;
  uploadedBy: { id: string; name: string | null; image: string | null } | null;
  createdAt: Date;
  _count: { chunks: number };
}

type SortField = "name" | "fileType" | "size" | "createdAt" | "status";
type SortDir = "asc" | "desc";

interface Props {
  items: DocumentItem[];
  kbId: string;
  kbName: string;
}

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Ready", value: "READY" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Error", value: "ERROR" },
  { label: "Queued", value: "QUEUED" },
] as const;

export function DocumentTable({ items, kbId, kbName }: Props) {
  const router = useRouter();
  const [uploadOpen, setUploadOpen] = useState(false);
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
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const processingStatuses = ["QUEUED", "UPLOADING", "STORED", "EXTRACTING", "CHUNKING", "EMBEDDING_PENDING"];

  const filtered = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.fileType.toLowerCase().includes(q) ||
          d.uploadedBy?.name?.toLowerCase().includes(q),
      );
    }
    if (statusFilter === "PROCESSING") {
      list = list.filter((d) => processingStatuses.includes(d.status));
    } else if (statusFilter) {
      list = list.filter((d) => d.status === statusFilter);
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "fileType":
          return a.fileType.localeCompare(b.fileType) * dir;
        case "size":
          return (a.size - b.size) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "createdAt":
          return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [items, search, sortField, sortDir, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const allSelected = paged.length > 0 && paged.every((d) => selected.has(d.id));
  const someSelected = paged.some((d) => selected.has(d.id));

  const toggleSelect = (id: string) => {
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
      setSelected((prev) => {
        const next = new Set(prev);
        paged.forEach((d) => next.add(d.id));
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
    if (selected.size === 0) return;
    try {
      const formData = new FormData();
      selected.forEach((id) => formData.append("ids", id));
      await bulkDeleteDocuments(formData);
      toast.success(`${selected.size} document(s) deleted`);
      clearSelection();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleBulkReprocess = async () => {
    if (selected.size === 0) return;
    try {
      const formData = new FormData();
      selected.forEach((id) => formData.append("ids", id));
      await bulkReprocessDocuments(formData);
      toast.success(`Reprocessing ${selected.size} document(s)`);
      clearSelection();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reprocess");
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
            No documents yet. Upload your first document to get started.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <FileText size={32} className="text-brand" />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-text-primary">No documents yet</h2>
          <p className="mt-2 max-w-sm text-center text-sm text-text-secondary">
            Upload PDF, DOCX, TXT, MD, or CSV files to populate your knowledge base.
          </p>
          <Button variant="primary" className="mt-8" onClick={() => setUploadOpen(true)}>
            <Upload size={16} />
            Upload documents
          </Button>
        </div>
        <DocumentUploadDialog
          kbId={kbId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          existingFiles={items.map((d) => d.name)}
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
            {items.length} document{items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={() => setUploadOpen(true)}>
          <Upload size={16} />
          Upload
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search by name, type, uploader..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full rounded-[10px] border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-2 text-xs font-medium transition-colors ${
            statusFilter
              ? "border-brand/30 bg-brand/10 text-brand"
              : "border-border text-text-secondary hover:bg-surface-hover"
          }`}
        >
          <Filter size={13} />
          Filter
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(0);
              }}
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
      )}

      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5">
          <span className="text-sm font-medium text-text-primary">
            {selected.size} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkReprocess}
            >
              <RotateCcw size={13} />
              Reprocess
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="!border-error/30 !text-error hover:!bg-error/10"
              onClick={handleBulkDelete}
            >
              <Trash size={13} />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="w-10 px-2 py-3">
                <button onClick={toggleSelectAll} className="mx-auto flex">
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
                  Filename
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
                  <button onClick={() => toggleSelect(doc.id)} className="mx-auto flex">
                    {selected.has(doc.id) ? (
                      <CheckSquare size={16} className="text-brand" />
                    ) : (
                      <Square size={16} className="text-text-tertiary" />
                    )}
                  </button>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                      <File size={15} className="text-brand" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {doc.name}
                      </p>
                      <p className="text-xs text-text-tertiary sm:hidden">
                        {doc.fileType.toUpperCase()} &middot; {formatSize(doc.size)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-3 py-3.5 sm:table-cell">
                  <span className="text-sm text-text-secondary">
                    {doc.fileType.toUpperCase()}
                  </span>
                </td>
                <td className="hidden px-3 py-3.5 md:table-cell">
                  <span className="text-sm text-text-secondary">{formatSize(doc.size)}</span>
                </td>
                <td className="hidden px-3 py-3.5 lg:table-cell">
                  <span className="text-sm text-text-secondary">
                    {doc.uploadedBy?.name || "Unknown"}
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
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen === doc.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-border bg-surface p-1 shadow-xl">
                          <button
                            onClick={() => { setPreviewId(doc.id); setMenuOpen(null); }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                          >
                            <Eye size={15} />
                            Preview
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
