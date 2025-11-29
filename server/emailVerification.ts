import { ServerClient } from "postmark";
import crypto from "crypto";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getBaseUrl } from "./urlUtils";

const postmarkClient = process.env.POSTMARK_SERVER_TOKEN 
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null;

export interface EmailVerificationResult {
  success: boolean;
  message: string;
  error?: string;
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getTokenExpiration(): Date {
  const expires = new Date();
  expires.setHours(expires.getHours() + 24);
  return expires;
}

export async function sendVerificationEmail(
  email: string,
  token: string,
  firstName?: string
): Promise<EmailVerificationResult> {
  if (!postmarkClient) {
    console.error("[EMAIL VERIFICATION] Postmark not configured");
    return {
      success: false,
      message: "Email service not configured",
      error: "POSTMARK_NOT_CONFIGURED",
    };
  }

  const baseUrl = getBaseUrl();
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  const name = firstName || "there";

  try {
    console.log("[EMAIL VERIFICATION] Sending verification email to:", email);

    await postmarkClient.sendEmail({
      From: "hello@artivio.ai",
      To: email,
      Subject: "Verify your Artivio AI account",
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify your email</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0f; color: #ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0f;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #1a1a24; border-radius: 12px; overflow: hidden;">
                  <!-- Header with logo -->
                  <tr>
                    <td style="padding: 40px 40px 30px 40px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                      <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff;">Artivio AI</h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: 600; color: #ffffff;">Welcome, ${name}!</h2>
                      
                      <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; color: #a1a1aa;">
                        Thanks for signing up for Artivio AI. Please verify your email address to get started with creating amazing AI-generated content.
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 10px 0 30px 0;">
                            <a href="${verificationUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 0 0 15px 0; font-size: 14px; color: #71717a;">
                        Or copy and paste this link into your browser:
                      </p>
                      
                      <p style="margin: 0 0 25px 0; font-size: 13px; color: #6366f1; word-break: break-all;">
                        ${verificationUrl}
                      </p>
                      
                      <p style="margin: 0; font-size: 14px; color: #71717a;">
                        This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #12121a; text-align: center; border-top: 1px solid #27272a;">
                      <p style="margin: 0; font-size: 13px; color: #71717a;">
                        &copy; ${new Date().getFullYear()} Artivio AI. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      TextBody: `
Welcome to Artivio AI, ${name}!

Thanks for signing up. Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

- The Artivio AI Team
      `,
      MessageStream: "outbound",
    });

    console.log("[EMAIL VERIFICATION] ✓ Verification email sent to:", email);

    return {
      success: true,
      message: "Verification email sent successfully",
    };
  } catch (error: any) {
    console.error("[EMAIL VERIFICATION] Failed to send email:", error.message);
    return {
      success: false,
      message: "Failed to send verification email",
      error: error.message,
    };
  }
}

export async function verifyEmail(token: string): Promise<EmailVerificationResult> {
  try {
    console.log("[EMAIL VERIFICATION] Verifying token...");

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token))
      .limit(1);

    if (!user) {
      console.log("[EMAIL VERIFICATION] Invalid token - no user found");
      return {
        success: false,
        message: "Invalid or expired verification link",
        error: "INVALID_TOKEN",
      };
    }

    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      console.log("[EMAIL VERIFICATION] Token expired for user:", user.email);
      return {
        success: false,
        message: "This verification link has expired. Please request a new one.",
        error: "TOKEN_EXPIRED",
      };
    }

    if (user.emailVerified) {
      console.log("[EMAIL VERIFICATION] Email already verified:", user.email);
      return {
        success: true,
        message: "Your email is already verified. You can log in.",
      };
    }

    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log("[EMAIL VERIFICATION] ✓ Email verified for user:", user.email);

    return {
      success: true,
      message: "Email verified successfully! You can now log in.",
    };
  } catch (error: any) {
    console.error("[EMAIL VERIFICATION] Verification error:", error.message);
    return {
      success: false,
      message: "An error occurred during verification",
      error: error.message,
    };
  }
}

export async function resendVerificationEmail(email: string): Promise<EmailVerificationResult> {
  try {
    console.log("[EMAIL VERIFICATION] Resend request for:", email);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      console.log("[EMAIL VERIFICATION] User not found:", email);
      return {
        success: true,
        message: "If an account exists with this email, a verification link will be sent.",
      };
    }

    if (user.emailVerified) {
      console.log("[EMAIL VERIFICATION] Already verified:", email);
      return {
        success: true,
        message: "Your email is already verified. You can log in.",
      };
    }

    if (user.authProvider === "google") {
      console.log("[EMAIL VERIFICATION] Google user doesn't need verification:", email);
      return {
        success: true,
        message: "Google accounts are automatically verified. You can log in.",
      };
    }

    const newToken = generateVerificationToken();
    const newExpiration = getTokenExpiration();

    await db
      .update(users)
      .set({
        emailVerificationToken: newToken,
        emailVerificationExpires: newExpiration,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const emailResult = await sendVerificationEmail(
      user.email!,
      newToken,
      user.firstName || undefined
    );

    if (!emailResult.success) {
      return emailResult;
    }

    return {
      success: true,
      message: "Verification email sent! Please check your inbox.",
    };
  } catch (error: any) {
    console.error("[EMAIL VERIFICATION] Resend error:", error.message);
    return {
      success: false,
      message: "Failed to resend verification email",
      error: error.message,
    };
  }
}
