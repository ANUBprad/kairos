'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { traceStats } from '@/lib/actions/observability';
import { costSummary } from '@/lib/actions/cost';
import { alertStats } from '@/lib/actions/alerts';
import { incidentStats } from '@/lib/actions/incidents';
import { driftStats } from '@/lib/actions/drift';
import { providerHealthSummary } from '@/lib/actions/provider-health';
import Link from 'next/link';

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Observability</h1>
        <p className="text-muted-foreground">
          Real-time monitoring, tracing, and incident management
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/app/observability/traces">
          <Card className="hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Traces</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTraces ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.errorRate?.toFixed(1) ?? 0}% error rate
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/observability/costs">
          <Card className="hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cost (7d)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(costs?.totalCost ?? 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                {(costs?.totalTokens ?? 0).toLocaleString()} tokens
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/observability/alerts">
          <Card className="hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alerts?.firingEvents ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {alerts?.totalRules ?? 0} rules configured
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/app/observability/incidents">
          <Card className="hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{incidents?.open ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                {incidents?.total ?? 0} total this month
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider Health</CardTitle>
            <CardDescription>7-day provider performance</CardDescription>
          </CardHeader>
          <CardContent>
            {providers?.byProvider && Object.keys(providers.byProvider).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(providers.byProvider).map(([name, data]: [string, any]) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{name}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {data.totalRequests.toLocaleString()} requests
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {data.uptime.toFixed(1)}% uptime
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {data.avgLatencyMs.toFixed(0)}ms avg
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No provider data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drift Alerts</CardTitle>
            <CardDescription>Quality and performance drift detection</CardDescription>
          </CardHeader>
          <CardContent>
            {drift?.open ?? 0 > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">{drift?.open} open</Badge>
                  <span className="text-sm text-muted-foreground">
                    {drift?.total ?? 0} total detected
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">No active drift alerts</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
