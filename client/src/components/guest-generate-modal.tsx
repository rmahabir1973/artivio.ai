import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Gift, CheckCircle } from "lucide-react";

interface GuestGenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
}

export function GuestGenerateModal({ 
  open, 
  onOpenChange, 
  featureName = "AI content" 
}: GuestGenerateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Ready to Create {featureName}?
          </DialogTitle>
          <DialogDescription className="text-center">
            Sign up for free to start generating amazing AI content!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center gap-3 mb-3">
              <Gift className="h-5 w-5 text-primary" />
              <span className="font-semibold">Free Trial Includes:</span>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>1,000 free credits to start</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Access to all AI models</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Generate videos, images & music</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>No credit card required</span>
              </li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-3">
            <Link href="/register">
              <Button className="w-full gap-2" size="lg" data-testid="button-signup-modal">
                <Zap className="h-4 w-4" />
                Sign Up Free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full" size="lg" data-testid="button-login-modal">
                Already have an account? Log In
              </Button>
            </Link>
          </div>
          
          <p className="text-xs text-center text-muted-foreground">
            Join 10,000+ creators using Artivio AI
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useGuestCheck() {
  const checkGuestAndPrompt = (
    isAuthenticated: boolean,
    setShowModal: (show: boolean) => void
  ): boolean => {
    if (!isAuthenticated) {
      setShowModal(true);
      return false;
    }
    return true;
  };

  return { checkGuestAndPrompt };
}
