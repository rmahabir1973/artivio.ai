import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Play, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionPlan } from "@shared/schema";
import { fetchWithAuth } from "@/lib/authBridge";
import { useAuth } from "@/hooks/useAuth";
import { VideoModal } from "@/components/video-modal";

interface PlanWithPopular extends SubscriptionPlan {
  popular?: boolean;
}

interface HomePageData {
  pricingVideoUrl?: string;
}

export default function Pricing() {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: plansData, isLoading, error } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/plans'],
  });

  const { data: homePageData } = useQuery<HomePageData>({
    queryKey: ['/api/homepage'],
  });

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

  // Filter to only paid monthly, paid annual, and trial plans (exclude old ones)
  const filteredPlans = plansData?.filter(p => 
    (p.billingPeriod === 'monthly' && p.price > 0) || 
    p.billingPeriod === 'trial'
  ) || [];

  const plans: PlanWithPopular[] = filteredPlans.map(plan => ({
    ...plan,
    popular: plan.name === 'starter',
  }));

  const trialPlan = plans.find(p => p.billingPeriod === 'trial');
  const paidPlans = plans.filter(p => p.billingPeriod === 'monthly');

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

  const getPriceDisplay = (priceInCents: number): string => {
    const price = priceInCents / 100;
    return price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
  };

  const paymentMethods = [
    { name: 'Mastercard', icon: '💳' },
    { name: 'Visa', icon: '💳' },
    { name: 'American Express', icon: '💳' },
    { name: 'Apple Pay', icon: '🍎' },
    { name: 'Google Pay', icon: '🔵' },
    { name: 'PayPal', icon: '🅿️' },
    { name: 'iDEAL', icon: '🏦' },
    { name: 'Alipay', icon: '🇨🇳' },
  ];

  const faqs = [
    {
      question: "Is my payment information completely secure?",
      answer: "Absolutely. Artivio AI uses industry-leading encryption and partners with trusted payment processors. Your payment data is processed with bank-level security, and we never store or expose your sensitive information."
    },
    {
      question: "Will there be any surprise charges?",
      answer: "No hidden fees whatsoever. The price displayed is exactly what you'll pay. There are no unexpected charges or additional costs beyond your subscription price."
    },
    {
      question: "What if my generation doesn't meet expectations?",
      answer: "No worries. If a generation doesn't work out, we'll refund your credits or provide a new one at no cost. We stand behind our quality and customer satisfaction."
    },
    {
      question: "Can I switch plans or cancel at any time?",
      answer: "Yes, absolutely. You have full control. Change your plan, upgrade, downgrade, or cancel whenever you want. Continue using your remaining credits even after canceling."
    },
    {
      question: "How are credits calculated for different generations?",
      answer: "Credits vary based on multiple factors: the specific tool or AI model you use, video/image length, resolution settings, output quality, and other parameters. Check your generation preview to see the exact credit cost before confirming."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <VideoModal 
        isOpen={videoModalOpen}
        onOpenChange={setVideoModalOpen}
        videoUrl={homePageData?.pricingVideoUrl}
        title="Artivio AI - Pricing Video"
      />

      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Your Complete AI Creative Studio in One Platform
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-6 leading-relaxed">
              Why juggle multiple tools when one platform does it all?<br />
              <span className="font-semibold text-foreground">See for yourself. <button onClick={() => setVideoModalOpen(true)} className="text-primary hover:underline inline-flex items-center gap-1">Watch the Video</button> to discover infinite creative possibilities</span>
            </p>
          </div>

          {/* Price Comparison Box */}
          <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 mb-12">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center mb-4">
                <span className="inline-block bg-destructive/20 text-destructive px-3 py-1 rounded-full text-sm font-semibold">🔥 SAVE BIG</span>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold mb-6">Your Price per Generation is 40% Less Than Market Average</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Market Price</p>
                    <p className="text-2xl font-bold text-muted-foreground line-through">$2.50</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <p className="text-lg font-semibold text-primary">Save 40%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-2">Artivio Price</p>
                    <p className="text-2xl font-bold text-primary">$1.50</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Plans & Pricing</h2>
          <p className="text-lg text-muted-foreground">Choose your perfect plan and start creating</p>
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
        ) : !paidPlans || paidPlans.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-muted-foreground font-semibold mb-2">No pricing plans available</p>
            <p className="text-muted-foreground text-sm">Please contact support if this persists.</p>
          </div>
        ) : (
          <>
            {/* Paid Plans Grid */}
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-12">
              {paidPlans.map((plan) => {
                const features = Array.isArray(plan.features) ? plan.features : [];
                const isCurrentPlan = user && !isLoadingSubscription && !isSubscriptionError && plan.id === currentPlanId;
                
                return (
                  <Card 
                    key={plan.id}
                    className={`relative hover-elevate transition-all flex flex-col ${
                      plan.popular ? 'border-primary shadow-xl md:scale-105 md:z-10' : 'border-muted'
                    } ${
                      selectedPlan === plan.name ? 'ring-2 ring-primary' : ''
                    } ${
                      isCurrentPlan ? 'opacity-70' : ''
                    }`}
                    data-testid={`card-plan-${plan.name}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold">
                          MOST POPULAR
                        </span>
                      </div>
                    )}
                    
                    <CardHeader className={`text-center ${plan.popular ? 'pt-10' : ''} pb-4`}>
                      <CardTitle className="text-2xl mb-1">{plan.displayName}</CardTitle>
                      {plan.description && (
                        <CardDescription className="text-xs">{plan.description}</CardDescription>
                      )}
                      
                      <div className="mt-6 flex flex-col items-center gap-1">
                        <div className="text-4xl font-bold text-primary">
                          ${getPriceDisplay(plan.price)}
                        </div>
                        <p className="text-xs text-muted-foreground">/month</p>
                        <div className="mt-3 p-2 bg-primary/10 rounded-md w-full">
                          <p className="text-sm font-semibold text-primary">{plan.creditsPerMonth.toLocaleString()} credits/mo</p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 pb-4">
                      <ul className="space-y-2">
                        {features.slice(0, 8).map((feature: string, index: number) => (
                          <li key={index} className="flex items-start gap-2 text-xs">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{feature}</span>
                          </li>
                        ))}
                        {features.length > 8 && (
                          <li className="text-xs text-muted-foreground italic pt-1">
                            + {features.length - 8} more features
                          </li>
                        )}
                      </ul>
                    </CardContent>

                    <CardFooter className="pt-2">
                      <Button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={isSubmitting || isCurrentPlan}
                        className="w-full"
                        variant={isCurrentPlan ? "secondary" : plan.popular ? "default" : "outline"}
                        size="sm"
                        data-testid={`button-select-${plan.name}`}
                      >
                        {isCurrentPlan ? (
                          "Current Plan"
                        ) : isSubmitting && selectedPlan === plan.name ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Processing...
                          </>
                        ) : (
                          "Get Started"
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Free Trial Section */}
            {trialPlan && (
              <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20 mb-16">
                <CardContent className="p-8">
                  <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div>
                      <div className="mb-4">
                        <span className="inline-block bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-semibold">
                          START FREE
                        </span>
                      </div>
                      <h3 className="text-3xl font-bold mb-3">7 Day Free Trial</h3>
                      <p className="text-muted-foreground mb-4 leading-relaxed">
                        No credit card required. Get {trialPlan.creditsPerMonth.toLocaleString()} credits to explore all our AI tools and create amazing content.
                      </p>
                      <ul className="space-y-2 mb-6">
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary" />
                          <span>Full access to all features</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary" />
                          <span>No credit card required</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary" />
                          <span>Cancel anytime</span>
                        </li>
                      </ul>
                      <Button
                        onClick={() => handleSelectPlan(trialPlan)}
                        disabled={isSubmitting}
                        size="lg"
                        className="w-full md:w-auto"
                        data-testid="button-start-trial"
                      >
                        {isSubmitting && selectedPlan === trialPlan.name ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Starting...
                          </>
                        ) : (
                          "Start Free Trial"
                        )}
                      </Button>
                    </div>
                    <div className="hidden md:block text-center">
                      <div className="inline-block text-6xl">✨</div>
                      <p className="text-muted-foreground mt-4">Join thousands of creators using Artivio AI</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Security Section */}
            <div className="max-w-4xl mx-auto mb-16">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold flex items-center justify-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  Pay Safely and Securely with
                </h3>
              </div>
              <Card className="bg-muted/30 border-muted">
                <CardContent className="pt-8">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {paymentMethods.map((method) => (
                      <div key={method.name} className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <span className="text-2xl">{method.icon}</span>
                        <span className="text-xs text-muted-foreground text-center line-clamp-2">{method.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* FAQ Section */}
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-3">Frequently Asked Questions</h2>
                <p className="text-muted-foreground">Everything you need to know about our pricing and service</p>
              </div>

              <div className="space-y-4">
                {faqs.map((faq, index) => (
                  <Card key={index} className="border-muted">
                    <CardContent className="pt-6">
                      <details className="group cursor-pointer">
                        <summary className="flex items-start gap-3 font-semibold text-foreground list-none select-none">
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                            {index + 1}
                          </span>
                          <span className="pt-0.5">{faq.question}</span>
                        </summary>
                        <div className="mt-4 pl-9 text-muted-foreground text-sm leading-relaxed">
                          {faq.answer}
                        </div>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="text-center mt-16 mb-8">
              <p className="text-muted-foreground text-sm">
                All plans include full access to every AI feature. Cancel anytime, no questions asked.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
