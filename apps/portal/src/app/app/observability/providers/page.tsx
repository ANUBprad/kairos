'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kairos/ui/card';
import { Badge } from '@kairos/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@kairos/ui/table';
import { providerHealthSummary, providerErrorList } from '@/lib/actions/provider-health';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kairos/ui/tabs';

export default function ProvidersPage() {
  const [health, setHealth] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [h, e] = await Promise.all([
          providerHealthSummary(7),
          providerErrorList(7),
        ]);
        setHealth(h);
        setErrors(e);
      } catch (err) {
        console.error('Failed to load provider health', err);
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
        <h1 className="text-3xl font-bold tracking-tight">Provider Health</h1>
        <p className="text-muted-foreground">
          Monitor provider availability, latency, and errors
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {Object.entries(health?.byProvider ?? {}).map(([name, data]: [string, any]) => (
            <Card key={name}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{name}</CardTitle>
                  <Badge variant={data.uptime >= 99.9 ? 'default' : data.uptime >= 99 ? 'secondary' : 'destructive'}>
                    {data.uptime >= 99.9 ? 'Healthy' : data.uptime >= 99 ? 'Degraded' : 'Unhealthy'}
                  </Badge>
                </div>
                <CardDescription>
                  {data.totalRequests.toLocaleString()} requests in 7 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Uptime</p>
                    <p className="text-2xl font-bold">{data.uptime.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Latency</p>
                    <p className="text-2xl font-bold">{data.avgLatencyMs.toFixed(0)}ms</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold">
                      {data.totalRequests > 0
                        ? ((data.successCount / data.totalRequests) * 100).toFixed(1)
                        : '100'}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cost</p>
                    <p className="text-2xl font-bold">${data.totalCost.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {Object.keys(health?.byProvider ?? {}).length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No provider data available yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Provider Errors (7d)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Last Error</TableHead>
                    <TableHead>Error Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No errors recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    errors.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.provider}</TableCell>
                        <TableCell>{e.model}</TableCell>
                        <TableCell>{e.errorCount}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{e.lastError ?? '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.lastErrorAt ? new Date(e.lastErrorAt).toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
