import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";
import { fetchWithAuth } from "@/lib/authBridge";
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

const PLATFORM_CONFIG: Record<string, { 
  name: string; 
  icon: any; 
  color: string;
  bgGradient: string;
}> = {
  instagram: { 
    name: "Instagram", 
    icon: SiInstagram, 
    color: "text-pink-500",
    bgGradient: "from-purple-600 via-pink-500 to-orange-400"
  },
  tiktok: { 
    name: "TikTok", 
    icon: SiTiktok, 
    color: "text-white",
    bgGradient: "from-zinc-900 to-zinc-800"
  },
  linkedin: { 
    name: "LinkedIn", 
    icon: SiLinkedin, 
    color: "text-blue-600",
    bgGradient: "from-blue-700 to-blue-500"
  },
  youtube: { 
    name: "YouTube", 
    icon: SiYoutube, 
    color: "text-red-600",
    bgGradient: "from-red-600 to-red-500"
  },
  facebook: { 
    name: "Facebook", 
    icon: SiFacebook, 
    color: "text-blue-500",
    bgGradient: "from-blue-600 to-blue-400"
  },
  x: { 
    name: "X (Twitter)", 
    icon: SiX, 
    color: "text-white",
    bgGradient: "from-zinc-900 to-zinc-700"
  },
  twitter: { 
    name: "X (Twitter)", 
    icon: SiX, 
    color: "text-white",
    bgGradient: "from-zinc-900 to-zinc-700"
  },
  threads: { 
    name: "Threads", 
    icon: SiThreads, 
    color: "text-white",
    bgGradient: "from-zinc-900 to-zinc-700"
  },
  pinterest: { 
    name: "Pinterest", 
    icon: SiPinterest, 
    color: "text-red-600",
    bgGradient: "from-red-600 to-red-500"
  },
  bluesky: { 
    name: "Bluesky", 
    icon: SiBluesky, 
    color: "text-blue-500",
    bgGradient: "from-blue-500 to-sky-400"
  },
};

export default function OAuthRedirect() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "redirecting" | "error">("loading");
  const [platform, setPlatform] = useState<string>("social");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const inviteId = params.get("invite");
    const nonce = params.get("nonce");
    const platformParam = params.get("platform") || "social";
    
    setPlatform(platformParam);

    if (!inviteId || !nonce) {
      setStatus("error");
      setErrorMessage("Invalid connection link. Please try connecting again from the dashboard.");
      return;
    }

    // Fetch the secure redirect URL from the backend
    const fetchRedirectUrl = async () => {
      try {
        const response = await fetchWithAuth(`/api/social/oauth-url/${inviteId}?nonce=${encodeURIComponent(nonce)}`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.message || "Failed to get authorization URL");
        }
        const data = await response.json();
        
        if (data.authUrl) {
          setStatus("redirecting");
          // Redirect after a brief delay to show the branded page
          setTimeout(() => {
            window.location.href = data.authUrl;
          }, 1500);
        } else {
          throw new Error("No authorization URL received");
        }
      } catch (error: any) {
        console.error('[OAuth] Error fetching redirect URL:', error);
        setStatus("error");
        setErrorMessage(error.message || "Failed to start authorization. Please try again.");
      }
    };

    fetchRedirectUrl();
  }, [searchString, setLocation]);

  const config = PLATFORM_CONFIG[platform.toLowerCase()] || {
    name: platform,
    icon: ExternalLink,
    color: "text-primary",
    bgGradient: "from-primary to-primary/80"
  };

  const Icon = config.icon;

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-xl text-destructive">Connection Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {errorMessage}
            </p>
            <button 
              onClick={() => setLocation("/social/connect")}
              className="text-primary hover:underline"
              data-testid="link-return-connect"
            >
              Return to Connect Accounts
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-4">
          <div className={`mx-auto w-20 h-20 bg-gradient-to-br ${config.bgGradient} rounded-2xl flex items-center justify-center mb-4 shadow-lg animate-pulse`}>
            <Icon className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl">Connecting to {config.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            You'll be redirected to {config.name} to authorize Artivio AI to post on your behalf. After completing the authorization, please return to Artivio.
          </p>
          
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {status === "loading" ? "Preparing secure connection..." : "Redirecting to " + config.name + "..."}
            </span>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Artivio AI only requests permission to create posts. We never access your messages, followers, or personal data.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
