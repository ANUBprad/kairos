"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export interface Project {
  id: string;
  name: string;
  knowledgeBaseCount: number;
}

export interface Experiment {
  id: string;
  name: string;
  status: "running" | "completed" | "failed" | "queued";
  createdAt: string;
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface ActivityItem {
  id: string;
  type: "experiment" | "upload" | "evaluation" | "chat";
  title: string;
  timestamp: string;
  href?: string;
}

interface WorkspaceState {
  project: Project | null;
  experiments: Experiment[];
  selectedExperiment: Experiment | null;
  breadcrumbs: BreadcrumbItem[];
  recentActivity: ActivityItem[];
  sidebarCollapsed: boolean;
  recentSearches: string[];
  preferredMetric: string;
}

interface WorkspaceContextType extends WorkspaceState {
  setProject: (project: Project | null) => void;
  setExperiments: (experiments: Experiment[]) => void;
  selectExperiment: (experiment: Experiment | null) => void;
  setBreadcrumbs: (items: BreadcrumbItem[]) => void;
  addActivity: (item: ActivityItem) => void;
  toggleSidebar: () => void;
  registerShortcut: (key: string, handler: () => void) => void;
  unregisterShortcut: (key: string) => void;
  addRecentSearch: (term: string) => void;
  setPreferredMetric: (metric: string) => void;
  clearWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

const STORAGE_PREFIX = "kairos_workspace_";
const MAX_RECENT = 20;
const DEBOUNCE_MS = 300;

function getStorageValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setStorageValue(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // quota exceeded or private browsing — silently ignore
  }
}

function useLocalStorageState<T>(
  key: string,
  fallback: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => getStorageValue(key, fallback));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStorageValue(key, state);
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [key, state]);

  return [state, setState];
}

const PAGE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  "/app": [{ label: "Overview" }],
  "/app/research": [{ label: "Research" }, { label: "Dashboard" }],
  "/app/copilot": [{ label: "Research" }, { label: "AI Copilot" }],
  "/app/lineage": [{ label: "Research" }, { label: "Experiment Lineage" }],
  "/app/planner": [{ label: "Research" }, { label: "Experiment Planner" }],
  "/app/knowledge-bases": [{ label: "Build" }, { label: "Documents" }],
  "/app/chunking-studio": [{ label: "Build" }, { label: "Chunking Studio" }],
  "/app/retrieval-lab": [{ label: "Evaluate" }, { label: "Retrieval Lab" }],
  "/app/advanced-retrieval": [
    { label: "Evaluate" },
    { label: "Advanced Retrieval" },
  ],
  "/app/evaluation": [{ label: "Evaluate" }, { label: "Evaluation" }],
  "/app/rag-chat": [{ label: "Explain" }, { label: "RAG Chat" }],
  "/app/architecture": [{ label: "Learn" }, { label: "Architecture" }],
  "/app/project-guide": [{ label: "Learn" }, { label: "Project Guide" }],
  "/app/settings": [{ label: "System" }, { label: "Configuration" }],
  "/app/notebook": [{ label: "Research" }, { label: "Notebook" }],
  "/app/benchmark-explorer": [
    { label: "Evaluate" },
    { label: "Benchmark Explorer" },
  ],
  "/app/experiment-builder": [
    { label: "Build" },
    { label: "Experiment Builder" },
  ],
  "/app/publication": [
    { label: "Research" },
    { label: "Publication Mode" },
  ],
  "/app/experiments": [{ label: "Evaluate" }, { label: "Experiments" }],
};

const shortcutsRef = new Map<string, () => void>();

const INITIAL_STATE = {
  project: null,
  experiments: [],
  breadcrumbs: [],
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const [project, setProject] = useState<Project | null>(INITIAL_STATE.project);
  const [experiments, setExperiments] = useState<Experiment[]>(INITIAL_STATE.experiments);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(INITIAL_STATE.breadcrumbs);

  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorageState<boolean>("sidebarCollapsed", false);
  const [recentActivity, setRecentActivity] = useLocalStorageState<ActivityItem[]>("recentActivity", []);
  const [selectedExperiment, setSelectedExperiment] = useLocalStorageState<Experiment | null>("selectedExperiment", null);
  const [recentSearches, setRecentSearches] = useLocalStorageState<string[]>("recentSearches", []);
  const [preferredMetric, setPreferredMetric] = useLocalStorageState<string>("preferredMetric", "f1");

  const selectExperiment = useCallback((experiment: Experiment | null) => {
    setSelectedExperiment(experiment);
  }, [setSelectedExperiment]);

  const addActivity = useCallback((item: ActivityItem) => {
    setRecentActivity((prev) => [item, ...prev].slice(0, MAX_RECENT));
  }, [setRecentActivity]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, [setSidebarCollapsed]);

  const addRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const trimmed = term.trim();
      if (!trimmed) return prev;
      const filtered = prev.filter((s) => s !== trimmed);
      return [trimmed, ...filtered].slice(0, MAX_RECENT);
    });
  }, [setRecentSearches]);

  const clearWorkspace = useCallback(() => {
    setProject(INITIAL_STATE.project);
    setExperiments(INITIAL_STATE.experiments);
    setSelectedExperiment(null);
    setBreadcrumbs(INITIAL_STATE.breadcrumbs);
    setRecentActivity([]);
    setSidebarCollapsed(false);
    setRecentSearches([]);
    setPreferredMetric("f1");
  }, [
    setProject,
    setExperiments,
    setSelectedExperiment,
    setBreadcrumbs,
    setRecentActivity,
    setSidebarCollapsed,
    setRecentSearches,
    setPreferredMetric,
  ]);

  const registerShortcut = useCallback((key: string, handler: () => void) => {
    shortcutsRef.set(key, handler);
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    shortcutsRef.delete(key);
  }, []);

  useEffect(() => {
    const crumbs = PAGE_BREADCRUMBS[pathname] || [
      { label: pathname.split("/").pop() || "Page" },
    ];
    setBreadcrumbs(crumbs);
  }, [pathname, setBreadcrumbs]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "k"
      ) {
        e.preventDefault();
        const handler = shortcutsRef.get("command-palette");
        if (handler) handler();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={useMemo(() => ({
        project,
        experiments,
        selectedExperiment,
        breadcrumbs,
        recentActivity,
        sidebarCollapsed,
        recentSearches,
        preferredMetric,
        setProject,
        setExperiments,
        selectExperiment,
        setBreadcrumbs,
        addActivity,
        toggleSidebar,
        registerShortcut,
        unregisterShortcut,
        addRecentSearch,
        setPreferredMetric,
        clearWorkspace,
      }), [
        project, experiments, selectedExperiment, breadcrumbs, recentActivity,
        sidebarCollapsed, recentSearches, preferredMetric,
        setProject, setExperiments, selectExperiment, setBreadcrumbs,
        addActivity, toggleSidebar, registerShortcut, unregisterShortcut,
        addRecentSearch, setPreferredMetric, clearWorkspace,
      ])}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}