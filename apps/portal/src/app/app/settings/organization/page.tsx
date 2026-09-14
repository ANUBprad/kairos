import { getWorkspaceContext } from "@/lib/server/workspace";
import { OrganizationSettingsClient } from "./organization-settings-client";

export const metadata = {
  title: "Organization",
};

export default async function OrganizationSettingsPage() {
  const workspace = await getWorkspaceContext();
  const orgId = workspace?.selectedOrganization?.id ?? "";

  return <OrganizationSettingsClient orgId={orgId} />;
}
