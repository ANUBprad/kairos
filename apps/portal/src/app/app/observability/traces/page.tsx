'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kairos/ui/card';
import { Badge } from '@kairos/ui/badge';
import { Button } from '@kairos/ui/button';
import { Input } from '@kairos/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@kairos/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@kairos/ui/table';
import { Search, Filter, ChevronDown, Eye } from 'lucide-react';
import { listTraces, traceStats } from '@/lib/actions/observability';
import Link from 'next/link';

export default function TracesPage() {
  const [traces, setTraces] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTraces();
  }, [page, status, provider]);

  async function loadTraces() {
    setLoading(true);
    try {
      const result = await listTraces({
        page,
        pageSize: 20,
        search: search || undefined,
        status: status || undefined,
        provider: provider || undefined,
        sortBy: 'startTime',
        sortOrder: 'desc',
      });
      setTraces(result.traces);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load traces', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    setPage(1);
    loadTraces();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trace Explorer</h1>
          <p className="text-muted-foreground">Search and analyze request traces</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search traces..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="TIMEOUT">Timeout</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Providers</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="azure">Azure</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSearch}>Search</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Time</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading traces...
                  </TableCell>
                </TableRow>
              ) : traces.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No traces found
                  </TableCell>
                </TableRow>
              ) : (
                traces.map((trace) => (
                  <TableRow key={trace.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {trace.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        trace.status === 'OK' ? 'default' :
                        trace.status === 'ERROR' ? 'destructive' : 'secondary'
                      }>
                        {trace.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{trace.provider ?? '-'}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{trace.model ?? '-'}</TableCell>
                    <TableCell>{trace.durationMs ? `${trace.durationMs}ms` : '-'}</TableCell>
                    <TableCell>{trace.totalTokens?.toLocaleString() ?? '-'}</TableCell>
                    <TableCell>{trace.cost ? `$${trace.cost.toFixed(4)}` : '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(trace.startTime).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Link href={`/app/observability/traces/${trace.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} traces total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={traces.length < 20}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
