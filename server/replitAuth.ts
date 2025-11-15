import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Trust proxy for secure cookie detection
    cookie: {
      httpOnly: true,
      // Don't set secure/sameSite statically - let them be set per-request
      // This fixes issues with HTTP dev and HTTPS production
      secure: 'auto', // Auto-detect based on connection
      sameSite: 'lax', // Use lax for better compatibility
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

// Normalize hostname (strip www, handle localhost)
function normalizeHostname(hostname: string): string {
  // Remove www. prefix for consistency
  const normalized = hostname.replace(/^www\./, '');
  console.log('[AUTH DEBUG] Normalized hostname:', { original: hostname, normalized });
  return normalized;
}

// Get protocol from request (handles proxies)
function getProtocol(req: any): string {
  // Trust X-Forwarded-Proto from proxy
  if (req.headers['x-forwarded-proto']) {
    return req.headers['x-forwarded-proto'];
  }
  // For Replit, check if we're on a replit.app domain (always HTTPS)
  if (req.hostname && req.hostname.includes('.repl.co')) {
    return 'https';
  }
  // Fallback to req.protocol
  return req.protocol || 'https';
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    // Note: User creation and plan assignment happens in GET /api/auth/user
    // Don't create user here, otherwise the !user check will always be false
    console.log('[AUTH DEBUG] verify callback completed, session created');
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a protocol/host combination
  const ensureStrategy = (req: any) => {
    // Include BOTH protocol and host in strategy key to handle HTTP/HTTPS correctly
    // This ensures each protocol/host combo gets its own callback URL
    const originalHost = req.get('host') || req.hostname;
    const protocol = getProtocol(req);
    const strategyName = `replitauth:${protocol}://${originalHost}`;
    const callbackURL = `${protocol}://${originalHost}/api/callback`;
    
    if (!registeredStrategies.has(strategyName)) {
      console.log('[AUTH DEBUG] Registering new strategy:', { 
        strategyName, 
        callbackURL,
        originalHost,
        protocol
      });
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    } else {
      console.log('[AUTH DEBUG] Strategy already exists:', {
        strategyName,
        callbackURL,
      });
    }
    return strategyName;
  };

  passport.serializeUser((user: Express.User, cb) => {
    console.log('[AUTH DEBUG] serializeUser called', {
      user: user ? 'present' : 'missing',
      hasClaims: !!(user as any)?.claims,
    });
    cb(null, user);
  });
  
  passport.deserializeUser((user: Express.User, cb) => {
    console.log('[AUTH DEBUG] deserializeUser called', {
      user: user ? 'present' : 'missing',
      hasClaims: !!(user as any)?.claims,
    });
    cb(null, user);
  });

  app.get("/api/login", (req, res, next) => {
    console.log('[AUTH DEBUG] /api/login - Starting authentication flow', {
      hostname: req.hostname,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      protocol: getProtocol(req),
    });
    const strategyName = ensureStrategy(req);
    
    // Save session before redirecting to ensure it persists
    req.session.save((err) => {
      if (err) {
        console.error('[AUTH DEBUG] Failed to save session before login:', err);
        return next(err);
      }
      console.log('[AUTH DEBUG] Session saved, initiating authentication');
      passport.authenticate(strategyName)(req, res, next);
    });
  });

  app.get("/api/callback", (req, res, next) => {
    console.log('[AUTH DEBUG] /api/callback - Callback hit', {
      hostname: req.hostname,
      sessionID: req.sessionID,
      hasSession: !!req.session,
      query: req.query,
      protocol: getProtocol(req),
    });
    const strategyName = ensureStrategy(req);
    
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  console.log('[AUTH DEBUG] isAuthenticated check', {
    sessionID: req.sessionID,
    isAuthenticated: req.isAuthenticated(),
    hasUser: !!user,
    hasExpiresAt: !!user?.expires_at,
    userKeys: user ? Object.keys(user) : [],
  });

  if (!req.isAuthenticated() || !user?.expires_at) {
    console.log('[AUTH DEBUG] Authentication failed - returning 401', {
      reason: !req.isAuthenticated() ? 'not authenticated' : 'no expires_at',
    });
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
