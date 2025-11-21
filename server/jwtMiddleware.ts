import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, JWTPayload } from "./jwtUtils";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

// Custom user type for JWT
export interface JWTUser {
  id: string;
  userId: string;
  email: string;
  tokenVersion: number;
  isAdmin?: boolean;
}

// Extend Express Request to include user from JWT
declare global {
  namespace Express {
    interface Request {
      user?: JWTUser;
      isAuthenticated?: () => boolean;
    }
  }
}

/**
 * Middleware to verify JWT access token from Authorization header
 * Attaches decoded user data to req.user
 */
export async function requireJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[JWT MIDDLEWARE] No authorization header found");
      res.status(401).json({ message: "Unauthorized - No token provided" });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      console.log("[JWT MIDDLEWARE] Invalid or expired access token");
      res.status(401).json({ message: "Unauthorized - Invalid token" });
      return;
    }

    // Verify user still exists and token version matches
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (!user) {
      console.log("[JWT MIDDLEWARE] User not found", { userId: decoded.userId });
      res.status(401).json({ message: "Unauthorized - User not found" });
      return;
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      console.log("[JWT MIDDLEWARE] Token version mismatch - forced logout", {
        userId: user.id,
        userTokenVersion: user.tokenVersion,
        tokenVersion: decoded.tokenVersion,
      });
      res.status(401).json({ message: "Unauthorized - Session expired" });
      return;
    }

    // Attach user to request
    const jwtUser: JWTUser = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      tokenVersion: decoded.tokenVersion,
      isAdmin: decoded.isAdmin,
    };
    req.user = jwtUser;

    // Add isAuthenticated method for backward compatibility
    req.isAuthenticated = () => true;

    console.log("[JWT MIDDLEWARE] ✓ Token verified", {
      userId: jwtUser.id,
      email: jwtUser.email,
    });

    next();
  } catch (error) {
    console.error("[JWT MIDDLEWARE ERROR] Unexpected error during token verification:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      authHeader: req.headers.authorization?.substring(0, 30) + "...",
    });
    res.status(500).json({ message: "Internal server error during authentication" });
  }
}

/**
 * Optional JWT middleware - doesn't fail if no token provided
 * Useful for routes that have different behavior for authenticated users
 */
export async function optionalJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided - continue without authentication
      req.isAuthenticated = () => false;
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      // Invalid token - continue without authentication
      req.isAuthenticated = () => false;
      return next();
    }

    // Verify user exists  
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, decoded.userId))
      .limit(1);

    if (user && user.tokenVersion === decoded.tokenVersion) {
      const jwtUser: JWTUser = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        tokenVersion: decoded.tokenVersion,
        isAdmin: decoded.isAdmin,
      };
      req.user = jwtUser;
      req.isAuthenticated = () => true;
    } else {
      req.isAuthenticated = () => false;
    }

    next();
  } catch (error) {
    console.error("[JWT MIDDLEWARE ERROR]", error);
    req.isAuthenticated = () => false;
    next();
  }
}

/**
 * Middleware to require admin privileges
 * Must be used after requireJWT
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.isAdmin) {
    console.log("[JWT MIDDLEWARE] Admin access denied", {
      userId: req.user?.id,
      isAdmin: req.user?.isAdmin,
    });
    res.status(403).json({ message: "Forbidden - Admin access required" });
    return;
  }

  console.log("[JWT MIDDLEWARE] ✓ Admin access granted", {
    userId: req.user.id,
    email: req.user.email,
  });

  next();
}
