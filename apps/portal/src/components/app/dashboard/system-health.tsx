"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Database,
  Server,
  Brain,
  Cpu,
  HardDrive,
  List,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ServiceStatus {
  name: string;
  status: "up" | "down" | "degraded" | "unknown";
  latencyMs?: number;
  icon: LucideIcon;
}

interface HealthResponse {
  status: string;
  checks: Record<string, { status: string; latencyMs?: number }>;
}

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  up: { dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  healthy: { dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  degraded: { dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  down: { dot: "bg-error", text: "text-error", bg: "bg-error/10" },
  unhealthy: { dot: "bg-error", text: "text-error", bg: "bg-error/10" },
  unknown: { dot: "bg-text-tertiary", text: "text-text-tertiary", bg: "bg-surface-hover" },
};

const FALLBACK_SERVICES: ServiceStatus[] = [
  { name: "Gateway", status: "unknown", icon: Server },
  { name: "Database", status: "unknown", icon: Database },
  { name: "Intelligence", status: "unknown", icon: Brain },
  { name: "Embedding", status: "unknown", icon: Cpu },
  { name: "Storage", status: "unknown", icon: HardDrive },
  { name: "Queue", status: "unknown", icon: List },
];

function ServiceRow({ service }: { service: ServiceStatus }) {
  const styles = STATUS_STYLES[service.status] || STATUS_STYLES.unknown;
  const Icon = service.icon;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)]", styles.bg)}>
          <Icon size={13} className={styles.text} />
        </div>
        <span className="text-sm font-medium text-text-primary">{service.name}</span>
      </div>
      <div className="flex items-center gap-2">
        {service.latencyMs !== undefined && (
          <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
            {service.latencyMs}ms
          </span>
        )}
        <div className={cn("h-2 w-2 rounded-full", styles.dot)} />
      </div>
    </div>
  );
}

interface SystemHealthProps {
  className?: string;
}

function SystemHealth({ className }: SystemHealthProps) {
  const [services, setServices] = useState<ServiceStatus[]>(FALLBACK_SERVICES);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health", { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error("Health check failed");
      const data: HealthResponse = await res.json();

      const updated = FALLBACK_SERVICES.map((svc) => {
        const key = Object.keys(data.checks).find(
          (k) => k.toLowerCase().includes(svc.name.toLowerCase().split(" ")[0])
        );
        const check = key ? data.checks[key] : undefined;
        const rawStatus = check?.status || data.status || "unknown";
        const normalizedStatus: ServiceStatus["status"] =
          rawStatus === "healthy" ? "up" :
          rawStatus === "unhealthy" ? "down" :
          rawStatus as ServiceStatus["status"];
        return {
          ...svc,
          status: normalizedStatus,
          latencyMs: check?.latencyMs,
        };
      });

      setServices(updated);
      setLastChecked(new Date());
    } catch {
      setServices(FALLBACK_SERVICES.map((s) => ({ ...s, status: "unknown" as const })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const healthyCount = services.filter((s) => s.status === "up").length;
  const totalCount = services.length;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 size={14} className="animate-spin text-text-tertiary" />
          ) : healthyCount === totalCount ? (
            <CheckCircle2 size={14} className="text-success" />
          ) : healthyCount > totalCount / 2 ? (
            <AlertTriangle size={14} className="text-warning" />
          ) : (
            <XCircle size={14} className="text-error" />
          )}
          <span className="text-xs font-medium text-text-secondary">
            {healthyCount}/{totalCount} services healthy
          </span>
        </div>
        {lastChecked && (
          <span className="text-[10px] text-text-tertiary">
            {lastChecked.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
      {services.map((svc) => (
        <ServiceRow key={svc.name} service={svc} />
      ))}
    </div>
  );
}

export { SystemHealth };
export type { ServiceStatus, SystemHealthProps };
