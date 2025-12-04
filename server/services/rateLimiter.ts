import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
  lastWarning?: number;
}

// In-memory rate limit store - key is identifier only (not per-endpoint for global limits)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired records periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((record, key) => {
    if (now > record.resetTime) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => rateLimitStore.delete(key));
  
  if (keysToDelete.length > 0) {
    console.log(`[RATE LIMIT] Cleanup: removed ${keysToDelete.length} expired records`);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  keyPrefix: string;     // Prefix for rate limit key (to separate different limit types)
  keyGenerator?: (req: Request) => string; // Custom key generator
  perEndpoint?: boolean; // Whether to track per-endpoint (default false = aggregate)
}

// Get identifier for rate limiting (user ID if authenticated, IP otherwise)
function getIdentifier(req: Request): string {
  const user = (req as any).user;
  if (user?.id) {
    return `user:${user.id}`;
  }
  
  // Get IP from various headers (for proxied requests)
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = typeof forwardedFor === 'string' 
    ? forwardedFor.split(',')[0].trim()
    : req.ip || req.socket.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
}

// Rate limiting middleware factory
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, message, keyPrefix, keyGenerator, perEndpoint = false } = config;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = keyGenerator ? keyGenerator(req) : getIdentifier(req);
    // Only include endpoint if perEndpoint is true
    const key = perEndpoint 
      ? `${keyPrefix}:${identifier}:${req.path}`
      : `${keyPrefix}:${identifier}`;
    
    const now = Date.now();
    const record = rateLimitStore.get(key);
    
    // Check if this is a new window or existing
    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { 
        count: 1, 
        resetTime: now + windowMs 
      });
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      
      return next();
    }
    
    // Increment count
    record.count++;
    
    const remaining = Math.max(0, maxRequests - record.count);
    const resetIn = Math.ceil((record.resetTime - now) / 1000);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    
    // Check if limit exceeded
    if (record.count > maxRequests) {
      res.setHeader('Retry-After', resetIn);
      
      console.warn(`[RATE LIMIT] Blocked request from ${identifier} (${record.count}/${maxRequests}) - key: ${keyPrefix}`);
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: message || 'Rate limit exceeded. Please try again later.',
        retryAfter: resetIn,
        limit: maxRequests,
        windowMs,
      });
    }
    
    // Log warning when approaching limit (80% threshold)
    if (record.count >= maxRequests * 0.8 && !record.lastWarning) {
      record.lastWarning = now;
      console.warn(`[RATE LIMIT] Warning: ${identifier} approaching limit (${record.count}/${maxRequests}) - key: ${keyPrefix}`);
    }
    
    next();
  };
}

// Rate limit modes:
// - 'disabled': No rate limiting (noop)
// - 'monitor': Log violations but don't block (for testing)
// - 'enforce': Block requests that exceed limits (production)
type RateLimitMode = 'disabled' | 'monitor' | 'enforce';

const RATE_LIMIT_MODE: RateLimitMode = 'monitor'; // Set to 'enforce' for production

console.log(`📊 Rate limiting mode: ${RATE_LIMIT_MODE}`);

// Track rate limit violations for monitoring
interface RateLimitViolation {
  timestamp: Date;
  identifier: string;
  limitType: string;
  count: number;
  maxRequests: number;
  path: string;
  wouldBlock: boolean;
}

const rateLimitViolations: RateLimitViolation[] = [];
const MAX_VIOLATIONS = 100;

// Get violations for admin monitoring
export function getRateLimitViolations(): RateLimitViolation[] {
  return rateLimitViolations.slice(-50).reverse();
}

// Pass-through middleware for when rate limits are disabled
const noopMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();

