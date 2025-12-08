import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Search,
  Loader2,
  Heart,
  Download,
  ExternalLink,
  Image as ImageIcon,
  BookmarkPlus,
  BookmarkCheck,
  Filter,
  X,
  Grid3X3,
  LayoutGrid,
  User,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarInset } from "@/components/ui/sidebar";

interface StockImage {
  id: string;
  dbId?: string; // Database ID for saved images (used for delete operations)
  source: "pixabay" | "pexels";
  previewUrl: string;
  webformatUrl: string;
  largeUrl: string;
  originalUrl?: string;
  width: number;
  height: number;
  tags: string;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
  downloads?: number;
  likes?: number;
  avgColor?: string;
}

interface SearchResponse {
  query: string;
  page: number;
  perPage: number;
  totalPixabay: number;
  totalPexels: number;
  images: StockImage[];
  sources: {
    pixabay: { available: boolean; error?: string };
    pexels: { available: boolean; error?: string };
  };
}

interface SavedResponse {
  images: StockImage[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const CATEGORIES = [
  "backgrounds",
  "fashion",
  "nature",
  "science",
  "education",
  "feelings",
  "health",
  "people",
  "religion",
  "places",
  "animals",
  "industry",
  "computer",
  "food",
  "sports",
  "transportation",
  "travel",
  "buildings",
  "business",
  "music",
];

const ORIENTATIONS = [
  { value: "all", label: "All Orientations" },
  { value: "horizontal", label: "Landscape" },
  { value: "vertical", label: "Portrait" },
];

export default function StockPhotos() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");
  const [source, setSource] = useState<"all" | "pixabay" | "pexels">("all");
  const [orientation, setOrientation] = useState("all");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<StockImage | null>(null);
  const [gridSize, setGridSize] = useState<"small" | "large">("large");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Search query URL - the default fetcher will use this as the fetch URL
  const searchUrl = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const params = new URLSearchParams({
      q: searchQuery.trim(),
      source,
      page: page.toString(),
      per_page: "40",
      orientation,
    });
    if (category) params.set("category", category);
    return `/api/stock-photos/search?${params.toString()}`;
  }, [searchQuery, source, page, orientation, category]);

  // Use the default TanStack Query fetcher (already configured with auth in queryClient)
  const {
    data: searchResults,
    isLoading: searchLoading,
    isFetching: searchFetching,
  } = useQuery<SearchResponse>({
    queryKey: [searchUrl],
    enabled: !!searchUrl && activeTab === "search",
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Saved images query - uses default fetcher
  const {
    data: savedImages,
    isLoading: savedLoading,
    refetch: refetchSavedImages,
  } = useQuery<SavedResponse>({
    queryKey: ["/api/stock-photos/saved"],
    enabled: activeTab === "saved",
    staleTime: 0, // Always consider stale to ensure fresh data
    refetchOnMount: "always", // Always refetch when component mounts or tab becomes active
    gcTime: 0, // Don't cache - always get fresh data
  });

  // Check which images are saved
  const checkSavedMutation = useMutation({
    mutationFn: async (images: Array<{ source: string; externalId: string }>) => {
      const response = await apiRequest("POST", "/api/stock-photos/check-saved", { images });
      const data = await response.json();
      return data.savedIds as string[];
    },
    onSuccess: (ids) => {
      setSavedIds(new Set(ids));
    },
  });

  // Save image mutation
  const saveMutation = useMutation({
    mutationFn: async (image: StockImage) => {
      console.log("[Stock Photos] Save mutation called for image:", image.id, image.source);
      const payload = {
        source: image.source,
        externalId: image.id,
        previewUrl: image.previewUrl,
        webformatUrl: image.webformatUrl,
        largeUrl: image.largeUrl,
        originalUrl: image.originalUrl,
        width: image.width,
        height: image.height,
        tags: image.tags,
        photographer: image.photographer,
        photographerUrl: image.photographerUrl,
        pageUrl: image.pageUrl,
      };
      console.log("[Stock Photos] Save payload:", payload);
      try {
        const result = await apiRequest("POST", "/api/stock-photos/save", payload);
        console.log("[Stock Photos] Save API response received");
        return result;
      } catch (err) {
        console.error("[Stock Photos] Save API error:", err);
        throw err;
      }
    },
    onSuccess: (_, image) => {
      console.log("[Stock Photos] Save mutation success for:", image.id);
      setSavedIds((prev) => new Set(Array.from(prev).concat([`${image.source}-${image.id}`])));
      // Invalidate and force refetch of saved images
      queryClient.invalidateQueries({ queryKey: ["/api/stock-photos/saved"] });
      // If already on saved tab, force immediate refetch
      if (activeTab === "saved") {
        refetchSavedImages();
      }
      toast({ title: "Image saved to library" });
    },
    onError: (error: any) => {
      console.error("[Stock Photos] Save mutation error:", error);
      if (error.message?.includes("already saved")) {
        toast({ title: "Image already in library", variant: "default" });
      } else {
        toast({ title: "Failed to save image", variant: "destructive" });
      }
    },
  });

  // Delete saved image mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/stock-photos/saved/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stock-photos/saved"] });
      toast({ title: "Image removed from library" });
    },
    onError: () => {
      toast({ title: "Failed to remove image", variant: "destructive" });
    },
  });

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    // Trigger refetch by updating searchParams
  };

  // Check saved status when search results change
  useEffect(() => {
    if (searchResults?.images?.length) {
      const imagesToCheck = searchResults.images.map((img) => ({
        source: img.source,
        externalId: img.id,
      }));
      checkSavedMutation.mutate(imagesToCheck);
    }
  }, [searchResults?.images]);

  // Force refetch saved images when switching to saved tab
  useEffect(() => {
    if (activeTab === "saved") {
      console.log("[Stock Photos] Saved tab activated, forcing refetch");
      refetchSavedImages();
    }
  }, [activeTab, refetchSavedImages]);

  const isImageSaved = (image: StockImage) => {
    return savedIds.has(`${image.source}-${image.id}`);
  };

  const handleDownload = async (image: StockImage) => {
    try {
      const downloadUrl = image.originalUrl || image.largeUrl;
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${image.source}-${image.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Download started" });
    } catch {
      // Fallback: open in new tab
      window.open(image.originalUrl || image.largeUrl, "_blank");
    }
  };

  const displayImages = activeTab === "search" ? searchResults?.images : savedImages?.images;
  const totalResults = activeTab === "search" 
    ? (searchResults?.totalPixabay || 0) + (searchResults?.totalPexels || 0)
    : savedImages?.total || 0;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <SidebarInset>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent">
            Stock Photos
          </h1>
          <p className="text-muted-foreground">
            Search millions of free stock photos from Pixabay and Pexels. Save your favorites for future generations.
          </p>
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">How to use with AI Generation:</span> Save stock images to{" "}
              <span className="font-medium text-foreground">My Saved</span>, then copy the image link to use in AI video or image generations.
              The main Library is reserved for your AI-generated content.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "saved")}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="search" className="gap-2" data-testid="tab-search">
              <Search className="h-4 w-4" />
              Search Photos
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2" data-testid="tab-saved">
              <Heart className="h-4 w-4" />
              My Saved ({savedImages?.total || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search Controls */}
        {activeTab === "search" && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for photos... (e.g., nature, business, technology)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <Button type="submit" disabled={!searchQuery.trim()} data-testid="button-search">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </form>

              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Filters:</span>
                </div>

                <Select value={source} onValueChange={(v) => { setSource(v as any); setPage(1); }}>
                  <SelectTrigger className="w-[140px]" data-testid="select-source">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="pixabay">Pixabay</SelectItem>
                    <SelectItem value="pexels">Pexels</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={orientation} onValueChange={(v) => { setOrientation(v); setPage(1); }}>
                  <SelectTrigger className="w-[160px]" data-testid="select-orientation">
                    <SelectValue placeholder="Orientation" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIENTATIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={category || "all"} onValueChange={(v) => { setCategory(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-[150px]" data-testid="select-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(category || orientation !== "all" || source !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCategory("");
                      setOrientation("all");
                      setSource("all");
                      setPage(1);
                    }}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant={gridSize === "small" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setGridSize("small")}
                    data-testid="button-grid-small"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={gridSize === "large" ? "secondary" : "ghost"}
                    size="icon"
                    onClick={() => setGridSize("large")}
                    data-testid="button-grid-large"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Source status */}
              {searchResults?.sources && (
                <div className="flex gap-2 text-xs">
                  {searchResults.sources.pixabay.available && (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                      Pixabay: {searchResults.totalPixabay.toLocaleString()} results
                    </Badge>
                  )}
                  {searchResults.sources.pexels.available && (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                      Pexels: {searchResults.totalPexels.toLocaleString()} results
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {(searchLoading || savedLoading) && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        )}

        {!searchLoading && !savedLoading && displayImages && displayImages.length > 0 && (
          <>
            <div className="text-sm text-muted-foreground">
              {activeTab === "search" ? (
                <>Showing {displayImages.length} of {totalResults.toLocaleString()} results</>
              ) : (
                <>{displayImages.length} saved images</>
              )}
            </div>

            <div
              className={cn(
                "grid gap-4",
                gridSize === "small" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              )}
            >
              {displayImages.map((image: StockImage) => (
                <Card
                  key={`${image.source}-${image.id}`}
                  className="group overflow-hidden cursor-pointer hover-elevate"
                  onClick={() => setSelectedImage(image)}
                  data-testid={`card-image-${image.source}-${image.id}`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={image.webformatUrl}
                      alt={image.tags}
                      className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    
                    {/* Source badge */}
                    <Badge
                      className={cn(
                        "absolute top-2 left-2 text-xs",
                        image.source === "pixabay" ? "bg-green-500/90" : "bg-blue-500/90"
                      )}
                    >
                      {image.source === "pixabay" ? "Pixabay" : "Pexels"}
                    </Badge>

                    {/* Quick actions overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isImageSaved(image)) {
                                // For search tab, we don't have the saved ID
                                toast({ title: "Image already saved" });
                              } else {
                                saveMutation.mutate(image);
                              }
                            }}
                            disabled={saveMutation.isPending || isImageSaved(image)}
                            data-testid={`button-save-${image.id}`}
                          >
                            {isImageSaved(image) ? (
                              <BookmarkCheck className="h-4 w-4 text-green-500" />
                            ) : (
                              <BookmarkPlus className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isImageSaved(image) ? "Saved" : "Save to Library"}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(image);
                            }}
                            data-testid={`button-download-${image.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Download</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(image.pageUrl, "_blank");
                            }}
                            data-testid={`button-external-${image.id}`}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View on {image.source}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {gridSize === "large" && (
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Camera className="h-3 w-3" />
                        <span className="truncate">{image.photographer}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {image.width} × {image.height}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Pagination for search */}
            {activeTab === "search" && totalResults > 40 && (
              <div className="flex items-center justify-center gap-4 py-4">
                <Button
                  variant="outline"
                  disabled={page <= 1 || searchFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page}</span>
                <Button
                  variant="outline"
                  disabled={displayImages.length < 40 || searchFetching}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Empty states */}
        {!searchLoading && !savedLoading && activeTab === "search" && !searchUrl && (
          <div className="text-center py-20 space-y-4">
            <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-medium">Search for stock photos</h3>
              <p className="text-muted-foreground">
                Enter a search term to find millions of free photos from Pixabay and Pexels
              </p>
            </div>
          </div>
        )}

        {!searchLoading && !savedLoading && activeTab === "search" && searchUrl && displayImages?.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <Search className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-medium">No results found</h3>
              <p className="text-muted-foreground">
                Try a different search term or adjust your filters
              </p>
            </div>
          </div>
        )}

        {!savedLoading && activeTab === "saved" && (!savedImages?.images || savedImages.images.length === 0) && (
          <div className="text-center py-20 space-y-4">
            <Heart className="h-16 w-16 mx-auto text-muted-foreground/50" />
            <div>
              <h3 className="text-lg font-medium">No saved images</h3>
              <p className="text-muted-foreground">
                Search for photos and save your favorites to use in your creations
              </p>
            </div>
            <Button onClick={() => setActiveTab("search")} data-testid="button-go-search">
              <Search className="h-4 w-4 mr-2" />
              Search Photos
            </Button>
          </div>
        )}

        {/* Attribution */}
        <div className="text-center text-xs text-muted-foreground py-4 border-t">
          Photos provided by{" "}
          <a href="https://pixabay.com" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:underline">
            Pixabay
          </a>
          {" "}and{" "}
          <a href="https://pexels.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
            Pexels
          </a>
        </div>
      </div>

      {/* Image Detail Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Badge className={selectedImage.source === "pixabay" ? "bg-green-500" : "bg-blue-500"}>
                    {selectedImage.source}
                  </Badge>
                  Photo by {selectedImage.photographer}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedImage.largeUrl}
                    alt={selectedImage.tags}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedImage.tags.split(",").map((tag) => (
                    <Badge key={tag.trim()} variant="outline" className="text-xs">
                      {tag.trim()}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>{selectedImage.width} × {selectedImage.height}</span>
                    {selectedImage.downloads && (
                      <span>{selectedImage.downloads.toLocaleString()} downloads</span>
                    )}
                    {selectedImage.likes && (
                      <span>{selectedImage.likes.toLocaleString()} likes</span>
                    )}
                  </div>
                  <a
                    href={selectedImage.photographerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    <User className="h-4 w-4" />
                    View photographer profile
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedImage.pageUrl, "_blank")}
                    data-testid="button-view-source"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on {selectedImage.source}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDownload(selectedImage)}
                    data-testid="button-download-large"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    onClick={() => {
                      if (!isImageSaved(selectedImage)) {
                        saveMutation.mutate(selectedImage);
                      }
                    }}
                    disabled={saveMutation.isPending || isImageSaved(selectedImage)}
                    data-testid="button-save-large"
                  >
                    {isImageSaved(selectedImage) ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 mr-2 text-green-500" />
                        Saved
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="h-4 w-4 mr-2" />
                        Save to Library
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </SidebarInset>
  );
}
