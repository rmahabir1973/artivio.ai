/**
 * Auth Bridge - Connects React auth state to queryClient's fetchWithAuth
 * 
 * CRITICAL: This must be initialized in main.tsx BEFORE React renders
 * to ensure all bundle chunks (including lazy-loaded routes) see the
 * auth token reference. Otherwise, production bundle splitting can
 * create separate copies with null tokens.
 */

let accessTokenRef: { current: string | null } = { current: null };

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
