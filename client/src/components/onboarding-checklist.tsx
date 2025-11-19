import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Check, 
  X, 
  Sparkles, 
  BookTemplate, 
  Rocket,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";

type OnboardingProgress = {
  id: string;
  userId: string;
  exploredWorkflows: boolean;
  triedTemplate: boolean;
  completedFirstGeneration: boolean;
  dismissed: boolean;
  createdAt: string;
  updatedAt: string;
};

const ONBOARDING_STEPS = [
  {
    id: 'exploredWorkflows',
    title: 'Explore Workflows',
    description: 'Browse our 20+ pre-built AI workflow templates',
    icon: Sparkles,
    link: '/workflows',
    dataTestId: 'onboarding-step-workflows'
  },
  {
    id: 'triedTemplate',
    title: 'Try a Template',
    description: 'Use a saved template to quickly generate content',
    icon: BookTemplate,
    link: '/generate/video',
    dataTestId: 'onboarding-step-template'
  },
  {
    id: 'completedFirstGeneration',
    title: 'Generate Content',
    description: 'Create your first AI-powered video, image, or music',
    icon: Rocket,
    link: '/generate/video',
    dataTestId: 'onboarding-step-generation'
  },
] as const;

export function OnboardingChecklist() {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);

  const { data: progress, isLoading, isError, error } = useQuery<OnboardingProgress>({
    queryKey: ['/api/onboarding'],
    retry: 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<OnboardingProgress>) => {
      const response = await apiRequest('PATCH', '/api/onboarding', updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update onboarding progress",
        variant: "destructive",
      });
      console.error('Onboarding update error:', error);
    },
  });

  // Show loading state
  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle>Loading your progress...</CardTitle>
          </div>
        </CardHeader>
      </Card>
    );
  }

  // Show error state (but don't block the user)
  if (isError) {
    console.error('Onboarding fetch error:', error);
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-destructive" />
              <CardTitle>Welcome to Artivio AI!</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/onboarding'] })}
              data-testid="button-onboarding-retry"
              className="h-8 gap-2"
            >
              Retry
            </Button>
          </div>
          <CardDescription>
            Couldn't load your onboarding progress. Click retry or continue exploring.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Should never happen, but defensive check
  if (!progress) {
    return null;
  }

  // Don't show if dismissed
  if (progress.dismissed) {
    return null;
  }

  const completedSteps = ONBOARDING_STEPS.filter(
    step => progress[step.id as keyof OnboardingProgress]
  ).length;

  const allComplete = completedSteps === ONBOARDING_STEPS.length;
  const progressPercent = (completedSteps / ONBOARDING_STEPS.length) * 100;

  const handleDismiss = () => {
    updateMutation.mutate({ dismissed: true });
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Welcome to Artivio AI!</CardTitle>
              {allComplete && (
                <Badge variant="default" className="ml-2">
                  <Check className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              {allComplete 
                ? "You've completed the quickstart! Keep creating amazing content."
                : `Get started by completing these steps (${completedSteps}/${ONBOARDING_STEPS.length})`
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {!allComplete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                data-testid="button-onboarding-toggle"
                className="h-8 w-8 p-0"
              >
                <ChevronRight 
                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              data-testid="button-onboarding-dismiss"
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your Progress</span>
              <span className="font-medium">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" data-testid="progress-onboarding" />
          </div>

          {/* Steps */}
          <div className="grid gap-3">
            {ONBOARDING_STEPS.map((step) => {
              const isComplete = progress[step.id as keyof OnboardingProgress];
              const StepIcon = step.icon;

              return (
                <Link 
                  key={step.id} 
                  href={step.link}
                  data-testid={step.dataTestId}
                >
                  <div
                    className={`
                      flex items-start gap-3 p-3 rounded-lg border transition-all
                      ${isComplete 
                        ? 'bg-primary/5 border-primary/20' 
                        : 'hover-elevate active-elevate-2 border-border cursor-pointer'
                      }
                    `}
                  >
                    <div className={`
                      flex items-center justify-center h-10 w-10 rounded-full flex-shrink-0
                      ${isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                    `}>
                      {isComplete ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium">{step.title}</h4>
                        {isComplete && (
                          <Badge variant="outline" className="bg-primary/10 border-primary/20">
                            Done
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {step.description}
                      </p>
                    </div>
                    {!isComplete && (
                      <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {allComplete && (
            <div className="pt-2 border-t">
              <p className="text-sm text-center text-muted-foreground">
                🎉 Great job! You're all set. Feel free to dismiss this card.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
