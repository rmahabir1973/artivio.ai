import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, ArrowUpRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

  if (plansLoading || subLoading) {
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
    </div>
  );
}
