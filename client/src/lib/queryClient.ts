import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { fetchWithAuth as authBridgeFetchWithAuth } from "./authBridge";

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

/**
 * Legacy wrapper for backwards compatibility
 * Now uses authBridge's fetchWithAuth which includes retry-on-401 logic
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return authBridgeFetchWithAuth(url, {
    ...options,
    credentials: "include",
  });
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
