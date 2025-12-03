import { ServerClient } from 'postmark';

// Postmark client for email alerts
const postmarkClient = process.env.POSTMARK_SERVER_TOKEN 
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null;

// Admin email for alerts (you can add multiple comma-separated)
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || 'support@artivio.ai';

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// Error categories
export type ErrorCategory = 
  | 'ai_generation'
  | 'payment'
  | 'authentication'
  | 'database'
  | 'external_api'
  | 'webhook'
  | 'rate_limit'
  | 'social_media'
  | 'general';

export interface ErrorLog {
  id: string;
  timestamp: Date;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  details?: string;
  userId?: string;
  endpoint?: string;
  stack?: string;
  resolved: boolean;
  emailSent: boolean;
}

// In-memory error log (recent errors for quick access)
const recentErrors: ErrorLog[] = [];
const MAX_RECENT_ERRORS = 500;
const ERROR_RETENTION_DAYS = 7;
const ERROR_RETENTION_MS = ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Error counts for throttling alerts (with bounded size)
interface ThrottleRecord {
  count: number;
  firstSeen: number;
  lastAlerted: number;
}
const errorCounts = new Map<string, ThrottleRecord>();
const MAX_THROTTLE_ENTRIES = 1000;
const ALERT_THROTTLE_MINUTES = 15;
const THROTTLE_CLEANUP_HOURS = 1;

