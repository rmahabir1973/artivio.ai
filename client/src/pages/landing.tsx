import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Video, Image, Music, Zap, Shield, Sparkles, Loader2, ChevronRight, Play, Palette, Mic, Film,
  Award, DollarSign, Droplet, Monitor, Smartphone, Tablet, Check, Star, Laptop,
  Wand2, Volume2, Sliders, MessageSquare, User, Shuffle, Maximize, Maximize2, Clock, TrendingUp,
  Users, Globe, Lock, Quote, Megaphone, Eraser, BookOpen, Crown
} from "lucide-react";
import { SiApple, SiAndroid, SiIos } from "react-icons/si";
import type { HomePageContent, SubscriptionPlan } from "@shared/schema";
import { normalizeVideoUrl, detectProvider, isValidVideoUrl } from "@/lib/videoProvider";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/authBridge";

// Testimonials data - realistic placeholder testimonials
const testimonials = [
  {
    quote: "I used to spend 8 hours editing videos. With Artivio, I go from concept to published in 15 minutes. Total game-changer for my content schedule.",
    name: "Sarah Chen",
    title: "Content Creator",
    followers: "125K",
    platforms: "TikTok • YouTube",
    avatar: "SC"
  },
  {
    quote: "My engagement tripled after switching to Artivio. The AI-generated videos look so professional that my audience can't tell the difference.",
    name: "Marcus Thompson",
    title: "YouTube Educator",
    followers: "89K",
    platforms: "YouTube • Instagram",
    avatar: "MT"
  },
  {
    quote: "I went from posting once a week to 5 videos a week. Consistency = more followers. Artivio made scaling my content effortless.",
    name: "Elena Rodriguez",
    title: "Lifestyle Influencer",
    followers: "200K",
    platforms: "Instagram • TikTok",
    avatar: "ER"
  },
  {
    quote: "The music generation alone is worth the subscription. I create custom tracks for all my videos without paying for licensing. Huge cost saver.",
    name: "James Wilson",
    title: "Podcast Host",
    followers: "45K",
    platforms: "YouTube • Spotify",
    avatar: "JW"
  },
  {
    quote: "As a marketing agency, we use Artivio for client content. What used to take our team 2 days now takes 2 hours. ROI is incredible.",
    name: "Priya Patel",
    title: "Marketing Director",
    followers: "15K",
    platforms: "LinkedIn • Twitter",
    avatar: "PP"
  }
];

// Results/Stats data
const resultsData = [
  { stat: "15 mins", label: "Average Time to Create", detail: "Down from 2-4 hours manually", quote: "From script to publish in one morning" },
  { stat: "4.2x", label: "More Content Per Week", detail: "Creators posting daily instead of weekly", quote: "Consistency = more followers" },
  { stat: "87%", label: "Report Viral Videos", detail: "vs 34% creating content manually", quote: "My engagement tripled" },
  { stat: "$0", label: "Cost to Start", detail: "Free tier includes daily generations", quote: "Test before you commit" },
  { stat: "10+", label: "AI Models Available", detail: "Veo 3.1, Runway, Sora, Kling, and more", quote: "Industry's best AI at lowest prices" },
  { stat: "48K+", label: "Active Creators", detail: "Growing 30% month-over-month", quote: "Join the fastest-growing creator community" }
];

// Comparison table data
const comparisonData = [
  { feature: "Time to Create Video", artivio: "15 minutes", manual: "2-4 hours", others: "30-45 minutes" },
  { feature: "Video Quality", artivio: "4K/Professional", manual: "4K/Professional", others: "720p-1080p" },
  { feature: "Learning Curve", artivio: "5 minutes", manual: "Weeks/Months", others: "1-2 hours" },
  { feature: "Cost Per Video", artivio: "$0.30-1.00", manual: "$0 (your time)", others: "$1-5" },
  { feature: "AI Voice Quality", artivio: "Natural/Human", manual: "N/A", others: "Robotic" },
  { feature: "Auto Multi-Platform", artivio: "Coming Soon", manual: "Manual Resize", others: "Basic 2-3" },
  { feature: "Free Trial Available", artivio: "Yes - Daily Free", manual: "N/A", others: "Limited 3 days" },
  { feature: "24/7 Support", artivio: "Yes", manual: "N/A", others: "Business Hours" }
];

