import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ExternalLink, ArrowLeft } from "lucide-react";
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
import { FaReddit } from "react-icons/fa";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PLATFORM_CONFIG: Record<string, { name: string; icon: any; color: string }> = {
  instagram: { name: "Instagram", icon: SiInstagram, color: "from-purple-600 via-pink-500 to-orange-400" },
  tiktok: { name: "TikTok", icon: SiTiktok, color: "from-black to-zinc-800" },
  linkedin: { name: "LinkedIn", icon: SiLinkedin, color: "from-[#0A66C2] to-[#004182]" },
  youtube: { name: "YouTube", icon: SiYoutube, color: "from-[#FF0000] to-[#CC0000]" },
  facebook: { name: "Facebook", icon: SiFacebook, color: "from-[#1877F2] to-[#0D5DB3]" },
  x: { name: "X (Twitter)", icon: SiX, color: "from-black to-zinc-800" },
  twitter: { name: "X (Twitter)", icon: SiX, color: "from-black to-zinc-800" },
  threads: { name: "Threads", icon: SiThreads, color: "from-black to-zinc-800" },
  pinterest: { name: "Pinterest", icon: SiPinterest, color: "from-[#E60023] to-[#AD001B]" },
  bluesky: { name: "Bluesky", icon: SiBluesky, color: "from-[#0085FF] to-[#0066CC]" },
  reddit: { name: "Reddit", icon: FaReddit, color: "from-[#FF4500] to-[#CC3700]" },
};

export default function OAuthCallback() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [platform, setPlatform] = useState<string>("social");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [synced, setSynced] = useState(false);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/social/sync-accounts");
      return await response.json();
    },
    onSuccess: (data: any) => {
      setSynced(true);
      queryClient.invalidateQueries({ queryKey: ["/api/social/accounts"] });
      if (data.accountCount > 0) {
        toast({
          title: "Account Connected!",
          description: `Successfully synced ${data.accountCount} account${data.accountCount > 1 ? 's' : ''}.`,
        });
      }
    },
    onError: (error: Error) => {
      console.error('[OAuth Callback] Sync error:', error);
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const platformParam = params.get("platform") || "social";
    const success = params.get("success");
    const error = params.get("error");
    
    setPlatform(platformParam);

    if (error) {
      setStatus("error");
      setErrorMessage(error === "cancelled" 
        ? "Authorization was cancelled. You can try connecting again."
        : error);
    } else if (success === "true" || !error) {
      setStatus("success");
      syncMutation.mutate();
    } else {
      setStatus("success");
      syncMutation.mutate();
    }
  }, [searchString]);

  const config = PLATFORM_CONFIG[platform.toLowerCase()] || {
    name: platform,
    icon: ExternalLink,
    color: "from-primary to-primary/80",
  };

  const IconComponent = config.icon;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-md text-center shadow-xl">
        <CardHeader className="space-y-4 pb-2">
          <div className={`mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}>
            <IconComponent className="w-10 h-10 text-white" />
          </div>
          
          {status === "loading" && (
            <>
              <CardTitle className="text-xl">Processing Connection</CardTitle>
              <CardDescription>
                Please wait while we complete the authorization...
              </CardDescription>
            </>
          )}
          
          {status === "success" && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <CardTitle className="text-xl">Connection Successful!</CardTitle>
              <CardDescription>
                Your {config.name} account has been connected to Artivio AI.
              </CardDescription>
            </>
          )}
          
          {status === "error" && (
            <>
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle className="text-xl">Connection Failed</CardTitle>
              <CardDescription className="text-destructive">
                {errorMessage}
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {status === "loading" && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              {syncMutation.isPending && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Syncing account...</span>
                </div>
              )}
              
              {synced && (
                <p className="text-sm text-muted-foreground">
                  You can now schedule posts to {config.name} directly from Artivio AI.
                </p>
              )}

              <Button 
                onClick={() => setLocation("/social/connect")}
                className="w-full"
                data-testid="button-return-dashboard"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Dashboard
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <Button 
                onClick={() => setLocation("/social/connect")}
                className="w-full"
                data-testid="button-try-again"
              >
                Try Again
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-4">
            Powered by Artivio AI
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
