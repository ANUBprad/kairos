'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { listTraces } from '@/lib/actions/observability';
import { Eye } from 'lucide-react';
import Link from 'next/link';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await listTraces({
          pageSize: 50,
          sortBy: 'startTime',
          sortOrder: 'desc',
        });
        const sessionMap = new Map<string, any[]>();
        for (const trace of result.traces) {
          const userId = trace.userId ?? 'anonymous';
          if (!sessionMap.has(userId)) sessionMap.set(userId, []);
          sessionMap.get(userId)!.push(trace);
        }
        const sessionList = Array.from(sessionMap.entries()).map(([userId, traces]) => ({
          userId,
          traces,
          requestCount: traces.length,
          firstRequest: traces[traces.length - 1]?.startTime,
          lastRequest: traces[0]?.startTime,
          totalCost: traces.reduce((sum: number, t: any) => sum + (t.cost ?? 0), 0),
          errorCount: traces.filter((t: any) => t.status === 'ERROR').length,
        }));
        setSessions(sessionList);
      } catch (e) {
        console.error('Failed to load sessions', e);
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
        <h1 className="text-3xl font-bold tracking-tight">Session Replay</h1>
        <p className="text-muted-foreground">
          Replay and inspect any request with full context
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>First Request</TableHead>
                <TableHead>Last Request</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No sessions recorded
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.userId}>
                    <TableCell className="font-medium">{session.userId}</TableCell>
                    <TableCell>{session.requestCount}</TableCell>
                    <TableCell>
                      {session.errorCount > 0 ? (
                        <Badge variant="destructive">{session.errorCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>${session.totalCost.toFixed(4)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.firstRequest ? new Date(session.firstRequest).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.lastRequest ? new Date(session.lastRequest).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Link href={`/app/observability/traces?search=${session.userId}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" /> View Traces
                        </Button>
                      </Link>
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
