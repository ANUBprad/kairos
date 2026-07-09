import type {
  ResearchTimelineEvent,
  TimelineEventType,
  CopilotContext,
} from "./types";

interface TimelineInput {
  context: CopilotContext;
}

export function generateTimeline(input: TimelineInput): ResearchTimelineEvent[] {
  const { context } = input;
  const events: ResearchTimelineEvent[] = [];

  if (context.knowledgeBase) {
    events.push({
      id: "kb-1",
      type: "knowledge_base_created",
      title: "Knowledge Base Created",
      description: `${context.knowledgeBase.name} with ${context.knowledgeBase.documentCount} documents`,
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      metrics: null,
      significance: "high",
    });
  }

  for (const benchmark of context.benchmarkHistory.slice(0, 5)) {
    events.push({
      id: `bench-${benchmark.id}`,
      type: "benchmark_run",
      title: `Benchmark: ${benchmark.name}`,
      description: `${benchmark.datasetName} with ${benchmark.questionCount} questions`,
      timestamp: benchmark.createdAt,
      metrics: benchmark.metrics,
      significance: "high",
    });
  }

  if (context.researchScientist) {
    for (const finding of context.researchScientist.findings.slice(0, 3)) {
      events.push({
        id: `finding-${finding.title.slice(0, 20)}`,
        type: "finding_discovered",
        title: finding.title,
        description: `Confidence: ${(finding.confidence * 100).toFixed(0)}%`,
        timestamp: new Date().toISOString(),
        metrics: null,
        significance: finding.severity === "high" ? "high" : "medium",
      });
    }
  }

  if (context.experimentPlanner && context.experimentPlanner.topRecommendations.length > 0) {
    events.push({
      id: "planner-rec",
      type: "recommendation_made",
      title: "Planner Recommendation",
      description: context.experimentPlanner.topRecommendations[0].rationale,
      timestamp: new Date().toISOString(),
      metrics: null,
      significance: "medium",
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

export function getTimelineMilestone(events: ResearchTimelineEvent[]): {
  currentPhase: string;
  nextMilestone: string;
  progress: number;
} {
  const phaseOrder: TimelineEventType[] = [
    "knowledge_base_created",
    "documents_uploaded",
    "chunking_configured",
    "retrieval_tested",
    "benchmark_run",
    "experiment_completed",
    "finding_discovered",
    "recommendation_made",
    "milestone_reached",
  ];

  const completedTypes = new Set(events.map((e) => e.type));

  let currentPhaseIndex = 0;
  for (let i = 0; i < phaseOrder.length; i++) {
    if (completedTypes.has(phaseOrder[i])) {
      currentPhaseIndex = i;
    }
  }

  const phaseNames: Record<TimelineEventType, string> = {
    knowledge_base_created: "Knowledge Base Setup",
    documents_uploaded: "Document Upload",
    chunking_configured: "Chunking Configuration",
    retrieval_tested: "Retrieval Testing",
    benchmark_run: "Benchmark Execution",
    experiment_completed: "Experiment Completion",
    finding_discovered: "Discovery",
    recommendation_made: "Planning",
    milestone_reached: "Milestone",
  };

  const currentPhase = phaseNames[phaseOrder[currentPhaseIndex]];
  const nextMilestone = currentPhaseIndex < phaseOrder.length - 1
    ? phaseNames[phaseOrder[currentPhaseIndex + 1]]
    : "Research Complete";

  const progress = (currentPhaseIndex + 1) / phaseOrder.length;

  return {
    currentPhase,
    nextMilestone,
    progress,
  };
}

export function formatTimelineEvent(event: ResearchTimelineEvent): string {
  const date = new Date(event.timestamp);
  const timeStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `[${timeStr}] ${event.title}: ${event.description}`;
}

export function getTimelineSummary(events: ResearchTimelineEvent[]): string {
  if (events.length === 0) return "No research activity yet";

  const highSig = events.filter((e) => e.significance === "high").length;
  const recent = events.filter((e) => {
    const diff = Date.now() - new Date(e.timestamp).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return `${events.length} events total, ${highSig} significant, ${recent} this week`;
}
