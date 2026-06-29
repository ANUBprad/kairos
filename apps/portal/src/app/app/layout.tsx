import { getServerSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { ensureDefaultOrg } from "@/lib/server/organization";
import { AppSidebar } from "@/components/app/sidebar";
import { UserMenu } from "@/components/app/user-menu";
import { Bell } from "lucide-react";

export const metadata = {
  title: { template: "%s | Kairos", default: "Dashboard | Kairos" },
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const { organization } = await ensureDefaultOrg();

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar
        organization={organization}
        userEmail={session.user.email}
      />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border bg-bg/80 px-6 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="hidden sm:inline">{organization.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg text-text-tertiary hover:bg-surface-hover hover:text-text-secondary transition-colors"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </button>
            <UserMenu
              email={session.user.email}
              name={session.user.name}
              image={session.user.image}
              organizationName={organization.name}
            />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
