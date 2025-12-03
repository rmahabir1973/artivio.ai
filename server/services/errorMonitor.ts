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

// Error counts for throttling alerts
const errorCounts = new Map<string, { count: number; firstSeen: number; lastAlerted: number }>();
const ALERT_THROTTLE_MINUTES = 15; // Don't send same error type more than once per 15 min

// Generate unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
  if (recentErrors.length > MAX_RECENT_ERRORS) {
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
    await sendErrorAlert(errorLog);
  }
  
  return errorLog;
}

// Send email alert
async function sendErrorAlert(errorLog: ErrorLog): Promise<void> {
  const errorKey = `${errorLog.category}:${errorLog.message.substring(0, 50)}`;
  const now = Date.now();
  const existing = errorCounts.get(errorKey);
  
  // Check if we should throttle this alert
  if (existing) {
    existing.count++;
    
    // Don't send another email if we recently alerted for this error type
    if (now - existing.lastAlerted < ALERT_THROTTLE_MINUTES * 60 * 1000) {
      console.log(`[ERROR MONITOR] Throttling alert for ${errorKey} (count: ${existing.count})`);
      return;
    }
    
    existing.lastAlerted = now;
  } else {
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
    
    errorLog.emailSent = true;
    console.log(`[ERROR MONITOR] Email alert sent for error ${errorLog.id}`);
  } catch (emailError) {
    console.error('[ERROR MONITOR] Failed to send email alert:', emailError);
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
