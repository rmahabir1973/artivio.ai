/**
 * Structured Logger for Production-Safe Logging
 * 
 * Provides log levels, PII scrubbing, and performance-optimized logging
 * for the referral system and other critical paths.
 */

// Safe JSON stringifier to prevent circular reference errors
function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, 2);
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  metadata?: Record<string, any>;
}

class Logger {
  private currentLevel: LogLevel;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    // Set log level based on environment
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    this.currentLevel = envLevel || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.currentLevel];
  }

  private scrubPII(obj: any, seen = new WeakSet()): any {
    if (typeof obj === 'string') {
      // Mask email addresses
      let scrubbed = obj.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
      
      // Mask UUID patterns (8-4-4-4-12 format)
      scrubbed = scrubbed.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]');
      
      // Mask other ID-like patterns (long alphanumeric strings)
      scrubbed = scrubbed.replace(/\b[0-9a-f]{24,}\b/gi, '[ID]');
      
      return scrubbed;
    }
    
    if (typeof obj === 'object' && obj !== null) {
      // Handle circular references
      if (seen.has(obj)) {
        return '[Circular]';
      }
      seen.add(obj);
      
      const scrubbed: any = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        // Redact sensitive field names including user IDs, names, and any field with 'id' or 'Id' in name
        const lowerKey = key.toLowerCase();
        if (
          ['email', 'password', 'token', 'secret', 'name', 'username', 'firstname', 'lastname', 'fullname'].includes(lowerKey) ||
          lowerKey.includes('email') ||
          lowerKey.includes('name') || // Redact any field containing 'name'
          (lowerKey.includes('id') && lowerKey !== 'txid') || // Allow txId (random string, not a real ID)
          lowerKey.endsWith('id')
        ) {
          scrubbed[key] = '[REDACTED]';
        } else {
          // Recursively scrub nested objects with circular reference tracking
          scrubbed[key] = this.scrubPII(obj[key], seen);
        }
      }
      return scrubbed;
    }
    
    return obj;
  }

  private formatLog(level: LogLevel, category: string, message: string, metadata?: Record<string, any>): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata: metadata ? this.scrubPII(metadata) : undefined,
    };

    // In production, use JSON for log aggregation tools
    if (process.env.NODE_ENV === 'production') {
      return safeStringify(entry);
    }

    // In development, use human-readable format
    const metaStr = metadata ? ` ${safeStringify(this.scrubPII(metadata))}` : '';
    return `[${entry.timestamp}] ${level.toUpperCase()} [${category}] ${message}${metaStr}`;
  }

  debug(category: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', category, message, metadata));
    }
  }

  info(category: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', category, message, metadata));
    }
  }

  warn(category: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', category, message, metadata));
    }
  }

  error(category: string, message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatLog('error', category, message, metadata));
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Specific logger for referral operations
// NOTE: Never log user IDs (userId, refereeId, referrerId) - use referralId instead
export const referralLogger = {
  codeGenerated: (codeLength: number, duration: number) => {
    logger.info('REFERRAL', 'Code generated', { codeLength, duration });
  },

  codeRetrieved: (duration: number) => {
    logger.debug('REFERRAL', 'Code retrieved from cache', { duration });
  },

  clickTracked: (referralId: string, hasEmail: boolean, duration: number) => {
    logger.info('REFERRAL', 'Click tracked', { referralId, hasEmail, duration });
  },

  clickDuplicate: (referralCodeLength: number) => {
    logger.warn('REFERRAL', 'Duplicate click attempt', { referralCodeLength });
  },

  conversionSuccess: (referralId: string, txId: string, referrerCredits: number, refereeCredits: number, duration: number) => {
    logger.info('REFERRAL', 'Conversion succeeded', { 
      referralId, 
      txId, 
      referrerCredits, 
      refereeCredits, 
      duration 
    });
  },

  conversionRaceDetected: (referralId: string, txId: string, duration: number) => {
    logger.warn('REFERRAL', 'Race condition detected - conversion blocked', { 
      referralId, 
      txId, 
      duration,
      note: 'Concurrent conversion attempts properly prevented'
    });
  },

  conversionNotFound: (referralCodeLength: number, txId: string, duration: number) => {
    logger.debug('REFERRAL', 'No pending referral found', { 
      referralCodeLength, 
      txId, 
      duration 
    });
  },

  error: (operation: string, error: Error, metadata?: Record<string, any>) => {
    logger.error('REFERRAL', `Operation failed: ${operation}`, { 
      error: error.message, 
      stack: error.stack,
      ...metadata 
    });
  },
};
