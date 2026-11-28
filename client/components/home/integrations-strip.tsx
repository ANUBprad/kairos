import React from "react";
import {
  AudioLines,
  Brain,
  Database,
  FileText,
  Flame,
  Globe,
  HardDrive,
  Search,
} from "lucide-react";
import { YoutubeIcon } from "@/components/ui/youtube-icon";
import { GithubIcon } from "./brand-icons";

interface SourceItem {
  label: string;
  icon: React.ReactNode;
}

interface SourceGroup {
  number: string;
  label: string;
  detail: string;
  items: SourceItem[];
  compact?: boolean;
}

const GROUPS: SourceGroup[] = [
  {
    number: "01",
    label: "Connected accounts",
    detail: "Authorized sources are imported into the same workspace library.",
    items: [
      { label: "Google Drive", icon: <HardDrive className="size-4" strokeWidth={1.6} /> },
      { label: "Notion", icon: <FileText className="size-4" strokeWidth={1.6} /> },
      { label: "GitHub", icon: <GithubIcon /> },
    ],
  },
  {
    number: "02",
    label: "Files and links",
    detail: "Add material directly, whether it starts as a file, page or transcript.",
    items: [
      { label: "PDFs", icon: <FileText className="size-4" strokeWidth={1.6} /> },
      { label: "Web pages", icon: <Globe className="size-4" strokeWidth={1.6} /> },
      { label: "YouTube", icon: <YoutubeIcon size={16} /> },
      { label: "Markdown & text", icon: <FileText className="size-4" strokeWidth={1.6} /> },
    ],
  },
  {
    number: "03",
    label: "Processing layer",
    detail: "Services behind extraction, retrieval, voice and memory. No separate sign-up is required.",
    compact: true,
    items: [
      { label: "Firecrawl", icon: <Flame className="size-4" strokeWidth={1.6} /> },
      { label: "Tavily", icon: <Search className="size-4" strokeWidth={1.6} /> },
      { label: "Pinecone", icon: <Database className="size-4" strokeWidth={1.6} /> },
      { label: "ElevenLabs", icon: <AudioLines className="size-4" strokeWidth={1.6} /> },
      { label: "Mem0", icon: <Brain className="size-4" strokeWidth={1.6} /> },
    ],
  },
];

export function IntegrationsStrip() {
  return (
    <section id="sources" className="scroll-mt-24 bg-background py-24 sm:py-28">
      <div className="kairos-section-wrap">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <p className="kairos-kicker">Connected research</p>
            <h2 className="kairos-editorial-title mt-4 text-[34px] sm:text-[44px]">
              One library, however
              <br />
              your sources arrive.
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Kairos normalizes each source into searchable evidence, so a PDF, a
            transcript and a web page can answer the same question together.
          </p>
        </div>

        <div className="mt-12 border-y border-border">
          {GROUPS.map((group) => (
            <div
              key={group.label}
              className="grid gap-6 border-b border-border py-8 last:border-0 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14"
            >
              <div className="flex gap-4">
                <span className="pt-0.5 font-mono text-[10px] tracking-[0.18em] text-processing-deep">
                  {group.number}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                  <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                    {group.detail}
                  </p>
                </div>
              </div>

              <div
                className={
                  group.compact
                    ? "flex flex-wrap gap-2"
                    : "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4"
                }
              >
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className={
                      group.compact
                        ? "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
                        : "flex min-h-20 items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-[13px] text-foreground transition-colors hover:border-brand/40"
                    }
                  >
                    <span className={group.compact ? "text-processing-deep" : "text-primary"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Connections are managed in workspace settings
        </p>
      </div>
    </section>
  );
}
