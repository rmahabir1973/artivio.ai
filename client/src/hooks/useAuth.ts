import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 0, // ALWAYS fetch fresh user data - no caching for auth
    refetchOnMount: true, // Refetch every time component mounts
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