// Periodic cleanup for old errors (runs every hour)
setInterval(() => {
  const now = Date.now();
  const cutoffTime = now - ERROR_RETENTION_MS;
  
  // Remove errors older than retention period
  let removedCount = 0;
  while (recentErrors.length > 0) {
    const oldest = recentErrors[recentErrors.length - 1];
    if (oldest.timestamp.getTime() < cutoffTime) {
      recentErrors.pop();
      removedCount++;
    } else {
      break;
    }
  }
  
  // Cleanup throttle records older than 1 hour
  const throttleCutoff = now - THROTTLE_CLEANUP_HOURS * 60 * 60 * 1000;
  const keysToDelete: string[] = [];
  errorCounts.forEach((record, key) => {
    if (record.lastAlerted < throttleCutoff) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => errorCounts.delete(key));
  
  if (removedCount > 0 || keysToDelete.length > 0) {
    console.log(`[ERROR MONITOR] Cleanup: removed ${removedCount} old errors, ${keysToDelete.length} throttle records`);
  }
}, 60 * 60 * 1000); // Every hour

// Generate unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Normalize error key for consistent throttling
function normalizeErrorKey(category: ErrorCategory, message: string): string {
  // Normalize message: lowercase, trim, remove dynamic parts like IDs/timestamps
  const normalized = message
    .toLowerCase()
    .trim()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replace(/\b\d{13,}\b/g, 'TIMESTAMP')
    .replace(/\b\d+\b/g, 'N')
    .substring(0, 100);
  return `${category}:${normalized}`;
}

// Log an error to the monitoring system
export async function logError(params: {
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  details?: string;
  userId?: string;
  endpoint?: string;
  error?: Error;
}): Promise<ErrorLog> {
  const { severity, category, message, details, userId, endpoint, error } = params;
  
  const errorLog: ErrorLog = {
    id: generateErrorId(),
    timestamp: new Date(),
    severity,
    category,
    message,
    details: details || error?.message,
    userId,
    endpoint,
    stack: error?.stack,
    resolved: false,
    emailSent: false,
  };
  
  // Add to recent errors (in memory)
  recentErrors.unshift(errorLog);
  
  // Enforce max size AND retention at insert time
  const retentionCutoff = Date.now() - ERROR_RETENTION_MS;
  while (recentErrors.length > MAX_RECENT_ERRORS || 
         (recentErrors.length > 0 && recentErrors[recentErrors.length - 1].timestamp.getTime() < retentionCutoff)) {
    recentErrors.pop();
  }
  
  // Log to console
  const logLevel = severity === 'critical' || severity === 'error' ? 'error' : 'warn';
  console[logLevel](`[ERROR MONITOR] [${severity.toUpperCase()}] [${category}] ${message}`, {
    id: errorLog.id,
    userId,
    endpoint,
    details,
  });
  
  // Send email alert for critical and error severity
  if ((severity === 'critical' || severity === 'error') && postmarkClient) {
    const emailSent = await sendErrorAlert(errorLog);
    errorLog.emailSent = emailSent;
  }
  
  return errorLog;
}

// Send email alert - returns true if email was sent
async function sendErrorAlert(errorLog: ErrorLog): Promise<boolean> {
  const errorKey = normalizeErrorKey(errorLog.category, errorLog.message);
  const now = Date.now();
  const existing = errorCounts.get(errorKey);
  
  // Check if we should throttle this alert
  if (existing) {
    existing.count++;
    
    // Don't send another email if we recently alerted for this error type
    if (now - existing.lastAlerted < ALERT_THROTTLE_MINUTES * 60 * 1000) {
      console.log(`[ERROR MONITOR] Throttling alert for ${errorKey} (count: ${existing.count})`);
      return false;
    }
    
    existing.lastAlerted = now;
  } else {
    // Bound the throttle map size
    if (errorCounts.size >= MAX_THROTTLE_ENTRIES) {
      // Remove oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      errorCounts.forEach((record, key) => {
        if (record.lastAlerted < oldestTime) {
          oldestTime = record.lastAlerted;
          oldestKey = key;
        }
      });
      if (oldestKey) {
        errorCounts.delete(oldestKey);
      }
    }
    errorCounts.set(errorKey, { count: 1, firstSeen: now, lastAlerted: now });
  }
  
  try {
    const severityColor = errorLog.severity === 'critical' ? '#dc2626' : '#f59e0b';
    const count = existing?.count || 1;
    
    await postmarkClient!.sendEmail({
      From: 'alerts@artivio.ai',
      To: ADMIN_EMAIL,
      Subject: `[${errorLog.severity.toUpperCase()}] Artivio AI - ${errorLog.category}: ${errorLog.message.substring(0, 50)}`,
      HtmlBody: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #fff; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #1a1a24; border-radius: 12px; overflow: hidden; }
            .header { background: ${severityColor}; padding: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; color: #fff; }
            .content { padding: 24px; }
            .field { margin-bottom: 16px; }
            .label { color: #a1a1aa; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
            .value { color: #fff; font-size: 14px; word-break: break-word; }
            .code { background: #0a0a0f; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 12px; overflow-x: auto; white-space: pre-wrap; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
            .severity-critical { background: #dc2626; color: #fff; }
            .severity-error { background: #f59e0b; color: #000; }
            .footer { padding: 16px 24px; background: #0a0a0f; text-align: center; color: #71717a; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Artivio AI Error Alert</h1>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Severity</div>
                <div class="value"><span class="badge severity-${errorLog.severity}">${errorLog.severity.toUpperCase()}</span></div>
              </div>
              <div class="field">
                <div class="label">Category</div>
                <div class="value">${errorLog.category}</div>
              </div>
              <div class="field">
                <div class="label">Message</div>
                <div class="value">${errorLog.message}</div>
              </div>
              ${errorLog.details ? `
              <div class="field">
                <div class="label">Details</div>
                <div class="code">${errorLog.details}</div>
              </div>
              ` : ''}
              ${errorLog.userId ? `
              <div class="field">
                <div class="label">User ID</div>
                <div class="value">${errorLog.userId}</div>
              </div>
              ` : ''}
              ${errorLog.endpoint ? `
              <div class="field">
                <div class="label">Endpoint</div>
                <div class="value">${errorLog.endpoint}</div>
              </div>
              ` : ''}
              <div class="field">
                <div class="label">Timestamp</div>
                <div class="value">${errorLog.timestamp.toISOString()}</div>
              </div>
              <div class="field">
                <div class="label">Error ID</div>
                <div class="value">${errorLog.id}</div>
              </div>
              ${count > 1 ? `
              <div class="field">
                <div class="label">Occurrence Count</div>
                <div class="value">${count} times since first seen</div>
              </div>
              ` : ''}
              ${errorLog.stack ? `
              <div class="field">
                <div class="label">Stack Trace</div>
                <div class="code">${errorLog.stack}</div>
              </div>
              ` : ''}
            </div>
            <div class="footer">
              <p>This is an automated alert from Artivio AI Error Monitoring</p>
              <p>View more details in the Admin Panel > Error Monitor</p>
            </div>
          </div>
        </body>
        </html>
      `,
      TextBody: `
Artivio AI Error Alert

Severity: ${errorLog.severity.toUpperCase()}
Category: ${errorLog.category}
Message: ${errorLog.message}
${errorLog.details ? `Details: ${errorLog.details}` : ''}
${errorLog.userId ? `User ID: ${errorLog.userId}` : ''}
${errorLog.endpoint ? `Endpoint: ${errorLog.endpoint}` : ''}
Timestamp: ${errorLog.timestamp.toISOString()}
Error ID: ${errorLog.id}
${count > 1 ? `Occurrence Count: ${count}` : ''}
${errorLog.stack ? `\nStack Trace:\n${errorLog.stack}` : ''}

---
View more details in the Admin Panel > Error Monitor
      `,
    });
    
    console.log(`[ERROR MONITOR] Email alert sent for error ${errorLog.id}`);
    return true;
  } catch (emailError) {
    console.error('[ERROR MONITOR] Failed to send email alert:', emailError);
    return false;
  }
}

// Get recent errors from memory
export function getRecentErrors(params?: {
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  limit?: number;
  includeResolved?: boolean;
}): ErrorLog[] {
  let filtered = recentErrors;
  
  if (params?.severity) {
    filtered = filtered.filter(e => e.severity === params.severity);
  }
  
  if (params?.category) {
    filtered = filtered.filter(e => e.category === params.category);
  }
  
  if (!params?.includeResolved) {
    filtered = filtered.filter(e => !e.resolved);
  }
  
  return filtered.slice(0, params?.limit || 50);
}

// Get error statistics
export function getErrorStats(): {
  total: number;
  bySeverity: Record<ErrorSeverity, number>;
  byCategory: Record<string, number>;
  last24Hours: number;
  lastHour: number;
  criticalUnresolved: number;
} {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;
  
  const bySeverity: Record<ErrorSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0,
    critical: 0,
  };
  
  const byCategory: Record<string, number> = {};
  let last24Hours = 0;
  let lastHour = 0;
  let criticalUnresolved = 0;
  
  for (const error of recentErrors) {
    bySeverity[error.severity]++;
    byCategory[error.category] = (byCategory[error.category] || 0) + 1;
    
    const errorTime = error.timestamp.getTime();
    if (errorTime > dayAgo) last24Hours++;
    if (errorTime > hourAgo) lastHour++;
    if (error.severity === 'critical' && !error.resolved) criticalUnresolved++;
  }
  
  return {
    total: recentErrors.length,
    bySeverity,
    byCategory,
    last24Hours,
    lastHour,
    criticalUnresolved,
  };
}

// Mark an error as resolved
export function resolveError(errorId: string): boolean {
  const error = recentErrors.find(e => e.id === errorId);
  if (error) {
    error.resolved = true;
    return true;
  }
  return false;
}

// Clear all errors (for testing/development)
export function clearErrors(): void {
  recentErrors.length = 0;
  errorCounts.clear();
  console.log('[ERROR MONITOR] All errors cleared');
}

// Helper to wrap async functions with error monitoring
export function withErrorMonitoring<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  category: ErrorCategory,
  context?: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      await logError({
        severity: 'error',
        category,
        message: context || fn.name || 'Unknown function error',
        error: error as Error,
      });
      throw error;
    }
  }) as T;
}

// Express error handling middleware
export function errorMonitorMiddleware(err: Error, req: any, res: any, next: any) {
  logError({
    severity: 'error',
    category: 'general',
    message: err.message,
    error: err,
    userId: req.user?.id,
    endpoint: req.path,
  }).catch(console.error);
  
  next(err);
}

console.log('[ERROR MONITOR] Error monitoring service initialized');
