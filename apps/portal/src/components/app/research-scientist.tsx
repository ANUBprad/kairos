"use client";

import { useState } from "react";
import {
  Brain, ChevronDown, ChevronRight, FileText, AlertTriangle,
  Lightbulb, Target, ArrowRight, Copy, Check,
  TrendingUp, Shield, FlaskConical,
} from "lucide-react";
import type { ResearchScientistResult } from "@/lib/research-scientist";
import type { Finding, DiscussionPoint, Threat, FutureWorkItem, ExecutiveSummary, Recommendation } from "@/lib/research-scientist/types";

interface ResearchScientistProps {
  result: ResearchScientistResult;
}

type Tab = "summary" | "findings" | "discussion" | "threats" | "future" | "recommendations" | "evidence";

export function ResearchScientist({ result }: ResearchScientistProps) {
  const [activeTab, setActiveTab] = useState<Tab>("summary");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyReport = () => {
    navigator.clipboard.writeText(result.paper.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Brain }> = [
    { id: "summary", label: "Executive Summary", icon: FileText },
    { id: "findings", label: `Findings (${result.paper.findings.length})`, icon: Lightbulb },
    { id: "discussion", label: "Discussion", icon: TrendingUp },
    { id: "threats", label: `Threats (${result.paper.threats.length})`, icon: Shield },
    { id: "future", label: "Future Work", icon: Target },
    { id: "recommendations", label: `Recommendations (${result.recommendations.length})`, icon: ArrowRight },
    { id: "evidence", label: `Evidence (${result.evidenceCount})`, icon: FlaskConical },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-brand" />
          <span className="text-sm font-semibold text-text-primary">Research Scientist</span>
          <span className={`text-xs font-medium ${result.confidence >= 0.8 ? "text-emerald-500" : result.confidence >= 0.6 ? "text-yellow-500" : "text-orange-500"}`}>
            {Math.round(result.confidence * 100)}% confidence
          </span>
        </div>
        <button
          onClick={copyReport}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary rounded transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy report"}
        </button>
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "text-brand border-b-2 border-brand bg-brand/5"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-4 max-h-[600px] overflow-y-auto">
        {activeTab === "summary" && (
          <ExecutiveSummaryView summary={result.paper.executiveSummary} />
        )}
        {activeTab === "findings" && (
          <FindingsView
            findings={result.paper.findings}
            expandedItems={expandedItems}
            toggleItem={toggleItem}
          />
        )}
        {activeTab === "discussion" && (
          <DiscussionView
            points={result.paper.discussion}
            expandedItems={expandedItems}
            toggleItem={toggleItem}
          />
        )}
        {activeTab === "threats" && (
          <ThreatsView
            threats={result.paper.threats}
            expandedItems={expandedItems}
            toggleItem={toggleItem}
          />
        )}
        {activeTab === "future" && (
          <FutureWorkView
            items={result.paper.futureWork}
            expandedItems={expandedItems}
            toggleItem={toggleItem}
          />
        )}
        {activeTab === "recommendations" && (
          <RecommendationsView
            recommendations={result.recommendations}
            expandedItems={expandedItems}
            toggleItem={toggleItem}
          />
        )}
        {activeTab === "evidence" && (
          <EvidenceView findings={result.paper.findings} />
        )}
      </div>
    </div>
  );
}

function ExecutiveSummaryView({ summary }: { summary: ExecutiveSummary }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-bg/50 p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-2">Overall Conclusion</h3>
        <p className="text-sm text-text-secondary">{summary.overallConclusion}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Best Configuration</div>
          <div className="text-sm font-medium text-text-primary mt-1">{summary.bestConfiguration}</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider">Confidence Level</div>
          <div className={`text-sm font-medium mt-1 ${summary.researchConfidence >= 0.8 ? "text-emerald-500" : summary.researchConfidence >= 0.6 ? "text-yellow-500" : "text-orange-500"}`}>
            {Math.round(summary.researchConfidence * 100)}%
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-bg/50 p-4">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Most Important Finding</h3>
        <p className="text-sm text-text-secondary">{summary.mostImportantFinding}</p>
      </div>

      <div className="rounded-lg border border-border bg-bg/50 p-4">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Most Surprising Observation</h3>
        <p className="text-sm text-text-secondary">{summary.mostSurprisingObservation}</p>
      </div>

      <div className="rounded-lg border border-border bg-bg/50 p-4">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Deployment Recommendation</h3>
        <p className="text-sm text-text-secondary">{summary.recommendedDeployment}</p>
      </div>

      <div className="rounded-lg border border-brand/30 bg-brand/5 p-4">
        <h3 className="text-xs font-semibold text-brand uppercase tracking-wider mb-2">Next Experiment</h3>
        <p className="text-sm text-text-secondary">{summary.nextExperiment}</p>
      </div>
    </div>
  );
}

