import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import type { ArtifactStatus, ArtifactType, DocumentStatus } from "@prisma/client";
import { kbWorkspaceHref } from "@/components/app/kb-workspace-tabs";
import { ProcessingBadge } from "@/components/app/processing-badge";
import { ArtifactStatusBadge } from "@/components/app/studio/artifact-status-badge";
import { ARTIFACT_TYPE_META, isActiveStudioArtifactType } from "@/components/app/studio/artifact-type-meta";

export interface HomeWorkspace {
  id: string;
  name: string;
  createdAt: Date;
  _count: { documents: number };
}

export interface HomeConversation {
  id: string;
  title: string | null;
  updatedAt: Date;
  knowledgeBaseId: string;
  knowledgeBase: { name: string };
}

export interface HomeSource {
  id: string;
  name: string;
  status: DocumentStatus;
  knowledgeBaseId: string;
  knowledgeBase: { name: string };
}

export interface HomeArtifact {
  id: string;
  name: string | null;
  type: ArtifactType;
  status: ArtifactStatus;
  createdAt: Date;
  knowledgeBaseId: string;
  knowledgeBase: { name: string };
}

export interface HomeData {
  userName: string | null;
  knowledgeBases: HomeWorkspace[];
  conversations: HomeConversation[];
  sources: HomeSource[];
  artifacts: HomeArtifact[];
  studies: { quizzesTaken: number; cardsKnown: number };
  loadError: boolean;
}

const primaryButton =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const secondaryButton =
  "inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const rowLink =
  "group flex items-center justify-between gap-4 rounded-[var(--radius-sm)] py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-bg";
const inlineLink = "font-medium text-brand transition-colors hover:text-brand-hover";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
      {children}
    </h2>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2.5">
        <SectionLabel>{title}</SectionLabel>
        {action}
      </div>
      <div className="mt-1">{children}</div>
    </section>
  );
}

