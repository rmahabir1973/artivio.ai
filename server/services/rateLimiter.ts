import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
  lastWarning?: number;
}

// In-memory rate limit store per user/IP
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
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;      // Custom error message
  keyGenerator?: (req: Request) => string; // Custom key generator
}

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
  // AI Generation endpoints - more restrictive
  generation: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 generations per minute
    message: 'Too many generation requests. Please wait before trying again.',
  },
  
  // API endpoints - moderate
  api: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,          // 60 requests per minute
    message: 'Too many requests. Please slow down.',
  },
  
  // Auth endpoints - strict to prevent brute force
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,          // 10 attempts per 15 minutes
    message: 'Too many authentication attempts. Please try again later.',
  },
  
  // Webhook endpoints - relaxed (but still protected)
  webhook: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 100,         // 100 per minute
    message: 'Webhook rate limit exceeded.',
  },

  // Admin endpoints - moderate protection
  admin: {
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 30,          // 30 requests per minute
    message: 'Admin rate limit exceeded. Please slow down.',
  },
};

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
  const { windowMs, maxRequests, message, keyGenerator } = config;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = keyGenerator ? keyGenerator(req) : getIdentifier(req);
    const endpoint = req.path;
    const key = `${identifier}:${endpoint}`;
    
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
      
      console.warn(`[RATE LIMIT] Blocked request from ${identifier} to ${endpoint} (${record.count}/${maxRequests})`);
      
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
      console.warn(`[RATE LIMIT] Warning: ${identifier} approaching limit on ${endpoint} (${record.count}/${maxRequests})`);
    }
    
    next();
  };
}

// Convenience middleware for specific endpoint types
export const rateLimitGeneration = rateLimit(RATE_LIMIT_CONFIGS.generation);
export const rateLimitApi = rateLimit(RATE_LIMIT_CONFIGS.api);
export const rateLimitAuth = rateLimit(RATE_LIMIT_CONFIGS.auth);
export const rateLimitWebhook = rateLimit(RATE_LIMIT_CONFIGS.webhook);
export const rateLimitAdmin = rateLimit(RATE_LIMIT_CONFIGS.admin);

// Global rate limit for all routes (very permissive, catches obvious abuse)
export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  maxRequests: 200,        // 200 requests per minute per user/IP
  message: 'Global rate limit exceeded. Please slow down.',
});

// Get current rate limit stats for monitoring
export function getRateLimitStats(): { 
  totalTracked: number; 
  topConsumers: Array<{ key: string; count: number; endpoint: string }>;
} {
  const entries: Array<{ key: string; count: number; endpoint: string }> = [];
  
  rateLimitStore.forEach((record, key) => {
    const parts = key.split(':');
    const endpoint = parts[parts.length - 1];
    entries.push({ key, count: record.count, endpoint });
  });
  
  // Sort by count descending and get top 10
  entries.sort((a, b) => b.count - a.count);
  
  return {
    totalTracked: rateLimitStore.size,
    topConsumers: entries.slice(0, 10),
  };
}
