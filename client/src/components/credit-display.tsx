import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export function CreditDisplay() {
  const { user } = useAuth();
  
  const credits = (user as any)?.credits ?? 0;
  
  return (
    <Badge variant="secondary" className="gap-1 px-3 py-1.5" data-testid="badge-credits">
      <Coins className="h-4 w-4" />
      <span className="font-semibold">{credits.toLocaleString()}</span>
      <span className="text-muted-foreground">credits</span>
    </Badge>
  );
}