// The first-run state is deliberate: it names the one action that unblocks
// everything (create a workspace) and describes the journey that follows, so a
// new user is never dropped onto an empty shell.
function OnboardingPanel() {
  const steps = [
    { title: "Create a workspace", description: "Name it after the subject you're researching." },
    { title: "Add your sources", description: "Upload PDFs, paste text, or add links and videos." },
    {
      title: "Research, create, and study",
      description: "Ask grounded questions, generate artifacts, and practice with quizzes.",
    },
  ];

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-8">
      <h2 className="section-title">Set up your first workspace</h2>
      <p className="mt-2 max-w-xl text-sm text-text-secondary">
        A workspace holds one set of sources. Everything you do — asking questions, creating
        artifacts, studying — happens inside it.
      </p>
      <ol className="mt-6 space-y-5">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-xs font-semibold text-text-secondary">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-text-primary">{step.title}</p>
              <p className="mt-0.5 text-sm text-text-tertiary">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HomeView({ data }: { data: HomeData }) {
  const { userName, knowledgeBases, conversations, sources, artifacts, studies, loadError } = data;

  const hasWorkspaces = knowledgeBases.length > 0;
  const hasStudy = studies.quizzesTaken > 0 || studies.cardsKnown > 0;
  const hasActivity = conversations.length > 0 || sources.length > 0 || artifacts.length > 0;

  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = userName?.trim().split(/\s+/)[0];
  const greeting = firstName ? `${part}, ${firstName}` : part;

  const subtitle = !hasWorkspaces
    ? "Bring your sources together, then research, create, and study from them."
    : hasActivity
      ? "Pick up where you left off, revisit a source, or start something new."
      : "Your workspace is ready. Add sources and your work will start showing up here.";

  return (
    <div className="animate-fade-in space-y-8">
      <header>
        <SectionLabel>Home</SectionLabel>
        <h1 className="page-title mt-2">{greeting}</h1>
        <p className="page-description mt-1 max-w-2xl">{subtitle}</p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {hasWorkspaces ? (
            <Link href="/app/research" className={primaryButton}>
              Start researching
              <ArrowRight size={14} />
            </Link>
          ) : (
            <Link href="/app/knowledge-bases" className={primaryButton}>
              Create a workspace
              <ArrowRight size={14} />
            </Link>
          )}
          {hasWorkspaces && (
            <Link href="/app/knowledge-bases" className={secondaryButton}>
              <FolderOpen size={14} />
              Open library
            </Link>
          )}
        </div>
      </header>

      {loadError && (
        <div
          role="status"
          className="rounded-[var(--radius-md)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-secondary"
        >
          Some of your recent activity couldn&apos;t be loaded. Refresh the page to try again.
        </div>
      )}

      {!hasWorkspaces ? (
        <OnboardingPanel />
      ) : (
        <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-8">
            {conversations.length > 0 && (
              <Section title="Continue researching">
                <ul className="divide-y divide-border">
                  {conversations.map((conversation) => (
                    <li key={conversation.id}>
                      <Link
                        href={`${kbWorkspaceHref(conversation.knowledgeBaseId, "research")}?conversation=${conversation.id}`}
                        className={rowLink}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text-primary transition-colors group-hover:text-brand">
                            {conversation.title || "Untitled conversation"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                            {conversation.knowledgeBase.name}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs text-text-tertiary">
                          {conversation.updatedAt.toLocaleDateString()}
                          <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-0.5"
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Recent sources">
              {sources.length > 0 ? (
                <ul className="divide-y divide-border">
                  {sources.map((source) => (
                    <li key={source.id}>
                      <Link
                        href={`/app/knowledge-bases/${source.knowledgeBaseId}/${source.id}`}
                        className={rowLink}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text-primary transition-colors group-hover:text-brand">
                            {source.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                            {source.knowledgeBase.name}
                          </span>
                        </span>
                        <ProcessingBadge status={source.status} className="shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-text-tertiary">
                  No sources yet.{" "}
                  <Link href="/app/knowledge-bases" className={inlineLink}>
                    Add sources to a workspace
                  </Link>
                </p>
              )}
            </Section>

            {artifacts.length > 0 && (
              <Section title="Recently created">
                <ul className="divide-y divide-border">
                  {artifacts.map((artifact) => {
                    const meta = isActiveStudioArtifactType(artifact.type)
                      ? ARTIFACT_TYPE_META[artifact.type]
                      : null;
                    const Icon = meta?.Icon;
                    const href =
                      artifact.status === "COMPLETED"
                        ? `/app/knowledge-bases/${artifact.knowledgeBaseId}/artifacts/${artifact.id}`
                        : kbWorkspaceHref(artifact.knowledgeBaseId, "studio");
                    return (
                      <li key={artifact.id}>
                        <Link href={href} className={rowLink}>
                          {Icon ? <Icon size={16} className="shrink-0 text-text-tertiary" /> : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-text-primary transition-colors group-hover:text-brand">
                              {artifact.name ||
                                `Untitled ${meta?.label.toLowerCase() ?? "artifact"}`}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                              {artifact.knowledgeBase.name}
                            </span>
                          </span>
                          <ArtifactStatusBadge status={artifact.status} className="shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
          </div>

          <aside className="min-w-0 space-y-8">
            <Section
              title="Workspaces"
              action={
                <Link href="/app/knowledge-bases" className={inlineLink}>
                  <span className="text-xs">View all</span>
                </Link>
              }
            >
              <ul className="divide-y divide-border">
                {knowledgeBases.slice(0, 5).map((kb) => (
                  <li key={kb.id}>
                    <Link href={kbWorkspaceHref(kb.id, "sources")} className={rowLink}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text-primary transition-colors group-hover:text-brand">
                          {kb.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-text-tertiary">
                          {kb._count.documents} source{kb._count.documents !== 1 ? "s" : ""}
                        </span>
                      </span>
                      <ArrowRight
                        size={14}
                        className="shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="Study">
              {hasStudy ? (
                <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-border bg-border">
                  <div className="bg-surface px-3 py-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Quizzes taken
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
                      {studies.quizzesTaken}
                    </dd>
                  </div>
                  <div className="bg-surface px-3 py-3">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Cards known
                    </dt>
                    <dd className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">
                      {studies.cardsKnown}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="py-3 text-sm text-text-tertiary">
                  No study activity yet. Turn a source into a quiz or flashcard deck and your
                  progress will appear here.
                </p>
              )}
              <Link
                href="/app/study"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand-hover"
              >
                Open Study
                <ArrowRight size={12} />
              </Link>
            </Section>
          </aside>
        </div>
      )}
    </div>
  );
}
