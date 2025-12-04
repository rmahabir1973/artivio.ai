import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializePassportStrategies } from "./customAuth";
import { pool } from "./db";

// ===== GLOBAL ERROR HANDLERS =====
// Prevent server crashes from unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED PROMISE REJECTION:', reason);
  console.error('   Promise:', promise);
  // Don't crash - log and continue
});

// Prevent server crashes from uncaught exceptions  
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  // Don't exit immediately - log and continue
  // The HTTP server and event loop will keep the process alive
});

// Validate critical environment variables at startup
const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('FATAL: Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please configure these variables before starting the server.');
  process.exit(1);
}

const app = express();

// ===== SECURITY HEADERS =====
// Disable x-powered-by header to hide server info
app.disable('x-powered-by');

const isDevelopment = process.env.NODE_ENV === 'development';

// TEMPORARILY DISABLED CSP FOR DEBUGGING - RE-ENABLE AFTER TESTING
// Configure helmet with comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: false, // DISABLED FOR TESTING
  /*contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://js.stripe.com",
        "https://www.googletagmanager.com",
        "https://accounts.google.com",
        "https://www.google.com",
        ...(isDevelopment ? ["http://localhost:*", "ws://localhost:*"] : []),
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        ...(isDevelopment ? ["http://localhost:*"] : []),
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.amazonaws.com",
        "https://images.unsplash.com",
        "https://images.pexels.com",
        "https://picsum.photos",
        "https://cdn.pixabay.com",
        "https://pixabay.com",
        "https://*.googleusercontent.com",
        "https://lh3.googleusercontent.com",
        "https://www.gravatar.com",
        "https://*.stripe.com",
        "https://peertube.stream",
        "https://*.peertube.stream",
        "https://framatube.org",
        "https://*.framatube.org",
        "*", // Allow external image URLs for user-uploaded content and AI-generated images
      ],
      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com",
      ],
      mediaSrc: [
        "'self'",
        "blob:",
        "data:",
        "https://*.amazonaws.com",
        "https://peertube.stream",
        "https://*.peertube.stream",
        "https://framatube.org",
        "https://*.framatube.org",
        "*", // Allow external media URLs for user content
      ],
      connectSrc_DISABLED: [
        "'self'",
        "wss:",
        "ws:",
        "https://api.stripe.com",
        "https://www.googleapis.com",
        "https://accounts.google.com",
        "https://*.amazonaws.com",
        "https://api.openai.com",
        "https://api.deepseek.com",
        "https://api.fish.audio",
        "https://api.elevenlabs.io",
        "https://api.pexels.com",
        "https://pixabay.com",
        "https://api.loops.so",
        "https://api.kie.ai",
        "https://klingai.com",
        "https://api.getlate.dev",
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com",
        "https://region1.google-analytics.com",
        ...(isDevelopment ? ["http://localhost:*", "ws://localhost:*"] : []),
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://accounts.google.com",
        "https://www.google.com",
        "https://www.youtube.com",
        "https://player.vimeo.com",
        "https:", // Allow any HTTPS video embeds (PeerTube instances vary widely)
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: [
        "'self'",
        "https://hooks.stripe.com",
        "https://accounts.google.com",
      ],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: isDevelopment ? null : [],
    },
  },*/
  crossOriginEmbedderPolicy: false, // Disable to allow loading external resources
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }, // Allow OAuth popups
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resource loading
  frameguard: { action: "sameorigin" }, // X-Frame-Options: SAMEORIGIN
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }, // Referrer-Policy
  xContentTypeOptions: true, // X-Content-Type-Options: nosniff
  hsts: false, // HSTS is handled by the hosting platform (Replit)
}));

// Permissions-Policy header (not included in helmet by default)
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=(self), usb=(), interest-cohort=()'
  );
  next();
});

// Global rate limiting - protects against API abuse
import { globalRateLimit, rateLimitGeneration, rateLimitAuth } from './services/rateLimiter';
app.use('/api', globalRateLimit);

// Apply stricter rate limits to specific sensitive endpoints
app.use('/api/generate', rateLimitGeneration);
app.use('/api/auth', rateLimitAuth);

