import { SecuritySettingsClient } from "./security-settings-client";
import { getServerSession } from "@/lib/server/auth-utils";
import { MAX_API_KEYS_PER_USER } from "@/lib/api-keys";

export const metadata = {
  title: "Security",
};

export default async function SecuritySettingsPage() {
  const session = await getServerSession();

  return (
    <SecuritySettingsClient
      email={session?.user?.email ?? null}
      isAnonymous={session?.user?.isAnonymous ?? false}
      maxKeys={MAX_API_KEYS_PER_USER}
    />
  );
}
