import { useEffect, useState, useMemo } from "react";
import { useInfiniteQuery, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset } from "@/components/ui/sidebar";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  CheckSquare,
  X,
  Tag,
  FolderInput,
  Sparkles,
  Copy,
  Share2,
  RotateCw,
  Coins,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { useLocation } from "wouter";
import type { Generation, Collection, Tag as TagType } from "@shared/schema";
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

interface SelectableListItemProps {
  generation: Generation;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (generation: Generation) => void;
}

function GenerationListItem({ 
  generation, 
  isSelectionMode, 
  isSelected, 
  onToggleSelect,
  onOpenDetail,
}: SelectableListItemProps) {
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

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(generation.id);
    } else {
      onOpenDetail(generation);
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-4 p-3 rounded-md hover-elevate border bg-card transition-all cursor-pointer",
        isSelected 
          ? "ring-2 ring-primary border-primary" 
          : "border-border/50"
      )}
      onClick={handleClick}
      data-testid={`list-item-${generation.id}`}
    >
      {isSelectionMode && (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(generation.id)}
            data-testid={`checkbox-${generation.id}`}
          />
        </div>
      )}

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

      {!isSelectionMode && (
        <div className="flex items-center gap-1 shrink-0">
          {generation.status === 'completed' && generation.resultUrl && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              data-testid={`button-download-${generation.id}`}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-more-${generation.id}`}
              >
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
      )}
    </div>
  );
}

interface SelectableCardWrapperProps {
  generation: Generation;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (generation: Generation) => void;
}

function SelectableCardWrapper({
  generation,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onOpenDetail,
}: SelectableCardWrapperProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect(generation.id);
      return;
    }
    
    // In normal mode, only open detail panel if click was NOT on an interactive element
    // This allows GenerationCard buttons to work normally
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button, a, [role="button"], [data-radix-collection-item], input, select, textarea, [role="menuitem"]');
    if (!isInteractive) {
      onOpenDetail(generation);
    }
  };

  return (
    <div
      className={cn(
        "relative transition-all",
        isSelectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-primary rounded-lg"
      )}
      onClick={handleClick}
      data-testid={`selectable-card-${generation.id}`}
    >
      {isSelectionMode && (
        <div 
          className="absolute top-3 left-3 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(generation.id)}
            className="bg-background/80 backdrop-blur-sm"
            data-testid={`checkbox-${generation.id}`}
          />
        </div>
      )}
      <div className={isSelectionMode ? "pointer-events-none" : ""}>
        <GenerationCard generation={generation} />
      </div>
    </div>
  );
}

export default function History() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  
  const [activeView, setActiveView] = useState<ActiveView>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionColor, setNewCollectionColor] = useState(COLLECTION_COLORS[0]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [movePopoverOpen, setMovePopoverOpen] = useState(false);

  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRemoveTagConfirm, setShowRemoveTagConfirm] = useState<string | null>(null);
  const [detailTagPopoverOpen, setDetailTagPopoverOpen] = useState(false);
  const [detailMovePopoverOpen, setDetailMovePopoverOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeView, typeFilter, searchQuery, sortBy, viewMode]);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useInfiniteQuery({
    queryKey: ["/api/generations", { paginated: true }],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const cursor = pageParam || '';
      const url = `/api/generations?cursor=${encodeURIComponent(cursor)}`;
      
      console.log('[HISTORY] Fetching generations with cursor:', cursor || 'first page');
      
      const response = await fetchWithAuth(url, {
        method: 'GET',
      });
      
      if (!response.ok) {
        console.error('[HISTORY] Failed to fetch generations:', response.status);
        throw new Error('Failed to fetch generations');
      }
      
      const result = await response.json() as { items: Generation[]; nextCursor: string | null };
      console.log('[HISTORY] Fetched generations:', result.items.length, 'items, hasMore:', !!result.nextCursor);
      return result;
    },
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Fix: Wait for auth to finish loading instead of checking isAuthenticated
    // TanStack Query doesn't re-run when enabled flips from false to true after mount
    // Using !authLoading ensures query runs once auth is complete (fetchWithAuth handles 401s)
    enabled: !authLoading,
    refetchInterval: (query) => {
      const allItems = query.state.data?.pages.flatMap(page => page.items) ?? [];
      const hasProcessing = allItems.some(gen => gen.status === 'processing');
      return hasProcessing ? 3000 : false;
    },
  });

  const { data: collections = [], isLoading: collectionsLoading } = useQuery<Collection[]>({
    queryKey: ['/api/collections'],
    enabled: !authLoading,
  });

  const { data: tags = [] } = useQuery<TagType[]>({
    queryKey: ['/api/tags'],
    enabled: !authLoading,
  });

  const { data: generationTags = [], isLoading: generationTagsLoading } = useQuery<TagType[]>({
    queryKey: ['/api/generations', selectedGeneration?.id, 'tags'],
    enabled: !!selectedGeneration,
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ generationId, isFavorite }: { generationId: string; isFavorite: boolean }) =>
      apiRequest('POST', `/api/generations/${generationId}/favorite`, { isFavorite }),
    onSuccess: () => {
      invalidateGenerations();
      if (selectedGeneration) {
        setSelectedGeneration(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null);
      }
      toast({ title: 'Success', description: 'Favorite status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update favorite', variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ generationId, archive }: { generationId: string; archive: boolean }) =>
      apiRequest('POST', `/api/generations/${generationId}/archive`, { archive }),
    onSuccess: (_, variables) => {
      invalidateGenerations();
      setDetailPanelOpen(false);
      setSelectedGeneration(null);
      toast({ title: 'Success', description: variables.archive ? 'Item archived' : 'Item restored' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to archive', variant: 'destructive' });
    },
  });

  const showcaseMutation = useMutation({
    mutationFn: async ({ generationId, isShowcase }: { generationId: string; isShowcase: boolean }) =>
      apiRequest('POST', `/api/generations/${generationId}/showcase`, { isShowcase }),
    onSuccess: () => {
      invalidateGenerations();
      if (selectedGeneration) {
        setSelectedGeneration(prev => prev ? { ...prev, isShowcase: !prev.isShowcase } : null);
      }
      toast({ title: 'Success', description: 'Showcase status updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update showcase', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (generationId: string) =>
      apiRequest('DELETE', `/api/generations/${generationId}`),
    onSuccess: () => {
      invalidateGenerations();
      setDetailPanelOpen(false);
      setSelectedGeneration(null);
      setShowDeleteConfirm(false);
      toast({ title: 'Success', description: 'Generation deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete', variant: 'destructive' });
    },
  });

  const moveToCollectionMutation = useMutation({
    mutationFn: async ({ generationId, collectionId }: { generationId: string; collectionId: string | null }) =>
      apiRequest('POST', `/api/generations/${generationId}/move`, { collectionId }),
    onSuccess: (_, variables) => {
      invalidateGenerations();
      if (selectedGeneration) {
        setSelectedGeneration(prev => prev ? { ...prev, collectionId: variables.collectionId } : null);
      }
      setDetailMovePopoverOpen(false);
      toast({ title: 'Success', description: 'Moved to collection' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to move', variant: 'destructive' });
    },
  });

  const addTagMutation = useMutation({
    mutationFn: async ({ generationId, tagId }: { generationId: string; tagId: string }) =>
      apiRequest('POST', `/api/generations/${generationId}/tags`, { tagId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/generations', selectedGeneration?.id, 'tags'] });
      setDetailTagPopoverOpen(false);
      toast({ title: 'Success', description: 'Tag added' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to add tag', variant: 'destructive' });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async ({ generationId, tagId }: { generationId: string; tagId: string }) =>
      apiRequest('DELETE', `/api/generations/${generationId}/tags/${tagId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/generations', selectedGeneration?.id, 'tags'] });
      setShowRemoveTagConfirm(null);
      toast({ title: 'Success', description: 'Tag removed' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to remove tag', variant: 'destructive' });
    },
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

  const invalidateGenerations = () => {
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/generations');
      }
    });
  };

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ generationIds, collectionId }: { generationIds: string[], collectionId: string | null }) =>
      apiRequest('POST', '/api/generations/bulk/move', { generationIds, collectionId }),
    onSuccess: () => {
      invalidateGenerations();
      setSelectedIds(new Set());
      setMovePopoverOpen(false);
      toast({ title: 'Success', description: 'Items moved successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to move items', variant: 'destructive' });
    },
  });

  const bulkFavoriteMutation = useMutation({
    mutationFn: async ({ generationIds, isFavorite }: { generationIds: string[], isFavorite: boolean }) =>
      apiRequest('POST', '/api/generations/bulk/favorite', { generationIds, isFavorite }),
    onSuccess: () => {
      invalidateGenerations();
      toast({ title: 'Success', description: 'Favorites updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update favorites', variant: 'destructive' });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async ({ generationIds, archive }: { generationIds: string[], archive: boolean }) =>
      apiRequest('POST', '/api/generations/bulk/archive', { generationIds, archive }),
    onSuccess: (_, variables) => {
      invalidateGenerations();
      setSelectedIds(new Set());
      toast({ title: 'Success', description: variables.archive ? 'Items archived' : 'Items restored' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to archive items', variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (generationIds: string[]) =>
      apiRequest('POST', '/api/generations/bulk/delete', { generationIds }),
    onSuccess: () => {
      invalidateGenerations();
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      toast({ title: 'Success', description: 'Items deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete items', variant: 'destructive' });
    },
  });

  const bulkAddTagMutation = useMutation({
    mutationFn: async ({ generationIds, tagId }: { generationIds: string[], tagId: string }) =>
      apiRequest('POST', '/api/generations/bulk/add-tag', { generationIds, tagId }),
    onSuccess: () => {
      invalidateGenerations();
      setTagPopoverOpen(false);
      toast({ title: 'Success', description: 'Tag added to selected items' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to add tag', variant: 'destructive' });
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

  const allVisibleSelected = filteredGenerations.length > 0 && 
    filteredGenerations.every(g => selectedIds.has(g.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredGenerations.map(g => g.id)));
    }
  };

  const getViewLabel = () => {
    if (activeView === 'all') return 'All Files';
    if (activeView === 'favorites') return 'Favorites';
    if (activeView === 'recent') return 'Recent';
    if (activeView === 'archived') return 'Archived';
    const collection = collections.find(c => c.id === activeView);
    return collection?.name || 'Files';
  };

  const openDetailPanel = (generation: Generation) => {
    setSelectedGeneration(generation);
    setDetailPanelOpen(true);
    setCurrentImageIndex(0);
  };

  const closeDetailPanel = () => {
    setDetailPanelOpen(false);
    setSelectedGeneration(null);
    setCurrentImageIndex(0);
  };

  const handleDetailDownload = async () => {
    if (!selectedGeneration?.resultUrl) return;
    
    try {
      const response = await fetchWithAuthBridge(`/api/generations/${selectedGeneration.id}/download`, {
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `artivio-${selectedGeneration.type}-${selectedGeneration.id}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Download started", description: "Your file is being downloaded" });
    } catch (error) {
      toast({ title: "Download failed", description: "Could not download the file", variant: "destructive" });
    }
  };

  const handleCopySeed = () => {
    if (!selectedGeneration?.seed) return;
    navigator.clipboard.writeText(selectedGeneration.seed.toString());
    toast({ title: "Copied", description: "Seed copied to clipboard" });
  };

  const handleRegenerate = () => {
    if (!selectedGeneration) return;
    const typeRoutes: Record<string, string> = {
      video: '/generate/video',
      image: '/generate/image',
      music: '/generate/music',
    };
    const route = typeRoutes[selectedGeneration.type];
    if (route) {
      sessionStorage.setItem('regeneratePrompt', selectedGeneration.prompt);
      sessionStorage.setItem('regenerateModel', selectedGeneration.model);
      if (selectedGeneration.seed) {
        sessionStorage.setItem('regenerateSeed', selectedGeneration.seed.toString());
      }
      setLocation(route);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-5 w-5" />;
      case 'image': return <ImageIcon className="h-5 w-5" />;
      case 'music': return <Music className="h-5 w-5" />;
      default: return <Sparkles className="h-5 w-5" />;
    }
  };

  const statusColors = {
    pending: "secondary",
    processing: "default",
    completed: "default",
    failed: "destructive",
  } as const;

  const getSelectedCollection = () => {
    if (!selectedGeneration?.collectionId) return null;
    return collections.find(c => c.id === selectedGeneration.collectionId);
  };

  const handleBulkFavorite = () => {
    const ids = Array.from(selectedIds);
    bulkFavoriteMutation.mutate({ generationIds: ids, isFavorite: true });
  };

  const handleBulkArchive = () => {
    const ids = Array.from(selectedIds);
    const archive = activeView !== 'archived';
    bulkArchiveMutation.mutate({ generationIds: ids, archive });
  };

  const handleBulkMove = (collectionId: string | null) => {
    const ids = Array.from(selectedIds);
    bulkMoveMutation.mutate({ generationIds: ids, collectionId });
  };

  const handleBulkAddTag = (tagId: string) => {
    const ids = Array.from(selectedIds);
    bulkAddTagMutation.mutate({ generationIds: ids, tagId });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    bulkDeleteMutation.mutate(ids);
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
                    {selectionMode && selectedIds.size > 0 
                      ? `${selectedIds.size} of ${filteredGenerations.length} selected`
                      : `${filteredGenerations.length} item${filteredGenerations.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectionMode ? (
                  <>
                    <div className="flex items-center gap-2 mr-2">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                      <span className="text-sm text-muted-foreground">Select All</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exitSelectionMode}
                      data-testid="button-cancel-selection"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
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

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectionMode(true)}
                      disabled={filteredGenerations.length === 0}
                      data-testid="button-select-mode"
                    >
                      <CheckSquare className="h-4 w-4 mr-1" />
                      Select
                    </Button>
                  </>
                )}
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
                  <SelectableCardWrapper
                    key={generation.id}
                    generation={generation}
                    isSelectionMode={selectionMode}
                    isSelected={selectedIds.has(generation.id)}
                    onToggleSelect={toggleSelect}
                    onOpenDetail={openDetailPanel}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGenerations.map((generation) => (
                  <GenerationListItem
                    key={generation.id}
                    generation={generation}
                    isSelectionMode={selectionMode}
                    isSelected={selectedIds.has(generation.id)}
                    onToggleSelect={toggleSelect}
                    onOpenDetail={openDetailPanel}
                  />
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

            {selectedIds.size > 0 && <div className="h-24" />}
          </ScrollArea>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div 
          className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border shadow-lg rounded-lg p-3 flex items-center gap-3 z-50 animate-in slide-in-from-bottom-4 duration-200"
          data-testid="bulk-action-bar"
        >
          <span className="text-sm font-medium whitespace-nowrap" data-testid="text-selected-count">
            {selectedIds.size} selected
          </span>

          <Separator orientation="vertical" className="h-6" />

          <Popover open={movePopoverOpen} onOpenChange={setMovePopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={bulkMoveMutation.isPending}
                data-testid="button-bulk-move"
              >
                <FolderInput className="h-4 w-4 mr-1" />
                Move
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="center">
              <div className="space-y-2">
                <p className="text-sm font-medium">Move to collection</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleBulkMove(null)}
                  data-testid="button-move-none"
                >
                  <X className="h-4 w-4 mr-2" />
                  No collection
                </Button>
                {collections.map((collection) => (
                  <Button
                    key={collection.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleBulkMove(collection.id)}
                    data-testid={`button-move-${collection.id}`}
                  >
                    <Folder 
                      className="h-4 w-4 mr-2" 
                      style={{ color: collection.color || '#6366F1' }} 
                    />
                    {collection.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={bulkAddTagMutation.isPending}
                data-testid="button-bulk-tag"
              >
                <Tag className="h-4 w-4 mr-1" />
                Tag
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="center">
              <div className="space-y-2">
                <p className="text-sm font-medium">Add tag</p>
                {tags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tags available</p>
                ) : (
                  tags.map((tag) => (
                    <Button
                      key={tag.id}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleBulkAddTag(tag.id)}
                      data-testid={`button-tag-${tag.id}`}
                    >
                      <div 
                        className="h-3 w-3 rounded-full mr-2" 
                        style={{ backgroundColor: tag.color }} 
                      />
                      {tag.name}
                    </Button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkFavorite}
            disabled={bulkFavoriteMutation.isPending}
            data-testid="button-bulk-favorite"
          >
            <Heart className="h-4 w-4 mr-1" />
            Favorite
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleBulkArchive}
            disabled={bulkArchiveMutation.isPending}
            data-testid="button-bulk-archive"
          >
            <Archive className="h-4 w-4 mr-1" />
            {activeView === 'archived' ? 'Restore' : 'Archive'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBulkDeleteDialog(true)}
            disabled={bulkDeleteMutation.isPending}
            className="text-destructive hover:text-destructive"
            data-testid="button-bulk-delete"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            data-testid="button-clear-selection"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} items?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected generations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <Sheet open={detailPanelOpen} onOpenChange={(open) => !open && closeDetailPanel()}>
        <SheetContent 
          side="right" 
          className={cn(
            "w-full sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col",
            isMobile && "w-full max-w-full"
          )}
          data-testid="detail-panel"
        >
          {selectedGeneration && (
            <>
              <SheetHeader className="p-4 border-b shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 p-2 rounded-md bg-muted">
                      {getTypeIcon(selectedGeneration.type)}
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-base truncate" data-testid="detail-title">
                        {selectedGeneration.type.charAt(0).toUpperCase() + selectedGeneration.type.slice(1)} Generation
                      </SheetTitle>
                      <Badge 
                        variant={statusColors[selectedGeneration.status as keyof typeof statusColors]}
                        className="mt-1"
                        data-testid="detail-status-badge"
                      >
                        {selectedGeneration.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                  <div className="rounded-lg overflow-hidden bg-muted aspect-video relative" data-testid="detail-preview">
                    {selectedGeneration.type === 'video' && selectedGeneration.resultUrl ? (
                      <video 
                        src={selectedGeneration.resultUrl} 
                        controls 
                        className="w-full h-full object-contain"
                        data-testid="detail-video-player"
                      />
                    ) : selectedGeneration.type === 'image' ? (
                      selectedGeneration.resultUrls && selectedGeneration.resultUrls.length > 1 ? (
                        <div className="relative w-full h-full">
                          <img 
                            src={selectedGeneration.resultUrls[currentImageIndex]} 
                            alt={`Image ${currentImageIndex + 1}`}
                            className="w-full h-full object-contain"
                            data-testid="detail-image"
                          />
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-white"
                              onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : selectedGeneration.resultUrls!.length - 1)}
                              data-testid="button-prev-image"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-white text-xs" data-testid="text-image-counter">
                              {currentImageIndex + 1} / {selectedGeneration.resultUrls.length}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-white"
                              onClick={() => setCurrentImageIndex(prev => prev < selectedGeneration.resultUrls!.length - 1 ? prev + 1 : 0)}
                              data-testid="button-next-image"
                            >
                              <ChevronRightIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : selectedGeneration.resultUrl ? (
                        <img 
                          src={selectedGeneration.resultUrl} 
                          alt="Generated image"
                          className="w-full h-full object-contain"
                          data-testid="detail-image"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-12 w-12" />
                        </div>
                      )
                    ) : selectedGeneration.type === 'music' && selectedGeneration.resultUrl ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-4">
                        <Music className="h-16 w-16 text-muted-foreground" />
                        <audio 
                          src={selectedGeneration.resultUrl} 
                          controls 
                          className="w-full"
                          data-testid="detail-audio-player"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {getTypeIcon(selectedGeneration.type)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Prompt</Label>
                      <ScrollArea className="max-h-32 mt-1">
                        <p className="text-sm" data-testid="detail-prompt">{selectedGeneration.prompt}</p>
                      </ScrollArea>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Model</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm" data-testid="detail-model">{selectedGeneration.model}</span>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Created</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-2 mt-1 cursor-help">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm" data-testid="detail-created">
                                {formatDistanceToNow(new Date(selectedGeneration.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {new Date(selectedGeneration.createdAt).toLocaleString()}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status</Label>
                        <div className="mt-1">
                          <Badge 
                            variant={statusColors[selectedGeneration.status as keyof typeof statusColors]}
                            data-testid="detail-status"
                          >
                            {selectedGeneration.status}
                          </Badge>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Credits</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Coins className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm" data-testid="detail-credits">{selectedGeneration.creditsCost}</span>
                        </div>
                      </div>

                      {selectedGeneration.seed && (
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Seed</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-mono" data-testid="detail-seed">{selectedGeneration.seed}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={handleCopySeed}
                              data-testid="button-copy-seed"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tags</Label>
                        <Popover open={detailTagPopoverOpen} onOpenChange={setDetailTagPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 text-xs"
                              data-testid="button-add-tag"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Tag
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56" align="end">
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Add tag</p>
                              {tags.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No tags available</p>
                              ) : (
                                tags
                                  .filter(tag => !generationTags.some(gt => gt.id === tag.id))
                                  .map((tag) => (
                                    <Button
                                      key={tag.id}
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start"
                                      onClick={() => addTagMutation.mutate({ 
                                        generationId: selectedGeneration.id, 
                                        tagId: tag.id 
                                      })}
                                      disabled={addTagMutation.isPending}
                                      data-testid={`button-add-tag-${tag.id}`}
                                    >
                                      <div 
                                        className="h-3 w-3 rounded-full mr-2" 
                                        style={{ backgroundColor: tag.color }} 
                                      />
                                      {tag.name}
                                    </Button>
                                  ))
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex flex-wrap gap-2" data-testid="detail-tags">
                        {generationTagsLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : generationTags.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No tags</span>
                        ) : (
                          generationTags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              className="cursor-pointer"
                              style={{ backgroundColor: `${tag.color}20`, borderColor: tag.color }}
                              onClick={() => setShowRemoveTagConfirm(tag.id)}
                              data-testid={`tag-${tag.id}`}
                            >
                              <div 
                                className="h-2 w-2 rounded-full mr-1" 
                                style={{ backgroundColor: tag.color }} 
                              />
                              {tag.name}
                              <X className="h-3 w-3 ml-1" />
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Collection</Label>
                      <Popover open={detailMovePopoverOpen} onOpenChange={setDetailMovePopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-between mt-1"
                            data-testid="button-change-collection"
                          >
                            <div className="flex items-center gap-2">
                              {getSelectedCollection() ? (
                                <>
                                  <Folder 
                                    className="h-4 w-4" 
                                    style={{ color: getSelectedCollection()?.color || '#6366F1' }} 
                                  />
                                  {getSelectedCollection()?.name}
                                </>
                              ) : (
                                <>
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">No collection</span>
                                </>
                              )}
                            </div>
                            <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56" align="start">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Move to collection</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => moveToCollectionMutation.mutate({ 
                                generationId: selectedGeneration.id, 
                                collectionId: null 
                              })}
                              disabled={moveToCollectionMutation.isPending}
                              data-testid="button-move-to-none"
                            >
                              <X className="h-4 w-4 mr-2" />
                              No collection
                            </Button>
                            {collections.map((collection) => (
                              <Button
                                key={collection.id}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => moveToCollectionMutation.mutate({ 
                                  generationId: selectedGeneration.id, 
                                  collectionId: collection.id 
                                })}
                                disabled={moveToCollectionMutation.isPending}
                                data-testid={`button-move-to-${collection.id}`}
                              >
                                <Folder 
                                  className="h-4 w-4 mr-2" 
                                  style={{ color: collection.color || '#6366F1' }} 
                                />
                                {collection.name}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Actions</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedGeneration.status === 'completed' && selectedGeneration.resultUrl && (
                          <Button
                            variant="outline"
                            onClick={handleDetailDownload}
                            data-testid="button-detail-download"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}

                        {selectedGeneration.status === 'completed' && (
                          <Button
                            variant={selectedGeneration.isShowcase ? "default" : "outline"}
                            onClick={() => showcaseMutation.mutate({ 
                              generationId: selectedGeneration.id, 
                              isShowcase: !selectedGeneration.isShowcase 
                            })}
                            disabled={showcaseMutation.isPending}
                            data-testid="button-detail-showcase"
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            {selectedGeneration.isShowcase ? 'Showcased' : 'Showcase'}
                          </Button>
                        )}

                        <Button
                          variant={selectedGeneration.isFavorite ? "default" : "outline"}
                          onClick={() => favoriteMutation.mutate({ 
                            generationId: selectedGeneration.id, 
                            isFavorite: !selectedGeneration.isFavorite 
                          })}
                          disabled={favoriteMutation.isPending}
                          data-testid="button-detail-favorite"
                        >
                          <Heart className={cn("h-4 w-4 mr-2", selectedGeneration.isFavorite && "fill-current")} />
                          {selectedGeneration.isFavorite ? 'Favorited' : 'Favorite'}
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => archiveMutation.mutate({ 
                            generationId: selectedGeneration.id, 
                            archive: !selectedGeneration.archivedAt 
                          })}
                          disabled={archiveMutation.isPending}
                          data-testid="button-detail-archive"
                        >
                          <Archive className="h-4 w-4 mr-2" />
                          {selectedGeneration.archivedAt ? 'Restore' : 'Archive'}
                        </Button>

                        {['video', 'image', 'music'].includes(selectedGeneration.type) && (
                          <Button
                            variant="outline"
                            onClick={handleRegenerate}
                            data-testid="button-detail-regenerate"
                          >
                            <RotateCw className="h-4 w-4 mr-2" />
                            Regenerate
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setShowDeleteConfirm(true)}
                          data-testid="button-detail-delete"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this generation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this generation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-detail-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedGeneration && deleteMutation.mutate(selectedGeneration.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-detail-delete"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!showRemoveTagConfirm} onOpenChange={(open) => !open && setShowRemoveTagConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this tag?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the tag from this generation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove-tag">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showRemoveTagConfirm && selectedGeneration && removeTagMutation.mutate({ 
                generationId: selectedGeneration.id, 
                tagId: showRemoveTagConfirm 
              })}
              data-testid="button-confirm-remove-tag"
            >
              {removeTagMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarInset>
  );
}
