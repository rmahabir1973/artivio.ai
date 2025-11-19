import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { setAuthContext } from "@/lib/queryClient";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Use ref to always get current token value
  const accessTokenRef = useRef<string | null>(null);
  accessTokenRef.current = accessToken;

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
  }, []);

  const login = useCallback((token: string) => {
    setAccessTokenState(token);
  }, []);

  const logout = useCallback(async () => {
    try {
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
      setUser(null);
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
        console.log("[AUTH] Access token refreshed successfully");
        return data.accessToken;
      }
      
      return null;
    } catch (error) {
      console.error("[AUTH] Error refreshing token:", error);
      return null;
    }
  }, []);

  // Use ref to avoid stale closure - this callback never changes
  const getAccessToken = useCallback(() => {
    console.log("[AUTH] getAccessToken called, current token:", accessTokenRef.current ? "EXISTS" : "NULL");
    return accessTokenRef.current;
  }, []); // No dependencies - always returns current ref value

  // Set the auth context reference in queryClient ONCE on mount
  useEffect(() => {
    console.log("[AUTH] Setting auth context reference in queryClient");
    setAuthContext({
      getAccessToken,
      refreshAccessToken,
      logout,
    });
  }, []); // Only run once on mount - callbacks are stable

  // Fetch user data on mount using refresh token
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("[AUTH] Initializing auth - attempting to refresh token");
        
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
