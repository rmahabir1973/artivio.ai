import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, CreditCard } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await apiRequest('POST', '/api/billing/checkout', { planId });
      return res.json();
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
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
    <div className="container mx-auto py-8 px-4 max-w-6xl">
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
          </CardContent>

          {isSubscribed && (
            <CardFooter>
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
            </CardFooter>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {plans?.map((plan) => {
          const isCurrent = plan.id === subscription?.planId;
          const isFree = plan.price === 0;

          return (
            <Card key={plan.id} className={isCurrent ? 'border-primary' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.displayName}
                  {isCurrent && <Badge>Current</Badge>}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-4xl font-bold">${(plan.price / 100).toFixed(2)}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm">{plan.creditsPerMonth.toLocaleString()} credits/month</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm">All AI features included</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                {isFree ? (
                  <Button variant="outline" disabled className="w-full" data-testid={`button-plan-${plan.id}`}>
                    Free Plan
                  </Button>
                ) : isCurrent ? (
                  <Button variant="outline" disabled className="w-full" data-testid={`button-plan-${plan.id}`}>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    onClick={() => checkoutMutation.mutate(plan.id)}
                    disabled={checkoutMutation.isPending || !plan.stripePriceId}
                    className="w-full"
                    data-testid={`button-plan-${plan.id}`}
                  >
                    {checkoutMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : !plan.stripePriceId ? (
                      'Coming Soon'
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
