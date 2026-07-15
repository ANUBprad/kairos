import { requireSession } from "@/lib/server/auth-utils";
import { redirect } from "next/navigation";
import { AccountClient } from "./account-client";

export const metadata = {
  title: "Account Settings",
};

export default async function AccountPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }
  if (!session) redirect("/login");

  return <AccountClient />;
}
