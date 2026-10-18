import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth-utils";
import { getWorkspaceContext } from "@/lib/server/workspace";
import { AppSidebar } from "@/components/app/sidebar";
import { AppHeader } from "@/components/app/app-header";
import { PageTransition } from "@/components/shared/page-transition";
import { KeyboardShortcuts } from "@/components/app/dashboard/keyboard-shortcuts";

export const metadata = {
  title: { template: "%s | Kairos", default: "Kairos" },
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    // No account required: bootstrap an isolated anonymous session instead of
    // gating the workspace behind a sign-in screen.
    redirect("/api/session");
  }

  const workspace = await getWorkspaceContext();
  const organization = workspace?.selectedOrganization ?? null;

  return (
    <div className="flex min-h-screen bg-bg">
      <KeyboardShortcuts />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:border focus:border-border focus:bg-surface focus:px-4 focus:py-2 focus:text-text-primary"
      >
        Skip to content
      </a>
      <AppSidebar
        organization={organization}
        organizations={workspace?.organizations ?? []}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          email={session.user.email}
          name={session.user.name}
          image={session.user.image ?? null}
          organizationName={organization?.name ?? null}
          isAnonymous={Boolean(session.user.isAnonymous)}
        />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}