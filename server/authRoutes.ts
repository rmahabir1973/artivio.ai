import { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { hashPassword } from "./customAuth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
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

// Helper to determine if request is over HTTPS
function isSecureRequest(req: Request): boolean {
  // Check if request is over HTTPS
  // In production with proxy (like Replit), check X-Forwarded-Proto header
  const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return protocol === 'https';
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

      // Store refresh token in database
      const tokenId = await storeRefreshToken(
        newUser.id,
        refreshToken,
        newUser.tokenVersion || 0,
        deviceInfo
      );

      // Set refresh token in httpOnly cookie
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

      console.log("[AUTH] ✓ JWT tokens generated and stored", {
        userId: newUser.id,
        tokenId,
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

      passport.authenticate("local", async (err: any, user: any, info: any) => {
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

        // Store refresh token in database
        const tokenId = await storeRefreshToken(
          user.id,
          refreshToken,
          user.tokenVersion || 0,
          deviceInfo
        );

        // Set refresh token in httpOnly cookie
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
          tokenId,
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
    })
  );

  // Google OAuth - Callback
  app.get("/auth/callback", (req, res, next) => {
    passport.authenticate("google", async (err: any, user: any, info: any) => {
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

        // Store refresh token in database
        const tokenId = await storeRefreshToken(
          user.id,
          refreshToken,
          user.tokenVersion || 0,
          deviceInfo
        );

        // Set refresh token in httpOnly cookie
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

        console.log("[AUTH] ✓ OAuth successful - JWT tokens generated and cookies set", {
          userId: user.id,
          tokenId,
          isAdmin,
        });

        // Redirect to home page with login success
        res.redirect("/?login=success");
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
    try {
      console.log("[AUTH] Refresh token request");

      // Get refresh token and tokenId from cookies
      const refreshToken = req.cookies.refreshToken;
      const tokenId = req.cookies.tokenId;

      if (!refreshToken || !tokenId) {
        console.log("[AUTH] Refresh failed - missing cookies", {
          hasRefreshToken: !!refreshToken,
          hasTokenId: !!tokenId,
        });
        return res.status(401).json({
          message: "No refresh token found. Please log in again.",
        });
      }

      // Validate refresh token
      const validationResult = await validateRefreshToken(refreshToken, tokenId);

      if (!validationResult) {
        console.log("[AUTH] Refresh failed - invalid or expired token", {
          tokenId,
        });
        // Clear invalid cookies
        res.clearCookie("refreshToken", { path: "/" });
        res.clearCookie("tokenId", { path: "/" });
        return res.status(401).json({
          message: "Invalid or expired refresh token. Please log in again.",
        });
      }

      const { userId, tokenVersion } = validationResult;

      // Get user data for access token
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        console.error("[AUTH ERROR] User not found during refresh", { userId });
        return res.status(404).json({
          message: "User not found. Please log in again.",
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

      // Rotate refresh token for security
      const deviceInfo = req.headers["user-agent"] || "unknown";
      const { token: newRefreshToken, tokenId: newTokenId } = await rotateRefreshToken(
        tokenId,
        userId,
        tokenVersion,
        deviceInfo
      );

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
        newTokenId,
      });

      // Return new access token
      res.json({
        message: "Token refreshed successfully",
        accessToken,
      });
    } catch (error: any) {
      console.error("[AUTH ERROR] Token refresh error", {
        error: error.message,
      });
      res.status(500).json({
        message: "Failed to refresh token. Please try again.",
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
