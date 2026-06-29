import { Resend } from "resend";

let resend: Resend | null = null;
const FROM = process.env.KAIROS_EMAIL_FROM || "noreply@kairos.dev";

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendWelcomeEmail(name: string, email: string) {
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: "Welcome to Kairos",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <img src="https://kairos.dev/kairos-nav.png" alt="Kairos" style="height: 28px; margin-bottom: 24px;" />
          <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Welcome to Kairos, ${name}</h1>
          <p style="color: #666; line-height: 1.6; margin: 0 0 24px;">
            Thanks for signing up. Here's how to get started:
          </p>
          <ol style="color: #666; line-height: 1.8; padding-left: 20px;">
            <li>Verify your email to unlock all features</li>
            <li>Create your first query in the dashboard</li>
            <li>Integrate with your app using our SDK</li>
          </ol>
          <p style="color: #666; line-height: 1.6; margin-top: 24px;">
            Questions? See our <a href="https://kairos.dev/docs" style="color: #FF5A0A;">Getting Started guide</a> or reply to this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Kairos — Adaptive Retrieval Intelligence Platform</p>
        </div>
      `,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return { success: false, error: "Failed to send welcome email" };
  }
}

export async function sendVerificationEmail(name: string, email: string, token: string) {
  const verifyUrl = `https://kairos.dev/api/auth/verify-email?token=${token}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: "Verify your Kairos email",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <img src="https://kairos.dev/kairos-nav.png" alt="Kairos" style="height: 28px; margin-bottom: 24px;" />
          <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Verify your email</h1>
          <p style="color: #666; line-height: 1.6; margin: 0 0 24px;">
            Hi ${name}, click the button below to verify your email address. This link expires in 24 hours.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #FF5A0A; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
            Verify Email
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            If you didn't sign up for Kairos, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Kairos — Adaptive Retrieval Intelligence Platform</p>
        </div>
      `,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { success: false, error: "Failed to send verification email" };
  }
}

export async function sendPasswordResetEmail(name: string, email: string, token: string) {
  const resetUrl = `https://kairos.dev/auth/reset-password?token=${token}`;
  try {
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: "Reset your Kairos password",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <img src="https://kairos.dev/kairos-nav.png" alt="Kairos" style="height: 28px; margin-bottom: 24px;" />
          <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 8px;">Reset your password</h1>
          <p style="color: #666; line-height: 1.6; margin: 0 0 24px;">
            Hi ${name}, click the button below to reset your password. This link expires in 1 hour.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #FF5A0A; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500;">
            Reset Password
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">
            If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Kairos — Adaptive Retrieval Intelligence Platform</p>
        </div>
      `,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    return { success: false, error: "Failed to send password reset email" };
  }
}

export async function sendContactNotification(name: string, email: string, subject: "bug" | "sales" | "support", message: string) {
  const subjectLabels: Record<string, string> = { bug: "Bug Report", sales: "Sales Inquiry", support: "Support Request" };
  try {
    await getResend().emails.send({
      from: FROM,
      to: process.env.KAIROS_CONTACT_EMAIL || "support@kairos.dev",
      replyTo: email,
      subject: `[Kairos Contact] ${subjectLabels[subject]} from ${name}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px;">New Contact Form Submission</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #666; width: 80px;">Name</td><td style="padding: 8px 0;">${name}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;">${email}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Subject</td><td style="padding: 8px 0;">${subjectLabels[subject]}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 16px 0;" />
          <p style="line-height: 1.6; white-space: pre-wrap;">${message}</p>
        </div>
      `,
    });
    return { success: true, error: null };
  } catch (error) {
    console.error("Failed to send contact notification:", error);
    return { success: false, error: "Failed to send notification" };
  }
}
