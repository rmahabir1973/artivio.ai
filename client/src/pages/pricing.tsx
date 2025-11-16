import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Footer } from "@/components/footer";

interface Plan {
  name: string;
  displayName: string;
  description: string;
  price: number;
  creditsPerMonth: number;
  features: string[];
  popular?: boolean;
}

const plans: Plan[] = [
  {
    name: "free",
    displayName: "Free",
    description: "Get started with basic features",
    price: 0,
    creditsPerMonth: 1000,
    features: [
      "1,000 credits per month",
      "Basic video generation",
      "Basic image generation",
      "Community support"
    ]
  },
  {
    name: "starter",
    displayName: "Starter",
    description: "Perfect for individuals and small projects",
    price: 1999,
    creditsPerMonth: 5000,
    features: [
      "5,000 credits per month",
      "All AI models access",
      "Priority generation queue",
      "Email support",
      "Up to 2,500 credit rollover"
    ],
    popular: true
  },
  {
    name: "pro",
    displayName: "Pro",
    description: "For professionals and growing teams",
    price: 4999,
    creditsPerMonth: 15000,
    features: [
      "15,000 credits per month",
      "All AI models access",
      "Highest priority queue",
      "Priority email & chat support",
      "Up to 7,500 credit rollover",
      "Early access to new features"
    ]
  }
];

export default function Pricing() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSelectPlan = async (planName: string) => {
    setSelectedPlan(planName);
    setIsSubmitting(true);

    try {
      // Store plan selection in backend
      const response = await fetch('/api/public/plan-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // CRITICAL: Include cookies for signed cookie to work
        body: JSON.stringify({ planName }),
      });

      if (!response.ok) {
        throw new Error('Failed to store plan selection');
      }

      // Redirect to authentication
      window.location.href = '/api/login';
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast({
        title: "Error",
        description: "Failed to select plan. Please try again.",
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

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`relative hover-elevate ${
                plan.popular ? 'border-primary shadow-lg' : ''
              } ${
                selectedPlan === plan.name ? 'ring-2 ring-primary' : ''
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
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">
                    ${(plan.price / 100).toFixed(0)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {plan.creditsPerMonth.toLocaleString()} credits included
                </p>
              </CardHeader>

              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={isSubmitting}
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  size="lg"
                  data-testid={`button-select-${plan.name}`}
                >
                  {isSubmitting && selectedPlan === plan.name
                    ? "Selecting..."
                    : plan.price === 0
                    ? "Start Free"
                    : "Get Started"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>All plans include access to our AI models. Cancel anytime.</p>
          <p className="mt-2">By continuing, you agree to our Terms of Service and Privacy Policy.</p>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
