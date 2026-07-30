'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Bell, BellOff, CheckCircle } from 'lucide-react';
import { listRules, toggleRule, listAlertEvents, resolveAlert, acknowledgeAlert, alertStats } from '@/lib/actions/alerts';
import { CreateAlertRuleDialog } from '@/components/observability/create-alert-rule-dialog';

export default function AlertsPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [r, e, s] = await Promise.all([
        listRules(),
        listAlertEvents(),
        alertStats(7),
      ]);
      setRules(r);
      setEvents(e);
      setStats(s);
    } catch (e) {
      console.error('Failed to load alerts', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(ruleId: string, enabled: boolean) {
    await toggleRule(ruleId, enabled);
    loadData();
  }

  async function handleResolve(eventId: string) {
    await resolveAlert(eventId);
    loadData();
  }

  async function handleAcknowledge(eventId: string) {
    await acknowledgeAlert(eventId);
    loadData();
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
          <h1 className="text-3xl font-bold tracking-tight">Alerting</h1>
          <p className="text-muted-foreground">Configure and manage alert rules</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Rule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRules ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeRules ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Events (7d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalEvents ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Currently Firing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{stats?.firingEvents ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
          <TabsTrigger value="events">Alert Events</TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No alert rules configured
                      </TableCell>
                    </TableRow>
                  ) : (
                    rules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell>{rule.metric}</TableCell>
                        <TableCell>
                          {rule.operator} {rule.threshold} ({rule.windowMinutes}m)
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            rule.severity === 'CRITICAL' ? 'destructive' :
                            rule.severity === 'ERROR' ? 'destructive' :
                            rule.severity === 'WARNING' ? 'default' : 'secondary'
                          }>
                            {rule.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{rule._count.events}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(rule.id, !rule.enabled)}
                          >
                            {rule.enabled ? (
                              <Bell className="h-4 w-4 text-green-500" />
                            ) : (
                              <BellOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {rule.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fired At</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No alert events
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.rule.name}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{event.message}</TableCell>
                        <TableCell>{event.value.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            event.status === 'FIRING' ? 'destructive' :
                            event.status === 'RESOLVED' ? 'default' : 'secondary'
                          }>
                            {event.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(event.firedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {event.status === 'FIRING' && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleAcknowledge(event.id)}>
                                Ack
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleResolve(event.id)}>
                                <CheckCircle className="h-4 w-4" />
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
        </TabsContent>
      </Tabs>

      <CreateAlertRuleDialog open={showCreate} onOpenChange={setShowCreate} onCreated={loadData} />
    </div>
  );
}
