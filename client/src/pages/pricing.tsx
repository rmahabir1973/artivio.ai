import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { SubscriptionPlan } from "@shared/schema";
import { fetchWithAuth } from "@/lib/authBridge";
import { useAuth } from "@/hooks/useAuth";
import { VideoModal } from "@/components/video-modal";

interface HomePageData {
  pricingVideoUrl?: string;
}

export default function Pricing() {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'annual' | 'monthly'>('annual');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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

  const trialPlan = plansData?.find(p => p.billingPeriod === 'trial');

  const { monthlyPlans, annualPlans } = useMemo(() => {
    if (!plansData) return { monthlyPlans: [], annualPlans: [] };
    
    const monthly = plansData
      .filter(p => p.billingPeriod === 'monthly' && p.price > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    
    const seenTiers = new Set<number>();
    const uniqueMonthly = monthly.filter(plan => {
      const tier = getPlanTierFromName(plan.displayName || plan.name);
      if (seenTiers.has(tier)) return false;
      seenTiers.add(tier);
      return true;
    });
    
    const annual = plansData
      .filter(p => p.billingPeriod === 'annual')
      .sort((a, b) => a.sortOrder - b.sortOrder);
    
    return { monthlyPlans: uniqueMonthly, annualPlans: annual };
  }, [plansData]);

  const displayPlans = billingPeriod === 'annual' ? annualPlans : monthlyPlans;

  function getPlanTierFromName(name: string): number {
    const lower = name.toLowerCase();
    if (lower.includes('trial') || lower.includes('free')) return 0;
    if (lower.includes('starter')) return 1;
    if (lower.includes('professional') || (lower.includes('pro') && !lower.includes('business'))) return 2;
    if (lower.includes('business')) return 3;
    if (lower.includes('agency') || lower.includes('enterprise')) return 4;
    return 1;
  }

  const isCurrentPlan = (plan: SubscriptionPlan): boolean => {
    if (!user || isLoadingSubscription || isSubscriptionError || !currentPlanId) return false;
    return plan.id === currentPlanId;
  };

  const isBillingSwitch = (plan: SubscriptionPlan): boolean => {
    if (!user || !currentPlanId) return false;
    if (plan.id === currentPlanId) return false;
    
    const currentPlan = plansData?.find(p => p.id === currentPlanId);
    if (!currentPlan) return false;
    
    const currentTier = getPlanTierFromName(currentPlan.displayName || currentPlan.name);
    const planTier = getPlanTierFromName(plan.displayName || plan.name);
    
    return planTier === currentTier && plan.billingPeriod !== currentPlan.billingPeriod;
  };

  const canUpgrade = (plan: SubscriptionPlan): boolean => {
    if (!user || !currentPlanId) return true;
    if (plan.id === currentPlanId) return false;
    
    const currentPlan = plansData?.find(p => p.id === currentPlanId);
    if (!currentPlan) return true;
    
    const currentTier = getPlanTierFromName(currentPlan.displayName || currentPlan.name);
    const planTier = getPlanTierFromName(plan.displayName || plan.name);
    
    return planTier > currentTier;
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (isCurrentPlan(plan)) {
      toast({
        title: "Already subscribed",
        description: "You are already on this plan.",
        variant: "default",
      });
      return;
    }

    setSelectedPlan(plan.id);
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

  const getMonthlyEquivalent = (plan: SubscriptionPlan): number => {
    if (plan.billingPeriod === 'annual') {
      const annual = plan.annualPrice || plan.price;
      return Math.round(annual / 12);
    }
    return plan.monthlyPrice || plan.price;
  };

  const getTotalPrice = (plan: SubscriptionPlan): number => {
    if (plan.billingPeriod === 'annual') {
      return plan.annualPrice || plan.price;
    }
    return plan.monthlyPrice || plan.price;
  };

  const formatPrice = (priceInCents: number): string => {
    const price = priceInCents / 100;
    return price % 1 === 0 ? price.toFixed(0) : price.toFixed(2);
  };

  const isPro = (plan: SubscriptionPlan): boolean => {
    const name = (plan.displayName || plan.name).toLowerCase();
    return name.includes('professional') || (name.includes('pro') && !name.includes('business'));
  };

  const getCompareTiers = useMemo(() => {
    const tierDefs = [
      { tier: 1, name: 'Starter' },
      { tier: 2, name: 'Professional' },
      { tier: 3, name: 'Business' },
      { tier: 4, name: 'Agency' },
    ];
    
    return tierDefs.map(def => {
      const monthly = monthlyPlans.find(p => getPlanTierFromName(p.displayName || p.name) === def.tier);
      const annual = annualPlans.find(p => getPlanTierFromName(p.displayName || p.name) === def.tier);
      const activePlan = billingPeriod === 'annual' ? annual : monthly;
      return { 
        ...def, 
        monthly, 
        annual, 
        activePlan,
        hasData: !!monthly || !!annual
      };
    }).filter(t => t.hasData);
  }, [monthlyPlans, annualPlans, billingPeriod]);

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
    <div className="min-h-screen bg-[#0a0a0a]">
      <VideoModal 
        isOpen={videoModalOpen}
        onOpenChange={setVideoModalOpen}
        videoUrl={homePageData?.pricingVideoUrl}
        title="Artivio AI - Pricing Video"
      />

      {/* Hero Section */}
      <section className="relative py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              Your Complete AI Creative Studio in One Platform
            </h1>
            <p className="text-lg md:text-xl text-gray-400 mb-6 leading-relaxed">
              Why juggle multiple tools when one platform does it all?<br />
              <span className="text-gray-300">See for yourself. <button onClick={() => setVideoModalOpen(true)} className="text-purple-400 hover:text-purple-300 hover:underline inline-flex items-center gap-1">Watch the Video</button> to discover infinite creative possibilities</span>
            </p>
          </div>

          {/* Price Comparison Box */}
          <div className="bg-[#111111] border border-[#222] rounded-xl p-6 mb-12">
            <div className="flex items-center justify-center mb-4">
              <span className="inline-flex items-center gap-1.5 bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-semibold">
                <span>🔥</span> SAVE BIG
              </span>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-6 text-white">Your Price per Generation is 40% Less Than Market Average</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Market Price</p>
                  <p className="text-2xl font-bold text-gray-500 line-through">$2.50</p>
                </div>
                <div className="flex items-center justify-center">
                  <p className="text-lg font-semibold text-red-400">Save 40%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Artivio Price</p>
                  <p className="text-2xl font-bold text-purple-400">$1.50</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans & Pricing Section */}
      <section className="container mx-auto px-4 pb-16">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-3 text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Plans & Pricing
          </h2>
          <p className="text-gray-400">Start free and upgrade to unlock more features.</p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex bg-[#1a1a1a] border border-[#333] rounded-full p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
              data-testid="toggle-monthly"
            >
              MONTHLY
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                billingPeriod === 'annual'
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
              data-testid="toggle-annual"
            >
              ANNUAL <span className={billingPeriod === 'annual' ? 'text-purple-600' : 'text-purple-500'}>(35% OFF)</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" data-testid="loader-plans" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-red-400 font-semibold mb-2">Failed to load pricing plans</p>
            <p className="text-gray-500 text-sm mb-4">{error instanceof Error ? error.message : 'An error occurred'}</p>
            <Button onClick={() => window.location.reload()} variant="outline">Reload Page</Button>
          </div>
        ) : displayPlans.length === 0 && !trialPlan ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-gray-400 font-semibold mb-2">No pricing plans available</p>
            <p className="text-gray-500 text-sm">Please contact support if this persists.</p>
          </div>
        ) : (
          <>
            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-16">
              {/* Free Trial Card */}
              {trialPlan && (
                <div 
                  className={`bg-[#111111] border rounded-xl p-6 flex flex-col ${
                    isCurrentPlan(trialPlan) ? 'border-purple-500/50 opacity-60' : 'border-[#222]'
                  }`}
                  data-testid="card-plan-trial"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white italic" style={{ fontFamily: "'Playfair Display', serif" }}>Free</h3>
                    <p className="text-sm text-gray-500 mt-1">Try your first AI creations</p>
                  </div>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">$0</span>
                    <span className="text-gray-500 ml-1">per month</span>
                  </div>

                  <Button
                    onClick={() => handleSelectPlan(trialPlan)}
                    disabled={isSubmitting || isCurrentPlan(trialPlan)}
                    variant="outline"
                    className={`w-full mb-6 bg-transparent border-[#333] text-white hover:bg-white hover:text-black ${
                      isCurrentPlan(trialPlan) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    data-testid="button-select-trial"
                  >
                    {isCurrentPlan(trialPlan) ? (
                      "Current Plan"
                    ) : isSubmitting && selectedPlan === trialPlan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      "Get Started"
                    )}
                  </Button>

                  <div className="space-y-4 flex-1">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">USAGE LIMITS</p>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                          <Check className="h-4 w-4 text-purple-400 shrink-0" />
                          {trialPlan.creditsPerMonth.toLocaleString()} credits
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                          <Check className="h-4 w-4 text-purple-400 shrink-0" />
                          7 day access
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                          <Check className="h-4 w-4 text-purple-400 shrink-0" />
                          No credit card required
                        </li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">FEATURES</p>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                          <Check className="h-4 w-4 text-purple-400 shrink-0" />
                          All AI models
                        </li>
                        <li className="flex items-center gap-2 text-sm text-gray-300">
                          <Check className="h-4 w-4 text-purple-400 shrink-0" />
                          All tools & features
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Paid Plan Cards */}
              {displayPlans.map((plan) => {
                const isProPlan = isPro(plan);
                const isCurrent = isCurrentPlan(plan);
                const canUpgradeToPlan = canUpgrade(plan);
                const monthlyPrice = getMonthlyEquivalent(plan);
                const totalPrice = getTotalPrice(plan);
                
                return (
                  <div 
                    key={plan.id}
                    className={`relative bg-[#111111] rounded-xl p-6 flex flex-col ${
                      isProPlan 
                        ? 'border-2 border-purple-500' 
                        : isCurrent 
                          ? 'border border-purple-500/50' 
                          : 'border border-[#222]'
                    } ${isCurrent ? 'opacity-60' : ''}`}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    {isProPlan && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-purple-500/20 text-purple-400 border border-purple-500/50 px-4 py-1 rounded-full text-xs font-medium">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className={`mb-4 ${isProPlan ? 'pt-2' : ''}`}>
                      <h3 className="text-xl font-semibold text-white italic" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {plan.displayName.replace(' (Annual)', '')}
                      </h3>
                      {plan.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{plan.description}</p>
                      )}
                    </div>
                    
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-white">${formatPrice(monthlyPrice)}</span>
                      <span className="text-gray-500 ml-1">/month</span>
                      {billingPeriod === 'annual' && (
                        <p className="text-xs text-gray-500 mt-1">
                          ${formatPrice(totalPrice)} billed yearly
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      disabled={isSubmitting || isCurrent}
                      variant={isProPlan ? "default" : "outline"}
                      className={`w-full mb-6 ${
                        isProPlan 
                          ? 'bg-purple-500 hover:bg-purple-600 text-white border-0' 
                          : 'bg-transparent border-[#333] text-white hover:bg-white hover:text-black'
                      } ${isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                      data-testid={`button-select-${plan.id}`}
                    >
                      {isCurrent ? (
                        "Current Plan"
                      ) : isSubmitting && selectedPlan === plan.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : user && canUpgradeToPlan ? (
                        "Upgrade"
                      ) : user && !canUpgradeToPlan ? (
                        "Switch Plan"
                      ) : (
                        "Get Started"
                      )}
                    </Button>

                    <div className="space-y-4 flex-1">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">USAGE LIMITS</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="h-4 w-4 text-purple-400 shrink-0" />
                            {plan.creditsPerMonth.toLocaleString()} credits/month
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="h-4 w-4 text-purple-400 shrink-0" />
                            {plan.creditRolloverLimit ? `${plan.creditRolloverLimit.toLocaleString()} rollover limit` : 'Credit rollover'}
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="h-4 w-4 text-purple-400 shrink-0" />
                            Priority generation
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">FEATURES</p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="h-4 w-4 text-purple-400 shrink-0" />
                            All AI video models
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="h-4 w-4 text-purple-400 shrink-0" />
                            All AI image models
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="h-4 w-4 text-purple-400 shrink-0" />
                            Suno music generation
                          </li>
                          <li className="flex items-center gap-2 text-sm text-gray-300">
                            <Check className="h-4 w-4 text-purple-400 shrink-0" />
                            Voice cloning & TTS
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Feature Comparison Table */}
            <div className="max-w-6xl mx-auto mb-16">
              <h3 className="text-2xl font-semibold text-white mb-8" style={{ fontFamily: "'Playfair Display', serif" }}>
                Compare Plans
              </h3>
              
              <div className="bg-[#0d0d0d] border border-[#222] rounded-xl overflow-hidden overflow-x-auto">
                {/* Table Header */}
                <div 
                  className="grid gap-4 p-4 border-b border-[#222] bg-[#111] min-w-[700px]" 
                  style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                >
                  <div className="text-gray-400 text-sm font-medium">Plan Details</div>
                  <div className="text-center">
                    <p className="text-white font-medium">Free Trial</p>
                    <p className="text-gray-500 text-xs">$0</p>
                  </div>
                  {getCompareTiers.map((tier) => {
                    const plan = tier.activePlan;
                    return (
                      <div key={tier.name} className="text-center">
                        <p className="text-white font-medium">{tier.name}</p>
                        <p className="text-gray-500 text-xs">
                          {plan ? `$${formatPrice(getMonthlyEquivalent(plan))}/mo` : '-'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Credits Row */}
                <div 
                  className="grid gap-4 p-4 border-b border-[#1a1a1a] min-w-[700px]" 
                  style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                >
                  <div className="text-gray-300 text-sm font-medium">Monthly Credits</div>
                  <div className="text-center">
                    <span className="text-purple-400 font-semibold">{trialPlan?.creditsPerMonth.toLocaleString() || '1,000'}</span>
                  </div>
                  {getCompareTiers.map((tier) => {
                    const plan = tier.activePlan || tier.monthly || tier.annual;
                    return (
                      <div key={tier.name} className="text-center">
                        <span className="text-purple-400 font-semibold">
                          {plan ? plan.creditsPerMonth.toLocaleString() : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Credit Rollover Row */}
                <div 
                  className="grid gap-4 p-4 border-b border-[#1a1a1a] min-w-[700px]" 
                  style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                >
                  <div className="text-gray-300 text-sm">Credit Rollover Limit</div>
                  <div className="text-center">
                    <X className="h-4 w-4 text-gray-600 mx-auto" />
                  </div>
                  {getCompareTiers.map((tier) => {
                    const plan = tier.activePlan || tier.monthly || tier.annual;
                    return (
                      <div key={tier.name} className="text-center">
                        {plan?.creditRolloverLimit ? (
                          <span className="text-gray-300 text-sm">{plan.creditRolloverLimit.toLocaleString()}</span>
                        ) : (
                          <Check className="h-4 w-4 text-purple-400 mx-auto" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Trial Duration Row */}
                <div 
                  className="grid gap-4 p-4 border-b border-[#1a1a1a] min-w-[700px]" 
                  style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                >
                  <div className="text-gray-300 text-sm">Access Duration</div>
                  <div className="text-center">
                    <span className="text-gray-400 text-sm">7 days</span>
                  </div>
                  {getCompareTiers.map((tier) => (
                    <div key={tier.name} className="text-center">
                      <span className="text-gray-300 text-sm">Unlimited</span>
                    </div>
                  ))}
                </div>

                {/* AI Video Section */}
                <div className="bg-[#0a0a0a] px-4 py-3 border-b border-[#222] min-w-[700px]">
                  <h4 className="text-purple-400 font-medium text-sm">AI Video Generation</h4>
                </div>
                {['Veo 3.1, Runway Gen-3, Kling 2.5', 'Seedance, Wan 2.5, Sora 2', 'Image-to-Video'].map((feature, idx) => (
                  <div 
                    key={idx} 
                    className="grid gap-4 p-4 border-b border-[#1a1a1a] min-w-[700px]" 
                    style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                  >
                    <div className="text-gray-300 text-sm">{feature}</div>
                    <div className="text-center"><Check className="h-4 w-4 text-purple-400 mx-auto" /></div>
                    {getCompareTiers.map((tier) => (
                      <div key={tier.name} className="text-center">
                        <Check className="h-4 w-4 text-purple-400 mx-auto" />
                      </div>
                    ))}
                  </div>
                ))}

                {/* AI Image Section */}
                <div className="bg-[#0a0a0a] px-4 py-3 border-b border-[#222] min-w-[700px]">
                  <h4 className="text-purple-400 font-medium text-sm">AI Image Generation</h4>
                </div>
                {['Seedream 4.0, Flux Kontext', 'Midjourney v7, 4o Image', 'Background Removal'].map((feature, idx) => (
                  <div 
                    key={idx} 
                    className="grid gap-4 p-4 border-b border-[#1a1a1a] min-w-[700px]" 
                    style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                  >
                    <div className="text-gray-300 text-sm">{feature}</div>
                    <div className="text-center"><Check className="h-4 w-4 text-purple-400 mx-auto" /></div>
                    {getCompareTiers.map((tier) => (
                      <div key={tier.name} className="text-center">
                        <Check className="h-4 w-4 text-purple-400 mx-auto" />
                      </div>
                    ))}
                  </div>
                ))}

                {/* AI Audio Section */}
                <div className="bg-[#0a0a0a] px-4 py-3 border-b border-[#222] min-w-[700px]">
                  <h4 className="text-purple-400 font-medium text-sm">AI Audio & Music</h4>
                </div>
                {['Suno V3.5/V4/V5 Music', 'Voice Cloning & TTS', 'Sound Effects & Lip Sync'].map((feature, idx) => (
                  <div 
                    key={idx} 
                    className="grid gap-4 p-4 border-b border-[#1a1a1a] min-w-[700px]" 
                    style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                  >
                    <div className="text-gray-300 text-sm">{feature}</div>
                    <div className="text-center"><Check className="h-4 w-4 text-purple-400 mx-auto" /></div>
                    {getCompareTiers.map((tier) => (
                      <div key={tier.name} className="text-center">
                        <Check className="h-4 w-4 text-purple-400 mx-auto" />
                      </div>
                    ))}
                  </div>
                ))}

                {/* Tools Section */}
                <div className="bg-[#0a0a0a] px-4 py-3 border-b border-[#222] min-w-[700px]">
                  <h4 className="text-purple-400 font-medium text-sm">Tools & Features</h4>
                </div>
                {['Image & Video Upscaling', 'AI Chat Assistant', 'QR Code Generator'].map((feature, idx) => (
                  <div 
                    key={idx} 
                    className={`grid gap-4 p-4 min-w-[700px] ${idx < 2 ? 'border-b border-[#1a1a1a]' : ''}`} 
                    style={{ gridTemplateColumns: `180px repeat(${getCompareTiers.length + 1}, 1fr)` }}
                  >
                    <div className="text-gray-300 text-sm">{feature}</div>
                    <div className="text-center"><Check className="h-4 w-4 text-purple-400 mx-auto" /></div>
                    {getCompareTiers.map((tier) => (
                      <div key={tier.name} className="text-center">
                        <Check className="h-4 w-4 text-purple-400 mx-auto" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-3xl mx-auto mb-16">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div 
                    key={index} 
                    className="bg-[#111111] border border-[#222] rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="w-full flex items-center justify-between p-5 text-left hover:bg-[#1a1a1a] transition-colors"
                      data-testid={`faq-toggle-${index}`}
                    >
                      <span className="text-white font-medium pr-4">{faq.question}</span>
                      <span className="text-gray-400 shrink-0">
                        <Plus className={`h-5 w-5 transition-transform ${openFaq === index ? 'rotate-45' : ''}`} />
                      </span>
                    </button>
                    {openFaq === index && (
                      <div className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="text-center">
              <p className="text-gray-500 text-sm">
                All plans include full access to every AI feature. Cancel anytime, no questions asked.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
