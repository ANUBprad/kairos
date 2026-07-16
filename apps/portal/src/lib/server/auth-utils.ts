import { getDemoSession, getDemoOrgAndProject, type DemoSession } from "./demo-user";

export type { DemoSession };

export async function getServerSession(): Promise<DemoSession> {
  return getDemoSession();
}

export async function requireSession(): Promise<DemoSession> {
  return getDemoSession();
}

export { getDemoOrgAndProject as ensureDefaultOrg };
