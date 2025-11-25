import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
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
app.use(express.json({
  limit: '50mb', // Allow large base64 payloads for image editing (10 images max, properly validated)
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
