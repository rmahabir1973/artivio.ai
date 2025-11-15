import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0, // Always fetch fresh user data - no caching for auth
    refetchOnMount: true, // Refetch every time component mounts
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
