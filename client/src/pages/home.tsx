import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Video, Image, Music, TrendingUp, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { GenerationCard } from "@/components/generation-card";
import type { Generation } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: recentGenerations = [] } = useQuery<Generation[]>({
    queryKey: ["/api/generations/recent"],
    enabled: isAuthenticated,
  });

  const { data: stats } = useQuery<{
    totalGenerations: number;
    todayGenerations: number;
    successRate: number;
  }>({
    queryKey: ["/api/stats"],
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Welcome to Artivio AI</h1>
        <p className="text-lg text-muted-foreground">
          Create amazing AI-generated content with powerful models
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="hover-elevate">
          <CardHeader>
            <Video className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Generate Video</CardTitle>
            <CardDescription>
              Create videos with Veo 3.1 and Runway Aleph
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" data-testid="button-create-video">
              <Link href="/generate/video">Start Generating</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <Image className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Generate Image</CardTitle>
            <CardDescription>
              Create images with 4o, Flux Kontext, Nano Banana
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" data-testid="button-create-image">
              <Link href="/generate/image">Start Generating</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader>
            <Music className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Generate Music</CardTitle>
            <CardDescription>
              Create music with Suno V3.5, V4, V4.5
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" data-testid="button-create-music">
              <Link href="/generate/music">Start Generating</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-generations">
              {stats?.totalGenerations ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Generations</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-generations">
              {stats?.todayGenerations ?? 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {stats?.successRate?.toFixed(1) ?? 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorite Model</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium" data-testid="text-favorite-model">
              Veo 3.1
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Generations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Recent Generations</h2>
          <Button variant="outline" asChild data-testid="button-view-all-history">
            <Link href="/history">View All</Link>
          </Button>
        </div>

        {recentGenerations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No generations yet. Start creating amazing AI content!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentGenerations.slice(0, 6).map((generation) => (
              <GenerationCard key={generation.id} generation={generation} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
