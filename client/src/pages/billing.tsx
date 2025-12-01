import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, ArrowUpRight, Share2, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { fetchWithAuth } from "@/lib/authBridge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";
import type { SubscriptionPlan, UserSubscription } from "@shared/schema";

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: plans, isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/plans'],
    enabled: !!user,
  });

  const { data: subscription, isLoading: subLoading } = useQuery<UserSubscription>({
    queryKey: ['/api/subscriptions/current'],
    enabled: !!user,
  });

  const { data: socialPosterStatus, isLoading: socialPosterLoading } = useQuery<{
    hasSocialPoster: boolean;
    socialPosterSubscriptionId: string | null;
  }>({
    queryKey: ['/api/social/subscription-status'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/social/subscription-status');
      if (!response.ok) return { hasSocialPoster: false, socialPosterSubscriptionId: null };
      return response.json();
    },
    enabled: !!user,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/portal', {});
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Portal Error",
        description: error.message || "Failed to open customer portal",
        variant: "destructive",
      });
    },
  });

  const currentPlan = plans?.find(p => p.id === subscription?.planId);

  if (plansLoading || subLoading || socialPosterLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" data-testid="loading-spinner" />
      </div>
    );
  }

  const isSubscribed = subscription && subscription.stripeSubscriptionId;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-billing">Billing & Subscription</h1>
        <p className="text-muted-foreground">Manage your subscription and billing information</p>
      </div>

      {subscription && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
            <CardDescription>Your active plan and usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-lg">{currentPlan?.displayName || 'Unknown Plan'}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.credits?.toLocaleString() || 0} credits remaining
                </p>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'destructive'} data-testid={`badge-status-${subscription.status}`}>
                {subscription.status}
              </Badge>
            </div>

            {subscription.currentPeriodEnd && (
              <div className="text-sm text-muted-foreground">
                {subscription.cancelAtPeriodEnd ? (
                  <p>Subscription ends on {format(new Date(subscription.currentPeriodEnd), 'PPP')}</p>
                ) : (
                  <p>Next billing date: {format(new Date(subscription.currentPeriodEnd), 'PPP')}</p>
                )}
              </div>
            )}

            <div className="pt-4 border-t flex flex-wrap gap-3">
              {isSubscribed && (
                <Button
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  variant="outline"
                  data-testid="button-manage-subscription"
                >
                  {portalMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </>
                  )}
                </Button>
              )}
              
              <Button asChild variant="default" data-testid="button-view-plans">
                <Link href="/pricing">
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                  View Plans & Upgrade
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!subscription && (
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
            <CardDescription>Choose a plan to get started with Artivio AI</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You don't have an active subscription. View our plans to unlock all AI features.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild data-testid="button-view-pricing">
              <Link href="/pricing">
                View Plans & Pricing
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Social Media Poster Add-On Section */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Social Media Poster
              </CardTitle>
              <CardDescription>Post to 9 platforms with AI-powered captions</CardDescription>
            </div>
            {socialPosterStatus?.hasSocialPoster ? (
              <Badge variant="default" className="bg-green-600" data-testid="badge-social-poster-active">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" data-testid="badge-social-poster-inactive">
                Add-On
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {socialPosterStatus?.hasSocialPoster ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Your Social Media Poster subscription is active. You can post to Instagram, TikTok, LinkedIn, YouTube, Facebook, X, Threads, Pinterest, and Bluesky.
              </p>
              <div className="flex gap-3">
                <Button asChild variant="outline" data-testid="button-open-social-hub">
                  <Link href="/social/connect">
                    <Share2 className="w-4 h-4 mr-2" />
                    Open Social Media Hub
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Supercharge your content with automated social media posting across 9 platforms. Get AI-generated captions, a content calendar, and analytics dashboard.
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-2xl font-bold">$25</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <Button asChild data-testid="button-add-social-poster">
                  <Link href="/social/upgrade">
                    Add Social Media Poster
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
