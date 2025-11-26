import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Video, Image, Music, Zap, Shield, Sparkles, Loader2, ChevronRight, Play, Palette, Mic, Film,
  Award, DollarSign, Droplet, Monitor, Smartphone, Tablet, Check, Star, Laptop,
  Wand2, Volume2, Sliders, MessageSquare, User, Shuffle, Maximize, Maximize2
} from "lucide-react";
import { SiApple, SiAndroid, SiIos } from "react-icons/si";
import type { HomePageContent, SubscriptionPlan } from "@shared/schema";
import { normalizeVimeoUrl } from "@/lib/vimeo";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/authBridge";

// Pricing Section Component
function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual" | "trial">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: plansData, isLoading, error } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/plans'],
  });

  const plans = plansData?.map(plan => ({
    ...plan,
    popular: plan.name === 'starter',
  })) || [];

  const handleSelectPlan = async (plan: SubscriptionPlan & { popular?: boolean }) => {
    setSelectedPlan(plan.name);
    setIsSubmitting(true);

    try {
      if (!user) {
        // Redirect unauthenticated users to register with plan selection
        if (plan.price === 0) {
          const response = await fetch('/api/public/plan-selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ planName: plan.name }),
          });
          if (response.ok) {
            window.location.href = '/register';
          }
        } else {
          window.location.href = '/login';
        }
      } else {
        // Authenticated users go to checkout
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

  const isTrial = (plan: SubscriptionPlan) => plan.billingPeriod === 'trial';

  return (
    <section id="pricing" className="py-20 px-6">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold px-4 py-2 rounded-full mb-4">
            SIMPLE, TRANSPARENT PRICING
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Plans Built for Every Creator
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Choose the perfect plan to unlock unlimited AI-powered content creation. Start free, upgrade anytime.
          </p>
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
        ) : (
          <>
            {/* Billing Period Toggle */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex items-center gap-2 p-1 bg-[#1A1A1A]/50 border border-white/10 rounded-lg">
                <button
                  onClick={() => setBillingPeriod("monthly")}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    billingPeriod === "monthly"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                  data-testid="button-pricing-monthly"
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod("annual")}
                  className={`px-6 py-2 rounded-md font-medium transition-all ${
                    billingPeriod === "annual"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                  data-testid="button-pricing-annual"
                >
                  Annual
                </button>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans
                .filter(p => p.billingPeriod === billingPeriod)
                .map((plan) => {
                  const features = Array.isArray(plan.features) ? plan.features : [];
                  return (
                    <Card 
                      key={plan.id}
                      className={`relative hover-elevate transition-all flex flex-col border ${
                        plan.popular 
                          ? 'border-purple-500/50 bg-gradient-to-br from-purple-900/20 to-blue-900/20 md:scale-105 shadow-xl' 
                          : 'border-white/10 bg-[#1A1A1A]'
                      } ${
                        selectedPlan === plan.name ? 'ring-2 ring-purple-500' : ''
                      }`}
                      data-testid={`pricing-card-${plan.name}`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                          <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Most Popular
                          </span>
                        </div>
                      )}
                      
                      <CardHeader className="text-center pt-8 pb-4">
                        <CardTitle className="text-2xl mb-2">{plan.displayName}</CardTitle>
                        {plan.description && (
                          <CardDescription className="text-sm text-gray-400">
                            {plan.description}
                          </CardDescription>
                        )}
                        
                        <div className="mt-6 flex flex-col items-center gap-2">
                          {plan.price === 0 ? (
                            <div className="text-4xl font-bold text-purple-400">
                              FREE
                            </div>
                          ) : (
                            <>
                              <div className="text-5xl font-bold text-purple-400">
                                ${getPriceDisplay(plan.price)}
                              </div>
                              <p className="text-gray-400 text-sm">
                                {isTrial(plan) ? 'one-time' : billingPeriod === 'annual' ? '/year' : '/month'}
                              </p>
                            </>
                          )}
                          <p className="text-sm text-gray-400 mt-2">
                            <span className="text-lg font-semibold text-purple-400">{plan.creditsPerMonth.toLocaleString()}</span>
                            {' '}credits {isTrial(plan) ? '(one-time)' : 'per month'}
                          </p>
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1">
                        <ul className="space-y-3">
                          {features.map((feature: string, index: number) => (
                            <li key={index} className="flex items-start gap-2">
                              <Check className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-300">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>

                      <CardFooter className="pt-4">
                        <Button
                          onClick={() => handleSelectPlan(plan)}
                          disabled={isSubmitting}
                          className={`w-full ${
                            plan.popular
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                              : ''
                          }`}
                          variant={plan.popular ? "default" : "outline"}
                          size="lg"
                          data-testid={`button-pricing-select-${plan.name}`}
                        >
                          {isSubmitting && selectedPlan === plan.name ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              {plan.price === 0 ? "Starting..." : "Processing..."}
                            </>
                          ) : (
                            plan.price === 0 ? "Start Free" : "Get Started"
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
            </div>

            {/* Features Info */}
            <div className="mt-16 max-w-4xl mx-auto text-center">
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
  
  const { data: content, isLoading } = useQuery<HomePageContent>({
    queryKey: ["/api/homepage"],
  });

  // Normalize Vimeo URL outside of render to avoid hook violations
  const normalizedVideoUrl = useMemo(() => {
    if (content?.heroVideoUrl && content.heroVideoUrl.includes('vimeo.com') && !videoLoadFailed) {
      const result = normalizeVimeoUrl(content.heroVideoUrl);
      if (result.success && result.url) {
        return result.url;
      } else {
        console.error('Vimeo URL normalization failed:', result.error);
      }
    }
    return null;
  }, [content?.heroVideoUrl, videoLoadFailed]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0F0F0F]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white">
      {/* Fixed Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0F0F0F]/80 backdrop-blur-lg border-b border-white/10">
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
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        {/* Background Video or Gradient */}
        {normalizedVideoUrl ? (
          <>
            <div className="absolute inset-0 z-0">
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
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-black/60 z-[1]" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20 z-0" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-3xl z-0" />
          </>
        )}
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold leading-tight drop-shadow-2xl">
              The platform built for{" "}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                creators
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 max-w-2xl mx-auto drop-shadow-lg">
              Transform your ideas into reality with AI-powered video, image, and music generation. 
              Professional quality content in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 h-14 shadow-2xl"
                asChild
                data-testid="button-hero-get-started"
              >
                <a href="/dashboard">
                  Get Started Free
                  <ChevronRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/30 bg-black/30 backdrop-blur-sm hover:bg-white/10 text-lg px-8 h-14 shadow-2xl"
                asChild
                data-testid="button-hero-see-action"
              >
                <a href="#features">
                  <Play className="mr-2 h-5 w-5" />
                  See It In Action
                </a>
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
              <p className="text-gray-400 mb-6 leading-relaxed">
                Generate professional videos with Veo 3.1, Runway, and more. 
                From concept to completion in minutes.
              </p>
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

      {/* Alternating Content Sections - UPDATE #1: Changed to aspect-video (16:9) */}
      <section id="products" className="py-20 px-6">
        <div className="container mx-auto space-y-32">
          {/* Section 1: Image Left */}
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-3xl blur-2xl" />
              <div className="relative aspect-video bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
                {content?.featureVideoUrl ? (
                  <iframe
                    src={content.featureVideoUrl}
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
                {content?.featureImageUrl ? (
                  <iframe
                    src={content.featureImageUrl}
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
                {content?.featureMusicUrl ? (
                  <iframe
                    src={content.featureMusicUrl}
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
                const normalizedUrl = video.url.includes('vimeo.com') 
                  ? normalizeVimeoUrl(video.url)
                  : { success: false, url: '', error: 'Not a Vimeo URL' };

                return (
                  <div 
                    key={index} 
                    className="group bg-[#1A1A1A] rounded-xl border border-white/10 overflow-hidden hover:border-purple-500/50 transition-all"
                    data-testid={`showcase-video-${index}`}
                  >
                    <div className="relative aspect-video bg-black">
                      {normalizedUrl.success ? (
                        <iframe
                          src={normalizedUrl.url?.replace('background=1', 'background=0')}
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
                  Combine and edit AI-generated videos with transitions
                </p>
                <p className="text-sm text-purple-400">Free</p>
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
          </div>
        </div>
      </section>

      {/* FAQ Section - UPDATE #4 */}
      {content?.faqs && content.faqs.length > 0 && (
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
              {content.faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`faq-${index}`}
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
      )}

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
              <a href="/dashboard">
                Get Started Free
                <ChevronRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-16 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Company */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-2 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">Artivio AI</span>
              </div>
              <p className="text-gray-400 text-sm">
                The creative platform built for the future
              </p>
            </div>

            {/* Products */}
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-features">Features</a></li>
                <li><a href="/pricing" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-pricing">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-api-docs">API Docs</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-changelog">Changelog</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-about">About</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-blog">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-careers">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-press">Press</a></li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-help">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-contact">Contact</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-privacy">Privacy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-terms">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              © 2024 Artivio AI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="social-twitter" aria-label="Twitter">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/></svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="social-github" aria-label="GitHub">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="social-linkedin" aria-label="LinkedIn">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
