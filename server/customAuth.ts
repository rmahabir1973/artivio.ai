import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import { Express } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getBaseUrl } from "./urlUtils";

const SALT_ROUNDS = 10;

// Flag to track if Passport strategies have been initialized (prevent duplicate registration on hot reload)
let strategiesInitialized = false;

// Initialize Passport strategies for JWT auth (without session)
export function initializePassportStrategies(app?: Express) {
  // Prevent duplicate strategy registration on hot reload
  if (strategiesInitialized) {
    console.log("⏭️  Passport strategies already initialized, skipping...");
    return;
  }

  console.log("📋 Initializing Passport strategies...");

  // Initialize passport middleware if app is provided
  if (app) {
    console.log("📋 Initializing Passport middleware...");
    app.use(passport.initialize());
    console.log("✓ Passport middleware initialized");
  }

  // Local Strategy
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          console.log("[AUTH DEBUG] Local strategy - attempting login", { email });

          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email.toLowerCase()))
            .limit(1);

          if (!user) {
            console.log("[AUTH DEBUG] Local strategy - user not found", { email });
            return done(null, false, { message: "Invalid email or password" });
          }

          if (!user.password) {
            console.log("[AUTH DEBUG] Local strategy - no password set", { email });
            return done(null, false, {
              message: `This account uses ${user.authProvider} login. Please use the "Continue with Google" button.`,
            });
          }

          const isValidPassword = await bcrypt.compare(password, user.password);

          if (!isValidPassword) {
            console.log("[AUTH DEBUG] Local strategy - invalid password", { email });
            return done(null, false, { message: "Invalid email or password" });
          }

          console.log("[AUTH DEBUG] Local strategy - login successful", {
            userId: user.id,
            email: user.email,
          });

          return done(null, user);
        } catch (error) {
          console.error("[AUTH ERROR] Local strategy error", { error, email });
          return done(error);
        }
      }
    )
  );

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Use environment-aware callback URL
    const callbackURL = `${getBaseUrl()}/auth/callback`;
    
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL,
          scope: ["profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            console.log("[AUTH DEBUG] Google OAuth - callback received", {
              googleId: profile.id,
              email: profile.emails?.[0]?.value,
            });

            const email = profile.emails?.[0]?.value;

            if (!email) {
              console.error("[AUTH ERROR] Google OAuth - no email provided");
              return done(new Error("No email provided by Google"));
            }

            // Check if user exists by Google ID
            let [user] = await db
              .select()
              .from(users)
              .where(eq(users.googleId, profile.id))
              .limit(1);

            if (user) {
              console.log("[AUTH DEBUG] Google OAuth - existing user found by Google ID", {
                userId: user.id,
                email: user.email,
              });
              return done(null, user);
            }

            // Check if user exists by email
            [user] = await db
              .select()
              .from(users)
              .where(eq(users.email, email.toLowerCase()))
              .limit(1);

            if (user) {
              // Link Google account to existing email/password account
              console.log("[AUTH DEBUG] Google OAuth - linking to existing email account", {
                userId: user.id,
                email: user.email,
              });

              await db
                .update(users)
                .set({
                  googleId: profile.id,
                  authProvider: "google",
                  profileImageUrl: profile.photos?.[0]?.value || user.profileImageUrl,
                  updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));

              // Refetch updated user
              [user] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

              return done(null, user);
            }

            // Create new user from Google OAuth
            console.log("[AUTH DEBUG] Google OAuth - creating new user", {
              email,
              googleId: profile.id,
            });

            const [newUser] = await db
              .insert(users)
              .values({
                email: email.toLowerCase(),
                googleId: profile.id,
                authProvider: "google",
                firstName: profile.name?.givenName || "",
                lastName: profile.name?.familyName || "",
                profileImageUrl: profile.photos?.[0]?.value,
                credits: 0, // Will be set in onboarding
              })
              .returning();

            console.log("[AUTH DEBUG] Google OAuth - new user created", {
              userId: newUser.id,
              email: newUser.email,
            });

            return done(null, newUser);
          } catch (error) {
            console.error("[AUTH ERROR] Google OAuth error", {
              error,
              profile: profile?.id,
            });
            return done(error as Error);
          }
        }
      )
    );

    console.log("✓ Google OAuth initialized successfully");
  } else {
    console.warn("⚠️  Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  // Mark strategies as initialized
  strategiesInitialized = true;
  console.log("✓ Passport strategies initialized successfully");
}

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Helper function to verify passwords
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
