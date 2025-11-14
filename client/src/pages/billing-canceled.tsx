import { useLocation } from "wouter";
import { XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingCanceledPage() {
  const [, navigate] = useLocation();

  return (
    <div className="container mx-auto py-16 px-4 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <XCircle className="w-16 h-16 text-muted-foreground" data-testid="icon-canceled" />
          </div>
          <CardTitle className="text-2xl">Subscription Canceled</CardTitle>
          <CardDescription>
            Your subscription checkout was canceled.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            No charges were made to your account. You can try again whenever you're ready.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate('/billing')} data-testid="button-try-again">
              Try Again
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" data-testid="button-go-home">
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
