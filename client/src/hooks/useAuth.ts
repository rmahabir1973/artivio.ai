import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 401) {
          return null;
        }

        if (!res.ok) {
          console.error("Auth check failed:", res.status);
          return null;
        }

        return await res.json();
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          console.error("Auth check timed out - treating as unauthenticated");
        } else {
          console.error("Auth check error:", err);
        }
        return null;
      }
    },
    retry: false,
    staleTime: 0, // Always fetch fresh user data - no caching for auth
    refetchOnMount: true, // Refetch every time component mounts
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}
