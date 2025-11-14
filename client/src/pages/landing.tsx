import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Image, Music, Zap, Shield, Sparkles } from "lucide-react";

export default function Landing() {
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
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Access the Best Video, Image & Music Models in{" "}
            <span className="text-primary">One API</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            All your AI APIs for video, image, music, and chat — lower cost, fast, and developer-friendly. 
            Create stunning AI content with powerful models like Veo 3.1, Runway Aleph, Flux Kontext, and Suno.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login">
                <Zap className="mr-2 h-5 w-5" />
                Get Started Free
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-12">
            <div>
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24.7s</div>
              <div className="text-sm text-muted-foreground">Response Time</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-sm text-muted-foreground">Support</div>
            </div>
            <div>
              <div className="text-3xl font-bold">#1</div>
              <div className="text-sm text-muted-foreground">Data Security</div>
            </div>
          </div>
        </div>
      </section>

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
            <a href="/api/login">
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
