'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { telemetryConfig, updateConfig, archiveTraces, cleanupAlerts, storageStats } from '@/lib/actions/storage';
import { Archive, Trash2 } from 'lucide-react';

export default function StoragePage() {
  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [c, s] = await Promise.all([
          telemetryConfig(),
          storageStats(),
        ]);
        setConfig(c);
        setStats(s);
      } catch (e) {
        console.error('Failed to load storage config', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleArchive() {
    setArchiving(true);
    try {
      await archiveTraces();
      const s = await storageStats();
      setStats(s);
    } finally {
      setArchiving(false);
    }
  }

  async function handleCleanup() {
    setCleaning(true);
    try {
      await cleanupAlerts(90);
      const s = await storageStats();
      setStats(s);
    } finally {
      setCleaning(false);
    }
  }

  async function handleSaveConfig() {
    if (!config) return;
    await updateConfig({
      samplingRate: config.samplingRate,
      retentionDays: config.retentionDays,
      enableTraces: config.enableTraces,
      enableMetrics: config.enableMetrics,
      enableLogs: config.enableLogs,
      maxSpansPerTrace: config.maxSpansPerTrace,
      maxEventsPerTrace: config.maxEventsPerTrace,
      compressOldTraces: config.compressOldTraces,
      archiveAfterDays: config.archiveAfterDays,
    });
  }

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
        <h1 className="text-3xl font-bold tracking-tight">Storage Management</h1>
        <p className="text-muted-foreground">Configure retention, compression, and cleanup policies</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Traces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.traces ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Spans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.spans ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.events ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.totalRecords ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Telemetry Config</CardTitle>
            <CardDescription>Configure data collection and retention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable Traces</Label>
              <Switch
                checked={config?.enableTraces ?? true}
                onCheckedChange={(v: boolean) => setConfig({ ...config, enableTraces: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable Metrics</Label>
              <Switch
                checked={config?.enableMetrics ?? true}
                onCheckedChange={(v: boolean) => setConfig({ ...config, enableMetrics: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enable Logs</Label>
              <Switch
                checked={config?.enableLogs ?? true}
                onCheckedChange={(v: boolean) => setConfig({ ...config, enableLogs: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Compress Old Traces</Label>
              <Switch
                checked={config?.compressOldTraces ?? true}
                onCheckedChange={(v: boolean) => setConfig({ ...config, compressOldTraces: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sampling Rate</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={config?.samplingRate ?? 1}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, samplingRate: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Retention (days)</Label>
                <Input
                  type="number"
                  value={config?.retentionDays ?? 90}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, retentionDays: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Spans/Trace</Label>
                <Input
                  type="number"
                  value={config?.maxSpansPerTrace ?? 100}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, maxSpansPerTrace: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Archive After (days)</Label>
                <Input
                  type="number"
                  value={config?.archiveAfterDays ?? 30}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, archiveAfterDays: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <Button onClick={handleSaveConfig}>Save Configuration</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cleanup Actions</CardTitle>
            <CardDescription>Manual data management operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Archive className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Archive Old Traces</p>
                  <p className="text-sm text-muted-foreground">
                    Move traces older than configured threshold to cold storage
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleArchive} disabled={archiving}>
                {archiving ? 'Archiving...' : 'Archive'}
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Cleanup Old Alerts</p>
                  <p className="text-sm text-muted-foreground">
                    Remove resolved alerts and drift detections older than 90 days
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleCleanup} disabled={cleaning}>
                {cleaning ? 'Cleaning...' : 'Cleanup'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
