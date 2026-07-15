import { requireSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDeploymentMeta } from "@/lib/telemetry/deployment";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }
  if (!session) redirect("/login");

  if (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN") {
    redirect("/app");
  }

  const meta = getDeploymentMeta();

  let userCount = 0;
  let subCount = 0;
  let kbCount = 0;
  let docCount = 0;
  try {
    [userCount, subCount, kbCount, docCount] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.knowledgeBase.count(),
      prisma.document.count(),
    ]);
  } catch {
    // stats unavailable
  }

  const planCounts = await prisma.subscription.groupBy({
    by: ["plan"],
    _count: true,
    where: { status: "ACTIVE" },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Admin Console</h1>
        <p className="text-sm text-text-secondary mt-1">System overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Users" value={String(userCount)} />
        <StatCard title="Active Subscriptions" value={String(subCount)} />
        <StatCard title="Knowledge Bases" value={String(kbCount)} />
        <StatCard title="Documents" value={String(docCount)} />
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Subscription Distribution</h2>
        <div className="grid gap-3 md:grid-cols-5">
          {["FREE", "STARTER", "PRO", "TEAM", "ENTERPRISE"].map((plan) => {
            const found = planCounts.find((p) => p.plan === plan);
            return (
              <div key={plan} className="rounded-[var(--radius-lg)] border border-border p-3 text-center">
                <p className="text-xs text-text-tertiary">{plan}</p>
                <p className="text-2xl font-bold text-text-primary">{found?._count ?? 0}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">System</h2>
        <div className="grid gap-2 md:grid-cols-2 text-sm">
          <Row label="Version" value={meta.version} />
          <Row label="Environment" value={meta.environment} />
          <Row label="Git Commit" value={meta.gitCommit} />
          <Row label="Node.js" value={meta.nodeVersion} />
          <Row label="Stripe" value={process.env.STRIPE_SECRET_KEY ? "Configured" : "Not configured"} />
          <Row label="PostHog" value={process.env.NEXT_PUBLIC_POSTHOG_KEY ? "Enabled" : "Disabled"} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-surface p-4">
      <p className="text-xs text-text-tertiary">{title}</p>
      <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-text-tertiary">{label}</span>
      <span className="text-text-primary font-medium">{value}</span>
    </div>
  );
}
