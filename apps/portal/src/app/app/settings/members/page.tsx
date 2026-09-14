import { getWorkspaceContext } from "@/lib/server/workspace";
import { MembersSettingsClient } from "./members-settings-client";

export const metadata = {
  title: "Members",
};

export default async function MembersSettingsPage() {
  const workspace = await getWorkspaceContext();
  const orgId = workspace?.selectedOrganization?.id ?? "";

  return <MembersSettingsClient orgId={orgId} />;
}