// Serve uploaded images statically from public/uploads
app.use('/uploads', express.static('public/uploads'));

// Serve combined videos statically from public/video-combinations
app.use('/video-combinations', express.static('public/video-combinations'));

// Serve video thumbnails statically from public/thumbnails
app.use('/thumbnails', express.static('public/thumbnails'));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

// Stripe webhook requires raw body for signature verification
// Skip JSON/urlencoded parsing for webhook route - let the route's express.raw() handle it
const jsonParser = express.json({
  limit: '50mb', // Allow large base64 payloads for image editing (10 images max, properly validated)
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
});

const urlencodedParser = express.urlencoded({ extended: false, limit: '50mb' });

// Conditionally apply body parsers - skip for Stripe webhook
app.use((req, res, next) => {
  // Skip body parsing for Stripe webhook - it needs the raw body for signature verification
  if (req.originalUrl === '/api/webhooks/stripe') {
    return next();
  }
  jsonParser(req, res, next);
});

app.use((req, res, next) => {
  // Skip body parsing for Stripe webhook
  if (req.originalUrl === '/api/webhooks/stripe') {
    return next();
  }
  urlencodedParser(req, res, next);
});

// Configure cookie-parser with signing secret for secure plan selection
app.use(cookieParser(process.env.SESSION_SECRET));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize Passport strategies FIRST - quick operation
  initializePassportStrategies(app);
  
  // Register all routes immediately - this makes endpoints available for health checks
  const server = await registerRoutes(app);

  // Error monitoring integration
  const { logError, errorMonitorMiddleware } = await import('./services/errorMonitor');
  
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log error to monitoring system (non-blocking)
    logError({
      severity: status >= 500 ? 'error' : 'warning',
      category: 'general',
      message: message,
      error: err,
      userId: (req as any).user?.id,
      endpoint: req.path,
    }).catch(console.error);

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Debug: Check Google Analytics secrets at startup
    console.log('[Startup] Google Analytics secrets check:', {
      GA_PROPERTY_ID: !!process.env.GA_PROPERTY_ID,
      GA_DATA_CLIENT_EMAIL: !!process.env.GA_DATA_CLIENT_EMAIL,
      GA_DATA_PRIVATE_KEY: !!process.env.GA_DATA_PRIVATE_KEY,
    });
  });

  // === BACKGROUND INITIALIZATION (non-blocking) ===
  // These operations run AFTER server is listening to avoid health check timeouts
  
  // Schedule periodic cleanup of old uploaded files (runs every 24 hours)
  const { cleanupOldUploads } = await import('./imageHosting');
  setInterval(() => {
    cleanupOldUploads(24 * 60 * 60 * 1000).catch((err) => {
      console.error('Scheduled cleanup failed:', err);
    });
  }, 24 * 60 * 60 * 1000); // Run every 24 hours
  
  // Run cleanup immediately on startup (background)
  cleanupOldUploads(24 * 60 * 60 * 1000).catch((err) => {
    console.error('Startup cleanup failed:', err);
  });
  
  // Initialize subscription plans in background (creates default plans if they don't exist)
  const { initializePlans } = await import('./seedPlans');
  initializePlans().catch((error) => {
    console.error('⚠️  WARNING: Plan initialization failed:');
    console.error('   Error:', error instanceof Error ? error.message : error);
  });
  
  // Initialize pricing in background ONLY when explicitly enabled
  // This prevents connection pool exhaustion on every server restart
  if (process.env.PRICING_SEED_ENABLED === 'true') {
    console.log('📋 Pricing seed enabled - updating pricing data...');
    const { seedPricing } = await import('./seedPricing');
    seedPricing().catch((error) => {
      console.error('⚠️  WARNING: Pricing seed failed, using existing pricing data');
      console.error('   Error:', error instanceof Error ? error.message : error);
      console.error('   → Pricing may be outdated. Check database connection and restart server.');
    });
  } else {
    console.log('ℹ️  Pricing seed skipped (set PRICING_SEED_ENABLED=true to enable)');
  }
})();
