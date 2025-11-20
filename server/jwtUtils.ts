import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db";
import { refreshTokens, users } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";

// JWT Configuration
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || "fallback-secret-change-in-production";
const REFRESH_TOKEN_SECRET = process.env.JWT_SECRET + "-refresh" || "fallback-refresh-secret";
const ACCESS_TOKEN_EXPIRY = "10m"; // 10 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

// JWT Payload Interface
export interface JWTPayload {
  userId: string;
  email: string;
  tokenVersion: number;
  isAdmin?: boolean;
}

// Generate Access Token (short-lived, stored in memory)
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      tokenVersion: payload.tokenVersion,
      isAdmin: payload.isAdmin,
    },
    ACCESS_TOKEN_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: "artivio-ai",
      audience: "artivio-ai-client",
    }
  );
}

// Generate Refresh Token (long-lived, stored in httpOnly cookie + database)
export function generateRefreshToken(): string {
  // Generate a cryptographically secure random token
  return crypto.randomBytes(64).toString("hex");
}

// Hash Refresh Token for database storage
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Verify Access Token
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET, {
      issuer: "artivio-ai",
      audience: "artivio-ai-client",
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    console.error("[JWT] Access token verification failed:", error);
    return null;
  }
}

// Store Refresh Token in Database
export async function storeRefreshToken(
  userId: string,
  token: string,
  tokenVersion: number,
  deviceInfo?: string
): Promise<string> {
  const tokenId = crypto.randomUUID();
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(refreshTokens).values({
    tokenId,
    userId,
    tokenHash,
    tokenVersion,
    deviceInfo: deviceInfo || null,
    expiresAt,
  });

  console.log("[JWT] Refresh token stored in database", { userId, tokenId });
  return tokenId;
}

// Validate Refresh Token from Database
export async function validateRefreshToken(
  token: string,
  tokenId: string
): Promise<{ userId: string; tokenVersion: number } | null> {
  try {
    const tokenHash = hashRefreshToken(token);

    // Find the refresh token in database
    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenId, tokenId),
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date()) // Not expired
        )
      )
      .limit(1);

    if (!storedToken) {
      console.log("[JWT] Refresh token not found or expired", { tokenId });
      return null;
    }

    // Verify the user still exists and token version matches
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId))
      .limit(1);

    if (!user) {
      console.error("[JWT] User not found for refresh token", {
        userId: storedToken.userId,
      });
      return null;
    }

    if (user.tokenVersion !== storedToken.tokenVersion) {
      console.log("[JWT] Token version mismatch - token invalidated", {
        userId: user.id,
        userTokenVersion: user.tokenVersion,
        storedTokenVersion: storedToken.tokenVersion,
      });
      return null;
    }

    console.log("[JWT] Refresh token validated successfully", {
      userId: user.id,
      tokenId,
    });

    return {
      userId: user.id,
      tokenVersion: user.tokenVersion,
    };
  } catch (error) {
    console.error("[JWT] Error validating refresh token:", error);
    return null;
  }
}

// Revoke Refresh Token (for logout)
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  try {
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenId, tokenId));
    console.log("[JWT] Refresh token revoked", { tokenId });
  } catch (error) {
    console.error("[JWT] Error revoking refresh token:", error);
  }
}

// Revoke All User Tokens (for forced logout / security breach)
export async function revokeAllUserTokens(userId: string): Promise<void> {
  try {
    // Delete all refresh tokens for this user
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));

    // Increment token version to invalidate all access tokens
    await db
      .update(users)
      .set({ tokenVersion: db.$count(users, eq(users.id, userId)) })
      .where(eq(users.id, userId));

    console.log("[JWT] All tokens revoked for user", { userId });
  } catch (error) {
    console.error("[JWT] Error revoking all user tokens:", error);
  }
}

// Cleanup Expired Tokens (run periodically)
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    const result = await db
      .delete(refreshTokens)
      .where(gt(new Date(), refreshTokens.expiresAt));

    console.log("[JWT] Expired refresh tokens cleaned up");
  } catch (error) {
    console.error("[JWT] Error cleaning up expired tokens:", error);
  }
}

// Rotate Refresh Token (best practice for security)
export async function rotateRefreshToken(
  oldTokenId: string,
  userId: string,
  tokenVersion: number,
  deviceInfo?: string
): Promise<{ token: string; tokenId: string }> {
  // Revoke old token
  await revokeRefreshToken(oldTokenId);

  // Generate new token
  const newToken = generateRefreshToken();
  const newTokenId = await storeRefreshToken(userId, newToken, tokenVersion, deviceInfo);

  console.log("[JWT] Refresh token rotated", {
    userId,
    oldTokenId,
    newTokenId,
  });

  return {
    token: newToken,
    tokenId: newTokenId,
  };
}
