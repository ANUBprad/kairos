import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { getReferralStats, createReferralInvite } from "@/lib/referrals";
import { sanitizeError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const stats = await getReferralStats(session.user.id);
    return NextResponse.json(stats);
  } catch (err) {
    const { message, errorId } = sanitizeError(err);
    return NextResponse.json({ error: message, errorId }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const invite = await createReferralInvite(session.user.id, email);
    return NextResponse.json(invite);
  } catch (err) {
    const { message, errorId } = sanitizeError(err);
    return NextResponse.json({ error: message, errorId }, { status: 500 });
  }
}
