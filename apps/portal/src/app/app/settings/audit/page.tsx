import { getWorkspaceContext } from "@/lib/server/workspace";
import { AuditLogsSettingsClient } from "./audit-logs-settings-client";

export const metadata = {
  title: "Audit Logs",
};

export default async function AuditLogsSettingsPage() {
  const workspace = await getWorkspaceContext();
  const orgId = workspace?.selectedOrganization?.id ?? "";

  return <AuditLogsSettingsClient orgId={orgId} />;
}
