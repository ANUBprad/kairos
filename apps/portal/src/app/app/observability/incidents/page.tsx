'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kairos/ui/card';
import { Badge } from '@kairos/ui/badge';
import { Button } from '@kairos/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@kairos/ui/table';
import { Plus } from 'lucide-react';
import { listIncidents, incidentStats } from '@/lib/actions/incidents';
import { CreateIncidentDialog } from '@/components/observability/create-incident-dialog';
import Link from 'next/link';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [i, s] = await Promise.all([
        listIncidents(),
        incidentStats(30),
      ]);
      setIncidents(i);
      setStats(s);
    } catch (e) {
      console.error('Failed to load incidents', e);
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-bold tracking-tight">Incident Center</h1>
          <p className="text-muted-foreground">Track and manage production incidents</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Incident
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.open ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.avgResolutionHours ?? 0).toFixed(1)}h
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats?.bySeverity?.find((s: any) => s.severity === 'CRITICAL')?._count ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incidents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No incidents recorded
                  </TableCell>
                </TableRow>
              ) : (
                incidents.map((inc) => (
                  <TableRow key={inc.id}>
                    <TableCell>
                      <Link href={`/app/observability/incidents/${inc.id}`} className="font-medium hover:underline">
                        {inc.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        inc.severity === 'FATAL' || inc.severity === 'CRITICAL' ? 'destructive' :
                        inc.severity === 'MAJOR' ? 'default' : 'secondary'
                      }>
                        {inc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        inc.status === 'RESOLVED' || inc.status === 'CLOSED' ? 'default' :
                        inc.status === 'OPEN' ? 'destructive' : 'secondary'
                      }>
                        {inc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inc.owner?.name ?? 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(inc.startedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {inc.resolvedAt
                        ? `${((new Date(inc.resolvedAt).getTime() - new Date(inc.startedAt).getTime()) / (1000 * 60 * 60)).toFixed(1)}h`
                        : 'Ongoing'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateIncidentDialog open={showCreate} onOpenChange={setShowCreate} onCreated={loadData} />
    </div>
  );
}
