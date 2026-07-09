import type { MemorySnapshot, ConversationConstraints, CopilotIntent } from "./types";

const MEMORY_KEY = "kairos-copilot-memory";

function getDefaults(): MemorySnapshot {
  return {
    currentProject: null,
    currentBenchmark: null,
    currentExperiment: null,
    previousQuestions: [],
    currentObjective: null,
    currentDataset: null,
    constraints: {
      budgetMs: null,
      budgetTokens: null,
      maxExperiments: null,
      priorityMetric: null,
      focusArea: null,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function loadMemory(): MemorySnapshot {
  if (typeof window === "undefined") return getDefaults();

  try {
    const stored = localStorage.getItem(MEMORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as MemorySnapshot;
      return {
        ...getDefaults(),
        ...parsed,
        lastUpdated: new Date().toISOString(),
      };
    }
  } catch {
    // Ignore parse errors
  }

  return getDefaults();
}

export function saveMemory(snapshot: MemorySnapshot): void {
  if (typeof window === "undefined") return;

  try {
    const toSave = {
      ...snapshot,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(MEMORY_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore storage errors
  }
}

export function updateMemory(
  current: MemorySnapshot,
  updates: Partial<MemorySnapshot>
): MemorySnapshot {
  const updated = { ...current, ...updates };
  updated.lastUpdated = new Date().toISOString();
  saveMemory(updated);
  return updated;
}

export function addQuestionToMemory(
  memory: MemorySnapshot,
  question: string,
  _intent: CopilotIntent
): MemorySnapshot {
  const previousQuestions = [...memory.previousQuestions, question].slice(-20);

  const updated = updateMemory(memory, { previousQuestions });
  return updated;
}

export function setConstraint(
  memory: MemorySnapshot,
  constraints: Partial<ConversationConstraints>
): MemorySnapshot {
  const updatedConstraints = { ...memory.constraints, ...constraints };
  return updateMemory(memory, { constraints: updatedConstraints });
}

export function detectConstraintsFromQuery(query: string): Partial<ConversationConstraints> {
  const constraints: Partial<ConversationConstraints> = {};

  const budgetMatch = query.match(/\$(\d+)/);
  if (budgetMatch) {
    constraints.budgetTokens = parseInt(budgetMatch[1]) * 100000;
  }

  const timeMatch = query.match(/(\d+)\s*(?:minutes?|mins?)/i);
  if (timeMatch) {
    constraints.budgetMs = parseInt(timeMatch[1]) * 60 * 1000;
  }

  const hourMatch = query.match(/(\d+)\s*(?:hours?|hrs?)/i);
  if (hourMatch) {
    constraints.budgetMs = parseInt(hourMatch[1]) * 60 * 60 * 1000;
  }

  const experimentMatch = query.match(/(?:only|just)\s+(\d+)\s*(?:experiments?|tests?|runs?)/i);
  if (experimentMatch) {
    constraints.maxExperiments = parseInt(experimentMatch[1]);
  }

  if (/latency|speed|fast/i.test(query)) {
    constraints.priorityMetric = "latency";
  } else if (/accuracy|recall|precision/i.test(query)) {
    constraints.priorityMetric = "accuracy";
  }

  if (/publish|paper|research/i.test(query)) {
    constraints.focusArea = "research";
  } else if (/production|deploy/i.test(query)) {
    constraints.focusArea = "production";
  }

  return constraints;
}

export function getMemorySummary(memory: MemorySnapshot): string {
  const parts: string[] = [];

  if (memory.currentProject) parts.push(`Project: ${memory.currentProject}`);
  if (memory.currentDataset) parts.push(`Dataset: ${memory.currentDataset}`);
  if (memory.currentObjective) parts.push(`Objective: ${memory.currentObjective}`);

  const activeConstraints = Object.entries(memory.constraints)
    .filter(([_, v]) => v !== null)
    .map(([k, v]) => `${k}=${v}`);

  if (activeConstraints.length > 0) {
    parts.push(`Constraints: ${activeConstraints.join(", ")}`);
  }

  if (memory.previousQuestions.length > 0) {
    parts.push(`${memory.previousQuestions.length} previous questions`);
  }

  return parts.length > 0 ? parts.join(" | ") : "Fresh session";
}

export function clearMemory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MEMORY_KEY);
}

export function getRecentObjectives(memory: MemorySnapshot): string[] {
  const objectives: string[] = [];

  if (memory.currentObjective) {
    objectives.push(memory.currentObjective);
  }

  for (const question of memory.previousQuestions.slice(-5).reverse()) {
    if (question.length > 10 && question.length < 100) {
      objectives.push(question);
    }
  }

  return [...new Set(objectives)].slice(0, 5);
}
