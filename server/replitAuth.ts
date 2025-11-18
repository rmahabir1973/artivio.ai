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
  
  // Determine if we should use secure cookies
  // CRITICAL FIX: 'auto' is NOT valid - must be boolean
  // Use secure cookies in production (HTTPS), but not in development (HTTP)
  const isProduction = process.env.NODE_ENV === 'production';
  const productionUrl = process.env.PRODUCTION_URL || '';
  const isHttps = productionUrl.startsWith('https://') || isProduction;
  
  console.log('[SESSION CONFIG]', {
    isProduction,
    isHttps,
    secureCookies: isHttps,
    sameSite: 'lax',
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Trust proxy headers (X-Forwarded-Proto, etc.)
    cookie: {
      httpOnly: true,
      secure: isHttps, // FIXED: Boolean value instead of invalid 'auto'
      sameSite: 'lax', // Lax for better mobile browser compatibility
      maxAge: sessionTtl,
      // Don't set domain - let browser handle it automatically
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
  
  console.log('[AUTH DEBUG] updateUserSession called', {
    hasAccessToken: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    hasExp: !!user.claims?.exp,
    expiresAt: user.expires_at,
  });
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
    // Explicitly serialize as plain JSON to persist refresh_token
    const userAny = user as any;
    const sessionUser = {
      claims: userAny.claims,
      access_token: userAny.access_token,
      refresh_token: userAny.refresh_token,
      expires_at: userAny.expires_at,
    };
    
    console.log('[AUTH DEBUG] serializeUser called', {
      user: user ? 'present' : 'missing',
      hasClaims: !!userAny.claims,
      hasRefreshToken: !!userAny.refresh_token,
      keys: Object.keys(sessionUser),
    });
    
    cb(null, sessionUser);
  });
  
  passport.deserializeUser((user: Express.User, cb) => {
    console.log('[AUTH DEBUG] deserializeUser called', {
      user: user ? 'present' : 'missing',
      hasClaims: !!(user as any)?.claims,
      hasRefreshToken: !!(user as any)?.refresh_token,
      userKeys: user ? Object.keys(user) : [],
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
  const timeUntilExpiry = user.expires_at - now;
  
  console.log('[AUTH DEBUG] Token expiration check', {
    now,
    expires_at: user.expires_at,
    timeUntilExpiry,
    isExpired: timeUntilExpiry <= 0,
  });
  
  if (timeUntilExpiry > 0) {
    console.log('[AUTH DEBUG] Token still valid, allowing request');
    return next();
  }

  console.log('[AUTH DEBUG] Token expired, attempting refresh');
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log('[AUTH DEBUG] No refresh token available, returning 401');
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    console.log('[AUTH DEBUG] Token refresh successful');
    return next();
  } catch (error: any) {
    console.error('[AUTH DEBUG] Token refresh failed:', error.message);
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const checkTrialExpiration: RequestHandler = async (req, res, next) => {
  // Skip trial check for billing and plan-related endpoints
  // Allow expired trial users to upgrade by accessing these paths
  const billingPaths = [
    '/api/billing/checkout',
    '/api/billing/portal',
    '/api/subscription',
    '/api/plans',
    '/api/public/plan-selection', // Allow expired trial users to select upgrade plan
  ];
  
  if (billingPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const user = req.user as any;
  if (!user?.claims?.sub) {
    return next(); // Let isAuthenticated handle this
  }

  try {
    const { storage } = await import('./storage');
    const subscription = await storage.getUserSubscription(user.claims.sub);
    
    if (!subscription) {
      // No subscription - allow access (edge case)
      return next();
    }

    const now = new Date();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    
    // Check if trial has expired
    if (subscription.plan.billingPeriod === 'trial' && periodEnd < now) {
      console.log('[TRIAL CHECK] Trial expired', {
        userId: user.claims.sub,
        periodEnd,
        now,
      });
      
      return res.status(403).json({ 
        error: "trial_expired",
        message: "Your free trial has ended. Please upgrade to continue using Artivio AI.",
        trialEndDate: periodEnd.toISOString(),
      });
    }
    
    return next();
  } catch (error: any) {
    console.error('[TRIAL CHECK] Error checking trial expiration:', error);
    // Allow request to continue on error to avoid blocking legitimate users
    return next();
  }
};
