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

const INTEGRATIONS: { label: string; icon: React.ReactNode }[] = [
  { label: "Google Drive", icon: <HardDrive className="size-5" strokeWidth={1.75} /> },
  { label: "Notion", icon: <FileText className="size-5" strokeWidth={1.75} /> },
  { label: "YouTube", icon: <YoutubeIcon size={20} /> },
  { label: "Firecrawl", icon: <Flame className="size-5" strokeWidth={1.75} /> },
  { label: "Tavily", icon: <Search className="size-5" strokeWidth={1.75} /> },
  { label: "Pinecone", icon: <Database className="size-5" strokeWidth={1.75} /> },
  { label: "ElevenLabs", icon: <AudioLines className="size-5" strokeWidth={1.75} /> },
  { label: "Mem0", icon: <Brain className="size-5" strokeWidth={1.75} /> },
  { label: "Web pages", icon: <Globe className="size-5" strokeWidth={1.75} /> },
];

export function IntegrationsStrip() {
  return (
    <section id="workflow" className="scroll-mt-24 px-5 pt-24 sm:px-6 sm:pt-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-xl">
          <p className="kairos-eyebrow">Connected research</p>
          <h2 className="kairos-section-title mt-3 text-[30px] sm:text-[36px]">
            Bring in the sources your work already lives in.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Kairos normalizes each source into searchable evidence, so a PDF, a
            transcript, and a web page can answer the same question together.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {INTEGRATIONS.map((item) => (
            <div
              key={item.label}
              className="kairos-card flex min-h-24 flex-col justify-between p-4"
            >
              <div className="text-primary">{item.icon}</div>
              <span className="mt-4 text-[13px] font-medium text-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
