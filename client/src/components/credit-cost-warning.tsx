import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, TrendingDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CreditCostWarningProps {
  cost: number;
  featureName: string;
}

export function CreditCostWarning({ cost, featureName }: CreditCostWarningProps) {
  const { user } = useAuth();
  const userCredits = (user as any)?.credits || 0;
  
  // Handle zero-cost models (free features)
  if (cost === 0) {
    return (
      <Alert className="border-green-500/50 bg-green-500/10" data-testid="alert-free-feature">
        <Info className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-sm text-green-700 dark:text-green-400">
          This {featureName} is <strong>free</strong> - no credits will be deducted!
        </AlertDescription>
      </Alert>
    );
  }
  
  const remaining = userCredits - cost;
  const burnRate = userCredits > 0 && cost > 0 ? Math.floor(userCredits / cost) : 0;
  
  // Determine warning level
  const isInsufficient = remaining < 0;
  const isLow = remaining >= 0 && remaining < cost * 2; // Less than 2 more generations
  const isModerate = remaining >= cost * 2 && remaining < cost * 5; // 2-5 generations left
  
  if (isInsufficient) {
    return (
      <Alert variant="destructive" data-testid="alert-insufficient-credits">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="font-semibold">Insufficient Credits</span>
            <p className="text-sm mt-1">
              You need <strong>{cost} credits</strong> but only have <strong>{userCredits}</strong>. Please upgrade your plan or purchase more credits.
            </p>
          </div>
          <Badge variant="destructive" className="font-mono">{userCredits} credits</Badge>
        </AlertDescription>
      </Alert>
    );
  }
  
  if (isLow) {
    return (
      <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10" data-testid="alert-low-credits">
        <TrendingDown className="h-4 w-4 text-orange-500" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="font-semibold text-orange-500">Low Credits Warning</span>
            <p className="text-sm mt-1">
              This {featureName} will use <strong>{cost} credits</strong>. You'll have <strong>{remaining} credits</strong> remaining ({burnRate} more generation{burnRate !== 1 ? 's' : ''} at this rate).
            </p>
          </div>
          <Badge variant="outline" className="font-mono border-orange-500 text-orange-500">{userCredits} → {remaining}</Badge>
        </AlertDescription>
      </Alert>
    );
  }
  
  if (isModerate) {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/10" data-testid="alert-moderate-credits">
        <Info className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            This {featureName} will use <strong>{cost} credits</strong>. You'll have <strong>{remaining} credits</strong> remaining (~{burnRate} more generations).
          </div>
          <Badge variant="outline" className="font-mono border-yellow-600 text-yellow-600">{userCredits} → {remaining}</Badge>
        </AlertDescription>
      </Alert>
    );
  }
  
  // Normal - plenty of credits
  return (
    <Alert className="border-primary/30 bg-primary/5" data-testid="alert-credit-info">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          Credit cost: <strong>{cost} credits</strong> • Remaining after: <strong>{remaining} credits</strong>
        </div>
        <Badge variant="outline" className="font-mono">{userCredits} → {remaining}</Badge>
      </AlertDescription>
    </Alert>
  );
}
