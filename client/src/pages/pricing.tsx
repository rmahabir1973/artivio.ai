import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionPlan } from "@shared/schema";
import { fetchWithAuth } from "@/lib/authBridge";
import { useAuth } from "@/hooks/useAuth";

interface PlanWithPopular extends SubscriptionPlan {
  popular?: boolean;
}

export default function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual" | "trial">("monthly");
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
    enabled: !!user,
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });

  const currentPlanId = subscription?.planId;

  const plans: PlanWithPopular[] = plansData?.map(plan => ({
    ...plan,
    popular: plan.name === 'starter',
  })) || [];

  const handleSelectPlan = async (plan: PlanWithPopular) => {
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
        const response = await fetch('/api/public/plan-selection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ planName: plan.name }),
        });

        if (!response.ok) {
          throw new Error('Failed to store plan selection');
        }

        window.location.href = '/register';
      } else {
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

  const getDisplayPrice = (plan: SubscriptionPlan): number => {
    if (billingPeriod === "annual" && plan.annualPrice) {
      return plan.annualPrice;
    }
    if (billingPeriod === "monthly" && plan.monthlyPrice) {
      return plan.monthlyPrice;
    }
    return plan.price;
  };

  const getPriceDisplay = (priceInCents: number): string => {
    const price = priceInCents / 100;
    return price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Artivio AI
          </h1>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Plans & Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan to unlock unlimited AI-powered content creation
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
            {/* Billing Period Toggle */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
                <button
                  onClick={() => setBillingPeriod("monthly")}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    billingPeriod === "monthly"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="button-monthly"
                >
                  Month
                </button>
                <button
                  onClick={() => setBillingPeriod("annual")}
                  className={`px-6 py-2 rounded-md font-medium transition-all relative ${
                    billingPeriod === "annual"
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid="button-annual"
                >
                  Annual
                  {plans.some(p => p.savingsPercentage && p.savingsPercentage > 0) && (
                    <span className="absolute -top-3 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {plans[0]?.savingsPercentage}% OFF
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
              {plans
                .filter(p => {
                  if (billingPeriod === "trial") return p.billingPeriod === "trial";
                  return p.billingPeriod !== "trial";
                })
                .map((plan) => {
                  const features = Array.isArray(plan.features) ? plan.features : [];
                  const isTrial = plan.billingPeriod === 'trial';
                  const isCurrentPlan = user && !isLoadingSubscription && !isSubscriptionError && plan.id === currentPlanId;
                  const displayPrice = getDisplayPrice(plan);
                  const savingsText = billingPeriod === "annual" && plan.savingsPercentage ? `Save ${plan.savingsPercentage}%` : null;
                  
                  return (
                    <Card 
                      key={plan.id}
                      className={`relative hover-elevate transition-all flex flex-col ${
                        plan.popular ? 'border-primary shadow-xl md:scale-105' : 'border-muted'
                      } ${
                        selectedPlan === plan.name ? 'ring-2 ring-primary' : ''
                      } ${
                        isCurrentPlan ? 'opacity-70' : ''
                      }`}
                      data-testid={`card-plan-${plan.name}`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                          <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Most Popular
                          </span>
                        </div>
                      )}

                      {savingsText && (
                        <div className="absolute -top-3 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          {savingsText}
                        </div>
                      )}
                      
                      <CardHeader className="text-center pt-8 pb-4">
                        <CardTitle className="text-2xl mb-2">{plan.displayName}</CardTitle>
                        {plan.description && (
                          <CardDescription className="text-sm">
                            {plan.description}
                          </CardDescription>
                        )}
                        
                        {/* Pricing Display */}
                        <div className="mt-6 flex flex-col items-center gap-2">
                          <div className="text-5xl font-bold text-primary">
                            ${getPriceDisplay(displayPrice)}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {isTrial ? 'one-time' : billingPeriod === 'annual' ? '/year' : '/month'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="text-lg font-semibold text-accent">{plan.creditsPerMonth.toLocaleString()}</span>
                            {' '}credits {isTrial ? '(one-time)' : 'per month'}
                          </p>
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1">
                        <ul className="space-y-3">
                          {features.map((feature: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <span className="text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>

                      <CardFooter className="pt-4">
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

              <Card className="p-6 border-primary/20">
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
