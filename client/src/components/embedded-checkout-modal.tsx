import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { fetchWithAuth } from "@/lib/authBridge";

const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

const stripePromise = stripePublicKey 
  ? loadStripe(stripePublicKey)
  : null;

interface EmbeddedCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  checkoutEndpoint: string;
  requestBody?: Record<string, unknown>;
  onComplete?: () => void;
}

export function EmbeddedCheckoutModal({
  open,
  onOpenChange,
  title = "Complete Your Purchase",
  checkoutEndpoint,
  requestBody,
  onComplete,
}: EmbeddedCheckoutModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    try {
      setError(null);
      setErrorCode(null);
      const response = await fetchWithAuth(checkoutEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: requestBody ? JSON.stringify(requestBody) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        // Check for specific error codes
        if (data.code) {
          setErrorCode(data.code);
        }
        throw new Error(data.message || data.error || "Failed to create checkout session");
      }

      return data.clientSecret;
    } catch (err: any) {
      console.error("Error fetching client secret:", err);
      setError(err.message || "Failed to initialize payment");
      throw err;
    }
  }, [checkoutEndpoint, requestBody]);

  // Determine if error is related to subscription requirements
  const isPaidPlanError = errorCode === 'NO_SUBSCRIPTION' || errorCode === 'FREE_TRIAL';

  const handleComplete = useCallback(() => {
    onComplete?.();
    onOpenChange(false);
  }, [onComplete, onOpenChange]);

  if (!stripePromise) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">
              Payment is not configured. Please contact support.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pb-6">
          {error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div className="text-center space-y-2">
                <p className="font-medium text-foreground">
                  {isPaidPlanError ? "Paid Subscription Required" : "Payment Error"}
                </p>
                <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
              </div>
              {isPaidPlanError ? (
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    window.location.href = "/pricing";
                  }}
                  className="gap-2"
                  data-testid="button-view-plans"
                >
                  View Plans
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setError(null)}
                  data-testid="button-retry-payment"
                >
                  Try again
                </Button>
              )}
            </div>
          ) : (
            <div id="checkout" className="min-h-[400px]">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret,
                  onComplete: handleComplete,
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SocialPosterCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
  billingPeriod?: 'monthly' | 'annual';
}

export function SocialPosterCheckoutModal({
  open,
  onOpenChange,
  onComplete,
  billingPeriod = 'monthly',
}: SocialPosterCheckoutModalProps) {
  return (
    <EmbeddedCheckoutModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Add Social Media Poster (${billingPeriod === 'annual' ? 'Annual' : 'Monthly'})`}
      checkoutEndpoint="/api/stripe/social-poster-embedded-checkout"
      requestBody={{ billingPeriod }}
      onComplete={onComplete}
    />
  );
}
