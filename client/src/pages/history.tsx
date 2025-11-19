import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { GenerationCard } from "@/components/generation-card";
import { Loader2, History as HistoryIcon } from "lucide-react";
import type { Generation } from "@shared/schema";

export default function History() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: generations = [], isLoading } = useQuery<Generation[]>({
    queryKey: ["/api/generations"],
    enabled: isAuthenticated,
  });

  const filteredGenerations = activeTab === "all" 
    ? generations 
    : generations.filter(g => g.type === activeTab);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <HistoryIcon className="h-10 w-10 text-primary" />
          Generation History
        </h1>
        <p className="text-lg text-muted-foreground">
          View and manage all your AI generations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-8">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="video" data-testid="tab-video">Videos</TabsTrigger>
          <TabsTrigger value="image" data-testid="tab-image">Images</TabsTrigger>
          <TabsTrigger value="music" data-testid="tab-music">Music</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredGenerations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {activeTab === "all" 
                    ? "No generations yet. Start creating amazing AI content!"
                    : `No ${activeTab} generations yet.`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredGenerations.length} generation{filteredGenerations.length !== 1 ? 's' : ''} found
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGenerations.map((generation) => (
                  <GenerationCard key={generation.id} generation={generation} />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