function FindingsView({
  findings,
  expandedItems,
  toggleItem,
}: {
  findings: Finding[];
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {findings.map((f) => (
        <div key={f.id} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => toggleItem(f.id)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
          >
            {expandedItems.has(f.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              f.severity === "critical" ? "bg-red-500" :
              f.severity === "high" ? "bg-amber-500" :
              f.severity === "medium" ? "bg-blue-500" : "bg-gray-400"
            }`} />
            <span className="text-sm font-medium text-text-primary flex-1">{f.title}</span>
            <span className="text-xs text-text-tertiary">{Math.round(f.confidence * 100)}%</span>
          </button>
          {expandedItems.has(f.id) && (
            <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
              <p className="text-sm text-text-secondary">{f.statement}</p>
              {f.evidence.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Evidence</div>
                  {f.evidence.map((e, i) => (
                    <div key={i} className="text-xs text-text-tertiary ml-2">
                      {e.metric}: {e.improvementPct > 0 ? "+" : ""}{e.improvementPct.toFixed(1)}%
                      ({e.pValue < 0.001 ? "p < 0.001" : `p = ${e.pValue.toFixed(3)}`})
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-text-tertiary italic">{f.interpretation}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DiscussionView({
  points,
  expandedItems,
  toggleItem,
}: {
  points: DiscussionPoint[];
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {points.map((d, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => toggleItem(`disc-${i}`)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
          >
            {expandedItems.has(`disc-${i}`) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span className="text-sm font-medium text-text-primary flex-1">{d.topic}</span>
          </button>
          {expandedItems.has(`disc-${i}`) && (
            <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
              <p className="text-sm text-text-secondary">{d.observation}</p>
              <p className="text-sm text-text-secondary">{d.explanation}</p>
              {d.implications.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Implications</div>
                  {d.implications.map((imp, j) => (
                    <div key={j} className="text-xs text-text-tertiary ml-2">- {imp}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ThreatsView({
  threats,
  expandedItems,
  toggleItem,
}: {
  threats: Threat[];
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {threats.map((t, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => toggleItem(`threat-${i}`)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
          >
            {expandedItems.has(`threat-${i}`) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <AlertTriangle size={14} className={
              t.impact === "high" ? "text-red-500" :
              t.impact === "medium" ? "text-amber-500" : "text-text-tertiary"
            } />
            <span className="text-sm font-medium text-text-primary flex-1">{t.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              t.impact === "high" ? "bg-red-100 text-red-700" :
              t.impact === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"
            }`}>
              {t.impact}
            </span>
          </button>
          {expandedItems.has(`threat-${i}`) && (
            <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
              <p className="text-xs text-text-tertiary uppercase tracking-wider">{t.category}</p>
              <p className="text-sm text-text-secondary">{t.description}</p>
              <p className="text-sm text-text-secondary"><strong>Mitigation:</strong> {t.mitigation}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FutureWorkView({
  items,
  expandedItems,
  toggleItem,
}: {
  items: FutureWorkItem[];
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((fw, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => toggleItem(`fw-${i}`)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
          >
            {expandedItems.has(`fw-${i}`) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Target size={14} className="text-brand" />
            <span className="text-sm font-medium text-text-primary flex-1">{fw.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              fw.priority === "high" ? "bg-emerald-100 text-emerald-700" :
              fw.priority === "medium" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
            }`}>
              {fw.priority}
            </span>
          </button>
          {expandedItems.has(`fw-${i}`) && (
            <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
              <p className="text-sm text-text-secondary">{fw.rationale}</p>
              <p className="text-sm text-text-secondary"><strong>Expected Impact:</strong> {fw.expectedImpact}</p>
              {fw.missingEvidence.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Missing Evidence</div>
                  {fw.missingEvidence.map((me, j) => (
                    <div key={j} className="text-xs text-text-tertiary ml-2">- {me}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecommendationsView({
  recommendations,
  expandedItems,
  toggleItem,
}: {
  recommendations: Recommendation[];
  expandedItems: Set<string>;
  toggleItem: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {recommendations.map((r, i) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => toggleItem(`rec-${i}`)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
          >
            {expandedItems.has(`rec-${i}`) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <ArrowRight size={14} className="text-brand" />
            <span className="text-sm font-medium text-text-primary flex-1">{r.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              r.priority === "high" ? "bg-emerald-100 text-emerald-700" :
              r.priority === "medium" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
            }`}>
              {r.priority}
            </span>
          </button>
          {expandedItems.has(`rec-${i}`) && (
            <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
              <p className="text-sm text-text-secondary">{r.description}</p>
              <p className="text-sm text-text-secondary"><strong>Expected Impact:</strong> {r.expectedImpact}</p>
              <p className="text-xs text-text-tertiary">Confidence: {Math.round(r.confidence * 100)}%</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EvidenceView({ findings }: { findings: Finding[] }) {
  const allEvidence = findings.flatMap((f) => f.evidence.map((e) => ({ ...e, findingTitle: f.title })));

  return (
    <div className="space-y-3">
      {allEvidence.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">No evidence available. Run more benchmarks.</p>
      ) : (
        allEvidence.map((e, i) => (
          <div key={i} className="rounded-lg border border-border bg-bg/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical size={12} className="text-brand" />
              <span className="text-xs font-medium text-text-primary">{e.findingTitle}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-text-tertiary">Metric:</span>
                <span className="ml-1 text-text-primary">{e.metric}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Improvement:</span>
                <span className="ml-1 text-text-primary">{e.improvementPct > 0 ? "+" : ""}{e.improvementPct.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-text-tertiary">p-value:</span>
                <span className="ml-1 text-text-primary">{e.pValue < 0.001 ? "< 0.001" : e.pValue.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Effect:</span>
                <span className="ml-1 text-text-primary">{e.effectMagnitude}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Configs:</span>
                <span className="ml-1 text-text-primary">{e.configs.join(" vs ")}</span>
              </div>
              <div>
                <span className="text-text-tertiary">CI:</span>
                <span className="ml-1 text-text-primary">[{(e.confidenceInterval[0] * 100).toFixed(1)}%, {(e.confidenceInterval[1] * 100).toFixed(1)}%]</span>
              </div>
            </div>
            <p className="text-xs text-text-tertiary mt-2 italic">{e.reasoning}</p>
          </div>
        ))
      )}
    </div>
  );
}
