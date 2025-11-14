import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 0, // ALWAYS fetch fresh user data - no caching for auth
    refetchOnMount: true, // Refetch every time component mounts
    refetchOnWindowFocus: true, // Refetch when window gets focus
  });

  // Handle both direct user object and wrapped response formats
  // Server might return: { user: {...} } or just {...}
  const user = data?.user ?? data;

  console.log('🟣 useAuth - Raw data:', data);
  console.log('🟣 useAuth - Extracted user:', user);
  console.log('🟣 useAuth - user.isAdmin:', user?.isAdmin);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
