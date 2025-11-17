import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Video, Image, Music, Zap, Shield, Sparkles, Loader2, ChevronRight, Play, Palette, Mic, Film } from "lucide-react";
import type { HomePageContent } from "@shared/schema";

export default function Landing() {
  const { data: content, isLoading } = useQuery<HomePageContent>({
    queryKey: ["/api/homepage"],
  });

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

            {/* Center Navigation - Desktop */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8 flex-1 justify-center flex-wrap">
              <a href="#products" className="text-gray-300 hover:text-white transition-colors text-sm font-medium whitespace-nowrap" data-testid="nav-products">
                Products
              </a>
              <a href="/pricing" className="text-gray-300 hover:text-white transition-colors text-sm font-medium whitespace-nowrap" data-testid="nav-pricing">
                Pricing
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm font-medium whitespace-nowrap" data-testid="nav-blog">
                Blog
              </a>
              <a href="/api/login" className="text-gray-300 hover:text-white transition-colors text-sm font-medium whitespace-nowrap" data-testid="nav-login">
                Log In
              </a>
              <a 
                href="/pricing" 
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium whitespace-nowrap"
                data-testid="nav-signup"
              >
                Sign Up
              </a>
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-gray-300 hover:text-white flex-shrink-0"
              onClick={() => {
                const menu = document.getElementById('mobile-menu');
                if (menu) {
                  menu.classList.toggle('hidden');
                }
              }}
              data-testid="button-mobile-menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Spacer for alignment - matches logo width */}
            <div className="hidden md:block flex-shrink-0" style={{ width: '140px' }} />
          </div>

          {/* Mobile Menu */}
          <div id="mobile-menu" className="hidden md:hidden py-4 border-t border-white/10">
            <nav className="flex flex-col gap-4">
              <a href="#products" className="text-gray-300 hover:text-white transition-colors text-sm font-medium" data-testid="mobile-nav-products">
                Products
              </a>
              <a href="/pricing" className="text-gray-300 hover:text-white transition-colors text-sm font-medium" data-testid="mobile-nav-pricing">
                Pricing
              </a>
              <a href="#" className="text-gray-300 hover:text-white transition-colors text-sm font-medium" data-testid="mobile-nav-blog">
                Blog
              </a>
              <a href="/api/login" className="text-gray-300 hover:text-white transition-colors text-sm font-medium" data-testid="mobile-nav-login">
                Log In
              </a>
              <a href="/pricing" className="text-gray-300 hover:text-white transition-colors text-sm font-medium" data-testid="mobile-nav-signup">
                Sign Up
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-blue-900/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-6xl md:text-7xl font-bold leading-tight">
              The platform built for{" "}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                creators
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Transform your ideas into reality with AI-powered video, image, and music generation. 
              Professional quality content in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-lg px-8 h-14"
                asChild
                data-testid="button-hero-get-started"
              >
                <a href="/pricing">
                  Get Started Free
                  <ChevronRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/20 hover:bg-white/5 text-lg px-8 h-14"
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

          {/* Hero Visual */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              {content?.heroVideoUrl ? (
                <div className="aspect-video bg-[#1A1A1A]">
                  <iframe
                    src={content.heroVideoUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Hero Video"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                  <Sparkles className="h-32 w-32 text-purple-500/40" />
                </div>
              )}
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
            {/* Feature Card 1 */}
            <div className="group bg-[#1A1A1A] rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-1">
              <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-xl w-fit mb-6">
                <Video className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">AI Video</h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Generate professional videos with Veo 3.1, Runway, and more. 
                From concept to completion in minutes.
              </p>
              <a href="#" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-2 group" data-testid="link-feature-video">
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
              <a href="#" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-2 group" data-testid="link-feature-image">
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
              <a href="#" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-2 group" data-testid="link-feature-music">
                Learn More
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Alternating Content Sections */}
      <section id="products" className="py-20 px-6">
        <div className="container mx-auto space-y-32">
          {/* Section 1: Image Left */}
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-3xl blur-2xl" />
              <div className="relative aspect-square bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
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
                <a href="/pricing">Start Creating</a>
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
                <a href="/pricing">Get Started</a>
              </Button>
            </div>
            <div className="relative md:order-2">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-2xl" />
              <div className="relative aspect-square bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
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
              <div className="relative aspect-square bg-[#1A1A1A] rounded-2xl border border-white/10 overflow-hidden">
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
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors" data-testid="footer-features">Features</a></li>
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
