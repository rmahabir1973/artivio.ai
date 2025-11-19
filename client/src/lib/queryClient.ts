import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Auth context reference for accessing token and refresh logic
interface AuthContextRef {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

let authContextRef: AuthContextRef | null = null;

// Set the auth context reference (called from AuthProvider)
export function setAuthContext(context: AuthContextRef) {
  authContextRef = context;
}

// Promise to prevent multiple concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let errorMessage = res.statusText;
    
    // Try to parse JSON error response
    if (text) {
      try {
        const json = JSON.parse(text);
        errorMessage = json.message || json.error || text;
      } catch {
        // Not JSON, use raw text
        errorMessage = text;
      }
    }
    
    throw new Error(errorMessage);
  }
}

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add Authorization header if we have an access token
  if (authContextRef) {
    const token = authContextRef.getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  // Handle 401 Unauthorized - try to refresh token
  if (response.status === 401 && authContextRef) {
    console.log("[AUTH] 401 response - attempting token refresh");

    // Prevent multiple concurrent refresh requests
    if (!refreshPromise) {
      refreshPromise = authContextRef.refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (newToken) {
      console.log("[AUTH] Token refreshed successfully - retrying request");
      
      // Retry the original request with the new token
      headers["Authorization"] = `Bearer ${newToken}`;
      
      const retryResponse = await fetch(url, {
        ...options,
        headers,
        credentials: "include",
      });

      return retryResponse;
    } else {
      console.log("[AUTH] Token refresh failed - redirecting to login");
      
      // Refresh failed - logout and redirect to login
      await authContextRef.logout();
      window.location.href = "/login";
      
      // Return the original 401 response
      return response;
    }
  }

  return response;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetchWithAuth(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetchWithAuth(queryKey.join("/") as string, {
      method: "GET",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
