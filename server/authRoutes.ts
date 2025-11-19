import { Express } from "express";
import passport from "passport";
import { hashPassword } from "./customAuth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

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

      // Log user in automatically after registration
      req.login(newUser, (err) => {
        if (err) {
          console.error("[AUTH] Auto-login after registration failed", {
            error: err,
          });
          return res.status(500).json({
            message: "Registration successful, but auto-login failed. Please log in manually.",
          });
        }

        console.log("[AUTH] ✓ Auto-login successful after registration");
        res.json({
          message: "Registration successful",
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
          },
        });
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

      passport.authenticate("local", (err: any, user: any, info: any) => {
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

        req.login(user, (loginErr) => {
          if (loginErr) {
            console.error("[AUTH ERROR] Session creation failed", {
              error: loginErr,
            });
            return res.status(500).json({
              message: "Login failed. Please try again.",
            });
          }

          console.log("[AUTH] ✓ Login successful", {
            userId: user.id,
            email: user.email,
          });

          res.json({
            message: "Login successful",
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            },
          });
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

  // Google OAuth - Callback (with explicit session save to prevent race condition)
  app.get("/auth/callback", (req, res, next) => {
    passport.authenticate("google", (err: any, user: any, info: any) => {
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
        sessionID: req.sessionID,
      });

      // Manually log the user in
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("[AUTH ERROR] Failed to establish session after OAuth", {
            error: loginErr,
          });
          return res.redirect("/?error=session_failed");
        }

        console.log("[AUTH] Session login successful, saving session...", {
          userId: user.id,
          sessionID: req.sessionID,
        });

        // CRITICAL: Explicitly save session to database before redirecting
        // This prevents race condition where redirect happens before session is persisted
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("[AUTH ERROR] Failed to save session to database", {
              error: saveErr,
              userId: user.id,
            });
            return res.redirect("/?error=session_save_failed");
          }

          console.log("[AUTH] ✓ Session saved successfully to database", {
            userId: user.id,
            email: user.email,
            sessionID: req.sessionID,
          });

          // Now it's safe to redirect - session is guaranteed to be in database
          res.redirect("/?login=success");
        });
      });
    })(req, res, next);
  });

  // Get current user
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.id;
      let user = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user || user.length === 0) {
        console.error("[AUTH] User not found in database", { userId });
        return res.status(404).json({ message: "User not found" });
      }

      const currentUser = user[0];

      // Hardcoded admin emails for access control
      const ADMIN_EMAILS = [
        "ryan.mahabir@outlook.com",
        "admin@artivio.ai",
        "joe@joecodeswell.com",
        "jordanlambrecht@gmail.com",
      ];

      // Override isAdmin based on hardcoded email list
      const isAdmin = ADMIN_EMAILS.includes(currentUser.email?.toLowerCase() || "");
      const userWithAdminOverride = { ...currentUser, isAdmin };

      // Disable caching to ensure fresh auth data
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      res.json(userWithAdminOverride);
    } catch (error) {
      console.error("[AUTH ERROR] Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout
  app.get("/api/logout", (req, res) => {
    console.log("[AUTH] Logout initiated", {
      userId: (req.user as any)?.id,
      sessionID: req.sessionID,
    });

    req.logout((err) => {
      if (err) {
        console.error("[AUTH] Logout error:", err);
      }

      // Build the correct redirect URL
      const protocol =
        req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
      const host = req.get("host") || req.hostname;
      const baseUrl = `${protocol}://${host}`;
      const redirectUrl = `${baseUrl}?logout=success`;

      // Destroy the session in the database (if it exists)
      if (req.session) {
        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            console.error("[AUTH] Session destroy error:", destroyErr);
          }
        });
      }

      // Clear the session cookie explicitly
      res.clearCookie("artivio.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" || process.env.PRODUCTION_URL?.startsWith("https://"),
        sameSite: "lax",
        path: "/",
      });

      console.log("[AUTH] ✓ Logout complete - session destroyed and cookie cleared", {
        redirectUrl,
      });

      // Redirect to home page with logout success query param
      res.redirect(redirectUrl);
    });
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
