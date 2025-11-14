import { useEffect } from "react";
import { useLocation } from "wouter";
import { CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";

export default function BillingSuccessPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/current'] });
  }, []);

  return (
    <div className="container mx-auto py-16 px-4 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-green-500" data-testid="icon-success" />
          </div>
          <CardTitle className="text-2xl">Subscription Successful!</CardTitle>
          <CardDescription>
            Thank you for subscribing. Your account has been upgraded.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your credits have been added and you now have access to all features.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/billing')} variant="outline" data-testid="button-view-billing">
              View Billing
            </Button>
            <Button onClick={() => navigate('/')} data-testid="button-get-started">
              Get Started
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