// Monitoring middleware - logs violations but doesn't block
function createMonitoringMiddleware(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix, keyGenerator, perEndpoint = false } = config;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = keyGenerator ? keyGenerator(req) : getIdentifier(req);
    const key = perEndpoint 
      ? `${keyPrefix}:${identifier}:${req.path}`
      : `${keyPrefix}:${identifier}`;
    
    const now = Date.now();
    let record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      record = rateLimitStore.get(key)!;
    } else {
      record.count++;
    }
    
    // Set informational headers (even in monitor mode)
    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    res.setHeader('X-RateLimit-Mode', 'monitor');
    
    // Would this have been blocked in enforce mode?
    if (record.count > maxRequests) {
      const violation: RateLimitViolation = {
        timestamp: new Date(),
        identifier,
        limitType: keyPrefix,
        count: record.count,
        maxRequests,
        path: req.path,
        wouldBlock: true,
      };
      
      rateLimitViolations.push(violation);
      if (rateLimitViolations.length > MAX_VIOLATIONS) {
        rateLimitViolations.shift();
      }
      
      console.warn(`📊 [RATE LIMIT MONITOR] Would block ${identifier} (${record.count}/${maxRequests}) - ${keyPrefix} - ${req.path}`);
    }
    
    // Always continue (don't block in monitor mode)
    next();
  };
}

// Factory to create rate limit middleware based on mode
function createRateLimitMiddleware(config: RateLimitConfig) {
  switch (RATE_LIMIT_MODE) {
    case 'disabled':
      return noopMiddleware;
    case 'monitor':
      return createMonitoringMiddleware(config);
    case 'enforce':
      return rateLimit(config);
    default:
      return noopMiddleware;
  }
}

// Global rate limit: 100 requests per 15 minutes per IP (aggregate across all endpoints)
export const globalRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  maxRequests: 100,           // 100 requests per 15 minutes
  keyPrefix: 'global',
  message: 'Too many requests. Please slow down and try again later.',
});

// Generation endpoints: 20 per hour per user (aggregate across all generation endpoints)
export const rateLimitGeneration = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000,   // 1 hour
  maxRequests: 20,            // 20 generations per hour
  keyPrefix: 'generation',
  message: 'Generation limit reached. You can make 20 AI generations per hour. Please wait before trying again.',
});

// Auth endpoints: INCREASED to 15 attempts per 15 minutes (was 5 - too strict)
// This accommodates legitimate retries while still preventing brute force
export const rateLimitAuth = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  maxRequests: 15,            // 15 attempts per 15 minutes (increased from 5)
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
});

// API endpoints: moderate limit
export const rateLimitApi = createRateLimitMiddleware({
  windowMs: 60 * 1000,        // 1 minute
  maxRequests: 60,            // 60 requests per minute
  keyPrefix: 'api',
  message: 'Too many API requests. Please slow down.',
});

// Webhook endpoints: relaxed (but still protected)
export const rateLimitWebhook = createRateLimitMiddleware({
  windowMs: 60 * 1000,        // 1 minute
  maxRequests: 100,           // 100 per minute
  keyPrefix: 'webhook',
  message: 'Webhook rate limit exceeded.',
});

// Admin endpoints: moderate protection
export const rateLimitAdmin = createRateLimitMiddleware({
  windowMs: 60 * 1000,        // 1 minute
  maxRequests: 30,            // 30 requests per minute
  keyPrefix: 'admin',
  message: 'Admin rate limit exceeded. Please slow down.',
});

// Get current rate limit stats for monitoring (aggregated by identifier, not endpoint)
export function getRateLimitStats(): { 
  totalTracked: number; 
  topConsumers: Array<{ key: string; count: number; limitType: string }>;
} {
  const entries: Array<{ key: string; count: number; limitType: string }> = [];
  
  rateLimitStore.forEach((record, key) => {
    const parts = key.split(':');
    const limitType = parts[0]; // e.g., 'global', 'generation', 'auth'
    entries.push({ key, count: record.count, limitType });
  });
  
  // Sort by count descending and get top 10
  entries.sort((a, b) => b.count - a.count);
  
  return {
    totalTracked: rateLimitStore.size,
    topConsumers: entries.slice(0, 10),
  };
}
