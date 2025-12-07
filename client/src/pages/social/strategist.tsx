import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  Loader2, 
  Wand2, 
  Target,
  TrendingUp,
  Calendar,
  CalendarIcon,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Users,
  ShoppingBag,
  Lightbulb,
} from "lucide-react";
import { format, addDays, startOfDay, isBefore } from "date-fns";
import { 
  SiInstagram, 
  SiTiktok, 
  SiLinkedin, 
  SiYoutube, 
  SiFacebook, 
  SiX,
  SiThreads,
  SiPinterest,
  SiBluesky,
} from "react-icons/si";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { fetchWithAuth } from "@/lib/authBridge";
import { SocialUpgradePrompt } from "@/components/social-upgrade-prompt";

const PLATFORMS = [
  { id: "instagram", name: "Instagram", icon: SiInstagram },
  { id: "tiktok", name: "TikTok", icon: SiTiktok },
  { id: "linkedin", name: "LinkedIn", icon: SiLinkedin },
  { id: "youtube", name: "YouTube", icon: SiYoutube },
  { id: "facebook", name: "Facebook", icon: SiFacebook },
  { id: "x", name: "X", icon: SiX },
  { id: "threads", name: "Threads", icon: SiThreads },
  { id: "pinterest", name: "Pinterest", icon: SiPinterest },
  { id: "bluesky", name: "Bluesky", icon: SiBluesky },
];

const GOALS = [
  { id: "traffic", label: "Drive Website Traffic", icon: TrendingUp, description: "Increase clicks to your website" },
  { id: "engagement", label: "Boost Engagement", icon: MessageSquare, description: "Get more likes, comments, and shares" },
  { id: "followers", label: "Grow Followers", icon: Users, description: "Expand your audience reach" },
  { id: "sales", label: "Generate Sales", icon: ShoppingBag, description: "Convert followers to customers" },
  { id: "awareness", label: "Brand Awareness", icon: Lightbulb, description: "Increase brand visibility" },
];

const DURATIONS = [
  { value: "1week", label: "1 Week" },
  { value: "2weeks", label: "2 Weeks" },
  { value: "1month", label: "1 Month" },
  { value: "3months", label: "3 Months" },
];

const POSTING_INTENSITIES = [
  { 
    value: "conservative", 
    label: "Conservative", 
    description: "1 post per platform every 2-3 days. Best for established brands.",
    postsPerDay: "~2-3 posts total per day"
  },
  { 
    value: "moderate", 
    label: "Moderate", 
    description: "1 post per platform per day. Balanced approach.",
    postsPerDay: "~5-7 posts total per day"
  },
  { 
    value: "aggressive", 
    label: "Aggressive", 
    description: "Maximum safe posts per platform. Best for new brands building presence.",
    postsPerDay: "~10-15+ posts total per day"
  },
];

interface PostGoal {
  id: number;
  goal: string;
  platforms: string[];
  duration: string;
  businessDescription: string;
  targetAudience: string;
  aiGeneratedPlan?: any;
  status: string;
  createdAt: string;
}

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

