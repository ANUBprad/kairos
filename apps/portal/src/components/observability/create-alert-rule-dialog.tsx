'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createRule } from '@/lib/actions/alerts';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateAlertRuleDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [metric, setMetric] = useState('error_rate');
  const [operator, setOperator] = useState('>');
  const [threshold, setThreshold] = useState('');
  const [windowMinutes, setWindowMinutes] = useState('5');
  const [severity, setSeverity] = useState('WARNING');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name || !threshold) return;
    setLoading(true);
    try {
      await createRule({
        name,
        metric,
        operator,
        threshold: parseFloat(threshold),
        windowMinutes: parseInt(windowMinutes),
        severity: severity as any,
      });
      onCreated();
      onOpenChange(false);
      setName('');
      setThreshold('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Alert Rule</DialogTitle>
          <DialogDescription>Define a threshold-based alert rule</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="High error rate" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Metric</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="error_rate">Error Rate (%)</SelectItem>
                  <SelectItem value="avg_latency">Avg Latency (ms)</SelectItem>
                  <SelectItem value="total_cost">Total Cost ($)</SelectItem>
                  <SelectItem value="request_count">Request Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="ERROR">Error</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Operator</Label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=">">{'>'}</SelectItem>
                  <SelectItem value=">=">{'>='}</SelectItem>
                  <SelectItem value="<">{'<'}</SelectItem>
                  <SelectItem value="<=">{'<='}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Threshold</Label>
              <Input type="number" value={threshold} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setThreshold(e.target.value)} />
            </div>
            <div>
              <Label>Window (min)</Label>
              <Input type="number" value={windowMinutes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWindowMinutes(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !name || !threshold}>
            {loading ? 'Creating...' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
