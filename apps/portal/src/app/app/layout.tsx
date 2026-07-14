import { requireSession } from "@/lib/server/auth-utils";
import { ensureDefaultOrg } from "@/lib/server/organization";
import { AppSidebar } from "@/components/app/sidebar";
import { AppHeader } from "@/components/app/app-header";
import { redirect } from "next/navigation";

export const metadata = {
  title: { template: "%s | Kairos", default: "Research Platform | Kairos" },
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }

  if (!session) redirect("/login");

  const { organization } = await ensureDefaultOrg();

  return (
    <div className="flex min-h-screen bg-bg">
      <AppSidebar
        organization={organization}
        userEmail={session?.user?.email ?? ""}
      />
      <div className="flex flex-1 flex-col">
        <AppHeader
          email={session?.user?.email ?? ""}
          name={session?.user?.name ?? null}
          image={session?.user?.image ?? null}
          organizationName={organization?.name ?? null}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
