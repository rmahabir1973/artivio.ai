/**
 * Centralized URL utility for generating production-safe base URLs
 * Prevents dev domain leakage in production environments
 */

/**
 * Get normalized base URL with robust scheme validation and fallback logic
 * Priority in DEVELOPMENT: REPLIT_DEV_DOMAIN > localhost (ensures webhooks reach dev environment)
 * Priority in PRODUCTION: PRODUCTION_URL > REPLIT_DOMAINS > localhost
 */
export function getBaseUrl(): string {
  let baseUrl = '';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // In development, prioritize DEV domain for webhook callbacks
  if (isDevelopment && process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    console.log(`[URL] Development mode: Using DEV domain for callbacks: ${baseUrl}`);
    return baseUrl.replace(/\/+$/, '');
  }
  
  // In production, use PRODUCTION_URL (highest priority)
  if (process.env.PRODUCTION_URL) {
    const trimmed = process.env.PRODUCTION_URL.trim();
    if (trimmed) {
      // Ensure PRODUCTION_URL has scheme
      baseUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      
      // Validate it's a valid URL
      try {
        new URL(baseUrl);
      } catch {
        console.warn(`Invalid PRODUCTION_URL: ${process.env.PRODUCTION_URL}, falling back to REPLIT_DOMAINS`);
        baseUrl = '';
      }
    }
  }
  
  // Try REPLIT_DOMAINS (published app domain)
  if (!baseUrl && process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    for (const domain of domains) {
      const trimmed = domain.trim();
      if (trimmed) {
        const candidate = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
        try {
          new URL(candidate);
          baseUrl = candidate;
          break;
        } catch {
          // Skip invalid domain, try next
          continue;
        }
      }
    }
  }
  
  // Fall back to REPLIT_DEV_DOMAIN (development)
  if (!baseUrl && process.env.REPLIT_DEV_DOMAIN) {
    baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Final fallback: localhost
  if (!baseUrl) {
    baseUrl = 'http://localhost:5000';
  }
  
  // Normalize: remove trailing slash to prevent double slashes
  return baseUrl.replace(/\/+$/, '');
}