export default function SocialStrategist() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [duration, setDuration] = useState("1week");
  const [postingIntensity, setPostingIntensity] = useState("moderate");
  const [startDate, setStartDate] = useState<Date>(new Date()); // Default: today
  const [businessDescription, setBusinessDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  const { data: subscriptionStatus, isLoading: statusLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/social/subscription-status"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/subscription-status");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.requiresSubscription) {
          return { hasSocialPoster: false };
        }
        throw new Error("Failed to fetch subscription status");
      }
      return response.json();
    },
    enabled: !!user,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: connectedAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/social/accounts"],
    enabled: !!user && subscriptionStatus?.hasSocialPoster === true,
  });

  const { data: existingGoals = [], isLoading: goalsLoading } = useQuery<PostGoal[]>({
    queryKey: ["/api/social/goals"],
    enabled: !!user && subscriptionStatus?.hasSocialPoster === true,
  });

  const createGoalMutation = useMutation({
    mutationFn: async (goalData: any) => {
      // Call the AI plan generation endpoint which creates goals AND posts
      const response = await apiRequest("POST", "/api/social/ai/generate-plan", goalData);
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      const postsCount = data.postsCreated || 0;
      toast({
        title: "Strategy Created!",
        description: postsCount > 0 
          ? `${postsCount} posts scheduled! View them in your Content Calendar.`
          : "Strategy created but no posts were scheduled. Try again or create posts manually.",
      });
      setStep(4);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create strategy",
        variant: "destructive",
      });
    },
  });

  const connectedPlatformIds = connectedAccounts
    .filter((acc: any) => acc.connected)
    .map((acc: any) => acc.platform);

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      setSelectedPlatforms(prev => prev.filter(p => p !== platformId));
    } else {
      setSelectedPlatforms(prev => [...prev, platformId]);
    }
  };

  const handleSubmit = () => {
    if (!selectedGoal || selectedPlatforms.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a goal and at least one platform.",
        variant: "destructive",
      });
      return;
    }

    createGoalMutation.mutate({
      goal: selectedGoal,
      platforms: selectedPlatforms,
      duration,
      postingIntensity,
      startDate: startDate.toISOString(),
      businessDescription,
      targetAudience,
    });
  };

  if (statusLoading) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-loading-status">
            Checking subscription status...
          </p>
        </div>
      </div>
    );
  }

  if (!subscriptionStatus?.hasSocialPoster) {
    return (
      <SocialUpgradePrompt 
        title="Unlock AI Strategist"
        description="Let AI create your perfect content strategy based on your goals."
      />
    );
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <Card data-testid="card-step-1">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>What's your goal?</CardTitle>
                  <CardDescription>Select your primary social media objective</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {GOALS.map((goal) => {
                const Icon = goal.icon;
                const isSelected = selectedGoal === goal.id;
                return (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`button-goal-${goal.id}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{goal.label}</p>
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full gap-2" 
                onClick={() => setStep(2)}
                disabled={!selectedGoal}
                data-testid="button-next-step-1"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        );

      case 2:
        return (
          <Card data-testid="card-step-2">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Select platforms</CardTitle>
                  <CardDescription>Choose where to post your content</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {connectedPlatformIds.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    You haven't connected any social accounts yet.
                  </p>
                  <Button asChild>
                    <Link href="/social/connect">Connect Accounts</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {PLATFORMS.filter(p => connectedPlatformIds.includes(p.id)).map((platform) => {
                    const Icon = platform.icon;
                    const isSelected = selectedPlatforms.includes(platform.id);
                    return (
                      <button
                        key={platform.id}
                        onClick={() => togglePlatform(platform.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover-elevate"
                        }`}
                        data-testid={`button-platform-${platform.id}`}
                      >
                        <Icon className={`w-6 h-6 ${isSelected ? "text-primary" : ""}`} />
                        <span className="text-sm font-medium">{platform.name}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={() => setStep(3)}
                disabled={selectedPlatforms.length === 0}
                data-testid="button-next-step-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        );

      case 3:
        return (
          <Card data-testid="card-step-3">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Tell us about your business</CardTitle>
                  <CardDescription>Help our AI create the perfect content strategy</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Campaign Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger data-testid="select-duration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-start-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, "MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        disabled={(date) => isBefore(date, startOfDay(new Date()))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              {/* Posting Intensity */}
              <div className="space-y-3">
                <Label>Posting Intensity</Label>
                <div className="grid grid-cols-3 gap-3">
                  {POSTING_INTENSITIES.map((intensity) => {
                    const isSelected = postingIntensity === intensity.value;
                    return (
                      <button
                        key={intensity.value}
                        type="button"
                        onClick={() => setPostingIntensity(intensity.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? "border-primary bg-primary/5" 
                            : "border-border hover-elevate"
                        }`}
                        data-testid={`button-intensity-${intensity.value}`}
                      >
                        <p className={`font-medium text-sm ${isSelected ? "text-primary" : ""}`}>
                          {intensity.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {intensity.postsPerDay}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {POSTING_INTENSITIES.find(i => i.value === postingIntensity)?.description}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="business">Describe your business</Label>
                <Textarea
                  id="business"
                  placeholder="e.g., I run an online fitness coaching business helping busy professionals get fit..."
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  rows={3}
                  data-testid="input-business-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audience">Target audience (optional)</Label>
                <Input
                  id="audience"
                  placeholder="e.g., Working professionals aged 25-45"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  data-testid="input-target-audience"
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button 
                className="flex-1 gap-2" 
                onClick={handleSubmit}
                disabled={createGoalMutation.isPending || !businessDescription.trim()}
                data-testid="button-generate-strategy"
              >
                {createGoalMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {duration === '1month' || duration === '3months' 
                        ? 'Generating (this may take a minute)...' 
                        : 'Generating...'}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Strategy
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        );

      case 4:
        return (
          <Card data-testid="card-step-4">
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Strategy Created!</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Your AI-powered content strategy is ready. View your scheduled posts in the Content Calendar.
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Create Another
                </Button>
                <Button asChild className="gap-2">
                  <Link href="/social/calendar">
                    <Calendar className="w-4 h-4" />
                    View Calendar
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
          AI Strategist
        </h1>
        <p className="text-muted-foreground mt-2">
          Let AI create your perfect content strategy based on your goals.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              s < step 
                ? "bg-primary text-primary-foreground"
                : s === step 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
            }`}>
              {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 4 && (
              <div className={`flex-1 h-1 rounded ${s < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {renderStepContent()}

      {existingGoals.length > 0 && step === 1 && (
        <>
          <Separator className="my-8" />
          
          <div>
            <h2 className="text-lg font-semibold mb-4">Previous Strategies</h2>
            <div className="space-y-3">
              {existingGoals.slice(0, 3).map((goal) => (
                <Card key={goal.id}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <Target className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium capitalize">{goal.goal.replace("_", " ")}</p>
                      <p className="text-sm text-muted-foreground">
                        {goal.platforms.join(", ")} • {goal.duration}
                      </p>
                    </div>
                    <Badge variant={goal.status === "active" ? "default" : "secondary"}>
                      {goal.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
