import { NextResponse } from "next/server";
import { contactSchema } from "@/lib/validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendContactNotification } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { success: notRateLimited } = await checkRateLimit(
      `contact:${ip}`,
      3,
      15 * 60 * 1000
    );

    if (!notRateLimited) {
      return NextResponse.json(
        { error: "Too many messages. Try again in 15 minutes.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstError.message, code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { name, email, subject, message } = parsed.data;

    const emailResult = await sendContactNotification(name, email, subject, message);

    if (!emailResult.success) {
      console.error("Contact email failed:", emailResult.error);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Message sent. We'll get back to you within 24 hours.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
