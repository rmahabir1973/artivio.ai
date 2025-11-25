import { useEffect, useState, useMemo } from "react";
import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset } from "@/components/ui/sidebar";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { GenerationCard } from "@/components/generation-card";
import { 
  Loader2, 
  History as HistoryIcon,
  Folder,
  FolderOpen,
  Heart,
  Clock,
  Archive,
  Plus,
  ChevronRight,
  Search,
  Grid3X3,
  List,
  PanelLeftClose,
  PanelLeft,
  Files,
  Video,
  Image as ImageIcon,
  Music,
  Calendar,
  Download,
  Trash2,
  MoreHorizontal,
  Play,
} from "lucide-react";
import type { Generation, Collection } from "@shared/schema";
import { fetchWithAuth, apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow, subDays, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchWithAuth as fetchWithAuthBridge } from "@/lib/authBridge";

type ActiveView = 'all' | 'favorites' | 'recent' | 'archived' | string;
type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'name-asc' | 'name-desc';
type TypeFilter = 'all' | 'video' | 'image' | 'music';

const COLLECTION_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', 
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#0EA5E9', '#3B82F6',
];

function GenerationListItem({ generation }: { generation: Generation }) {
  const { toast } = useToast();
  
  const statusColors = {
    pending: "secondary",
    processing: "default",
    completed: "default",
    failed: "destructive",
  } as const;

  const typeIcons: Record<string, React.ReactNode> = {
    video: <Video className="h-4 w-4" />,
    image: <ImageIcon className="h-4 w-4" />,
    music: <Music className="h-4 w-4" />,
  };

  const handleDownload = async () => {
    if (!generation.resultUrl) return;
    
    try {
      const response = await fetchWithAuthBridge(`/api/generations/${generation.id}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `artivio-${generation.type}-${generation.id}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Download started", description: "Your file is being downloaded" });
    } catch (error) {
      toast({ title: "Download failed", description: "Could not download the file", variant: "destructive" });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/generations/${generation.id}`),
    onSuccess: () => {
      toast({ title: "Success", description: "Generation deleted successfully" });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/generations');
        }
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete", variant: "destructive" });
    },
  });

  const getThumbnail = () => {
    if (generation.thumbnailUrl) return generation.thumbnailUrl;
    if (generation.resultUrl) {
      if (generation.type === 'image') return generation.resultUrl;
      if (generation.type === 'video') return generation.resultUrl;
    }
    return null;
  };

  const thumbnail = getThumbnail();

  return (
    <div 
      className="flex items-center gap-4 p-3 rounded-md hover-elevate border border-border/50 bg-card"
      data-testid={`list-item-${generation.id}`}
    >
      <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
        {thumbnail ? (
          generation.type === 'video' ? (
            <video 
              src={thumbnail} 
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
          ) : (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            {typeIcons[generation.type] || <Files className="h-6 w-6" />}
          </div>
        )}
        {generation.type === 'video' && generation.status === 'completed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm" data-testid={`text-prompt-${generation.id}`}>
          {generation.prompt}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant={statusColors[generation.status as keyof typeof statusColors]} className="text-xs">
            {generation.status}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {typeIcons[generation.type]}
            {generation.type}
          </span>
          <span className="text-xs text-muted-foreground">
            {generation.model}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        <Calendar className="h-3 w-3" />
        {formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {generation.status === 'completed' && generation.resultUrl && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDownload}
            data-testid={`button-download-${generation.id}`}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" data-testid={`button-more-${generation.id}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => deleteMutation.mutate()}
              className="text-destructive"
              data-testid={`button-delete-${generation.id}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function History() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  
  const [activeView, setActiveView] = useState<ActiveView>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionColor, setNewCollectionColor] = useState(COLLECTION_COLORS[0]);

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

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const url = `/api/generations?cursor=${encodeURIComponent(cursor)}`;
      
      const response = await fetchWithAuth(url, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch generations');
      }
      
      return response.json() as Promise<{ items: Generation[]; nextCursor: string | null }>;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const allItems = query.state.data?.pages.flatMap(page => page.items) ?? [];
      const hasProcessing = allItems.some(gen => gen.status === 'processing');
      return hasProcessing ? 3000 : false;
    },
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<Collection[]>({
    queryKey: ['/api/collections'],
    enabled: isAuthenticated,
  });

  const createCollectionMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return await apiRequest("POST", "/api/collections", data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Collection created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/collections'] });
      setShowCreateCollection(false);
      setNewCollectionName("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create collection", variant: "destructive" });
    },
  });

  const allGenerations = useMemo(() => {
    return data?.pages.flatMap(page => page.items) ?? [];
  }, [data]);

  const filteredGenerations = useMemo(() => {
    let result = [...allGenerations];

    if (activeView === 'favorites') {
      result = result.filter(g => g.isFavorite);
    } else if (activeView === 'recent') {
      const sevenDaysAgo = subDays(new Date(), 7);
      result = result.filter(g => isAfter(new Date(g.createdAt), sevenDaysAgo));
    } else if (activeView === 'archived') {
      result = result.filter(g => g.archivedAt !== null);
    } else if (activeView !== 'all') {
      result = result.filter(g => g.collectionId === activeView);
    } else {
      result = result.filter(g => g.archivedAt === null);
    }

    if (typeFilter !== 'all') {
      result = result.filter(g => g.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(g => 
        g.prompt.toLowerCase().includes(query) ||
        g.model.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc':
          return a.prompt.localeCompare(b.prompt);
        case 'name-desc':
          return b.prompt.localeCompare(a.prompt);
        default:
          return 0;
      }
    });

    return result;
  }, [allGenerations, activeView, typeFilter, searchQuery, sortBy]);

  const getViewLabel = () => {
    if (activeView === 'all') return 'All Files';
    if (activeView === 'favorites') return 'Favorites';
    if (activeView === 'recent') return 'Recent';
    if (activeView === 'archived') return 'Archived';
    const collection = collections.find(c => c.id === activeView);
    return collection?.name || 'Files';
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <SidebarInset>
      <div className="flex h-[calc(100vh-4rem)]">
        <div 
          className={cn(
            "shrink-0 bg-sidebar border-r border-sidebar-border transition-all duration-300 overflow-hidden",
            sidebarOpen ? "w-[250px]" : "w-0"
          )}
        >
          <div className="h-full flex flex-col w-[250px]">
            <div className="p-4 border-b border-sidebar-border">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-sidebar-foreground flex items-center gap-2">
                  <HistoryIcon className="h-5 w-5" />
                  Library
                </h2>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setSidebarOpen(false)}
                  className="h-8 w-8"
                  data-testid="button-close-sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-2">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveView('all')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                    activeView === 'all' 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover-elevate"
                  )}
                  data-testid="button-view-all"
                >
                  <Files className="h-4 w-4" />
                  All Files
                </button>

                <button
                  onClick={() => setActiveView('favorites')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                    activeView === 'favorites' 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover-elevate"
                  )}
                  data-testid="button-view-favorites"
                >
                  <Heart className="h-4 w-4" />
                  Favorites
                </button>

                <button
                  onClick={() => setActiveView('recent')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                    activeView === 'recent' 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-sidebar-foreground hover-elevate"
                  )}
                  data-testid="button-view-recent"
                >
                  <Clock className="h-4 w-4" />
                  Recent
                </button>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Collections
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setShowCreateCollection(true)}
                    data-testid="button-create-collection"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {collectionsLoading ? (
                  <div className="px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : collections.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No collections yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {collections.map((collection) => (
                      <button
                        key={collection.id}
                        onClick={() => setActiveView(collection.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                          activeView === collection.id 
                            ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                            : "text-sidebar-foreground hover-elevate"
                        )}
                        data-testid={`button-collection-${collection.id}`}
                      >
                        {activeView === collection.id ? (
                          <FolderOpen 
                            className="h-4 w-4" 
                            style={{ color: collection.color || '#6366F1' }} 
                          />
                        ) : (
                          <Folder 
                            className="h-4 w-4" 
                            style={{ color: collection.color || '#6366F1' }} 
                          />
                        )}
                        <span className="truncate">{collection.name}</span>
                        <ChevronRight className="h-3 w-3 ml-auto opacity-50" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <button
                onClick={() => setActiveView('archived')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  activeView === 'archived' 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover-elevate"
                )}
                data-testid="button-view-archived"
              >
                <Archive className="h-4 w-4" />
                Archived
              </button>
            </ScrollArea>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="shrink-0 p-4 border-b border-border bg-background">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {!sidebarOpen && (
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => setSidebarOpen(true)}
                    data-testid="button-open-sidebar"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                )}
                <div>
                  <h1 className="text-xl font-semibold">{getViewLabel()}</h1>
                  <p className="text-sm text-muted-foreground">
                    {filteredGenerations.length} item{filteredGenerations.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-[200px]"
                    data-testid="input-search"
                  />
                </div>

                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
                  <SelectTrigger className="w-[120px]" data-testid="select-type-filter">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="image">Images</SelectItem>
                    <SelectItem value="music">Music</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                  <SelectTrigger className="w-[130px]" data-testid="select-sort">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="name-asc">Name A-Z</SelectItem>
                    <SelectItem value="name-desc">Name Z-A</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center border rounded-md">
                  <Button
                    size="icon"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                    data-testid="button-view-grid"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                    data-testid="button-view-list"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredGenerations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    {activeView === 'favorites' ? (
                      <>
                        <Heart className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No favorites yet</p>
                        <p className="text-sm text-muted-foreground">Star your best generations to find them here</p>
                      </>
                    ) : activeView === 'recent' ? (
                      <>
                        <Clock className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No recent generations</p>
                        <p className="text-sm text-muted-foreground">Generations from the last 7 days will appear here</p>
                      </>
                    ) : activeView === 'archived' ? (
                      <>
                        <Archive className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No archived items</p>
                        <p className="text-sm text-muted-foreground">Archive generations you want to keep but hide from your library</p>
                      </>
                    ) : activeView === 'all' ? (
                      <>
                        <Files className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No generations yet</p>
                        <p className="text-sm text-muted-foreground">Start creating amazing AI content!</p>
                      </>
                    ) : (
                      <>
                        <Folder className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">This collection is empty</p>
                        <p className="text-sm text-muted-foreground">Add generations to organize your content</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredGenerations.map((generation) => (
                  <GenerationCard key={generation.id} generation={generation} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGenerations.map((generation) => (
                  <GenerationListItem key={generation.id} generation={generation} />
                ))}
              </div>
            )}

            {hasNextPage && (
              <div className="flex justify-center mt-8 pb-4">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="outline"
                  size="lg"
                  data-testid="button-load-more"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <Dialog open={showCreateCollection} onOpenChange={setShowCreateCollection}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
            <DialogDescription>
              Create a new collection to organize your generations
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                placeholder="My Collection"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                data-testid="input-collection-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCollectionColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-transform",
                      newCollectionColor === color && "ring-2 ring-offset-2 ring-primary scale-110"
                    )}
                    style={{ backgroundColor: color }}
                    data-testid={`button-color-${color.slice(1)}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateCollection(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => createCollectionMutation.mutate({ 
                name: newCollectionName, 
                color: newCollectionColor 
              })}
              disabled={!newCollectionName.trim() || createCollectionMutation.isPending}
              data-testid="button-save-collection"
            >
              {createCollectionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                'Create Collection'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}
