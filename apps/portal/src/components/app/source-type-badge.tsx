"use client";

import { File, FileText, Globe, Youtube } from "lucide-react";
import type { DocumentSourceType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { SOURCE_TYPE_META } from "@/lib/source-library";

const SOURCE_TYPE_ICONS: Record<DocumentSourceType, typeof File> = {
  FILE: File,
  TEXT: FileText,
  URL: Globe,
  YOUTUBE: Youtube,
};

interface Props {
  sourceType: DocumentSourceType | string;
  className?: string;
}

export function SourceTypeBadge({ sourceType, className }: Props) {
  const meta = SOURCE_TYPE_META[sourceType as DocumentSourceType] || SOURCE_TYPE_META.FILE;
  const Icon = SOURCE_TYPE_ICONS[sourceType as DocumentSourceType] || SOURCE_TYPE_ICONS.FILE;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-0.5 text-[11px] font-semibold",
        meta.className,
        className,
      )}
    >
      <Icon size={12} />
      {meta.label}
    </span>
  );
}