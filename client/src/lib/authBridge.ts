import { setAuthContext } from "./queryClient";

/**
 * Auth Bridge - Connects React auth state to queryClient's fetchWithAuth
 * 
 * CRITICAL: This must be initialized in main.tsx BEFORE React renders
 * to ensure all bundle chunks (including lazy-loaded routes) see the
 * auth context reference. Otherwise, production bundle splitting can
 * create separate copies of queryClient with null authContextRef.
 */

let accessTokenRef: { current: string | null } = { current: null };

export function initializeAuthBridge() {
  console.log("[AUTH BRIDGE] Initializing auth bridge before React render");
  
  setAuthContext({
    getAccessToken: () => {
      const token = accessTokenRef.current;
      console.log("[AUTH BRIDGE] getAccessToken called, token:", token ? `${token.substring(0, 20)}...` : "NULL");
      return token;
    },
    refreshAccessToken: async () => {
      console.log("[AUTH BRIDGE] refreshAccessToken called");
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });

        if (!response.ok) {
          console.log("[AUTH BRIDGE] Token refresh failed:", response.status);
          return null;
        }

        const data = await response.json();
        
        if (data.accessToken) {
          accessTokenRef.current = data.accessToken;
          console.log("[AUTH BRIDGE] Access token refreshed successfully");
          return data.accessToken;
        }
        
        return null;
      } catch (error) {
        console.error("[AUTH BRIDGE] Error refreshing token:", error);
        return null;
      }
    },
    logout: async () => {
      console.log("[AUTH BRIDGE] logout called");
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        console.error("[AUTH BRIDGE] Logout API call failed:", error);
      } finally {
        accessTokenRef.current = null;
      }
    },
  });
  
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