// Additional FAQs for conversion
const additionalFaqs = [
  { question: "How fast can I create a video?", answer: "Most creators publish videos in 15 minutes. Just describe your idea, select your style, and Artivio generates it. No editing experience needed." },
  { question: "Do I need special software or equipment?", answer: "No! You only need a web browser and an internet connection. Artivio runs completely online. No downloads, no installations." },
  { question: "What happens if I don't like the generated video?", answer: "You get unlimited regenerations with your credits. Adjust your prompt, try different styles, or pick different music. Full creative control." },
  { question: "Can I use these videos commercially?", answer: "Yes! All content created with Artivio is yours to use commercially. Post to social media, YouTube, your website - complete ownership." },
  { question: "What if I want to post to multiple platforms?", answer: "We're building auto-format support for all major platforms (TikTok, Instagram, YouTube, LinkedIn, etc) - coming soon! For now, you can easily resize your content using our video editor." },
  { question: "Is there a refund if I'm not satisfied?", answer: "Yes. 30-day full refund guarantee, no questions asked. We're confident you'll love Artivio." }
];

// Pricing Section Component
function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<'annual' | 'monthly'>('annual');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: plansData, isLoading, error } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/plans'],
  });

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

  const isPro = (plan: SubscriptionPlan): boolean => {
    const name = (plan.displayName || plan.name).toLowerCase();
    return name.includes('professional') || (name.includes('pro') && !name.includes('business'));
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

  const isTrial = (plan: SubscriptionPlan) => plan.billingPeriod === 'trial';

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    setSelectedPlan(plan.name);
    setIsSubmitting(true);

    try {
      // Handle free trial plan separately
      if (isTrial(plan)) {
        if (user) {
          const response = await fetchWithAuth('/api/billing/start-free-trial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to start free trial');
          }
          toast({
            title: "Welcome to Artivio AI!",
            description: `Your free trial has started! You've received ${data.creditsGranted} credits.`,
          });
          window.location.href = '/dashboard';
        } else {
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
        }
      } else {
        // Handle paid plans
        if (!user) {
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
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ planId: plan.id }),
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
    <section id="pricing" className="py-20 px-6 bg-[#0a0a0a]">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-3 text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
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
              data-testid="button-pricing-monthly"
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
              data-testid="button-pricing-annual"
            >
              ANNUAL <span className={billingPeriod === 'annual' ? 'text-purple-600' : 'text-purple-500'}>(35% OFF)</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" data-testid="loader-pricing" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-red-400 font-semibold mb-2">Failed to load pricing plans</p>
            <p className="text-gray-400 text-sm mb-4">Please refresh the page to try again</p>
          </div>
        ) : displayPlans.length === 0 && !trialPlan ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-gray-400 font-semibold mb-2">No pricing plans available</p>
            <p className="text-gray-500 text-sm">Please contact support if this persists.</p>
          </div>
        ) : (
          <>
            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto mb-12">
              {/* Free Trial Card */}
              {trialPlan && (
                <div 
                  className="bg-[#111111] border border-[#222] rounded-xl p-6 flex flex-col"
                  data-testid="pricing-card-trial"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white italic" style={{ fontFamily: "'Playfair Display', serif" }}>Free</h3>
                    <p className="text-sm text-gray-500 mt-1">Try your first AI creations</p>
                  </div>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">$0</span>
                    <span className="text-gray-500 ml-1">/month</span>
                  </div>

                  <Button
                    onClick={() => handleSelectPlan(trialPlan)}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full mb-6 bg-transparent border-[#333] text-white hover:bg-white hover:text-black"
                    data-testid="button-pricing-select-trial"
                  >
                    {isSubmitting && selectedPlan === trialPlan.name ? (
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
                const monthlyPrice = getMonthlyEquivalent(plan);
                const totalPrice = getTotalPrice(plan);
                
                return (
                  <div 
                    key={plan.id}
                    className={`relative bg-[#111111] rounded-xl p-6 flex flex-col ${
                      isProPlan 
                        ? 'border-2 border-purple-500' 
                        : 'border border-[#222]'
                    }`}
                    data-testid={`pricing-card-${plan.name}`}
                  >
                    {isProPlan && (
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
                      disabled={isSubmitting}
                      variant={isProPlan ? "default" : "outline"}
                      className={`w-full mb-6 ${
                        isProPlan 
                          ? 'bg-purple-500 hover:bg-purple-600 text-white border-0' 
                          : 'bg-transparent border-[#333] text-white hover:bg-white hover:text-black'
                      }`}
                      data-testid={`button-pricing-select-${plan.name}`}
                    >
                      {isSubmitting && selectedPlan === plan.name ? (
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

            {/* Features Info */}
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-gray-300 mb-4">
                All plans include full access to every AI model and tool. No credit card required to start.
              </p>
              <Button variant="ghost" asChild data-testid="button-view-standalone-pricing">
                <a href="/pricing" className="text-purple-400 hover:text-purple-300">
                  View detailed pricing page →
                </a>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export default function Landing() {
  const [videoLoadFailed, setVideoLoadFailed] = useState(false);
  const [demoVideoModalOpen, setDemoVideoModalOpen] = useState(false);
  
  const { data: content, isLoading } = useQuery<HomePageContent>({
    queryKey: ["/api/homepage"],
  });

  // Normalize video URL outside of render to avoid hook violations (supports Vimeo & PeerTube)
  const normalizedVideoUrl = useMemo(() => {
    if (content?.heroVideoUrl && isValidVideoUrl(content.heroVideoUrl) && !videoLoadFailed) {
      const result = normalizeVideoUrl(content.heroVideoUrl);
      if (result.success && result.info?.embedUrl) {
        return result.info.embedUrl;
      } else {
        console.error('Video URL normalization failed:', result.error);
      }
    }
    return null;
  }, [content?.heroVideoUrl, videoLoadFailed]);

  // Normalize feature video URLs (supports Vimeo & PeerTube)
  const normalizedFeatureVideoUrl = useMemo(() => {
    if (content?.featureVideoUrl && isValidVideoUrl(content.featureVideoUrl)) {
      const result = normalizeVideoUrl(content.featureVideoUrl);
      if (result.success && result.info?.embedUrl) {
        // Use playback URL (not background autoplay)
        const url = new URL(result.info.embedUrl);
        url.searchParams.set('autoplay', '0');
        url.searchParams.set('controls', '1');
        url.searchParams.set('muted', '0');
        if (result.info.provider === 'vimeo') {
          url.searchParams.delete('background');
        }
        return url.toString();
      }
    }
    return content?.featureVideoUrl || null;
  }, [content?.featureVideoUrl]);

  const normalizedFeatureImageUrl = useMemo(() => {
    if (content?.featureImageUrl && isValidVideoUrl(content.featureImageUrl)) {
      const result = normalizeVideoUrl(content.featureImageUrl);
      if (result.success && result.info?.embedUrl) {
        const url = new URL(result.info.embedUrl);
        url.searchParams.set('autoplay', '0');
        url.searchParams.set('controls', '1');
        url.searchParams.set('muted', '0');
        if (result.info.provider === 'vimeo') {
          url.searchParams.delete('background');
        }
        return url.toString();
      }
    }
    return content?.featureImageUrl || null;
  }, [content?.featureImageUrl]);

  const normalizedFeatureMusicUrl = useMemo(() => {
    if (content?.featureMusicUrl && isValidVideoUrl(content.featureMusicUrl)) {
      const result = normalizeVideoUrl(content.featureMusicUrl);
      if (result.success && result.info?.embedUrl) {
        const url = new URL(result.info.embedUrl);
        url.searchParams.set('autoplay', '0');
        url.searchParams.set('controls', '1');
        url.searchParams.set('muted', '0');
        if (result.info.provider === 'vimeo') {
          url.searchParams.delete('background');
        }
        return url.toString();
      }
    }
    return content?.featureMusicUrl || null;
  }, [content?.featureMusicUrl]);

  const normalizedDemoVideoUrl = useMemo(() => {
    if (content?.demoVideoUrl && isValidVideoUrl(content.demoVideoUrl)) {
      const result = normalizeVideoUrl(content.demoVideoUrl);
      if (result.success && result.info?.embedUrl) {
        const url = new URL(result.info.embedUrl);
        url.searchParams.set('autoplay', '0');
        url.searchParams.set('controls', '1');
        url.searchParams.set('muted', '0');
        if (result.info.provider === 'vimeo') {
          url.searchParams.delete('background');
        }
        return url.toString();
      }
    }
    return content?.demoVideoUrl || null;
  }, [content?.demoVideoUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0F0F0F]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      {/* Urgency Banner - Top of Page */}
      <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2.5 px-4">
        <div className="container mx-auto flex items-center justify-center gap-4 flex-wrap">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Free tier now available: Daily video generations (No card required)
          </p>
          <a 
            href="/dashboard" 
            className="bg-white text-purple-600 px-4 py-1.5 rounded-md text-xs font-bold hover:scale-105 transition-transform whitespace-nowrap"
            data-testid="banner-cta"
          >
            Start Creating Now
          </a>
        </div>
      </div>

      {/* Fixed Navigation Header */}
      <header className="fixed top-10 left-0 right-0 z-50 bg-[#0F0F0F]/80 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-20 flex-wrap gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-2 rounded-lg">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Artivio AI</span>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-8 flex-1 justify-center">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors" data-testid="nav-features">
                Features
              </a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors" data-testid="nav-pricing">
                Pricing
              </a>
              <a href="/video-models" className="text-gray-300 hover:text-white transition-colors" data-testid="nav-showcase">
                Showcase
              </a>
              <a href="#faq" className="text-gray-300 hover:text-white transition-colors" data-testid="nav-faq">
                FAQ
              </a>
            </nav>

            {/* CTA Buttons */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <Button variant="ghost" asChild data-testid="button-sign-in">
                <a href="/login">Sign In</a>
              </Button>
              <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" asChild data-testid="button-get-started">
                <a href="/dashboard">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Full Screen with Background Video */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden pt-32 md:pt-36">
        {/* Mobile: Always show gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20 z-0 md:hidden" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-3xl z-0 md:hidden" />
        
        {/* Desktop: Show video if available, otherwise gradient */}
        {normalizedVideoUrl ? (
          <>
            <div className="absolute inset-0 z-0 hidden md:block">
              <iframe
                src={normalizedVideoUrl}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[56.25vw] min-h-[100vh] min-w-[177.77vh]"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Hero Background Video"
                onError={() => {
                  console.error('Hero video failed to load');
                  setVideoLoadFailed(true);
                }}
              />
            </div>
            {/* Dark overlay for text readability - desktop only */}
            <div className="absolute inset-0 bg-black/60 z-[1] hidden md:block" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20 z-0 hidden md:block" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-3xl z-0 hidden md:block" />
          </>
        )}
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight drop-shadow-2xl">
              Create{" "}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Viral Content
              </span>
              {" "}in Minutes, Not Weeks
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto drop-shadow-lg leading-relaxed">
              Generate stunning AI videos, images & audio. Built for multi-platform creators. 
              Get results in hours, not months.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 h-14 shadow-2xl"
                asChild
                data-testid="button-hero-get-started"
              >
                <a href="/dashboard">
                  Start Creating Free - No Card Required
                  <ChevronRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 text-lg px-8 h-14 shadow-2xl"
                onClick={() => setDemoVideoModalOpen(true)}
                data-testid="button-hero-see-action"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch 2-min Demo
              </Button>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronRight className="h-8 w-8 rotate-90 text-white/60" />
          </div>
        </div>
      </section>

      {/* Benefits Bar - UPDATE #2 */}
      <section className="py-8 px-6 border-y border-white/10 bg-[#1A1A1A]/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-3" data-testid="benefit-no-watermarks">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-3 rounded-full">
                <Droplet className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg font-semibold">No Watermarks</span>
            </div>
            <div className="flex items-center justify-center gap-3" data-testid="benefit-commercial-use">
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-full">
                <Award className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg font-semibold">Commercial Use</span>
            </div>
            <div className="flex items-center justify-center gap-3" data-testid="benefit-low-fees">
              <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-full">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <span className="text-lg font-semibold">Low Monthly Fees</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges Section */}
      <section className="py-10 px-6 border-b border-white/10 bg-[#0F0F0F]">
        <div className="container mx-auto">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12 lg:gap-16">
            <div className="text-center" data-testid="trust-rating">
              <div className="flex items-center justify-center gap-1 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-lg font-bold text-white">4.8/5 Stars</p>
              <p className="text-sm text-gray-400">2,400+ Reviews</p>
            </div>
            <div className="text-center" data-testid="trust-creators">
              <Users className="h-8 w-8 text-purple-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">48K+</p>
              <p className="text-sm text-gray-400">Active Creators</p>
            </div>
            <div className="text-center" data-testid="trust-videos">
              <Video className="h-8 w-8 text-blue-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">2M+</p>
              <p className="text-sm text-gray-400">Videos Generated</p>
            </div>
            <div className="text-center" data-testid="trust-countries">
              <Globe className="h-8 w-8 text-green-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">150+</p>
              <p className="text-sm text-gray-400">Countries</p>
            </div>
            <div className="text-center" data-testid="trust-gdpr">
              <Lock className="h-8 w-8 text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">GDPR</p>
              <p className="text-sm text-gray-400">Compliant</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Everything you need to create
            </h2>
            <p className="text-xl text-gray-400">
              Powerful AI tools for every type of content
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Feature Card 1 - UPDATE #1: Using 16:9 aspect ratio */}
            <div className="group bg-[#1A1A1A] rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-xl w-fit mb-6">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">AI Video</h3>
              <p className="text-gray-400 mb-4 leading-relaxed">
                Generate professional videos with Veo 3.1, Runway, and more. 
                From concept to completion in minutes.
              </p>
              {/* Pricing Banner */}
              <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg px-3 py-2 mb-4" data-testid="video-pricing-banner">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-purple-300 font-semibold">Lowest Rates:</span>
                  <span className="text-gray-300">Veo 3.1 <strong className="text-white">$0.93</strong></span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">Runway <strong className="text-white">$0.37</strong></span>
                </div>
              </div>
              <a href="/generate/video" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-2 group" data-testid="link-feature-video">
                Learn More
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Feature Card 2 */}
            <div className="group bg-[#1A1A1A] rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-xl w-fit mb-6">
                <Image className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">AI Images</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Create stunning visuals with DALL-E, Flux, and Midjourney. 
                Photorealistic to artistic styles.
              </p>
              <a href="/generate/image" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-2 group" data-testid="link-feature-image">
                Learn More
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Feature Card 3 */}
            <div className="group bg-[#1A1A1A] rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-xl w-fit mb-6">
                <Music className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">AI Music</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Compose original tracks with Suno V4. 
                Full songs with vocals up to 8 minutes long.
              </p>
              <a href="/generate/music" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-2 group" data-testid="link-feature-music">
                Learn More
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Results Showcase Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-[#0F0F0F] to-[#1A1A1A]">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Creators Are Posting 10x Faster
            </h2>
            <p className="text-xl text-gray-400">
              Real results from real creators using Artivio
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {resultsData.map((result, index) => (
              <div 
                key={index}
                className="bg-gradient-to-br from-[#1A1A1A] to-[#252525] p-8 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all hover:-translate-y-1"
                data-testid={`result-card-${index}`}
              >
                <div className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
                  {result.stat}
                </div>
                <p className="text-lg font-semibold text-white mb-1">{result.label}</p>
                <p className="text-sm text-gray-400 mb-4">{result.detail}</p>
                <p className="text-sm italic text-gray-300 border-l-2 border-purple-500 pl-3">
                  "{result.quote}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-6 bg-[#0F0F0F]">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold px-4 py-2 rounded-full mb-4">
              TRUSTED BY CREATORS WORLDWIDE
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What Creators Are Saying
            </h2>
            <p className="text-xl text-gray-400">
              Join thousands of creators who've transformed their content workflow
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="bg-[#1A1A1A] p-6 rounded-xl border border-white/10 hover:border-purple-500/30 transition-all"
                data-testid={`testimonial-card-${index}`}
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <Quote className="h-8 w-8 text-purple-500/30 mb-2" />
                <p className="text-gray-300 mb-6 leading-relaxed">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{testimonial.name}</p>
                    <p className="text-sm text-gray-400">{testimonial.title} | {testimonial.followers} followers</p>
                    <p className="text-xs text-purple-400">{testimonial.platforms}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="py-20 px-6 bg-[#1A1A1A]">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Creators Choose Artivio
            </h2>
            <p className="text-xl text-gray-400">
              See how we compare to alternatives
            </p>
          </div>

          <div className="max-w-5xl mx-auto overflow-x-auto">
            <table className="w-full border-collapse" data-testid="comparison-table">
              <thead>
                <tr>
                  <th className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 text-left font-semibold rounded-tl-lg">Feature</th>
                  <th className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 text-left font-semibold">Artivio</th>
                  <th className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 text-left font-semibold">Manual Editing</th>
                  <th className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 text-left font-semibold rounded-tr-lg">Other AI Tools</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                    <td className="p-4 text-gray-300">{row.feature}</td>
                    <td className="p-4 text-green-400 font-semibold">{row.artivio}</td>
                    <td className="p-4 text-gray-400">{row.manual}</td>
                    <td className="p-4 text-gray-400">{row.others}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-10">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              asChild
              data-testid="button-comparison-cta"
            >
              <a href="/dashboard">
                Start Creating Free
                <ChevronRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Alternating Content Sections - UPDATE #1: Changed to aspect-video (16:9) */}
      <section id="products" className="py-20 px-6">
        <div className="container mx-auto space-y-32">
          {/* Section 1: Image Left */}
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-3xl blur-2xl" />
              <div className="relative aspect-video bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
                {normalizedFeatureVideoUrl ? (
                  <iframe
                    src={normalizedFeatureVideoUrl}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Create videos that captivate"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center">
                    <Film className="h-32 w-32 text-purple-500/40" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold">
                Create videos that captivate
              </h2>
              <p className="text-xl text-gray-400 leading-relaxed">
                Transform text into stunning videos with our advanced AI models. 
                Perfect for marketing, social media, and professional content creation.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Zap className="h-6 w-6 text-purple-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Lightning Fast</div>
                    <div className="text-gray-400">Generate videos in minutes, not hours</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Shield className="h-6 w-6 text-purple-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Professional Quality</div>
                    <div className="text-gray-400">4K resolution with perfect synchronization</div>
                  </div>
                </li>
              </ul>
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" asChild data-testid="button-section-video">
                <a href="/dashboard">Start Creating</a>
              </Button>
            </div>
          </div>

          {/* Section 2: Text Left */}
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6 md:order-1">
              <h2 className="text-4xl md:text-5xl font-bold">
                Images that inspire
              </h2>
              <p className="text-xl text-gray-400 leading-relaxed">
                Generate breathtaking visuals for any purpose. From product mockups 
                to artistic masterpieces, our AI brings your vision to life.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Palette className="h-6 w-6 text-purple-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Infinite Styles</div>
                    <div className="text-gray-400">From photorealistic to abstract art</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="h-6 w-6 text-purple-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Perfect Details</div>
                    <div className="text-gray-400">Crisp, high-resolution outputs every time</div>
                  </div>
                </li>
              </ul>
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" asChild data-testid="button-section-image">
                <a href="/dashboard">Get Started</a>
              </Button>
            </div>
            <div className="relative md:order-2">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-2xl" />
              <div className="relative aspect-video bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
                {normalizedFeatureImageUrl ? (
                  <iframe
                    src={normalizedFeatureImageUrl}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Images that inspire"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                    <Palette className="h-32 w-32 text-blue-500/40" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Image Left */}
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-3xl blur-2xl" />
              <div className="relative aspect-video bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
                {normalizedFeatureMusicUrl ? (
                  <iframe
                    src={normalizedFeatureMusicUrl}
                    className="absolute inset-0 w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Music that moves"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center">
                    <Mic className="h-32 w-32 text-purple-500/40" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold">
                Music that moves
              </h2>
              <p className="text-xl text-gray-400 leading-relaxed">
                Compose original soundtracks with AI. Perfect for videos, podcasts, 
                games, and any project needing custom music.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Music className="h-6 w-6 text-purple-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Any Genre</div>
                    <div className="text-gray-400">From classical to electronic, rock to jazz</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Zap className="h-6 w-6 text-purple-500 shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold mb-1">Full Tracks</div>
                    <div className="text-gray-400">Complete songs with vocals up to 8 minutes</div>
                  </div>
                </li>
              </ul>
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" asChild data-testid="button-section-music">
                <a href="/pricing">Create Music</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Compatibility - UPDATE #6 */}
      <section className="py-16 px-6 bg-[#1A1A1A]/30">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Works Everywhere You Do
            </h2>
            <p className="text-xl text-gray-400">
              Fully compatible across all platforms
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="flex flex-col items-center gap-3" data-testid="platform-macos">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-2xl">
                <SiApple className="h-12 w-12 text-white" />
              </div>
              <span className="font-semibold">Mac OS</span>
            </div>
            <div className="flex flex-col items-center gap-3" data-testid="platform-windows">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-2xl">
                <Laptop className="h-12 w-12 text-white" />
              </div>
              <span className="font-semibold">Windows PC</span>
            </div>
            <div className="flex flex-col items-center gap-3" data-testid="platform-ios">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-2xl">
                <SiIos className="h-12 w-12 text-white" />
              </div>
              <span className="font-semibold">iOS</span>
            </div>
            <div className="flex flex-col items-center gap-3" data-testid="platform-android">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-2xl">
                <SiAndroid className="h-12 w-12 text-white" />
              </div>
              <span className="font-semibold">Android</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* 3 Easy Steps - UPDATE #7 */}
      <section className="py-20 px-6 bg-[#1A1A1A]/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Create in 3 Simple Steps
            </h2>
            <p className="text-xl text-gray-400">
              From idea to final product in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
            <div className="relative" data-testid="step-1">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <Card className="bg-[#1A1A1A] border-white/10 pt-10 text-center">
                <CardContent className="space-y-4">
                  <div className="bg-purple-500/10 p-4 rounded-full w-fit mx-auto">
                    <Sparkles className="h-8 w-8 text-purple-500" />
                  </div>
                  <h3 className="text-xl font-bold">Choose Your Tool</h3>
                  <p className="text-gray-400">
                    Select from video, image, or music generation based on your project needs
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="relative" data-testid="step-2">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <Card className="bg-[#1A1A1A] border-white/10 pt-10 text-center">
                <CardContent className="space-y-4">
                  <div className="bg-purple-500/10 p-4 rounded-full w-fit mx-auto">
                    <Film className="h-8 w-8 text-purple-500" />
                  </div>
                  <h3 className="text-xl font-bold">Describe Your Vision</h3>
                  <p className="text-gray-400">
                    Enter your prompt or upload reference images to guide the AI
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="relative" data-testid="step-3">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <Card className="bg-[#1A1A1A] border-white/10 pt-10 text-center">
                <CardContent className="space-y-4">
                  <div className="bg-purple-500/10 p-4 rounded-full w-fit mx-auto">
                    <Star className="h-8 w-8 text-purple-500" />
                  </div>
                  <h3 className="text-xl font-bold">Download & Share</h3>
                  <p className="text-gray-400">
                    Get your professional-quality content ready to use in minutes
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Videos Section - UPDATE #3 & #4 */}
      {content?.showcaseVideos && content.showcaseVideos.length > 0 && (
        <section id="showcase" className="py-20 px-6">
          <div className="container mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Featured Creations
              </h2>
              <p className="text-xl text-gray-400">
                See what's possible with Artivio AI
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {content.showcaseVideos.map((video, index) => {
                const result = isValidVideoUrl(video.url) 
                  ? normalizeVideoUrl(video.url)
                  : { success: false, error: 'Invalid video URL' };
                const embedUrl = result.success && result.info?.embedUrl 
                  ? result.info.embedUrl.replace('background=1', 'background=0').replace('autoplay=1', 'autoplay=0')
                  : null;

                return (
                  <div 
                    key={index} 
                    className="group bg-[#1A1A1A] rounded-xl border border-white/10 overflow-hidden hover:border-purple-500/50 transition-all"
                    data-testid={`showcase-video-${index}`}
                  >
                    <div className="relative aspect-video bg-black">
                      {embedUrl ? (
                        <iframe
                          src={embedUrl}
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title={video.title || `Showcase ${index + 1}`}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex items-center justify-center">
                          <Play className="h-16 w-16 text-purple-500/40" />
                        </div>
                      )}
                    </div>
                    {(video.title || video.description) && (
                      <div className="p-4">
                        {video.title && (
                          <h3 className="font-semibold mb-2">{video.title}</h3>
                        )}
                        {video.description && (
                          <p className="text-sm text-gray-400">{video.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* All Features Section - UPDATE #8 */}
      <section className="py-20 px-6 bg-[#1A1A1A]/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              All Features
            </h2>
            <p className="text-xl text-gray-400">
              Everything you need in one platform
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {/* Video Generation */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-video-generation">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Video className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Video Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Create stunning videos with Veo 3.1, Runway Aleph, and more AI models
                </p>
                <p className="text-sm text-purple-400">500+ credits</p>
              </CardContent>
            </Card>

            {/* Video Editor */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-video-editor">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Film className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Video Editor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Professional video editing with timeline, effects, and cloud export
                </p>
                <p className="text-sm text-purple-400">New Feature</p>
              </CardContent>
            </Card>

            {/* Image Generation */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-image-generation">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Image className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Image Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Generate images with 4o Image, Flux Kontext, and Nano Banana
                </p>
                <p className="text-sm text-purple-400">100+ credits</p>
              </CardContent>
            </Card>

            {/* Music Generation */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-music-generation">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Music className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Music Generation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Compose original music with Suno V3.5, V4, and V4.5 models
                </p>
                <p className="text-sm text-purple-400">100+ credits</p>
              </CardContent>
            </Card>

            {/* AI Chat */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-ai-chat">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Sparkles className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>AI Chat</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Chat with Deepseek and OpenAI models including GPT-4o and o1
                </p>
                <p className="text-sm text-purple-400">Free</p>
              </CardContent>
            </Card>

            {/* Voice Cloning */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-voice-cloning">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Mic className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Voice Cloning</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Clone voices with ElevenLabs technology for natural speech
                </p>
                <p className="text-sm text-purple-400">100+ credits</p>
              </CardContent>
            </Card>

            {/* Image Analysis */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-image-analysis">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Shield className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Image Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Analyze images with GPT-4o Vision for insights and descriptions
                </p>
                <p className="text-sm text-purple-400">100+ credits</p>
              </CardContent>
            </Card>

            {/* QR Code Generator */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-qr-generator">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Monitor className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>QR Code Generator</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Create custom QR codes with logo embedding and styling
                </p>
                <p className="text-sm text-purple-400">Free</p>
              </CardContent>
            </Card>

            {/* Generation History */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-history">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Zap className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Generation History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  View and manage all your AI-generated content
                </p>
                <p className="text-sm text-purple-400">Free</p>
              </CardContent>
            </Card>

            {/* Lip Sync */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-lip-sync">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Wand2 className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Lip Sync</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Create lip-synced videos with InfiniteTalk technology
                </p>
                <p className="text-sm text-purple-400">15-60 credits</p>
              </CardContent>
            </Card>

            {/* Text-to-Speech */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-tts">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Volume2 className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Text-to-Speech</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Convert text to natural speech with ElevenLabs voices
                </p>
                <p className="text-sm text-purple-400">50+ credits</p>
              </CardContent>
            </Card>

            {/* Sound Effects */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-sound-effects">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Sliders className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Sound Effects</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Generate custom sound effects with ElevenLabs AI
                </p>
                <p className="text-sm text-purple-400">30-100 credits</p>
              </CardContent>
            </Card>

            {/* Speech-to-Text */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-speech-to-text">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <MessageSquare className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Speech-to-Text</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Transcribe audio and video to text instantly
                </p>
                <p className="text-sm text-purple-400">50+ credits</p>
              </CardContent>
            </Card>

            {/* Talking Avatars */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-talking-avatars">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <User className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Talking Avatars</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Create animated avatars that lip-sync to audio
                </p>
                <p className="text-sm text-purple-400">50+ credits</p>
              </CardContent>
            </Card>

            {/* Audio Converter */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-audio-converter">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Shuffle className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Audio Converter</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Convert and optimize audio files between formats
                </p>
                <p className="text-sm text-purple-400">Free</p>
              </CardContent>
            </Card>

            {/* Topaz Image Upscaler */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-topaz-image">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Maximize className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Image Upscaler</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Upscale images 2x, 4x, or 8x with Topaz AI
                </p>
                <p className="text-sm text-purple-400">10-40 credits</p>
              </CardContent>
            </Card>

            {/* Topaz Video Upscaler */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-topaz-video">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Maximize2 className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Video Upscaler</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Upscale videos with professional quality enhancement
                </p>
                <p className="text-sm text-purple-400">72 credits</p>
              </CardContent>
            </Card>

            {/* Sora 2 Pro */}
            <Card className="bg-[#1A1A1A] border-white/10 relative" data-testid="feature-sora2">
              <CardHeader>
                <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 p-3 rounded-lg w-fit mb-3">
                  <Crown className="h-6 w-6 text-yellow-500" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  Sora 2
                  <span className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold px-2 py-0.5 rounded">PREMIUM</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  OpenAI's most advanced video generation with Storyboard mode
                </p>
                <p className="text-sm text-purple-400">500+ credits</p>
              </CardContent>
            </Card>

            {/* Brand Builder Tools */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-brand-builder">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Megaphone className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Brand Builder Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Create professional marketing content with AI-powered workflows
                </p>
                <p className="text-sm text-purple-400">Varies by workflow</p>
              </CardContent>
            </Card>

            {/* Background Remover */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-background-remover">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <Eraser className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Background Remover</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Remove backgrounds from images with AI precision
                </p>
                <p className="text-sm text-purple-400">10+ credits</p>
              </CardContent>
            </Card>

            {/* Story Studio */}
            <Card className="bg-[#1A1A1A] border-white/10" data-testid="feature-story-studio">
              <CardHeader>
                <div className="bg-purple-500/10 p-3 rounded-lg w-fit mb-3">
                  <BookOpen className="h-6 w-6 text-purple-500" />
                </div>
                <CardTitle>Story Studio</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400 mb-3">
                  Create engaging stories with AI-generated visuals and narratives
                </p>
                <p className="text-sm text-purple-400">Coming Soon</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section - UPDATE #4 */}
      <section id="faq" className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-400">
              Everything you need to know
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {/* Additional conversion-focused FAQs */}
            {additionalFaqs.map((faq, index) => (
              <AccordionItem 
                key={`additional-${index}`} 
                value={`additional-faq-${index}`}
                className="bg-[#1A1A1A] border border-white/10 rounded-lg px-6"
                data-testid={`faq-item-additional-${index}`}
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
            {/* Admin-managed FAQs */}
            {content?.faqs?.map((faq, index) => (
              <AccordionItem 
                key={`admin-${index}`} 
                value={`admin-faq-${index}`}
                className="bg-[#1A1A1A] border border-white/10 rounded-lg px-6"
                data-testid={`faq-item-${index}`}
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  <span className="font-semibold">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-gray-400">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
        <div className="container mx-auto relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-5xl md:text-6xl font-bold">
              Ready to create something amazing?
            </h2>
            <p className="text-xl text-gray-400">
              Join thousands of creators using Artivio AI to bring their ideas to life
            </p>
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-12 h-16"
              asChild
              data-testid="button-final-cta"
            >
              <a href="/pricing">
                Get Started Free
                <ChevronRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Demo Video Modal */}
      <Dialog open={demoVideoModalOpen} onOpenChange={setDemoVideoModalOpen}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 bg-black border-white/10">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="text-white">Watch How Artivio Works</DialogTitle>
          </DialogHeader>
          <div className="aspect-video w-full">
            {normalizedDemoVideoUrl ? (
              <iframe
                src={normalizedDemoVideoUrl}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title="Artivio Demo Video"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-blue-900/50">
                <div className="text-center p-8">
                  <Play className="h-16 w-16 text-white/50 mx-auto mb-4" />
                  <p className="text-white/70 text-lg">Demo video coming soon!</p>
                  <p className="text-white/50 text-sm mt-2">Check back later for our full product walkthrough.</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
