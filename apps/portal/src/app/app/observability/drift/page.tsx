'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kairos/ui/card';
import { Badge } from '@kairos/ui/badge';
import { Button } from '@kairos/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@kairos/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kairos/ui/tabs';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { listDriftAlerts, acknowledgeDriftAlert, resolveDriftAlert, ignoreDriftAlert, driftStats, runDriftDetection } from '@/lib/actions/drift';

export default function DriftPage() {
  const [drifts, setDrifts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [d, s] = await Promise.all([
        listDriftAlerts(),
        driftStats(30),
      ]);
      setDrifts(d);
      setStats(s);
    } catch (e) {
      console.error('Failed to load drift data', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDetect() {
    setDetecting(true);
    try {
      await runDriftDetection();
      await loadData();
    } finally {
      setDetecting(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Drift Detection</h1>
          <p className="text-muted-foreground">Monitor for quality and performance drift</p>
        </div>
        <Button onClick={handleDetect} disabled={detecting}>
          {detecting ? 'Detecting...' : 'Run Detection'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Alerts (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.open ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alert Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byType?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drift Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Baseline</TableHead>
                <TableHead>Deviation</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No drift alerts detected
                  </TableCell>
                </TableRow>
              ) : (
                drifts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{d.metric}</TableCell>
                    <TableCell>{d.currentValue.toFixed(3)}</TableCell>
                    <TableCell>{d.baselineValue.toFixed(3)}</TableCell>
                    <TableCell className={d.deviationPercent > 0 ? 'text-red-500' : 'text-green-500'}>
                      {d.deviationPercent > 0 ? '+' : ''}{d.deviationPercent.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        d.severity === 'CRITICAL' ? 'destructive' :
                        d.severity === 'ERROR' ? 'destructive' : 'default'
                      }>
                        {d.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        d.status === 'OPEN' ? 'destructive' :
                        d.status === 'RESOLVED' ? 'default' : 'secondary'
                      }>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {d.status === 'OPEN' && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => acknowledgeDriftAlert(d.id)}>
                            Ack
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => resolveDriftAlert(d.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => ignoreDriftAlert(d.id)}>
                            Ignore
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
