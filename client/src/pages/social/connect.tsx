import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Link2, 
  Unlink, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  AlertCircle,
  Info,
  Sparkles,
  Shield,
  RefreshCw,
  X,
} from "lucide-react";
import { 
  SiInstagram, 
  SiTiktok, 
  SiLinkedin, 
  SiYoutube, 
  SiFacebook, 
  SiX,
  SiThreads,
  SiPinterest,
  SiBluesky,
} from "react-icons/si";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { fetchWithAuth } from "@/lib/authBridge";
import { SocialUpgradePrompt } from "@/components/social-upgrade-prompt";

interface Platform {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
  dailyLimit: number;
}

const SUPPORTED_PLATFORMS: Platform[] = [
  { 
    id: "instagram", 
    name: "Instagram", 
    icon: SiInstagram, 
    color: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
    description: "Share reels, stories, and posts",
    dailyLimit: 50
  },
  { 
    id: "tiktok", 
    name: "TikTok", 
    icon: SiTiktok, 
    color: "bg-black dark:bg-zinc-900",
    description: "Post videos and engage with trends",
    dailyLimit: 15
  },
  { 
    id: "linkedin", 
    name: "LinkedIn", 
    icon: SiLinkedin, 
    color: "bg-[#0A66C2]",
    description: "Professional content and networking",
    dailyLimit: 150
  },
  { 
    id: "youtube", 
    name: "YouTube", 
    icon: SiYoutube, 
    color: "bg-[#FF0000]",
    description: "Long-form videos and Shorts",
    dailyLimit: 10
  },
  { 
    id: "facebook", 
    name: "Facebook", 
    icon: SiFacebook, 
    color: "bg-[#1877F2]",
    description: "Posts, reels, and page content",
    dailyLimit: 25
  },
  { 
    id: "x", 
    name: "X (Twitter)", 
    icon: SiX, 
    color: "bg-black dark:bg-zinc-900",
    description: "Tweets and media posts",
    dailyLimit: 50
  },
  { 
    id: "threads", 
    name: "Threads", 
    icon: SiThreads, 
    color: "bg-black dark:bg-zinc-900",
    description: "Text and media updates",
    dailyLimit: 50
  },
  { 
    id: "pinterest", 
    name: "Pinterest", 
    icon: SiPinterest, 
    color: "bg-[#E60023]",
    description: "Pins and visual content",
    dailyLimit: 20
  },
  { 
    id: "bluesky", 
    name: "Bluesky", 
    icon: SiBluesky, 
    color: "bg-[#0085FF]",
    description: "Decentralized social posts",
    dailyLimit: 50
  },
];

interface SocialAccount {
  id: string;
  platform: string;
  platformAccountId: string;
  accountUsername: string;
  connected: boolean;
  postsToday: number;
  dailyLimit: number;
}

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

