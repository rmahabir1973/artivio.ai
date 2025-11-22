import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Library, 
  Trash2, 
  Copy, 
  Save, 
  Search,
  ImageIcon,
  Plus
} from "lucide-react";

interface SavedSeed {
  id: string;
  name: string;
  seed: number;
  description?: string;
  previewImageUrl?: string;
  usageCount: number;
  createdAt: string;
}

interface SavedSeedsLibraryProps {
  currentSeed?: number;
  onApplySeed: (seed: number) => void;
  triggerButton?: React.ReactNode;
}

export function SavedSeedsLibrary({ 
  currentSeed, 
  onApplySeed,
  triggerButton 
}: SavedSeedsLibraryProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form state for saving a seed
  const [seedName, setSeedName] = useState("");
  const [seedDescription, setSeedDescription] = useState("");

  // Fetch saved seeds
  const { data: savedSeeds = [], isLoading, isError, error, refetch, isFetching } = useQuery<SavedSeed[]>({
    queryKey: ["/api/saved-seeds"],
    enabled: open,
    retry: 2, // Retry failed requests twice
  });

  // Save seed mutation
  const saveSeedMutation = useMutation({
    mutationFn: async (data: { name: string; seed: number; description?: string }) => {
      return apiRequest("POST", "/api/saved-seeds", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-seeds"] });
      toast({
        title: "Seed Saved",
        description: "Your seed has been saved to the library.",
      });
      setSaveDialogOpen(false);
      setSeedName("");
      setSeedDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Seed",
        description: error.message || "An error occurred while saving the seed.",
        variant: "destructive",
      });
    },
  });

  // Delete seed mutation
  const deleteSeedMutation = useMutation({
    mutationFn: async (seedId: string) => {
      return apiRequest("DELETE", `/api/saved-seeds/${seedId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-seeds"] });
      toast({
        title: "Seed Deleted",
        description: "The seed has been removed from your library.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Delete Seed",
        description: error.message || "An error occurred while deleting the seed.",
        variant: "destructive",
      });
    },
  });

  const handleSaveSeed = () => {
    if (!currentSeed) {
      toast({
        title: "No Seed to Save",
        description: "Please generate or enter a seed first.",
        variant: "destructive",
      });
      return;
    }

    if (!seedName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for this seed.",
        variant: "destructive",
      });
      return;
    }

    saveSeedMutation.mutate({
      name: seedName.trim(),
      seed: currentSeed,
      description: seedDescription.trim() || undefined,
    });
  };

  const handleApplySeed = (seed: number) => {
    onApplySeed(seed);
    setOpen(false);
    toast({
      title: "Seed Applied",
      description: `Seed ${seed} has been applied to your generation settings.`,
    });
  };

  const handleCopySeed = (seed: number) => {
    navigator.clipboard.writeText(seed.toString());
    toast({
      title: "Seed Copied",
      description: "The seed value has been copied to your clipboard.",
    });
  };

  // Filter seeds based on search query
  const filteredSeeds = savedSeeds.filter((seed) =>
    seed.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seed.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    seed.seed.toString().includes(searchQuery)
  );

  return (
    <>
      {/* Save Current Seed Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            disabled={!currentSeed}
            data-testid="button-save-seed"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Seed
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="dialog-save-seed">
          <DialogHeader>
            <DialogTitle>Save Seed to Library</DialogTitle>
            <DialogDescription>
              Save this seed ({currentSeed}) to your library for future use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="seed-name">Name *</Label>
              <Input
                id="seed-name"
                placeholder="e.g., Cyberpunk Theme, Character V1"
                value={seedName}
                onChange={(e) => setSeedName(e.target.value)}
                data-testid="input-seed-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seed-description">Description (Optional)</Label>
              <Textarea
                id="seed-description"
                placeholder="Add notes about this seed..."
                value={seedDescription}
                onChange={(e) => setSeedDescription(e.target.value)}
                rows={3}
                data-testid="input-seed-description"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Seed Value:</strong> {currentSeed}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSaveDialogOpen(false)}
              data-testid="button-cancel-save-seed"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSeed}
              disabled={saveSeedMutation.isPending || !seedName.trim()}
              data-testid="button-confirm-save-seed"
            >
              {saveSeedMutation.isPending ? "Saving..." : "Save Seed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Browse Seeds Library Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {triggerButton || (
            <Button variant="outline" size="sm" data-testid="button-browse-seeds">
              <Library className="h-4 w-4 mr-2" />
              Seed Library
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="dialog-seed-library">
          <DialogHeader>
            <DialogTitle>Saved Seeds Library</DialogTitle>
            <DialogDescription>
              Browse and manage your saved seeds. Click on a seed to apply it to your generation.
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search seeds by name, description, or value..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-seeds"
            />
          </div>

          {/* Seeds Grid */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading seeds...
              </div>
            ) : isError ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-destructive font-medium">
                  Failed to load saved seeds
                </p>
                {error && (
                  <p className="text-sm text-muted-foreground">
                    {error instanceof Error ? error.message : 'An unknown error occurred'}
                  </p>
                )}
                <Button 
                  variant="outline" 
                  onClick={() => refetch()}
                  disabled={isFetching}
                  data-testid="button-retry-seeds"
                >
                  {isFetching ? 'Retrying...' : 'Try Again'}
                </Button>
              </div>
            ) : filteredSeeds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? (
                  <p>No seeds match your search.</p>
                ) : (
                  <div className="space-y-2">
                    <Library className="h-12 w-12 mx-auto opacity-20" />
                    <p>No saved seeds yet.</p>
                    <p className="text-sm">
                      Save your favorite seeds to reuse them later!
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSeeds.map((seed) => (
                  <Card 
                    key={seed.id} 
                    className="hover-elevate active-elevate-2 cursor-pointer"
                    data-testid={`seed-card-${seed.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        {/* Thumbnail or placeholder */}
                        <div className="flex-shrink-0">
                          {seed.previewImageUrl ? (
                            <img
                              src={seed.previewImageUrl}
                              alt={seed.name}
                              className="w-20 h-20 object-cover rounded-md"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Seed Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate" data-testid={`seed-name-${seed.id}`}>
                            {seed.name}
                          </h4>
                          <p className="text-sm text-muted-foreground" data-testid={`seed-value-${seed.id}`}>
                            Seed: {seed.seed}
                          </p>
                          {seed.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {seed.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Used {seed.usageCount} times
                          </p>

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApplySeed(seed.seed)}
                              data-testid={`button-apply-seed-${seed.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopySeed(seed.seed);
                              }}
                              data-testid={`button-copy-seed-${seed.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete seed "${seed.name}"?`)) {
                                  deleteSeedMutation.mutate(seed.id);
                                }
                              }}
                              data-testid={`button-delete-seed-${seed.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
