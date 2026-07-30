import { prisma } from '../db';

export interface CreateAlertRuleInput {
  name: string;
  description?: string;
  metric: string;
  operator: string;
  threshold: number;
  windowMinutes?: number;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  cooldownMinutes?: number;
  notifyWebhook?: string;
  notifyEmail?: string;
  notifySlack?: string;
}

export async function createAlertRule(orgId: string, input: CreateAlertRuleInput) {
  return prisma.alertRule.create({
    data: {
      ...input,
      organizationId: orgId,
    },
  });
}

export async function getAlertRules(orgId: string) {
  return prisma.alertRule.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { events: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateAlertRule(ruleId: string, data: Partial<CreateAlertRuleInput>) {
  return prisma.alertRule.update({
    where: { id: ruleId },
    data,
  });
}

export async function deleteAlertRule(ruleId: string) {
  return prisma.alertRule.delete({ where: { id: ruleId } });
}

export async function toggleAlertRule(ruleId: string, enabled: boolean) {
  return prisma.alertRule.update({
    where: { id: ruleId },
    data: { enabled },
  });
}

export async function evaluateAlertRules(orgId: string) {
  const rules = await prisma.alertRule.findMany({
    where: { organizationId: orgId, enabled: true },
  });

  const firedAlerts: Array<{
    rule: any;
    value: number;
    message: string;
  }> = [];

  for (const rule of rules) {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - rule.windowMinutes);

    let currentValue = 0;

    switch (rule.metric) {
      case 'error_rate': {
        const [total, errors] = await Promise.all([
          prisma.trace.count({
            where: { organizationId: orgId, startTime: { gte: windowStart } },
          }),
          prisma.trace.count({
            where: { organizationId: orgId, startTime: { gte: windowStart }, status: 'ERROR' },
          }),
        ]);
        currentValue = total > 0 ? (errors / total) * 100 : 0;
        break;
      }
      case 'avg_latency': {
        const result = await prisma.trace.aggregate({
          where: { organizationId: orgId, startTime: { gte: windowStart } },
          _avg: { durationMs: true },
        });
        currentValue = result._avg.durationMs ?? 0;
        break;
      }
      case 'total_cost': {
        const result = await prisma.trace.aggregate({
          where: { organizationId: orgId, startTime: { gte: windowStart } },
          _sum: { cost: true },
        });
        currentValue = result._sum.cost ?? 0;
        break;
      }
      case 'request_count': {
        currentValue = await prisma.trace.count({
          where: { organizationId: orgId, startTime: { gte: windowStart } },
        });
        break;
      }
    }

    let triggered = false;
    switch (rule.operator) {
      case '>': triggered = currentValue > rule.threshold; break;
      case '>=': triggered = currentValue >= rule.threshold; break;
      case '<': triggered = currentValue < rule.threshold; break;
      case '<=': triggered = currentValue <= rule.threshold; break;
      case '==': triggered = currentValue === rule.threshold; break;
      case '!=': triggered = currentValue !== rule.threshold; break;
    }

    if (triggered) {
      firedAlerts.push({
        rule,
        value: currentValue,
        message: `${rule.name}: ${rule.metric} is ${currentValue} (threshold: ${rule.operator} ${rule.threshold})`,
      });
    }
  }

  return firedAlerts;
}

export async function createAlertEvent(orgId: string, ruleId: string, value: number, message: string) {
  return prisma.alertEvent.create({
    data: {
      ruleId,
      status: 'FIRING',
      value,
      message,
      firedAt: new Date(),
      organizationId: orgId,
    },
  });
}

export async function getAlertEvents(orgId: string, filters?: { status?: string; ruleId?: string }) {
  const where: any = { organizationId: orgId };
  if (filters?.status) where.status = filters.status;
  if (filters?.ruleId) where.ruleId = filters.ruleId;

  return prisma.alertEvent.findMany({
    where,
    include: { rule: true },
    orderBy: { firedAt: 'desc' },
    take: 100,
  });
}

export async function resolveAlertEvent(eventId: string) {
  return prisma.alertEvent.update({
    where: { id: eventId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}

export async function acknowledgeAlertEvent(eventId: string) {
  return prisma.alertEvent.update({
    where: { id: eventId },
    data: { status: 'ACKNOWLEDGED' },
  });
}

export async function getAlertStats(orgId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [totalRules, activeRules, totalEvents, firingEvents, bySeverity, byRule] =
    await Promise.all([
      prisma.alertRule.count({ where: { organizationId: orgId } }),
      prisma.alertRule.count({ where: { organizationId: orgId, enabled: true } }),
      prisma.alertEvent.count({
        where: { organizationId: orgId, firedAt: { gte: startDate } },
      }),
      prisma.alertEvent.count({
        where: { organizationId: orgId, status: 'FIRING' },
      }),
      prisma.alertEvent.groupBy({
        by: ['ruleId'],
        where: { organizationId: orgId, firedAt: { gte: startDate } },
        _count: true,
      }),
      prisma.alertRule.findMany({
        where: { organizationId: orgId },
        include: {
          _count: { select: { events: true } },
        },
      }),
    ]);

  return {
    totalRules,
    activeRules,
    totalEvents,
    firingEvents,
    bySeverity,
    byRule,
    days,
  };
}
