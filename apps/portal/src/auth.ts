import { requireSession, getServerSession } from "@/lib/server/auth-utils";

export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
  };
};

export { getServerSession };

export async function auth(): Promise<Session | null> {
  try {
    const session = await requireSession();
    return session as Session;
  } catch {
    return null;
  }
}
