/**
 * Auth Bridge - Connects React auth state to queryClient's fetchWithAuth
 * 
 * CRITICAL: This must be initialized in main.tsx BEFORE React renders
 * to ensure all bundle chunks (including lazy-loaded routes) see the
 * auth token reference. Otherwise, production bundle splitting can
 * create separate copies with null tokens.
 */

let accessTokenRef: { current: string | null } = { current: null };
let refreshTokenFn: (() => Promise<string | null>) | null = null;
let logoutFn: (() => Promise<void>) | null = null;

export function initializeAuthBridge() {
  console.log("[AUTH BRIDGE] Initializing auth bridge before React render");
  console.log("[AUTH BRIDGE] ✓ Auth bridge initialized");
}

/**
 * Update the access token from React components
 * This is called by AuthProvider when the token changes
 */
export function setAccessToken(token: string | null) {
  accessTokenRef.current = token;
  console.log("[AUTH BRIDGE] Access token updated:", token ? `${token.substring(0, 20)}...` : "NULL");
}

/**
 * Get current access token (for React components)
 */
export function getAccessToken(): string | null {
  return accessTokenRef.current;
}

/**
 * Register the refresh token function from AuthProvider
 * This allows auth bridge to refresh tokens when needed
 */
export function setRefreshTokenFn(fn: (() => Promise<string | null>) | null) {
  refreshTokenFn = fn;
}

/**
 * Register the logout function from AuthProvider
 * This allows auth bridge to trigger complete logout when auth fails
 */
export function setLogoutFn(fn: (() => Promise<void>) | null) {
  logoutFn = fn;
}

/**
 * Ensures a valid access token is available before making a request
 * If no token exists, attempts to refresh it
 * @returns The access token or null if unavailable
 */
export async function ensureValidToken(): Promise<string | null> {
  // If we have a token, return it
  if (accessTokenRef.current) {
    return accessTokenRef.current;
  }

  // Try to refresh the token
  if (refreshTokenFn) {
    console.log("[AUTH BRIDGE] No token available, attempting refresh...");
    const newToken = await refreshTokenFn();
    return newToken;
  }

  console.log("[AUTH BRIDGE] No token and no refresh function available");
  return null;
}

/**
 * Wrapper around fetch that automatically adds Authorization header and handles 401 errors
 * Similar to apiRequest but supports raw fetch for special cases like blob downloads and SSE
 * 
 * @param url The URL to fetch
 * @param options Fetch options
 * @param retryOn401 Whether to retry with refreshed token on 401 (default: true)
 * @returns The fetch Response
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  retryOn401: boolean = true
): Promise<Response> {
  // Get or refresh the access token
  let token = await ensureValidToken();
  
  if (!token) {
    throw new Error("Not authenticated. Please log in.");
  }
  
  // Add Authorization header
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  
  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If 401 and we should retry, refresh token and try once more
  if (response.status === 401 && retryOn401 && refreshTokenFn) {
    console.log("[AUTH BRIDGE] Got 401, refreshing token and retrying...");
    
    // Clear the current token
    setAccessToken(null);
    
    // Try to refresh
    token = await refreshTokenFn();
    
    if (!token) {
      // Refresh failed - trigger complete logout to clear all auth state
      console.log("[AUTH BRIDGE] Refresh failed, triggering logout");
      if (logoutFn) {
        await logoutFn();
      }
      throw new Error("SESSION_EXPIRED");
    }
    
    // Retry with new token
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, {
      ...options,
      headers,
    });
  }
  
  return response;
}

// Backwards compatibility: export authBridge object
export const authBridge = {
  setAccessToken,
  getAccessToken,
  setRefreshTokenFn,
  setLogoutFn,
  ensureValidToken,
  fetchWithAuth,
};
