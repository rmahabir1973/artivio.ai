import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionPlan } from "@shared/schema";
import { fetchWithAuth } from "@/lib/authBridge";
import { useAuth } from "@/hooks/useAuth";

interface PlanWithPopular extends SubscriptionPlan {
  popular?: boolean;
}

export default function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: plansData, isLoading, error } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/plans'],
  });

  // Debug logging
  React.useEffect(() => {
    console.log('[Pricing] Plans query state:', { isLoading, plansCount: plansData?.length, error });
  }, [isLoading, plansData, error]);

  // Fetch current subscription to check which plan user is on (only for authenticated users)
  const { data: subscription, isLoading: isLoadingSubscription, isError: isSubscriptionError } = useQuery<any>({
    queryKey: ['/api/subscriptions/current'],
    queryFn: async () => {
      const response = await fetchWithAuth('/api/subscriptions/current');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }
      return response.json();
    },
    enabled: !!user, // Only fetch if user is logged in
    retry: false, // Don't retry on failure to avoid 401 errors
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    gcTime: 0, // Don't cache for too long
  });

  const currentPlanId = subscription?.planId;

  const plans: PlanWithPopular[] = plansData?.map(plan => ({
    ...plan,
    popular: plan.name === 'starter',
  })) || [];

  const handleSelectPlan = async (plan: PlanWithPopular) => {
    // Prevent selecting current plan
    if (plan.id === currentPlanId) {
      toast({
        title: "Already subscribed",
        description: "You are already on this plan.",
        variant: "default",
      });
      return;
    }

    setSelectedPlan(plan.name);
    setIsSubmitting(true);

    try {
      if (plan.price === 0) {
        // Free trial: use existing signup flow
        const response = await fetch('/api/public/plan-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ planName: plan.name }),
        });

        if (!response.ok) {
          throw new Error('Failed to store plan selection');
        }

        // Redirect to registration for new users
        window.location.href = '/register';
      } else {
        // Paid plan: redirect to Stripe checkout
        // fetchWithAuth automatically adds Authorization header and retries on 401
        const response = await fetchWithAuth('/api/billing/checkout', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ 
            planId: plan.id,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to create checkout session');
        }

        // Redirect to Stripe checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }
      }
    } catch (error: any) {
      console.error('Error selecting plan:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to select plan. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Artivio AI
            </h1>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your AI content creation needs. Start creating amazing videos, images, and music today.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-plans" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-destructive font-semibold mb-2">Failed to load pricing plans</p>
            <p className="text-muted-foreground text-sm mb-4">{error instanceof Error ? error.message : 'An error occurred'}</p>
            <Button onClick={() => window.location.reload()}>Reload Page</Button>
          </div>
        ) : !plansData || plansData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-muted-foreground font-semibold mb-2">No pricing plans available</p>
            <p className="text-muted-foreground text-sm">Please contact support if this persists.</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => {
                const features = Array.isArray(plan.features) ? plan.features : [];
                const isTrial = plan.billingPeriod === 'trial';
                // Only mark as current plan if we successfully loaded subscription and it matches
                const isCurrentPlan = user && !isLoadingSubscription && !isSubscriptionError && plan.id === currentPlanId;
                
                return (
                  <Card 
                    key={plan.id}
                    className={`relative hover-elevate ${
                      plan.popular ? 'border-primary shadow-lg' : ''
                    } ${
                      selectedPlan === plan.name ? 'ring-2 ring-primary' : ''
                    } ${
                      isCurrentPlan ? 'opacity-70' : ''
                    }`}
                    data-testid={`card-plan-${plan.name}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <CardHeader className="text-center pt-8">
                      <CardTitle className="text-2xl mb-2">{plan.displayName}</CardTitle>
                      {plan.description && (
                        <div 
                          className="text-sm text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: plan.description }}
                        />
                      )}
                      <div className="mt-4">
                        <span className="text-4xl font-bold">
                          ${(() => {
                            const price = plan.price / 100;
                            return price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
                          })()}
                        </span>
                        <span className="text-muted-foreground">
                          {isTrial ? '' : '/month'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {plan.creditsPerMonth.toLocaleString()} credits {isTrial ? '(one-time)' : 'per month'}
                      </p>
                    </CardHeader>

                    <CardContent>
                      <ul className="space-y-3">
                        {features.map((feature: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>

                    <CardFooter>
                      <Button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={isSubmitting || isCurrentPlan}
                        className="w-full"
                        variant={isCurrentPlan ? "secondary" : plan.popular ? "default" : "outline"}
                        size="lg"
                        data-testid={`button-select-${plan.name}`}
                      >
                        {isCurrentPlan ? (
                          "Current Plan"
                        ) : isSubmitting && selectedPlan === plan.name ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {plan.price === 0 ? "Starting Trial..." : "Processing..."}
                          </>
                        ) : (
                          plan.price === 0 ? "Start Free Trial" : "Get Started"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Features Comparison */}
            <div className="mt-16 max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">All Plans Include All Features</h2>
                <p className="text-lg text-muted-foreground">
                  Every subscription tier gives you full access to our complete suite of AI tools. The only difference is the number of credits you receive.
                </p>
              </div>

              <Card className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">AI Content Generation</h3>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">Video Generation (Veo, Runway, Seedance, Wan, Kling, Grok, Sora)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">Image Generation (Seedream, Flux, Nano Banana)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">Music Generation (Suno V3.5-V5)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">Image & Video Upscaling (Topaz AI)</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-4">Platform Features</h3>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">AI Chatbot (Deepseek & OpenAI models)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">Voice Cloning (ElevenLabs)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">Video Editor/Combiner (FFmpeg)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">QR Code Generator (Free, no credits)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">No watermarks & commercial use rights</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </Card>
            </div>

            {/* Additional Info */}
            <div className="mt-12 text-center text-sm text-muted-foreground">
              <p>All plans include full access to every AI model and feature. Cancel anytime.</p>
              <p className="mt-2">By continuing, you agree to our Terms of Service and Privacy Policy.</p>
            </div>
          </>
        )}
      </section>

    </div>
  );
}
