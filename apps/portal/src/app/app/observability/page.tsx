'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { traceStats } from '@/lib/actions/observability';
import { costSummary } from '@/lib/actions/cost';
import { alertStats } from '@/lib/actions/alerts';
import { incidentStats } from '@/lib/actions/incidents';
import { driftStats } from '@/lib/actions/drift';
import { providerHealthSummary } from '@/lib/actions/provider-health';
import Link from 'next/link';

// A metric that was never collected must stay visibly "Not yet collected"
// rather than be read as a measured zero.
function metric(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString() : 'Not yet collected';
}

export default function ObservabilityDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [incidents, setIncidents] = useState<any>(null);
  const [drift, setDrift] = useState<any>(null);
  const [providers, setProviders] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, c, a, i, d, p] = await Promise.all([
          traceStats(7),
          costSummary(7),
          alertStats(7),
          incidentStats(7),
          driftStats(7),
          providerHealthSummary(7),
        ]);
        setStats(s);
        setCosts(c);
        setAlerts(a);
        setIncidents(i);
        setDrift(d);
        setProviders(p);
      } catch (e) {
        console.error('Failed to load observability stats', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand" />
      </div>
    );
  }

  const cards = [
    {
      href: '/app/observability/traces',
      label: 'Traces (7d)',
      icon: Activity,
      value: metric(stats?.totalTraces),
      sub: stats
        ? typeof stats.errorRate === 'number'
          ? `${stats.errorRate.toFixed(1)}% error rate`
          : 'Not yet collected'
        : 'Not yet collected',
    },
    {
      href: '/app/observability/costs',
      label: 'Cost (7d)',
      icon: DollarSign,
      value: costs ? `$${(costs.totalCost ?? 0).toFixed(2)}` : 'Not yet collected',
      sub: costs
        ? `${(costs.totalTokens ?? 0).toLocaleString()} tokens`
        : 'Not yet collected',
    },
    {
      href: '/app/observability/alerts',
      label: 'Active Alerts',
      icon: AlertTriangle,
      value: metric(alerts?.firingEvents),
      sub: alerts
        ? `${alerts.totalRules ?? 0} rules configured`
        : 'Not yet collected',
    },
    {
      href: '/app/observability/incidents',
      label: 'Open Incidents',
      icon: Clock,
      value: metric(incidents?.open),
      sub: incidents
        ? `${incidents.total ?? 0} total this month`
        : 'Not yet collected',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-colors hover:border-border-hover"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-text-tertiary">{card.label}</p>
                <Icon size={15} className="text-text-tertiary" />
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">{card.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4" aria-label="Provider health">
          <h2 className="text-sm font-semibold text-text-primary">Provider Health</h2>
          <p className="text-xs text-text-tertiary">7-day provider performance</p>
          {providers?.byProvider && Object.keys(providers.byProvider).length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {Object.entries(providers.byProvider).map(([name, data]: [string, any]) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{name}</Badge>
                    <span className="text-sm text-text-secondary">
                      {data.totalRequests.toLocaleString()} requests
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-primary">{data.uptime.toFixed(1)}% uptime</span>
                    <span className="text-text-tertiary">{data.avgLatencyMs.toFixed(0)}ms avg</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-text-tertiary">Not yet collected</p>
          )}
        </section>

        <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-4" aria-label="Drift alerts">
          <h2 className="text-sm font-semibold text-text-primary">Drift Alerts</h2>
          <p className="text-xs text-text-tertiary">Quality and performance drift detection</p>
          {drift && (drift.open ?? 0) > 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="destructive">{drift.open} open</Badge>
              <span className="text-sm text-text-secondary">{drift.total ?? 0} total detected</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm text-text-tertiary">
              {drift ? (
                <>
                  <CheckCircle size={14} className="text-success" />
                  No active drift alerts
                </>
              ) : (
                'Not yet collected'
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}