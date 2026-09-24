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
import { APP_NAV } from "@/lib/app-nav";

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

const shortcutsRef = new Map<string, () => void>();

const INITIAL_STATE = {
  project: null,
  experiments: [],
  breadcrumbs: [],
};

// Breadcrumbs are derived from the single app-nav source: exact page match
// renders its section + label, then the deepest prefix match covers workspace
// subroutes (a KB workspace or an observability page) without a second list.
const NAV_ITEMS_WITH_SECTION = APP_NAV.flatMap((section) =>
  section.items.map((item) => ({ section: section.label, href: item.href, label: item.label })),
);

function deriveBreadcrumbs(pathname: string | null): BreadcrumbItem[] {
  if (!pathname) return [];
  const all = NAV_ITEMS_WITH_SECTION;
  const exact = all.find((i) => i.href === pathname);
  if (exact) {
    return exact.href === "/app"
      ? [{ label: exact.label }]
      : [{ label: exact.section }, { label: exact.label }];
  }
  const nested = all
    .filter((i) => i.href !== "/app" && pathname.startsWith(i.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (nested) return [{ label: nested.section }, { label: nested.label }];
  return [{ label: pathname.split("/").pop() || "Page" }];
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const pageBreadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    return deriveBreadcrumbs(pathname);
  }, [pathname]);

  const [project, setProject] = useState<Project | null>(INITIAL_STATE.project);
  const [experiments, setExperiments] = useState<Experiment[]>(INITIAL_STATE.experiments);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>(pageBreadcrumbs);

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