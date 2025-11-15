import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Video, Image, Music, Zap, Shield, Sparkles, Loader2 } from "lucide-react";
import type { HomePageContent } from "@shared/schema";

export default function Landing() {
  const { data: content, isLoading } = useQuery<HomePageContent>({
    queryKey: ["/api/homepage"],
  });

  const heroTitle = content?.heroTitle || "Create any video you can imagine";
  const heroSubtitle = content?.heroSubtitle || "Generate stunning videos, images, and music with powerful AI models";
  const showcaseVideos = content?.showcaseVideos || [];
  const creatorsTitle = content?.creatorsTitle || "Creators";
  const creatorsDescription = content?.creatorsDescription || null;
  const creatorsImageUrl = content?.creatorsImageUrl || null;
  const businessTitle = content?.businessTitle || "Businesses";
  const businessDescription = content?.businessDescription || null;
  const businessImageUrl = content?.businessImageUrl || null;
  const faqs = content?.faqs || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Artivio AI</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
                {heroTitle}
              </h1>
              <p className="text-xl text-muted-foreground">
                {heroSubtitle}
              </p>
              <div className="flex gap-4">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/pricing">
                    <Zap className="mr-2 h-5 w-5" />
                    Get Started Free
                  </a>
                </Button>
              </div>
            </div>
            <div className="relative">
              {content?.heroVideoUrl ? (
                <div className="relative rounded-xl overflow-hidden shadow-2xl aspect-video">
                  <iframe
                    src={content.heroVideoUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title="Hero Video"
                  />
                </div>
              ) : content?.heroImageUrl ? (
                <div className="relative rounded-xl overflow-hidden shadow-2xl aspect-video">
                  <img
                    src={content.heroImageUrl}
                    alt="Hero"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden shadow-2xl aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Sparkles className="h-24 w-24 text-primary/40" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Showcase Videos */}
      {showcaseVideos.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">See What's Possible</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {showcaseVideos.map((video, index) => (
                <Card key={index} className="hover-elevate overflow-hidden">
                  <div className="aspect-video">
                    <iframe
                      src={video.url}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture"
                      allowFullScreen
                      title={video.title || `Showcase Video ${index + 1}`}
                    />
                  </div>
                  {(video.title || video.description) && (
                    <CardContent className="p-4">
                      {video.title && (
                        <h3 className="font-semibold mb-1">{video.title}</h3>
                      )}
                      {video.description && (
                        <p className="text-sm text-muted-foreground">{video.description}</p>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">AI APIs for Any Project</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card className="hover-elevate">
            <CardHeader>
              <Video className="h-12 w-12 text-primary mb-4" />
              <CardTitle>AI Video Generation</CardTitle>
              <CardDescription>
                Create high-quality videos with Veo 3.1, Veo 3.1 Fast, and Runway Aleph. 
                Synchronized audio, smooth motion, and realistic scenes.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Image className="h-12 w-12 text-primary mb-4" />
              <CardTitle>AI Image Generation</CardTitle>
              <CardDescription>
                Produce high-quality, style-rich images with 4o Image API, Flux Kontext API, 
                and Nano Banana API. Photorealistic renders to consistent characters.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <Music className="h-12 w-12 text-primary mb-4" />
              <CardTitle>AI Music Generation</CardTitle>
              <CardDescription>
                Create high-quality music with Suno API, supporting V3.5, V4, V4.5 models. 
                Enhanced vocals, richer sound, tracks up to 8 minutes long.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Creators & Business Sections */}
      {(creatorsDescription || businessDescription) && (
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12">
            {creatorsDescription && (
              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="text-2xl">{creatorsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {creatorsImageUrl && (
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <img
                        src={creatorsImageUrl}
                        alt={creatorsTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <p className="text-muted-foreground">{creatorsDescription}</p>
                </CardContent>
              </Card>
            )}

            {businessDescription && (
              <Card className="hover-elevate">
                <CardHeader>
                  <CardTitle className="text-2xl">{businessTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {businessImageUrl && (
                    <div className="aspect-video rounded-lg overflow-hidden">
                      <img
                        src={businessImageUrl}
                        alt={businessTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <p className="text-muted-foreground">{businessDescription}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Why Choose Section */}
      <section className="container mx-auto px-4 py-16 bg-muted/30 rounded-2xl my-16">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose Artivio AI</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="space-y-3">
            <Shield className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-semibold">Affordable Pricing</h3>
            <p className="text-muted-foreground">
              Flexible credit-based system. Pay only for what you use, making it cost-effective 
              for startups, agencies, and enterprise projects.
            </p>
          </div>
          <div className="space-y-3">
            <Zap className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-semibold">Fast & Scalable</h3>
            <p className="text-muted-foreground">
              Experience 99.9% uptime, low latency responses, and high concurrency handling. 
              Stable, reliable results every time.
            </p>
          </div>
          <div className="space-y-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-semibold">Simple Integration</h3>
            <p className="text-muted-foreground">
              Easy to use interface with clear documentation. Generate videos, images, 
              or music in just minutes.
            </p>
          </div>
          <div className="space-y-3">
            <Shield className="h-8 w-8 text-primary" />
            <h3 className="text-xl font-semibold">Robust Security</h3>
            <p className="text-muted-foreground">
              We prioritize data security with encryption technology. Your information 
              is safe and protected.
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left hover:no-underline">
                    <span className="font-semibold">{faq.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h2 className="text-4xl font-bold">
            Start Building with the World's Top AI Models Today
          </h2>
          <p className="text-xl text-muted-foreground">
            Access video, image, and music APIs in one platform — faster, more affordable, 
            and user-friendly.
          </p>
          <Button size="lg" asChild data-testid="button-cta-signup">
            <a href="/pricing">
              Get Your Free Account
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Artivio AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
