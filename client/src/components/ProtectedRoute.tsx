import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isManualLogout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Track if user was authenticated in this render cycle to detect session expiration
  const wasAuthenticatedRef = useRef(isAuthenticated);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Only show "Session Expired" toast if:
      // 1. User was previously authenticated (not a first-time visitor)
      // 2. This is NOT a manual logout (user clicked logout button)
      if (wasAuthenticatedRef.current && !isManualLogout) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
      }
      
      // Redirect to login page (manual logout already navigates, but this handles session expiration)
      if (!isManualLogout) {
        setLocation("/login");
      }
    }
    
    // Update the ref whenever authentication state changes
    if (isAuthenticated) {
      wasAuthenticatedRef.current = true;
    } else {
      // Reset the ref when user is no longer authenticated
      wasAuthenticatedRef.current = false;
    }
  }, [isAuthenticated, isLoading, isManualLogout, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
