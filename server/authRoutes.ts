import { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { hashPassword } from "./customAuth";
import { db } from "./db";
import { users, refreshTokens } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";
import { z } from "zod";
import {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  rotateRefreshToken,
  JWTPayload,
} from "./jwtUtils";
import { requireJWT } from "./jwtMiddleware";
import { LoopsService } from "./loops";

// Helper to determine if request is over HTTPS
function isSecureRequest(req: Request): boolean {
  // Check if request is over HTTPS
  // In production with proxy (like Replit), check X-Forwarded-Proto header
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return protocol === 'https';
}

// Get cookie options - using 'lax' for Safari/iOS compatibility
// Safari/iOS rejects sameSite:'none' cookies without Secure=true (HTTP/dev environments)
function getCookieOptions(req: Request) {
  const isSecure = isSecureRequest(req);
  
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax' as const, // Use 'lax' for Safari/iOS compatibility
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  };
}

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").optional(),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export function registerAuthRoutes(app: Express) {
  // Registration endpoint
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("[AUTH] Registration attempt", {
        email: req.body.email,
      });

      // Validate request body
      const validatedData = registerSchema.parse(req.body);
      const { email, password, name, firstName, lastName } = validatedData;

      // Split name into firstName and lastName if provided
      let finalFirstName = firstName || "";
      let finalLastName = lastName || "";
      
      if (name && !firstName && !lastName) {
        const nameParts = name.trim().split(/\s+/);
        finalFirstName = nameParts[0] || "";
        finalLastName = nameParts.slice(1).join(" ") || "";
      }

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser) {
        console.log("[AUTH] Registration failed - email already exists", {
          email: email.toLowerCase(),
        });
        return res.status(400).json({
          error: "An account with this email already exists. Please log in instead.",
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user (credits will be assigned during onboarding)
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          authProvider: "local",
          firstName: finalFirstName,
          lastName: finalLastName,
          credits: 0, // Will be set during onboarding
        })
        .returning();

      console.log("[AUTH] ✓ User registered successfully", {
        userId: newUser.id,
        email: newUser.email,
      });

      // Add new user to Loops.so 7-Day Trial Nurture funnel (fire and forget)
      LoopsService.addToSevenDayFunnel(
        newUser.email || email.toLowerCase(),
        finalFirstName || undefined,
        finalLastName || undefined,
        newUser.id.toString()
      ).then(result => {
        if (result.success) {
          console.log("[AUTH] ✓ User added to 7-Day Trial Nurture funnel", {
            userId: newUser.id,
            email: newUser.email,
          });
        }
      }).catch(err => {
        console.error("[AUTH] Failed to add user to Loops funnel (non-blocking)", {
          error: err.message,
          userId: newUser.id,
        });
      });

      // Admin email whitelist
      const ADMIN_EMAILS = [
        "ryan.mahabir@outlook.com",
        "admin@artivio.ai",
        "joe@joecodeswell.com",
        "jordanlambrecht@gmail.com",
      ];
      const isAdmin = ADMIN_EMAILS.includes(newUser.email?.toLowerCase() || "");

      // Generate JWT tokens
      const accessToken = generateAccessToken({
        userId: newUser.id,
        email: newUser.email || email.toLowerCase(),
        tokenVersion: newUser.tokenVersion || 0,
        isAdmin,
      });

      const refreshToken = generateRefreshToken();
      const deviceInfo = req.headers["user-agent"] || "unknown";

      // Store refresh token in database FIRST - catch errors
      let tokenId;
      try {
        tokenId = await storeRefreshToken(
          newUser.id,
          refreshToken,
          newUser.tokenVersion || 0,
          deviceInfo
        );
      } catch (storeError: any) {
        console.error("[AUTH ERROR] Failed to store refresh token during registration", {
          error: storeError.message,
          userId: newUser.id,
        });
        // Don't set cookies if database operation failed
        return res.status(503).json({
          message: "Database error during registration. Please try again.",
          code: "TOKEN_STORE_ERROR",
        });
      }

      // Only set cookies AFTER successful database storage
      const cookieOptions = getCookieOptions(req);
      res.cookie("refreshToken", refreshToken, cookieOptions);
      res.cookie("tokenId", tokenId, cookieOptions);

      console.log("[AUTH] ✓ JWT tokens generated and stored", {
        userId: newUser.id,
        email: newUser.email,
        tokenId: tokenId?.substring(0, 8),
      });

      // Return access token and user data
      res.json({
        message: "Registration successful",
        accessToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isAdmin,
        },
      });
    } catch (error: any) {
      console.error("[AUTH ERROR] Registration error", {
        error: error.message,
      });

      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      res.status(500).json({
        message: "Registration failed. Please try again.",
      });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", (req, res, next) => {
    try {
      console.log("[AUTH] Login attempt", {
        email: req.body.email,
      });

      // Validate request body
      const validatedData = loginSchema.parse(req.body);

      passport.authenticate("local", { session: false }, async (err: any, user: any, info: any) => {
        if (err) {
          console.error("[AUTH ERROR] Login error", { error: err });
          return res.status(500).json({
            message: "Login failed. Please try again.",
          });
        }

        if (!user) {
          console.log("[AUTH] Login failed - invalid credentials", {
            email: validatedData.email,
            reason: info?.message,
          });
          return res.status(401).json({
            message: info?.message || "Invalid email or password",
          });
        }

        console.log("[AUTH] ✓ Authentication successful", {
          userId: user.id,
          email: user.email,
        });

        // Admin email whitelist
        const ADMIN_EMAILS = [
          "ryan.mahabir@outlook.com",
          "admin@artivio.ai",
          "joe@joecodeswell.com",
          "jordanlambrecht@gmail.com",
        ];
        const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");

        // Generate JWT tokens
        const accessToken = generateAccessToken({
          userId: user.id,
          email: user.email,
          tokenVersion: user.tokenVersion || 0,
          isAdmin,
        });

        const refreshToken = generateRefreshToken();
        const deviceInfo = req.headers["user-agent"] || "unknown";

        // Store refresh token in database FIRST - catch errors
        let tokenId;
        try {
          tokenId = await storeRefreshToken(
            user.id,
            refreshToken,
            user.tokenVersion || 0,
            deviceInfo
          );
        } catch (storeError: any) {
          console.error("[AUTH ERROR] Failed to store refresh token during login", {
            error: storeError.message,
            userId: user.id,
          });
          // Don't set cookies if database operation failed
          return res.status(503).json({
            message: "Database error during login. Please try again.",
            code: "TOKEN_STORE_ERROR",
          });
        }

        // Only set cookies AFTER successful database storage
        const useSecureCookies = isSecureRequest(req);
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: useSecureCookies,
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          path: "/",
        });

        // Store tokenId in cookie for validation
        res.cookie("tokenId", tokenId, {
          httpOnly: true,
          secure: useSecureCookies,
          sameSite: "lax",
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          path: "/",
        });

        console.log("[AUTH] ✓ Login successful - JWT tokens generated", {
          userId: user.id,
          email: user.email,
          tokenId: tokenId?.substring(0, 8),
          isAdmin,
        });

        // Return access token and user data
        res.json({
          message: "Login successful",
          accessToken,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isAdmin,
          },
        });
      })(req, res, next);
    } catch (error: any) {
      console.error("[AUTH ERROR] Login error", {
        error: error.message,
      });

      // Handle validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        });
      }

      res.status(500).json({
        message: "Login failed. Please try again.",
      });
    }
  });

  // Google OAuth - Initiate
  app.get(
    "/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false, // Stateless auth - we use JWT instead of sessions
    })
  );

  // Google OAuth - Callback
  app.get("/auth/callback", (req, res, next) => {
    passport.authenticate("google", { session: false }, async (err: any, user: any, info: any) => {
      if (err) {
        console.error("[AUTH ERROR] Google OAuth error", { error: err });
        return res.redirect("/?error=auth_failed");
      }

      if (!user) {
        console.log("[AUTH] Google OAuth failed - no user", { info });
        return res.redirect("/?error=auth_failed");
      }

      console.log("[AUTH] Google OAuth authentication successful", {
        userId: user.id,
        email: user.email,
      });

      try {
        // Admin email whitelist
        const ADMIN_EMAILS = [
          "ryan.mahabir@outlook.com",
          "admin@artivio.ai",
          "joe@joecodeswell.com",
          "jordanlambrecht@gmail.com",
        ];
        const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");

        // Generate JWT tokens
        const accessToken = generateAccessToken({
          userId: user.id,
          email: user.email,
          tokenVersion: user.tokenVersion || 0,
          isAdmin,
        });

        const refreshToken = generateRefreshToken();
        const deviceInfo = req.headers["user-agent"] || "unknown";

        // Store refresh token in database FIRST - catch errors
        let tokenId;
        try {
          tokenId = await storeRefreshToken(
            user.id,
            refreshToken,
            user.tokenVersion || 0,
            deviceInfo
          );
        } catch (storeError: any) {
          console.error("[AUTH ERROR] Failed to store refresh token during OAuth", {
            error: storeError.message,
            userId: user.id,
          });
          // Don't set cookies if database operation failed
          return res.redirect("/?error=token_store_failed");
        }

        // Safari/iOS blocks cookies on 302 redirects (even with sameSite: lax)
        // Solution: Send 200 OK with HTML meta refresh instead of 302 redirect
        // Safari accepts cookies in 200 OK responses, just not in redirect responses
        const cookieOptions = getCookieOptions(req);
        res.cookie("refreshToken", refreshToken, cookieOptions);
        res.cookie("tokenId", tokenId, cookieOptions);

        console.log("[AUTH] ✓ OAuth successful - cookies set via HTML response", {
          userId: user.id,
          email: user.email,
          tokenId: tokenId?.substring(0, 8),
          isAdmin,
        });

        // Send HTML with meta refresh instead of 302 redirect
        // This allows Safari to accept the cookies we just set
        const redirectUrl = `/?login=success#token=${accessToken}`;
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta http-equiv="refresh" content="0;url=${redirectUrl}">
            <title>Redirecting...</title>
          </head>
          <body>
            <p>Authentication successful. Redirecting...</p>
            <script>window.location.href = "${redirectUrl}";</script>
          </body>
          </html>
        `);
      } catch (error) {
        console.error("[AUTH ERROR] Failed to generate JWT tokens after OAuth", {
          error,
          userId: user.id,
        });
        return res.redirect("/?error=token_generation_failed");
      }
    })(req, res, next);
  });

  // Refresh Token endpoint
  app.post("/api/auth/refresh", async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    const tokenId = req.cookies.tokenId;

    try {
      console.log("[AUTH] Refresh token request", {
        hasRefreshToken: !!refreshToken,
        hasTokenId: !!tokenId,
        tokenIdPreview: tokenId?.substring(0, 8),
      });

      // Check for required cookies
      if (!refreshToken || !tokenId) {
        console.log("[AUTH] Refresh failed - missing cookies");
        res.clearCookie("refreshToken", { path: "/" });
        res.clearCookie("tokenId", { path: "/" });
        return res.status(401).json({
          message: "No refresh token found. Please log in again.",
          code: "MISSING_REFRESH_TOKEN",
        });
      }

      // Validate refresh token - catch any database errors
      let validationResult;
      try {
        validationResult = await validateRefreshToken(refreshToken, tokenId);
      } catch (dbError: any) {
        console.error("[AUTH ERROR] Database error during token validation", {
          error: dbError.message,
          tokenId: tokenId?.substring(0, 8),
        });
        res.clearCookie("refreshToken", { path: "/" });
        res.clearCookie("tokenId", { path: "/" });
        return res.status(401).json({
          message: "Token validation failed. Please log in again.",
          code: "VALIDATION_ERROR",
        });
      }

      if (!validationResult) {
        console.log("[AUTH] Refresh failed - invalid or expired token", {
          tokenId: tokenId?.substring(0, 8),
        });
        res.clearCookie("refreshToken", { path: "/" });
        res.clearCookie("tokenId", { path: "/" });
        return res.status(401).json({
          message: "Invalid or expired refresh token. Please log in again.",
          code: "INVALID_REFRESH_TOKEN",
        });
      }

      const { userId, tokenVersion } = validationResult;

      // Validate tokenVersion - protect against undefined/null
      if (typeof tokenVersion !== 'number') {
        console.error("[AUTH ERROR] Invalid tokenVersion in refresh", {
          userId,
          tokenVersion,
          tokenId: tokenId?.substring(0, 8),
        });
        res.clearCookie("refreshToken", { path: "/" });
        res.clearCookie("tokenId", { path: "/" });
        return res.status(401).json({
          message: "Invalid token version. Please log in again.",
          code: "INVALID_TOKEN_VERSION",
        });
      }

      // Get user data for access token - catch database errors
      let user;
      try {
        [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
      } catch (dbError: any) {
        console.error("[AUTH ERROR] Database error fetching user during refresh", {
          error: dbError.message,
          userId,
        });
        res.clearCookie("refreshToken", { path: "/" });
        res.clearCookie("tokenId", { path: "/" });
        return res.status(503).json({
          message: "Database error. Please try again.",
          code: "DB_ERROR",
        });
      }

      if (!user) {
        console.error("[AUTH ERROR] User not found during refresh", {
          userId,
          tokenId: tokenId?.substring(0, 8),
        });
        res.clearCookie("refreshToken", { path: "/" });
        res.clearCookie("tokenId", { path: "/" });
        return res.status(404).json({
          message: "User not found. Please log in again.",
          code: "USER_NOT_FOUND",
        });
      }

      // Admin email whitelist
      const ADMIN_EMAILS = [
        "ryan.mahabir@outlook.com",
        "admin@artivio.ai",
        "joe@joecodeswell.com",
        "jordanlambrecht@gmail.com",
      ];
      const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");

      // Rotate refresh token for security - catch database errors
      let newRefreshToken, newTokenId;
      try {
        const deviceInfo = req.headers["user-agent"] || "unknown";
        const rotationResult = await rotateRefreshToken(
          tokenId,
          userId,
          tokenVersion, // Now guaranteed to be a valid number
          deviceInfo
        );
        newRefreshToken = rotationResult.token;
        newTokenId = rotationResult.tokenId;
      } catch (rotationError: any) {
        console.error("[AUTH ERROR] Token rotation failed", {
          error: rotationError.message,
          userId,
          tokenId: tokenId?.substring(0, 8),
        });
        // Don't clear cookies here - the old token is still valid
        // Return 503 to indicate temporary issue
        return res.status(503).json({
          message: "Token rotation failed. Please try again.",
          code: "ROTATION_ERROR",
        });
      }

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email || "",
        tokenVersion,
        isAdmin,
      });

      // Set new refresh token cookies
      const useSecureCookies = isSecureRequest(req);
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/",
      });

      res.cookie("tokenId", newTokenId, {
        httpOnly: true,
        secure: useSecureCookies,
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: "/",
      });

      console.log("[AUTH] ✓ Token refresh successful", {
        userId: user.id,
        email: user.email,
        newTokenId: newTokenId?.substring(0, 8),
        isAdmin,
      });

      // Return new access token
      res.json({
        message: "Token refreshed successfully",
        accessToken,
      });
    } catch (error: any) {
      // Catch-all for any unexpected errors
      console.error("[AUTH ERROR] Unexpected token refresh error", {
        error: error.message,
        stack: error.stack,
        tokenId: tokenId?.substring(0, 8),
      });

      // Clear cookies on unexpected errors
      res.clearCookie("refreshToken", { path: "/" });
      res.clearCookie("tokenId", { path: "/" });

      res.status(500).json({
        message: "An unexpected error occurred. Please log in again.",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // Bootstrap endpoint - validates refresh cookies and returns access token + user data
  // This is a read-only operation that doesn't rotate tokens (unlike /refresh)
  app.get("/api/auth/bootstrap", async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    const tokenId = req.cookies.tokenId;

    try {
      console.log("[AUTH] Bootstrap request", {
        hasRefreshToken: !!refreshToken,
        hasTokenId: !!tokenId,
        tokenIdPreview: tokenId?.substring(0, 8),
      });

      // Check for required cookies
      if (!refreshToken || !tokenId) {
        console.log("[AUTH] Bootstrap failed - missing cookies");
        return res.status(401).json({
          message: "No refresh token found",
          code: "MISSING_REFRESH_TOKEN",
        });
      }

      // Validate refresh token - catch any database errors
      let validationResult;
      try {
        validationResult = await validateRefreshToken(refreshToken, tokenId);
      } catch (dbError: any) {
        console.error("[AUTH ERROR] Database error during bootstrap token validation", {
          error: dbError.message,
          tokenId: tokenId?.substring(0, 8),
        });
        return res.status(401).json({
          message: "Token validation failed",
          code: "VALIDATION_ERROR",
        });
      }

      if (!validationResult) {
        console.log("[AUTH] Bootstrap failed - invalid or expired token", {
          tokenId: tokenId?.substring(0, 8),
        });
        return res.status(401).json({
          message: "Invalid or expired refresh token",
          code: "INVALID_REFRESH_TOKEN",
        });
      }

      const { userId, tokenVersion } = validationResult;

      // Validate tokenVersion - protect against undefined/null
      if (typeof tokenVersion !== 'number') {
        console.error("[AUTH ERROR] Invalid tokenVersion in bootstrap", {
          userId,
          tokenVersion,
          tokenId: tokenId?.substring(0, 8),
        });
        return res.status(401).json({
          message: "Invalid token version",
          code: "INVALID_TOKEN_VERSION",
        });
      }

      // Get user data - catch database errors
      let user;
      try {
        [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
      } catch (dbError: any) {
        console.error("[AUTH ERROR] Database error fetching user during bootstrap", {
          error: dbError.message,
          userId,
        });
        return res.status(503).json({
          message: "Database error",
          code: "DB_ERROR",
        });
      }

      if (!user) {
        console.error("[AUTH ERROR] User not found during bootstrap", {
          userId,
          tokenId: tokenId?.substring(0, 8),
        });
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      // Admin email whitelist
      const ADMIN_EMAILS = [
        "ryan.mahabir@outlook.com",
        "admin@artivio.ai",
        "joe@joecodeswell.com",
        "jordanlambrecht@gmail.com",
      ];
      const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");

      // Generate access token
      const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email || "",
        tokenVersion,
        isAdmin,
      });

      console.log("[AUTH] ✓ Bootstrap successful", {
        userId: user.id,
        email: user.email,
        tokenId: tokenId?.substring(0, 8),
        isAdmin,
      });

      // Return access token AND user data
      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          credits: user.credits,
          isAdmin,
        },
      });
    } catch (error: any) {
      // Catch-all for any unexpected errors
      console.error("[AUTH ERROR] Unexpected bootstrap error", {
        error: error.message,
        stack: error.stack,
        tokenId: tokenId?.substring(0, 8),
      });

      res.status(500).json({
        message: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      });
    }
  });

  // Get current user (JWT-protected endpoint)
  app.get("/api/auth/user", requireJWT, async (req: any, res) => {
    try {
      // req.user is already set by requireJWT middleware
      const userId = req.user.id;
      
      console.log("[AUTH] Fetching user data", { userId });

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.error("[AUTH] User not found in database", { userId });
        return res.status(404).json({ message: "User not found" });
      }

      // Admin email whitelist (already set in JWT but double-check with current email)
      const ADMIN_EMAILS = [
        "ryan.mahabir@outlook.com",
        "admin@artivio.ai",
        "joe@joecodeswell.com",
        "jordanlambrecht@gmail.com",
      ];

      const isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() || "");
      const userWithAdminOverride = { ...user, isAdmin };

      // Disable caching to ensure fresh auth data
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      console.log("[AUTH] ✓ User data fetched successfully", {
        userId: user.id,
        email: user.email,
        isAdmin,
      });

      res.json(userWithAdminOverride);
    } catch (error) {
      console.error("[AUTH ERROR] Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    try {
      console.log("[AUTH] Logout initiated");

      // Get tokenId from cookie
      const tokenId = req.cookies.tokenId;

      if (tokenId) {
        // Revoke refresh token in database
        await revokeRefreshToken(tokenId);
        console.log("[AUTH] Refresh token revoked", { tokenId });
      } else {
        console.log("[AUTH] No tokenId found in cookies");
      }

      // Clear JWT cookies
      res.clearCookie("refreshToken", { path: "/" });
      res.clearCookie("tokenId", { path: "/" });

      console.log("[AUTH] ✓ Logout successful - cookies cleared");

      res.json({
        message: "Logout successful",
      });
    } catch (error: any) {
      console.error("[AUTH ERROR] Logout error", {
        error: error.message,
      });
      res.status(500).json({
        message: "Logout failed. Please try again.",
      });
    }
  });
}

// Middleware to check if user is authenticated
export const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated() || !req.user) {
    console.log("[AUTH] ❌ Unauthorized request", {
      path: req.path,
      sessionID: req.sessionID,
      hasUser: !!req.user,
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  console.log("[AUTH] ✓ Authenticated request", {
    userId: req.user.id,
    path: req.path,
  });

  next();
};
