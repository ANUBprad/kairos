'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kairos/ui/card';
import { Badge } from '@kairos/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@kairos/ui/table';
import { costSummary, costForecast, costAnomalies } from '@/lib/actions/cost';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kairos/ui/tabs';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

export default function CostsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [forecast, setForecast] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, f, a] = await Promise.all([
          costSummary(30),
          costForecast(),
          costAnomalies(),
        ]);
        setSummary(s);
        setForecast(f);
        setAnomalies(a);
      } catch (e) {
        console.error('Failed to load cost data', e);
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
        <h1 className="text-3xl font-bold tracking-tight">Cost Intelligence</h1>
        <p className="text-muted-foreground">Track, forecast, and optimize AI spending</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(summary?.totalCost ?? 0).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(forecast?.dailyAvg7 ?? 0).toFixed(2)}</div>
            <div className="flex items-center gap-1 text-xs">
              {(forecast?.trend ?? 0) > 0 ? (
                <TrendingUp className="h-3 w-3 text-red-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-500" />
              )}
              <span className={forecast?.trend > 0 ? 'text-red-500' : 'text-green-500'}>
                {Math.abs((forecast?.trend ?? 0) * 100).toFixed(1)}% trend
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">30-Day Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(forecast?.forecast30Days ?? 0).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary?.totalTokens ?? 0).toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="breakdown">
        <TabsList>
          <TabsTrigger value="breakdown">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
        </TabsList>

        <TabsContent value="breakdown" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>By Provider</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary?.byProvider ?? []).map((p: any) => (
                    <TableRow key={p.provider}>
                      <TableCell className="font-medium">{p.provider}</TableCell>
                      <TableCell>{Number(p._sum.requestCount ?? 0).toLocaleString()}</TableCell>
                      <TableCell>{Number(p._sum.totalTokens ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">${(p._sum.cost ?? 0).toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Model</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(summary?.byModel ?? []).map((m: any) => (
                    <TableRow key={m.model}>
                      <TableCell className="font-medium">{m.model}</TableCell>
                      <TableCell>{Number(m._sum.requestCount ?? 0).toLocaleString()}</TableCell>
                      <TableCell>{Number(m._sum.totalTokens ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">${(m._sum.cost ?? 0).toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anomalies">
          <Card>
            <CardHeader>
              <CardTitle>Cost Anomalies</CardTitle>
              <CardDescription>Unusual spending patterns detected</CardDescription>
            </CardHeader>
            <CardContent>
              {anomalies.length > 0 ? (
                <div className="space-y-3">
                  {anomalies.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium">
                          ${a.cost.toFixed(2)} on {new Date(a.date).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.deviation.toFixed(1)} standard deviations from mean
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No anomalies detected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
