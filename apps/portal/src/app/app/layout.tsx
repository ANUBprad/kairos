import { getDemoOrgAndProject } from "@/lib/server/demo-user";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/app/sidebar";
import { AppHeader } from "@/components/app/app-header";
import { PageTransition } from "@/components/shared/page-transition";

export const metadata = {
  title: { template: "%s | Kairos", default: "Research Platform | Kairos" },
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getDemoOrgAndProject();

  const organization = result
    ? await prisma.organization.findUnique({
        where: { id: result.orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          projects: {
            select: {
              id: true,
              name: true,
              _count: { select: { knowledgeBases: true } },
            },
          },
        },
      })
    : null;

  return (
    <div className="flex min-h-screen bg-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:bg-background focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-border"
      >
        Skip to content
      </a>
      <AppSidebar
        organization={organization}
      />
      <div className="flex flex-1 flex-col">
        <AppHeader
          email="demo@kairos.dev"
          name="Demo User"
          image={null}
          organizationName={organization?.name ?? null}
        />
        <main id="main-content" className="flex-1 p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
