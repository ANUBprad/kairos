'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { traceStats } from '@/lib/actions/observability';
import { costSummary } from '@/lib/actions/cost';
import { alertStats } from '@/lib/actions/alerts';
import { incidentStats } from '@/lib/actions/incidents';
import { providerHealthSummary } from '@/lib/actions/provider-health';

export default function LiveMetricsPage() {
  const [traces, setTraces] = useState<any>(null);
  const [costs, setCosts] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>(null);
  const [incidents, setIncidents] = useState<any>(null);
  const [providers, setProviders] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [t, c, a, i, p] = await Promise.all([
          traceStats(1),
          costSummary(1),
          alertStats(1),
          incidentStats(1),
          providerHealthSummary(1),
        ]);
        setTraces(t);
        setCosts(c);
        setAlerts(a);
        setIncidents(i);
        setProviders(p);
      } catch (e) {
        console.error('Failed to load live metrics', e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live Metrics</h1>
        <p className="text-muted-foreground">Real-time system health (auto-refreshes every 30s)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Requests (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{traces?.totalTraces ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {(traces?.errorRate ?? 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(traces?.avgDurationMs ?? 0).toFixed(0)}ms
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cost (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(costs?.totalCost ?? 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Firing Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {alerts?.firingEvents ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {incidents?.open ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(providers?.byProvider ?? {}).map(([name, data]: [string, any]) => (
              <div key={name} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${data.uptime >= 99.9 ? 'bg-green-500' : data.uptime >= 99 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="font-medium">{name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{data.uptime.toFixed(1)}%</span>
                  <span>{data.avgLatencyMs.toFixed(0)}ms</span>
                  <span>{data.totalRequests.toLocaleString()} reqs</span>
                </div>
              </div>
            ))}
            {Object.keys(providers?.byProvider ?? {}).length === 0 && (
              <p className="text-sm text-muted-foreground">No provider data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Usage (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Input Tokens</span>
                <span className="font-medium">{(costs?.inputTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Output Tokens</span>
                <span className="font-medium">{(costs?.outputTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tokens</span>
                <span className="font-medium">{(costs?.totalTokens ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Requests</span>
                <span className="font-medium">{(costs?.totalRequests ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Cost/Request</span>
                <span className="font-medium">${(costs?.avgCostPerRequest ?? 0).toFixed(4)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
