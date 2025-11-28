import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Mail, 
  CheckCircle, 
  Loader2, 
  Video, 
  Image as ImageIcon, 
  Music, 
  Sparkles,
  Zap,
  Gift,
  ArrowRight
} from "lucide-react";

export default function Newsletter() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const newsletterMutation = useMutation({
    mutationFn: async ({ email, firstName }: { email: string; firstName?: string }) => {
      const response = await apiRequest("POST", "/api/public/newsletter-signup", { email, firstName });
      return await response.json();
    },
    onSuccess: () => {
      setSubscribed(true);
      setEmail("");
      setFirstName("");
      toast({
        title: "Welcome to the community!",
        description: "Check your inbox for your first AI tips email.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      newsletterMutation.mutate({ email, firstName: firstName || undefined });
    }
  };

  const benefits = [
    {
      icon: Video,
      title: "AI Video Tips",
      description: "Learn to create stunning videos with Veo 3.1, Sora 2 Pro, and more"
    },
    {
      icon: ImageIcon,
      title: "Image Generation Secrets",
      description: "Master prompts for 4o Image, Flux Kontext, and Nano Banana"
    },
    {
      icon: Music,
      title: "AI Music Tutorials",
      description: "Create original music with Suno V4.5 and V5 models"
    },
    {
      icon: Gift,
      title: "Exclusive Offers",
      description: "Get early access to new features and special discounts"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-1">
            <Mail className="h-3 w-3 mr-2" />
            Join 10,000+ Creators
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Get Weekly AI Creation Tips
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join our newsletter and receive exclusive tutorials, tips, and offers for AI video, image, and music generation every week.
          </p>
        </div>

        <Card className="mb-12 border-primary/20 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 p-8">
            {subscribed ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2">You're In!</h2>
                <p className="text-muted-foreground mb-6">
                  Check your inbox for a welcome email. Your 7-day AI creation journey starts now!
                </p>
                <Link href="/dashboard">
                  <Button size="lg" className="gap-2" data-testid="button-go-to-dashboard">
                    Start Creating
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="First name (optional)"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-background"
                    data-testid="input-newsletter-firstname"
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background"
                    data-testid="input-newsletter-email"
                  />
                </div>
                <Button 
                  type="submit" 
                  size="lg"
                  className="w-full gap-2"
                  disabled={newsletterMutation.isPending}
                  data-testid="button-newsletter-subscribe"
                >
                  {newsletterMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Subscribe to Newsletter
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  No spam, ever. Unsubscribe anytime with one click.
                </p>
              </form>
            )}
          </div>
        </Card>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">What You'll Get</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover-elevate">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <benefit.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{benefit.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <Badge variant="secondary">7-Day Welcome Series</Badge>
            </div>
            <CardTitle>Start Your AI Creation Journey</CardTitle>
            <CardDescription>
              New subscribers receive a 7-day email series covering everything from basic prompts to advanced techniques
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div key={day} className="text-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1">
                    <span className="text-xs font-bold text-primary">{day}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Day {day}</span>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                From welcome to mastery in just one week. Each email includes actionable tips and real examples.
              </p>
              <Link href="/pricing">
                <Button variant="outline" className="gap-2" data-testid="button-view-pricing">
                  <Zap className="h-4 w-4" />
                  See Our Plans
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-12">
          <Link href="/">
            <Button variant="ghost" className="text-muted-foreground" data-testid="button-back-home">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