export default function SocialConnect() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  
  // Connection modal state
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'waiting' | 'polling' | 'success' | 'timeout'>('waiting');
  const [modalPlatform, setModalPlatform] = useState<Platform | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialAccountCountRef = useRef<number>(0);
  const pollCountRef = useRef<number>(0);
  const MAX_POLL_ATTEMPTS = 60; // 5 minutes at 5-second intervals

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/social/subscription-status"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/subscription-status");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.requiresSubscription) {
          return { hasSocialPoster: false };
        }
        throw new Error("Failed to fetch subscription status");
      }
      return response.json();
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const syncAccountsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/social/sync-accounts");
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
      if (data.accountCount > 0) {
        toast({
          title: "Accounts Synced",
          description: `Found ${data.accountCount} connected account${data.accountCount > 1 ? 's' : ''}.`,
        });
      } else {
        toast({
          title: "No New Accounts",
          description: "Complete the authorization in the new tab first, then refresh again.",
        });
      }
    },
    onError: (error: Error) => {
      console.error('[Social] Sync error:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Could not sync accounts. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-sync accounts when user visits the page (handles return from OAuth)
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    
    if (params.get("success") === "true") {
      toast({
        title: "Social Media Poster activated!",
        description: "You can now connect your social accounts and start posting.",
      });
      setLocation("/social/connect", { replace: true });
    }
    
    const connectedPlatform = params.get("connected");
    if (connectedPlatform && subscriptionStatus?.hasSocialPoster) {
      toast({
        title: "Syncing Account",
        description: `Checking ${connectedPlatform} connection...`,
      });
      syncAccountsMutation.mutate();
      setLocation("/social/connect", { replace: true });
    }
  }, [searchString, toast, setLocation, subscriptionStatus?.hasSocialPoster]);

  const { data: socialProfile, isLoading: profileLoading } = useQuery<any>({
    queryKey: ["/api/social/profile"],
    enabled: !!user && subscriptionStatus?.hasSocialPoster === true,
    retry: 1,
  });

  const { data: connectedAccounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useQuery<SocialAccount[]>({
    queryKey: ["/api/social/accounts"],
    enabled: !!user && !!socialProfile && subscriptionStatus?.hasSocialPoster === true,
    retry: 1,
  });

  // Auto-sync on page load when user has social poster access
  // This catches accounts connected via OAuth that redirected to GetLate's success page
  useEffect(() => {
    if (subscriptionStatus?.hasSocialPoster && socialProfile && !hasAutoSynced && !syncAccountsMutation.isPending) {
      setHasAutoSynced(true);
      syncAccountsMutation.mutate();
    }
  }, [subscriptionStatus?.hasSocialPoster, socialProfile, hasAutoSynced, syncAccountsMutation.isPending]);

  // Stop polling and cleanup
  const stopPolling = useCallback(() => {
    // Clear the start delay timeout if modal is closed before polling starts
    if (startDelayTimeoutRef.current) {
      clearTimeout(startDelayTimeoutRef.current);
      startDelayTimeoutRef.current = null;
    }
    // Clear the polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  // Close modal and cleanup
  const closeConnectionModal = useCallback(() => {
    stopPolling();
    setShowConnectionModal(false);
    setConnectionStatus('waiting');
    setModalPlatform(null);
  }, [stopPolling]);

  // Poll for new accounts
  const pollForNewAccount = useCallback(async () => {
    pollCountRef.current += 1;
    
    if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
      setConnectionStatus('timeout');
      stopPolling();
      return;
    }

    try {
      // Sync accounts from GetLate
      const syncResponse = await apiRequest("POST", "/api/social/sync-accounts");
      const syncData = await syncResponse.json();
      
      // Check if we have more accounts than before
      if (syncData.accountCount > initialAccountCountRef.current) {
        setConnectionStatus('success');
        stopPolling();
        queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
        
        // Auto-close after showing success
        setTimeout(() => {
          closeConnectionModal();
        }, 2000);
      } else {
        setConnectionStatus('polling');
      }
    } catch (error) {
      console.error('[Social] Poll error:', error);
      // Continue polling on error
      setConnectionStatus('polling');
    }
  }, [stopPolling, closeConnectionModal]);

  // Start polling when modal opens
  const startPolling = useCallback((platform: Platform, currentAccountCount: number) => {
    // Clear any existing timers first
    stopPolling();
    
    setModalPlatform(platform);
    initialAccountCountRef.current = currentAccountCount;
    pollCountRef.current = 0;
    setConnectionStatus('waiting');
    setShowConnectionModal(true);
    
    // Start polling after a short delay to give user time to complete OAuth
    startDelayTimeoutRef.current = setTimeout(() => {
      setConnectionStatus('polling');
      pollingIntervalRef.current = setInterval(pollForNewAccount, 5000);
    }, 3000);
  }, [pollForNewAccount, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const initProfileMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/social/profile/init");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/profile"] });
      toast({
        title: "Profile Initialized",
        description: "Your social media hub is ready to use!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Could not initialize social media hub",
        variant: "destructive",
      });
    },
  });

  const connectAccountMutation = useMutation({
    mutationFn: async (platform: Platform) => {
      setConnectingPlatform(platform.id);
      const response = await apiRequest("POST", "/api/social/accounts/connect", { platform: platform.id });
      return { ...(await response.json()), platformObj: platform };
    },
    onSuccess: (data: any) => {
      setConnectingPlatform(null);
      const proxyUrl = data.proxyUrl;
      const platform = data.platformObj as Platform;
      
      if (proxyUrl) {
        // Open OAuth in new tab
        window.open(proxyUrl, "_blank", "noopener,noreferrer");
        
        // Show the connection modal with polling
        startPolling(platform, connectedAccounts.length);
      } else {
        console.error('[Social] No proxy URL in response:', data);
        toast({
          title: "Connection Error",
          description: "Could not generate secure authorization link. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      setConnectingPlatform(null);
      toast({
        title: "Connection Failed",
        description: error.message || "Could not generate connection link",
        variant: "destructive",
      });
    },
  });

  const disconnectAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest("DELETE", `/api/social/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
      toast({
        title: "Account Disconnected",
        description: "The social account has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect account",
        variant: "destructive",
      });
    },
  });

  const isConnected = (platformId: string) => {
    return connectedAccounts.some(acc => acc.platform === platformId && acc.connected);
  };

  const getConnectedAccount = (platformId: string) => {
    return connectedAccounts.find(acc => acc.platform === platformId && acc.connected);
  };

  if (statusLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-loading-status">
            Checking subscription status...
          </p>
        </div>
      </div>
    );
  }

  if (!subscriptionStatus?.hasSocialPoster) {
    return (
      <SocialUpgradePrompt 
        title="Unlock Social Media Connections"
        description="Connect your social accounts and start posting AI-generated content to 9 platforms."
      />
    );
  }

  if (profileLoading) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!socialProfile) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-sky-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Social Media Hub</CardTitle>
            <CardDescription className="text-base max-w-md mx-auto">
              Manage all your social media accounts in one place. Schedule AI-powered posts and grow your audience.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pt-4 pb-8">
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {SUPPORTED_PLATFORMS.slice(0, 5).map((platform) => {
                const Icon = platform.icon;
                return (
                  <div 
                    key={platform.id} 
                    className={`w-10 h-10 ${platform.color} rounded-lg flex items-center justify-center`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                );
              })}
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-xs text-muted-foreground font-medium">+4</span>
              </div>
            </div>
            <Button 
              size="lg" 
              onClick={() => initProfileMutation.mutate()}
              disabled={initProfileMutation.isPending}
              className="gap-2"
              data-testid="button-init-social"
            >
              {initProfileMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Connect Accounts
          </h1>
          <p className="text-muted-foreground mt-2">
            Link your social media accounts to start scheduling AI-powered content.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncAccountsMutation.mutate()}
          disabled={syncAccountsMutation.isPending}
          className="gap-2 flex-shrink-0"
          data-testid="button-refresh-accounts"
        >
          <RefreshCw className={`w-4 h-4 ${syncAccountsMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Alert className="mb-6">
        <Shield className="h-4 w-4" />
        <AlertTitle>Secure Connection</AlertTitle>
        <AlertDescription>
          Your account credentials are never stored. You authorize each platform directly through secure OAuth, and we only receive posting permissions.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const Icon = platform.icon;
          const connected = isConnected(platform.id);
          const account = getConnectedAccount(platform.id);
          const isConnecting = connectingPlatform === platform.id;

          return (
            <Card 
              key={platform.id} 
              className={connected ? "border-green-500/30 bg-green-500/5" : ""}
              data-testid={`card-platform-${platform.id}`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`w-12 h-12 ${platform.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{platform.name}</h3>
                    {connected && (
                      <Badge variant="outline" className="text-green-600 border-green-600 gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {connected && account 
                      ? `@${account.accountUsername}` 
                      : platform.description
                    }
                  </p>
                  {connected && account && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Daily limit: {account.postsToday}/{platform.dailyLimit} posts
                    </p>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {connected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => account && disconnectAccountMutation.mutate(account.id)}
                      disabled={disconnectAccountMutation.isPending}
                      className="gap-1 text-destructive hover:text-destructive"
                      data-testid={`button-disconnect-${platform.id}`}
                    >
                      {disconnectAccountMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlink className="w-4 h-4" />
                      )}
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => connectAccountMutation.mutate(platform)}
                      disabled={isConnecting || connectAccountMutation.isPending || showConnectionModal}
                      className="gap-1"
                      data-testid={`button-connect-${platform.id}`}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-muted-foreground" />
            Daily Posting Limits
          </CardTitle>
          <CardDescription>
            To protect your accounts and ensure optimal engagement, we limit daily posts per platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {SUPPORTED_PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              return (
                <div key={platform.id} className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span>{platform.name}:</span>
                  <span className="font-medium">{platform.dailyLimit}/day</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Connection Status Modal with Polling */}
      <Dialog open={showConnectionModal} onOpenChange={(open) => !open && closeConnectionModal()}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-connection-status">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {modalPlatform && (
                <>
                  <div className={`w-10 h-10 rounded-lg ${modalPlatform.color} flex items-center justify-center`}>
                    <modalPlatform.icon className="w-5 h-5 text-white" />
                  </div>
                  <span>Connecting to {modalPlatform.name}</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Complete the authorization in the new tab that opened.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {connectionStatus === 'waiting' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Opening authorization page...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    A new tab should open shortly
                  </p>
                </div>
              </div>
            )}
            
            {connectionStatus === 'polling' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div>
                  <p className="font-medium">Waiting for authorization...</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete the login in the other tab. This will update automatically when done.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Checking every 5 seconds...</span>
                </div>
              </div>
            )}
            
            {connectionStatus === 'success' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-green-600 dark:text-green-400">
                    Account Connected!
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your {modalPlatform?.name} account has been successfully linked.
                  </p>
                </div>
              </div>
            )}
            
            {connectionStatus === 'timeout' && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Connection Timed Out
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    We didn't detect a new connection. You can close this and try again, or click "Check Now" if you completed the authorization.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setConnectionStatus('polling');
                    pollCountRef.current = 0;
                    pollingIntervalRef.current = setInterval(pollForNewAccount, 5000);
                    pollForNewAccount();
                  }}
                  data-testid="button-check-connection"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Now
                </Button>
              </div>
            )}
          </div>
          
          {connectionStatus !== 'success' && (
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                onClick={closeConnectionModal}
                data-testid="button-close-connection-modal"
              >
                Cancel
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
