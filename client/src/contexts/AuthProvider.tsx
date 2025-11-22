import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { setAccessToken as bridgeSetAccessToken, getAccessToken as bridgeGetAccessToken, setRefreshTokenFn, setLogoutFn } from "@/lib/authBridge";
import { queryClient } from "@/lib/queryClient";

interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  login: (token: string) => void;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  isAuthenticated: boolean;
  user: any | null;
  isLoading: boolean;
  setUser: (user: any | null) => void;
  setIsLoading: (loading: boolean) => void;
  isManualLogout: boolean; // Track if logout was manually triggered
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isManualLogout, setIsManualLogout] = useState<boolean>(false);
  
  // Auto-reset isManualLogout after a short delay to prevent it from blocking subsequent redirects
  useEffect(() => {
    if (isManualLogout) {
      const timer = setTimeout(() => {
        setIsManualLogout(false);
      }, 100); // Short delay to allow ProtectedRoute to check the flag
      return () => clearTimeout(timer);
    }
  }, [isManualLogout]);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    // CRITICAL: Update the auth bridge so fetchWithAuth sees the new token
    bridgeSetAccessToken(token);
  }, []);

  const login = useCallback((token: string) => {
    setAccessTokenState(token);
    bridgeSetAccessToken(token);
    setIsManualLogout(false); // Reset manual logout flag on login
  }, []);

  const logout = useCallback(async () => {
    try {
      // Mark this as a manual logout to prevent "Session Expired" toast
      setIsManualLogout(true);
      
      // Call backend logout endpoint to clear httpOnly cookies
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      // Always clear local state regardless of API call result
      setAccessTokenState(null);
      bridgeSetAccessToken(null);
      setUser(null);
      
      // Clear ALL React Query cache on logout
      console.log('[AUTH] Logout - clearing all cached data');
      queryClient.clear();
      console.log('[AUTH] ✓ Cache cleared');
      
      // Navigate to login page using SPA navigation
      window.history.pushState({}, '', '/login');
      // Trigger a popstate event to make wouter detect the change
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        console.log("[AUTH] Token refresh failed:", response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.accessToken) {
        setAccessTokenState(data.accessToken);
        bridgeSetAccessToken(data.accessToken);
        console.log("[AUTH] Access token refreshed successfully");
        return data.accessToken;
      }
      
      return null;
    } catch (error) {
      console.error("[AUTH] Error refreshing token:", error);
      return null;
    }
  }, []);
  
  // Register the refresh and logout functions in authBridge
  useEffect(() => {
    setRefreshTokenFn(refreshAccessToken);
    setLogoutFn(logout);
    return () => {
      setRefreshTokenFn(null);
      setLogoutFn(null);
    };
  }, [refreshAccessToken, logout]);

  // Use bridge for getAccessToken
  const getAccessToken = useCallback(() => {
    return bridgeGetAccessToken();
  }, []);

  // Fetch user data on mount using refresh token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("[AUTH] Initializing auth - attempting to refresh token");
        
        // Check for OAuth token in URL fragment (e.g., #token=xxx after Google login)
        const hash = window.location.hash;
        const searchParams = new URLSearchParams(window.location.search);
        
        if (hash.includes('token=')) {
          const tokenMatch = hash.match(/token=([^&]+)/);
          if (tokenMatch && tokenMatch[1]) {
            const oauthToken = tokenMatch[1];
            console.log("[AUTH] Found OAuth token in URL fragment");
            
            // Store the token
            setAccessTokenState(oauthToken);
            bridgeSetAccessToken(oauthToken);
            
            // Clean up URL (remove OAuth artifacts)
            window.location.hash = '';
            searchParams.delete('login');
            const newSearch = searchParams.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState({}, '', newUrl);
            
            // Fetch user data with the OAuth token
            const userResponse = await fetch("/api/auth/user", {
              headers: {
                Authorization: `Bearer ${oauthToken}`,
              },
              credentials: "include",
            });

            if (userResponse.ok) {
              const userData = await userResponse.json();
              setUser(userData);
              console.log("[AUTH] OAuth login successful - user data loaded");
              setIsLoading(false);
              return;
            }
          }
        }
        
        // Try to refresh the access token using the httpOnly refresh token cookie
        const token = await refreshAccessToken();
        
        if (token) {
          console.log("[AUTH] Token obtained - fetching user data");
          
          // Fetch user data with the new token
          const userResponse = await fetch("/api/auth/user", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUser(userData);
            console.log("[AUTH] User data loaded successfully");
          } else {
            console.log("[AUTH] Failed to fetch user data:", userResponse.status);
            setAccessTokenState(null);
            setUser(null);
          }
        } else {
          console.log("[AUTH] No valid refresh token - user not authenticated");
          setUser(null);
        }
      } catch (error) {
        console.error("[AUTH] Error initializing auth:", error);
        setAccessTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    accessToken,
    setAccessToken,
    login,
    logout,
    refreshAccessToken,
    isAuthenticated: !!accessToken && !!user,
    user,
    isLoading,
    setUser,
    setIsLoading,
    isManualLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
