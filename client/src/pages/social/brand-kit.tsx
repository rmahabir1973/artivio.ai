import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Globe,
  Palette,
  Image,
  FileText,
  Users,
  MessageSquare,
  Settings,
  Plus,
  Trash2,
  Upload,
  Link as LinkIcon,
  Sparkles,
  ScanSearch,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  Target,
  Megaphone,
  Pencil,
  X,
  ExternalLink,
  Calendar,
  Wand2,
  Check,
  FolderOpen,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/authBridge";
import { SocialUpgradePrompt } from "@/components/social-upgrade-prompt";
import { usePricing } from "@/hooks/use-pricing";
import type { SocialBrandKit, SocialBrandMaterial, SocialBrandAsset } from "@shared/schema";

interface SubscriptionStatus {
  hasSocialPoster: boolean;
  status?: string;
}

const TONE_OPTIONS = [
  "Professional", "Casual", "Friendly", "Authoritative", "Playful", 
  "Inspirational", "Educational", "Conversational", "Bold", "Empathetic"
];

const EMOTION_OPTIONS = [
  "Trust", "Excitement", "Joy", "Confidence", "Curiosity",
  "Comfort", "Urgency", "Pride", "Hope", "Satisfaction"
];

const CHARACTER_OPTIONS = [
  "Expert", "Guide", "Friend", "Mentor", "Innovator",
  "Champion", "Visionary", "Helper", "Storyteller", "Leader"
];

const SYNTAX_OPTIONS = [
  "Short sentences", "Long-form", "Questions", "Lists", "Story-driven",
  "Data-focused", "Metaphors", "Direct", "Descriptive", "Conversational"
];

const LANGUAGE_OPTIONS = [
  "Technical jargon OK", "Simple language", "Industry-specific terms",
  "Formal", "Informal", "Inclusive", "Energetic", "Calm"
];

const MEDIA_TYPES = [
  { id: "text", label: "Text Posts" },
  { id: "image", label: "Images" },
  { id: "video", label: "Videos" },
];

export default function SocialBrandKit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("materials");
  const [isAddUrlDialogOpen, setIsAddUrlDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newUrlName, setNewUrlName] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);

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

  const { data: brandKit, isLoading: brandKitLoading, refetch: refetchBrandKit } = useQuery<SocialBrandKit>({
    queryKey: ["/api/social/brand-kit"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/brand-kit");
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error("Failed to fetch brand kit");
      }
      return response.json();
    },
    enabled: !!user && subscriptionStatus?.hasSocialPoster,
  });

  const { data: materials = [], isLoading: materialsLoading } = useQuery<SocialBrandMaterial[]>({
    queryKey: ["/api/social/brand-kit/materials"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/brand-kit/materials");
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: !!user && subscriptionStatus?.hasSocialPoster && !!brandKit,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery<SocialBrandAsset[]>({
    queryKey: ["/api/social/brand-kit/assets"],
    queryFn: async () => {
      const response = await fetchWithAuth("/api/social/brand-kit/assets");
      if (!response.ok) {
        return [];
      }
      return response.json();
    },
    enabled: !!user && subscriptionStatus?.hasSocialPoster && !!brandKit,
  });

  const createBrandKitMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth("/api/social/brand-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Brand" }),
      });
      if (!response.ok) throw new Error("Failed to create brand kit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit"] });
      toast({ title: "Brand Kit created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create Brand Kit", variant: "destructive" });
    },
  });

  const updateBrandKitMutation = useMutation({
    mutationFn: async (data: Partial<SocialBrandKit>) => {
      const response = await fetchWithAuth("/api/social/brand-kit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update brand kit");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit"] });
      setEditingSection(null);
      toast({ title: "Brand Kit updated!" });
    },
    onError: () => {
      toast({ title: "Failed to update Brand Kit", variant: "destructive" });
    },
  });

  const addMaterialMutation = useMutation({
    mutationFn: async (data: { name: string; url: string }) => {
      const response = await fetchWithAuth("/api/social/brand-kit/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, type: "website", fileType: "website" }),
      });
      if (!response.ok) throw new Error("Failed to add material");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit/materials"] });
      setIsAddUrlDialogOpen(false);
      setNewUrl("");
      setNewUrlName("");
      toast({ title: "Website URL added!" });
    },
    onError: () => {
      toast({ title: "Failed to add URL", variant: "destructive" });
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithAuth(`/api/social/brand-kit/materials/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete material");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit/materials"] });
      toast({ title: "Material removed!" });
    },
    onError: () => {
      toast({ title: "Failed to remove material", variant: "destructive" });
    },
  });

  const scanWebsiteMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetchWithAuth("/api/social/brand-kit/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error("Failed to scan website");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit"] });
      toast({ title: "Website scan started! Results will appear shortly." });
    },
    onError: () => {
      toast({ title: "Failed to scan website", variant: "destructive" });
    },
  });

  const analyzeWithAIMutation = useMutation({
    mutationFn: async () => {
      const response = await fetchWithAuth("/api/social/brand-kit/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to analyze brand");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit"] });
      toast({ title: "AI analysis complete! Your brand profile has been updated." });
    },
    onError: () => {
      toast({ title: "AI analysis failed. Please try again.", variant: "destructive" });
    },
  });

  if (statusLoading || brandKitLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
          <div className="grid gap-4 md:grid-cols-3 mt-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!subscriptionStatus?.hasSocialPoster) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <SocialUpgradePrompt />
      </div>
    );
  }

  if (!brandKit) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="text-center py-12">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Palette className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Create Your Brand Kit</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Set up your brand identity to help AI create consistent, on-brand content for all your social media posts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              size="lg" 
              onClick={() => createBrandKitMutation.mutate()}
              disabled={createBrandKitMutation.isPending}
              data-testid="button-create-brand-kit"
            >
              {createBrandKitMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Brand Kit
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const completionScore = calculateCompletionScore(brandKit);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-brand-kit-title">Brand Kit</h1>
          <p className="text-muted-foreground">
            Define your brand identity for consistent AI-generated content
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            onClick={() => analyzeWithAIMutation.mutate()}
            disabled={analyzeWithAIMutation.isPending}
            variant="outline"
            data-testid="button-ai-analyze"
          >
            {analyzeWithAIMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            AI Analyze
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Profile Completion</p>
              <p className="font-semibold">{completionScore}%</p>
            </div>
            <Progress value={completionScore} className="w-24" />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="materials" className="gap-2" data-testid="tab-materials">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Source Materials</span>
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2" data-testid="tab-assets">
            <Image className="w-4 h-4" />
            <span className="hidden sm:inline">Images & Video</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2" data-testid="tab-profile">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Brand Profile</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2" data-testid="tab-voice">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Styles & Voice</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2" data-testid="tab-preferences">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Content Prefs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="space-y-6">
          <SourceMaterialsTab
            materials={materials}
            isLoading={materialsLoading}
            isAddUrlDialogOpen={isAddUrlDialogOpen}
            setIsAddUrlDialogOpen={setIsAddUrlDialogOpen}
            newUrl={newUrl}
            setNewUrl={setNewUrl}
            newUrlName={newUrlName}
            setNewUrlName={setNewUrlName}
            addMaterialMutation={addMaterialMutation}
            deleteMaterialMutation={deleteMaterialMutation}
            scanWebsiteMutation={scanWebsiteMutation}
            brandKit={brandKit}
          />
        </TabsContent>

        <TabsContent value="assets" className="space-y-6">
          <AssetsTab assets={assets} isLoading={assetsLoading} />
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <BrandProfileTab
            brandKit={brandKit}
            updateBrandKitMutation={updateBrandKitMutation}
            editingSection={editingSection}
            setEditingSection={setEditingSection}
          />
        </TabsContent>

        <TabsContent value="voice" className="space-y-6">
          <StylesVoiceTab
            brandKit={brandKit}
            updateBrandKitMutation={updateBrandKitMutation}
            editingSection={editingSection}
            setEditingSection={setEditingSection}
          />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <ContentPreferencesTab
            brandKit={brandKit}
            updateBrandKitMutation={updateBrandKitMutation}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function calculateCompletionScore(brandKit: SocialBrandKit): number {
  let score = 0;
  const checks = [
    brandKit.businessOverview?.coreIdentity,
    brandKit.businessOverview?.primaryPositioning,
    brandKit.competitors?.local?.length || brandKit.competitors?.national?.length,
    brandKit.customerDemographics?.primarySegments?.length,
    brandKit.logos?.original,
    brandKit.colors?.length,
    brandKit.brandVoice?.tone?.length,
    brandKit.contentPreferences?.featuredMediaTypes?.length,
  ];
  
  checks.forEach((check) => {
    if (check) score += 12.5;
  });
  
  return Math.round(score);
}

function SourceMaterialsTab({
  materials,
  isLoading,
  isAddUrlDialogOpen,
  setIsAddUrlDialogOpen,
  newUrl,
  setNewUrl,
  newUrlName,
  setNewUrlName,
  addMaterialMutation,
  deleteMaterialMutation,
  scanWebsiteMutation,
  brandKit,
}: any) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Website URLs
            </CardTitle>
            <CardDescription>
              Add your website URLs so we can learn about your brand
            </CardDescription>
          </div>
          <Dialog open={isAddUrlDialogOpen} onOpenChange={setIsAddUrlDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-url">
                <Plus className="w-4 h-4 mr-2" />
                Add URL
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Website URL</DialogTitle>
                <DialogDescription>
                  Add a website URL to help us understand your brand better
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url-name">Name</Label>
                  <Input
                    id="url-name"
                    placeholder="e.g., Main Website, About Page"
                    value={newUrlName}
                    onChange={(e) => setNewUrlName(e.target.value)}
                    data-testid="input-url-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    data-testid="input-url"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddUrlDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => addMaterialMutation.mutate({ name: newUrlName, url: newUrl })}
                  disabled={!newUrl || !newUrlName || addMaterialMutation.isPending}
                  data-testid="button-save-url"
                >
                  {addMaterialMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Add URL
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No website URLs added yet</p>
              <p className="text-sm">Add your website to help AI understand your brand</p>
            </div>
          ) : (
            <div className="space-y-3">
              {materials.map((material: SocialBrandMaterial) => (
                <div
                  key={material.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`material-item-${material.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <LinkIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{material.name}</p>
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        {material.url}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => scanWebsiteMutation.mutate(material.url)}
                      disabled={scanWebsiteMutation.isPending}
                      data-testid={`button-scan-${material.id}`}
                    >
                      {scanWebsiteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ScanSearch className="w-4 h-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Scan</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMaterialMutation.mutate(material.id)}
                      disabled={deleteMaterialMutation.isPending}
                      data-testid={`button-delete-${material.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {brandKit?.scanStatus === 'scanning' && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Scanning website...</p>
                <p className="text-sm text-muted-foreground">
                  Extracting colors, images, and content from your website
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {brandKit?.scanStatus === 'completed' && brandKit?.lastScanAt && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="font-medium">Last scan completed</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(brandKit.lastScanAt).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AssetsTab({ assets, isLoading }: { assets: SocialBrandAsset[]; isLoading: boolean }) {
  const { toast } = useToast();

  const suggestedAssets = assets.filter((a) => a.isSuggested === true);
  const libraryAssets = assets.filter((a) => a.isSuggested !== true);

  const groupByFolder = (assetList: SocialBrandAsset[]) => {
    const grouped: Record<string, SocialBrandAsset[]> = {};
    assetList.forEach((asset) => {
      const folder = asset.folder || "Uncategorized";
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(asset);
    });
    return grouped;
  };

  const suggestedByFolder = groupByFolder(suggestedAssets);
  const libraryByFolder = groupByFolder(libraryAssets);

  const acceptAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await fetchWithAuth(`/api/social/brand-kit/assets/${assetId}/accept`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to accept asset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit/assets"] });
      toast({ title: "Asset added to your library!" });
    },
    onError: () => {
      toast({ title: "Failed to accept asset", variant: "destructive" });
    },
  });

  const dismissAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await fetchWithAuth(`/api/social/brand-kit/assets/${assetId}/dismiss`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to dismiss asset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit/assets"] });
      toast({ title: "Asset dismissed" });
    },
    onError: () => {
      toast({ title: "Failed to dismiss asset", variant: "destructive" });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await fetchWithAuth(`/api/social/brand-kit/assets/${assetId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete asset");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/brand-kit/assets"] });
      toast({ title: "Asset deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete asset", variant: "destructive" });
    },
  });

  const renderAssetGrid = (
    assetList: SocialBrandAsset[],
    isSuggested: boolean
  ) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {assetList.map((asset) => (
        <div
          key={asset.id}
          className="relative group aspect-square rounded-lg overflow-hidden border"
          data-testid={`asset-item-${asset.id}`}
        >
          {isSuggested && asset.sourceUrl ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <img
                  src={asset.thumbnailUrl || asset.url}
                  alt={asset.filename}
                  className="w-full h-full object-cover cursor-help"
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs break-all">Found at: {asset.sourceUrl}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <img
              src={asset.thumbnailUrl || asset.url}
              alt={asset.filename}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            {isSuggested ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => acceptAssetMutation.mutate(asset.id)}
                      disabled={acceptAssetMutation.isPending}
                      data-testid={`button-accept-asset-${asset.id}`}
                    >
                      {acceptAssetMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept to library</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => dismissAssetMutation.mutate(asset.id)}
                      disabled={dismissAssetMutation.isPending}
                      data-testid={`button-dismiss-asset-${asset.id}`}
                    >
                      {dismissAssetMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Dismiss</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => deleteAssetMutation.mutate(asset.id)}
                    disabled={deleteAssetMutation.isPending}
                    data-testid={`button-delete-asset-${asset.id}`}
                  >
                    {deleteAssetMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            )}
          </div>
          {asset.folder && (
            <Badge
              className="absolute top-2 left-2"
              variant="outline"
            >
              <FolderOpen className="w-3 h-3 mr-1" />
              <span className="truncate max-w-[80px]">{asset.folder}</span>
            </Badge>
          )}
          {!isSuggested && (
            <Badge
              className="absolute bottom-2 left-2"
              variant={asset.usageStatus === 'used' ? 'default' : 'secondary'}
            >
              {asset.usageStatus === 'used' ? 'Used' : 'Unused'}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );

  const renderFolderGroup = (
    groupedAssets: Record<string, SocialBrandAsset[]>,
    isSuggested: boolean
  ) => {
    const folderNames = Object.keys(groupedAssets);
    if (folderNames.length === 1) {
      return renderAssetGrid(groupedAssets[folderNames[0]], isSuggested);
    }
    return (
      <div className="space-y-6">
        {folderNames.map((folder) => (
          <div key={folder}>
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{folder}</span>
              <Badge variant="secondary" className="text-xs">
                {groupedAssets[folder].length}
              </Badge>
            </div>
            {renderAssetGrid(groupedAssets[folder], isSuggested)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {suggestedAssets.length > 0 && (
        <Card data-testid="section-suggested-assets">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Suggested Assets
                <Badge variant="secondary">{suggestedAssets.length}</Badge>
              </CardTitle>
              <CardDescription>
                Assets discovered from your website scans. Accept to add to your library or dismiss.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : (
              renderFolderGroup(suggestedByFolder, true)
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="section-library-assets">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Your Library
              {libraryAssets.length > 0 && (
                <Badge variant="secondary">{libraryAssets.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Your approved brand assets for content creation
            </CardDescription>
          </div>
          <Button data-testid="button-upload-asset">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : libraryAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No assets in your library yet</p>
              <p className="text-sm">
                {suggestedAssets.length > 0
                  ? "Accept suggested assets above or upload your own"
                  : "Scan your website to discover assets or upload your own"}
              </p>
              <Button variant="outline" className="mt-4" data-testid="button-upload-first-asset">
                <Upload className="w-4 h-4 mr-2" />
                Upload Your First Asset
              </Button>
            </div>
          ) : (
            renderFolderGroup(libraryByFolder, false)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BrandProfileTab({ brandKit, updateBrandKitMutation, editingSection, setEditingSection }: any) {
  const [formData, setFormData] = useState({
    coreIdentity: brandKit?.businessOverview?.coreIdentity || "",
    primaryPositioning: brandKit?.businessOverview?.primaryPositioning || "",
    secondaryPositioning: brandKit?.businessOverview?.secondaryPositioning || "",
    tertiaryPositioning: brandKit?.businessOverview?.tertiaryPositioning || "",
    competitiveAdvantages: brandKit?.businessOverview?.competitiveAdvantages?.join("\n") || "",
    localCompetitors: brandKit?.competitors?.local?.join("\n") || "",
    nationalCompetitors: brandKit?.competitors?.national?.join("\n") || "",
    primarySegments: brandKit?.customerDemographics?.primarySegments?.join("\n") || "",
    ageRange: brandKit?.customerDemographics?.ageRange || "",
    location: brandKit?.customerDemographics?.location || "",
    interests: brandKit?.customerDemographics?.interests?.join("\n") || "",
    painPoints: brandKit?.customerDemographics?.painPoints?.join("\n") || "",
    goals: brandKit?.customerDemographics?.goals?.join("\n") || "",
  });

  const handleSaveSection = (section: string) => {
    let data: any = {};
    
    if (section === "overview") {
      data.businessOverview = {
        coreIdentity: formData.coreIdentity,
        primaryPositioning: formData.primaryPositioning,
        secondaryPositioning: formData.secondaryPositioning,
        tertiaryPositioning: formData.tertiaryPositioning,
        competitiveAdvantages: formData.competitiveAdvantages.split("\n").filter(Boolean),
      };
    } else if (section === "competitors") {
      data.competitors = {
        local: formData.localCompetitors.split("\n").filter(Boolean),
        national: formData.nationalCompetitors.split("\n").filter(Boolean),
      };
    } else if (section === "demographics") {
      data.customerDemographics = {
        primarySegments: formData.primarySegments.split("\n").filter(Boolean),
        ageRange: formData.ageRange,
        location: formData.location,
        interests: formData.interests.split("\n").filter(Boolean),
        painPoints: formData.painPoints.split("\n").filter(Boolean),
        goals: formData.goals.split("\n").filter(Boolean),
      };
    }
    
    updateBrandKitMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Business Overview
            </CardTitle>
            <CardDescription>
              Define your brand's core identity and market positioning
            </CardDescription>
          </div>
          {editingSection !== "overview" ? (
            <Button
              variant="outline"
              onClick={() => setEditingSection("overview")}
              data-testid="button-edit-overview"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveSection("overview")}
                disabled={updateBrandKitMutation.isPending}
                data-testid="button-save-overview"
              >
                {updateBrandKitMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Core Identity</Label>
            {editingSection === "overview" ? (
              <Textarea
                placeholder="Describe your business in 1-2 sentences..."
                value={formData.coreIdentity}
                onChange={(e) => setFormData({ ...formData, coreIdentity: e.target.value })}
                data-testid="input-core-identity"
              />
            ) : (
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                {brandKit?.businessOverview?.coreIdentity || "Not set"}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Primary Positioning</Label>
              {editingSection === "overview" ? (
                <Input
                  placeholder="Main market position"
                  value={formData.primaryPositioning}
                  onChange={(e) => setFormData({ ...formData, primaryPositioning: e.target.value })}
                  data-testid="input-primary-positioning"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {brandKit?.businessOverview?.primaryPositioning || "Not set"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Secondary Positioning</Label>
              {editingSection === "overview" ? (
                <Input
                  placeholder="Secondary market position"
                  value={formData.secondaryPositioning}
                  onChange={(e) => setFormData({ ...formData, secondaryPositioning: e.target.value })}
                  data-testid="input-secondary-positioning"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {brandKit?.businessOverview?.secondaryPositioning || "Not set"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tertiary Positioning</Label>
              {editingSection === "overview" ? (
                <Input
                  placeholder="Third market position"
                  value={formData.tertiaryPositioning}
                  onChange={(e) => setFormData({ ...formData, tertiaryPositioning: e.target.value })}
                  data-testid="input-tertiary-positioning"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {brandKit?.businessOverview?.tertiaryPositioning || "Not set"}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Competitive Advantages</Label>
            {editingSection === "overview" ? (
              <Textarea
                placeholder="One advantage per line..."
                value={formData.competitiveAdvantages}
                onChange={(e) => setFormData({ ...formData, competitiveAdvantages: e.target.value })}
                rows={4}
                data-testid="input-competitive-advantages"
              />
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.businessOverview?.competitiveAdvantages?.length ? (
                  brandKit.businessOverview.competitiveAdvantages.map((adv: string, i: number) => (
                    <Badge key={i} variant="secondary">{adv}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Competitors
            </CardTitle>
            <CardDescription>
              Identify your local and national competitors
            </CardDescription>
          </div>
          {editingSection !== "competitors" ? (
            <Button
              variant="outline"
              onClick={() => setEditingSection("competitors")}
              data-testid="button-edit-competitors"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveSection("competitors")}
                disabled={updateBrandKitMutation.isPending}
                data-testid="button-save-competitors"
              >
                {updateBrandKitMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Local Competitors</Label>
            {editingSection === "competitors" ? (
              <Textarea
                placeholder="One competitor per line..."
                value={formData.localCompetitors}
                onChange={(e) => setFormData({ ...formData, localCompetitors: e.target.value })}
                rows={4}
                data-testid="input-local-competitors"
              />
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg min-h-[60px]">
                {brandKit?.competitors?.local?.length ? (
                  brandKit.competitors.local.map((comp: string, i: number) => (
                    <Badge key={i} variant="outline">{comp}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>National Competitors</Label>
            {editingSection === "competitors" ? (
              <Textarea
                placeholder="One competitor per line..."
                value={formData.nationalCompetitors}
                onChange={(e) => setFormData({ ...formData, nationalCompetitors: e.target.value })}
                rows={4}
                data-testid="input-national-competitors"
              />
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg min-h-[60px]">
                {brandKit?.competitors?.national?.length ? (
                  brandKit.competitors.national.map((comp: string, i: number) => (
                    <Badge key={i} variant="outline">{comp}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Customer Demographics
            </CardTitle>
            <CardDescription>
              Define your target audience and their characteristics
            </CardDescription>
          </div>
          {editingSection !== "demographics" ? (
            <Button
              variant="outline"
              onClick={() => setEditingSection("demographics")}
              data-testid="button-edit-demographics"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveSection("demographics")}
                disabled={updateBrandKitMutation.isPending}
                data-testid="button-save-demographics"
              >
                {updateBrandKitMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Primary Segments</Label>
              {editingSection === "demographics" ? (
                <Textarea
                  placeholder="One segment per line..."
                  value={formData.primarySegments}
                  onChange={(e) => setFormData({ ...formData, primarySegments: e.target.value })}
                  rows={3}
                  data-testid="input-primary-segments"
                />
              ) : (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg min-h-[60px]">
                  {brandKit?.customerDemographics?.primarySegments?.length ? (
                    brandKit.customerDemographics.primarySegments.map((seg: string, i: number) => (
                      <Badge key={i} variant="secondary">{seg}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Not set</span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Age Range</Label>
              {editingSection === "demographics" ? (
                <Input
                  placeholder="e.g., 25-45"
                  value={formData.ageRange}
                  onChange={(e) => setFormData({ ...formData, ageRange: e.target.value })}
                  data-testid="input-age-range"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {brandKit?.customerDemographics?.ageRange || "Not set"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              {editingSection === "demographics" ? (
                <Input
                  placeholder="e.g., United States"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  data-testid="input-location"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {brandKit?.customerDemographics?.location || "Not set"}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Interests</Label>
              {editingSection === "demographics" ? (
                <Textarea
                  placeholder="One interest per line..."
                  value={formData.interests}
                  onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
                  rows={3}
                  data-testid="input-interests"
                />
              ) : (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg min-h-[60px]">
                  {brandKit?.customerDemographics?.interests?.length ? (
                    brandKit.customerDemographics.interests.map((int: string, i: number) => (
                      <Badge key={i} variant="outline">{int}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Not set</span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Pain Points</Label>
              {editingSection === "demographics" ? (
                <Textarea
                  placeholder="One pain point per line..."
                  value={formData.painPoints}
                  onChange={(e) => setFormData({ ...formData, painPoints: e.target.value })}
                  rows={3}
                  data-testid="input-pain-points"
                />
              ) : (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg min-h-[60px]">
                  {brandKit?.customerDemographics?.painPoints?.length ? (
                    brandKit.customerDemographics.painPoints.map((pain: string, i: number) => (
                      <Badge key={i} variant="outline">{pain}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Not set</span>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Goals</Label>
              {editingSection === "demographics" ? (
                <Textarea
                  placeholder="One goal per line..."
                  value={formData.goals}
                  onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  rows={3}
                  data-testid="input-goals"
                />
              ) : (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg min-h-[60px]">
                  {brandKit?.customerDemographics?.goals?.length ? (
                    brandKit.customerDemographics.goals.map((goal: string, i: number) => (
                      <Badge key={i} variant="outline">{goal}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Not set</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StylesVoiceTab({ brandKit, updateBrandKitMutation, editingSection, setEditingSection }: any) {
  const [formData, setFormData] = useState({
    visualIdentityDescription: brandKit?.visualIdentityDescription || "",
    colors: brandKit?.colors || [],
    fonts: brandKit?.fonts?.join("\n") || "",
    purpose: brandKit?.brandVoice?.purpose || "",
    audience: brandKit?.brandVoice?.audience || "",
    tone: brandKit?.brandVoice?.tone || [],
    emotions: brandKit?.brandVoice?.emotions || [],
    character: brandKit?.brandVoice?.character || [],
    syntax: brandKit?.brandVoice?.syntax || [],
    language: brandKit?.brandVoice?.language || [],
  });

  const [newColor, setNewColor] = useState("#3b82f6");

  const addColor = () => {
    if (newColor && !formData.colors.includes(newColor)) {
      setFormData({ ...formData, colors: [...formData.colors, newColor] });
    }
  };

  const removeColor = (color: string) => {
    setFormData({ ...formData, colors: formData.colors.filter((c: string) => c !== color) });
  };

  const toggleOption = (field: string, option: string) => {
    const currentList = formData[field as keyof typeof formData] as string[];
    if (currentList.includes(option)) {
      setFormData({ ...formData, [field]: currentList.filter((o) => o !== option) });
    } else {
      setFormData({ ...formData, [field]: [...currentList, option] });
    }
  };

  const handleSaveVisual = () => {
    updateBrandKitMutation.mutate({
      visualIdentityDescription: formData.visualIdentityDescription,
      colors: formData.colors,
      fonts: formData.fonts.split("\n").filter(Boolean),
    });
  };

  const handleSaveVoice = () => {
    updateBrandKitMutation.mutate({
      brandVoice: {
        purpose: formData.purpose,
        audience: formData.audience,
        tone: formData.tone,
        emotions: formData.emotions,
        character: formData.character,
        syntax: formData.syntax,
        language: formData.language,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Visual Identity
            </CardTitle>
            <CardDescription>
              Define your brand's visual style and colors
            </CardDescription>
          </div>
          {editingSection !== "visual" ? (
            <Button
              variant="outline"
              onClick={() => setEditingSection("visual")}
              data-testid="button-edit-visual"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveVisual}
                disabled={updateBrandKitMutation.isPending}
                data-testid="button-save-visual"
              >
                {updateBrandKitMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Visual Style Description</Label>
            {editingSection === "visual" ? (
              <Textarea
                placeholder="Describe your brand's visual style..."
                value={formData.visualIdentityDescription}
                onChange={(e) => setFormData({ ...formData, visualIdentityDescription: e.target.value })}
                data-testid="input-visual-description"
              />
            ) : (
              <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                {brandKit?.visualIdentityDescription || "Not set"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Brand Colors</Label>
            {editingSection === "visual" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-16 h-10 p-1"
                    data-testid="input-color-picker"
                  />
                  <Input
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                    data-testid="input-color-hex"
                  />
                  <Button onClick={addColor} data-testid="button-add-color">
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.colors.map((color: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1 border rounded-full"
                    >
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm">{color}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => removeColor(color)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.colors?.length ? (
                  brandKit.colors.map((color: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1 bg-background border rounded-full"
                    >
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm">{color}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No colors set</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Brand Fonts</Label>
            {editingSection === "visual" ? (
              <Textarea
                placeholder="One font per line (e.g., Inter, Roboto, Open Sans)..."
                value={formData.fonts}
                onChange={(e) => setFormData({ ...formData, fonts: e.target.value })}
                rows={3}
                data-testid="input-fonts"
              />
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.fonts?.length ? (
                  brandKit.fonts.map((font: string, i: number) => (
                    <Badge key={i} variant="secondary">{font}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No fonts set</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Brand Voice
            </CardTitle>
            <CardDescription>
              Define how your brand communicates
            </CardDescription>
          </div>
          {editingSection !== "voice" ? (
            <Button
              variant="outline"
              onClick={() => setEditingSection("voice")}
              data-testid="button-edit-voice"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveVoice}
                disabled={updateBrandKitMutation.isPending}
                data-testid="button-save-voice"
              >
                {updateBrandKitMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Purpose</Label>
              {editingSection === "voice" ? (
                <Textarea
                  placeholder="What is the purpose of your brand's communication?"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  data-testid="input-purpose"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {brandKit?.brandVoice?.purpose || "Not set"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              {editingSection === "voice" ? (
                <Textarea
                  placeholder="Who are you speaking to?"
                  value={formData.audience}
                  onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                  data-testid="input-audience"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
                  {brandKit?.brandVoice?.audience || "Not set"}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tone</Label>
            {editingSection === "voice" ? (
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((option) => (
                  <Badge
                    key={option}
                    variant={formData.tone.includes(option) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleOption("tone", option)}
                    data-testid={`badge-tone-${option.toLowerCase()}`}
                  >
                    {option}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.brandVoice?.tone?.length ? (
                  brandKit.brandVoice.tone.map((t: string, i: number) => (
                    <Badge key={i} variant="secondary">{t}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Emotions</Label>
            {editingSection === "voice" ? (
              <div className="flex flex-wrap gap-2">
                {EMOTION_OPTIONS.map((option) => (
                  <Badge
                    key={option}
                    variant={formData.emotions.includes(option) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleOption("emotions", option)}
                    data-testid={`badge-emotion-${option.toLowerCase()}`}
                  >
                    {option}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.brandVoice?.emotions?.length ? (
                  brandKit.brandVoice.emotions.map((e: string, i: number) => (
                    <Badge key={i} variant="secondary">{e}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Character</Label>
            {editingSection === "voice" ? (
              <div className="flex flex-wrap gap-2">
                {CHARACTER_OPTIONS.map((option) => (
                  <Badge
                    key={option}
                    variant={formData.character.includes(option) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleOption("character", option)}
                    data-testid={`badge-character-${option.toLowerCase()}`}
                  >
                    {option}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.brandVoice?.character?.length ? (
                  brandKit.brandVoice.character.map((c: string, i: number) => (
                    <Badge key={i} variant="secondary">{c}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Syntax</Label>
            {editingSection === "voice" ? (
              <div className="flex flex-wrap gap-2">
                {SYNTAX_OPTIONS.map((option) => (
                  <Badge
                    key={option}
                    variant={formData.syntax.includes(option) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleOption("syntax", option)}
                    data-testid={`badge-syntax-${option.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {option}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.brandVoice?.syntax?.length ? (
                  brandKit.brandVoice.syntax.map((s: string, i: number) => (
                    <Badge key={i} variant="secondary">{s}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Language Style</Label>
            {editingSection === "voice" ? (
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <Badge
                    key={option}
                    variant={formData.language.includes(option) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleOption("language", option)}
                    data-testid={`badge-language-${option.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {option}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                {brandKit?.brandVoice?.language?.length ? (
                  brandKit.brandVoice.language.map((l: string, i: number) => (
                    <Badge key={i} variant="secondary">{l}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Not set</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// AI Model options for content generation - IDs must match database pricing entries
// Labels are display names, all other data (costs, descriptions) comes from the pricing database
const VIDEO_MODELS = [
  { id: 'veo-3.1-fast', label: 'Veo 3.1 Fast' },
  { id: 'veo-3.1', label: 'Veo 3.1' },
  { id: 'seedance-1-lite-720p', label: 'Seedance Lite' },
  { id: 'seedance-1-pro-5s-720p', label: 'Seedance Pro' },
  { id: 'kling-2.5-turbo-1080p-5s', label: 'Kling 2.5 Turbo' },
  { id: 'wan-2.5-1080p', label: 'Wan 2.5' },
  { id: 'runway-gen3-alpha-turbo-5s', label: 'Runway Gen-3' },
  { id: 'sora-2-pro-480p-5s', label: 'Sora 2 Pro' },
];

const IMAGE_MODELS = [
  { id: 'seedream-4-1', label: 'Seedream 4.0' },
  { id: 'flux-kontext-pro', label: 'Flux Kontext' },
  { id: '4o-image-1', label: '4o Image API' },
  { id: 'nano-banana', label: 'Nano Banana' },
];

const MUSIC_MODELS = [
  { id: 'suno-v4', label: 'Suno V4' },
  { id: 'suno-v4.5', label: 'Suno V4.5' },
  { id: 'suno-v5', label: 'Suno V5' },
];

// Legacy ID mapping for backwards compatibility with previously saved brand kits
const LEGACY_MODEL_ID_MAP: Record<string, string> = {
  'veo_3_1_fast': 'veo-3.1-fast',
  'veo_3_1': 'veo-3.1',
  'seedance_lite': 'seedance-1-lite-720p',
  'seedance_pro': 'seedance-1-pro-5s-720p',
  'kling_2_5': 'kling-2.5-turbo-1080p-5s',
  'wan_2_5': 'wan-2.5-1080p',
  'runway_gen3': 'runway-gen3-alpha-turbo-5s',
  'sora_2_pro': 'sora-2-pro-480p-5s',
  'seedream_4': 'seedream-4-1',
  'flux_kontext': 'flux-kontext-pro',
  '4o_image': '4o-image-1',
  'nano_banana': 'nano-banana',
  'suno_v4': 'suno-v4',
  'suno_v4_5': 'suno-v4.5',
  'suno_v5': 'suno-v5',
};

// Helper to migrate legacy model IDs to new database IDs
const migrateModelId = (id: string | undefined, defaultId: string): string => {
  if (!id) return defaultId;
  return LEGACY_MODEL_ID_MAP[id] || id;
};

const AUTOMATION_LEVELS = [
  { id: 'manual', label: 'Manual Only', description: 'I create all content myself' },
  { id: 'ai_suggests', label: 'AI Suggests', description: 'AI proposes content, I approve everything' },
  { id: 'semi_auto', label: 'Semi-Automatic', description: 'AI creates some content automatically' },
  { id: 'full_auto', label: 'Full Automation', description: 'AI handles content creation' },
];

function ContentPreferencesTab({ brandKit, updateBrandKitMutation }: any) {
  // Use dynamic pricing from database - pricingMap for both costs and descriptions
  const { pricingMap, isLoading: pricingLoading } = usePricing();
  const { toast } = useToast();
  
  // Helper to get pricing info from database - returns null if not found
  const getPricingInfo = (modelId: string) => {
    if (pricingLoading) return null; // Still loading
    const entry = pricingMap.get(modelId);
    if (!entry) return null; // Model not found in pricing table
    return {
      cost: entry.creditCost,
      description: entry.description || 'No description available',
      exists: true,
    };
  };
  
  // Check if a model has valid pricing
  const hasValidPricing = (modelId: string) => {
    return !pricingLoading && pricingMap.has(modelId);
  };
  
  const [formData, setFormData] = useState({
    featuredMediaTypes: brandKit?.contentPreferences?.featuredMediaTypes || [],
    mediaKitPriority: brandKit?.contentPreferences?.mediaKitPriority || "brand_kit_first",
    reuseAfterWeeks: brandKit?.contentPreferences?.reuseAfterWeeks ?? 4,
    contentLanguage: brandKit?.contentPreferences?.contentLanguage || "English",
    topicsToAvoid: brandKit?.contentPreferences?.topicsToAvoid?.join("\n") || "",
    alwaysIncludeMusic: brandKit?.contentPreferences?.alwaysIncludeMusic || false,
    alwaysIncludeImages: brandKit?.contentPreferences?.alwaysIncludeImages || false,
    // AI Settings - migrate legacy IDs to new database IDs
    aiSettings: {
      preferredVideoModel: migrateModelId(brandKit?.contentPreferences?.aiSettings?.preferredVideoModel, 'veo-3.1-fast'),
      preferredImageModel: migrateModelId(brandKit?.contentPreferences?.aiSettings?.preferredImageModel, 'seedream-4-1'),
      preferredMusicModel: migrateModelId(brandKit?.contentPreferences?.aiSettings?.preferredMusicModel, 'suno-v4'),
      dailyCreditBudget: brandKit?.contentPreferences?.aiSettings?.dailyCreditBudget ?? 500,
      automationLevel: brandKit?.contentPreferences?.aiSettings?.automationLevel || 'ai_suggests',
      autoGenerationPercent: brandKit?.contentPreferences?.aiSettings?.autoGenerationPercent ?? 50,
    },
  });

  const toggleMediaType = (type: string) => {
    if (formData.featuredMediaTypes.includes(type)) {
      setFormData({
        ...formData,
        featuredMediaTypes: formData.featuredMediaTypes.filter((t: string) => t !== type),
      });
    } else {
      setFormData({
        ...formData,
        featuredMediaTypes: [...formData.featuredMediaTypes, type],
      });
    }
  };

  const handleSave = () => {
    // Validate that all selected models have valid pricing in the database
    const invalidModels: string[] = [];
    if (!hasValidPricing(formData.aiSettings.preferredVideoModel)) {
      invalidModels.push('Video Model');
    }
    if (!hasValidPricing(formData.aiSettings.preferredImageModel)) {
      invalidModels.push('Image Model');
    }
    if (!hasValidPricing(formData.aiSettings.preferredMusicModel)) {
      invalidModels.push('Music Model');
    }
    
    if (invalidModels.length > 0) {
      toast({
        title: "Invalid Model Selection",
        description: `The following models are not in the pricing database: ${invalidModels.join(', ')}. Please select models with valid pricing.`,
        variant: "destructive",
      });
      return;
    }
    
    updateBrandKitMutation.mutate({
      contentPreferences: {
        ...formData,
        topicsToAvoid: formData.topicsToAvoid.split("\n").filter(Boolean),
        aiSettings: formData.aiSettings,
      },
    });
  };

  const updateAiSetting = (key: string, value: any) => {
    // Apply validation for numeric fields
    let validatedValue = value;
    
    if (key === 'dailyCreditBudget') {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      validatedValue = isNaN(numValue) ? 0 : Math.max(0, Math.min(10000, numValue));
    }
    
    if (key === 'autoGenerationPercent') {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      validatedValue = isNaN(numValue) ? 0 : Math.max(0, Math.min(100, numValue));
    }
    
    setFormData({
      ...formData,
      aiSettings: {
        ...formData.aiSettings,
        [key]: validatedValue,
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Content Preferences
          </CardTitle>
          <CardDescription>
            Configure how AI generates content for your brand
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Featured Media Types</Label>
            <div className="flex flex-wrap gap-3">
              {MEDIA_TYPES.map((type) => (
                <div
                  key={type.id}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                    formData.featuredMediaTypes.includes(type.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => toggleMediaType(type.id)}
                  data-testid={`toggle-media-${type.id}`}
                >
                  <span>{type.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Media Kit Priority</Label>
            <Select
              value={formData.mediaKitPriority}
              onValueChange={(value) => setFormData({ ...formData, mediaKitPriority: value })}
            >
              <SelectTrigger data-testid="select-media-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="only_brand_kit">Only use brand kit assets</SelectItem>
                <SelectItem value="brand_kit_first">Prefer brand kit, then stock</SelectItem>
                <SelectItem value="only_stock">Only use stock media</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reuse Media After (weeks)</Label>
            <Select
              value={formData.reuseAfterWeeks?.toString() || "never"}
              onValueChange={(value) => setFormData({ 
                ...formData, 
                reuseAfterWeeks: value === "never" ? null : parseInt(value) 
              })}
            >
              <SelectTrigger data-testid="select-reuse-weeks">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 week</SelectItem>
                <SelectItem value="2">2 weeks</SelectItem>
                <SelectItem value="4">4 weeks</SelectItem>
                <SelectItem value="8">8 weeks</SelectItem>
                <SelectItem value="12">12 weeks</SelectItem>
                <SelectItem value="never">Never reuse</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Content Language</Label>
            <Select
              value={formData.contentLanguage}
              onValueChange={(value) => setFormData({ ...formData, contentLanguage: value })}
            >
              <SelectTrigger data-testid="select-content-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
                <SelectItem value="Portuguese">Portuguese</SelectItem>
                <SelectItem value="Italian">Italian</SelectItem>
                <SelectItem value="Chinese">Chinese</SelectItem>
                <SelectItem value="Japanese">Japanese</SelectItem>
                <SelectItem value="Korean">Korean</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Topics to Avoid</Label>
            <Textarea
              placeholder="One topic per line..."
              value={formData.topicsToAvoid}
              onChange={(e) => setFormData({ ...formData, topicsToAvoid: e.target.value })}
              rows={4}
              data-testid="input-topics-to-avoid"
            />
            <p className="text-sm text-muted-foreground">
              AI will avoid mentioning these topics in generated content
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Always Include Music</Label>
                <p className="text-sm text-muted-foreground">
                  Add background music to video content
                </p>
              </div>
              <Switch
                checked={formData.alwaysIncludeMusic}
                onCheckedChange={(checked) => setFormData({ ...formData, alwaysIncludeMusic: checked })}
                data-testid="switch-include-music"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Always Include Images</Label>
                <p className="text-sm text-muted-foreground">
                  Include images in text-based posts
                </p>
              </div>
              <Switch
                checked={formData.alwaysIncludeImages}
                onCheckedChange={(checked) => setFormData({ ...formData, alwaysIncludeImages: checked })}
                data-testid="switch-include-images"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-6">
          <Button
            onClick={handleSave}
            disabled={updateBrandKitMutation.isPending}
            data-testid="button-save-preferences"
          >
            {updateBrandKitMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Save Preferences
          </Button>
        </CardFooter>
      </Card>

      {/* AI Generation Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            AI Generation Settings
          </CardTitle>
          <CardDescription>
            Configure how the AI Agent generates content and manages your credit budget
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Automation Level */}
          <div className="space-y-3">
            <Label>Automation Level</Label>
            <p className="text-sm text-muted-foreground">
              Control how much the AI Agent handles automatically
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AUTOMATION_LEVELS.map((level) => (
                <div
                  key={level.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    formData.aiSettings.automationLevel === level.id
                      ? "bg-primary/10 border-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => updateAiSetting('automationLevel', level.id)}
                  data-testid={`automation-level-${level.id}`}
                >
                  <div className="font-medium">{level.label}</div>
                  <div className="text-sm text-muted-foreground">{level.description}</div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Daily Credit Budget */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Daily Credit Budget</Label>
              <Badge variant="secondary" data-testid="badge-credit-budget">
                {formData.aiSettings.dailyCreditBudget === 0 
                  ? 'Unlimited' 
                  : `${formData.aiSettings.dailyCreditBudget} credits/day`}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Maximum credits the AI Agent can spend per day on content generation
            </p>
            
            {/* Unlimited Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Unlimited Credits</Label>
                <p className="text-xs text-muted-foreground">
                  No daily limit on AI-generated content
                </p>
              </div>
              <Switch
                checked={formData.aiSettings.dailyCreditBudget === 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    updateAiSetting('dailyCreditBudget', 0);
                  } else {
                    updateAiSetting('dailyCreditBudget', 500); // Default value when disabled
                  }
                }}
                data-testid="switch-unlimited-credits"
              />
            </div>
            
            {/* Budget slider - only shown when not unlimited */}
            {formData.aiSettings.dailyCreditBudget !== 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <Slider
                    value={[formData.aiSettings.dailyCreditBudget]}
                    onValueChange={([value]) => updateAiSetting('dailyCreditBudget', value)}
                    min={50}
                    max={2000}
                    step={50}
                    className="flex-1"
                    data-testid="slider-credit-budget"
                  />
                  <Input
                    type="number"
                    value={formData.aiSettings.dailyCreditBudget}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value > 0) {
                        updateAiSetting('dailyCreditBudget', value);
                      }
                    }}
                    className="w-24"
                    min={50}
                    max={10000}
                    data-testid="input-credit-budget"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>50 credits</span>
                  <span>2,000 credits</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* AI Model Preferences */}
          <div className="space-y-4">
            <div>
              <Label className="text-base">AI Model Preferences</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose which models the AI Agent uses. Cheaper models save credits but may have lower quality.
              </p>
            </div>

            {/* Video Model */}
            <div className="space-y-2">
              <Label>Preferred Video Model</Label>
              <Select
                value={formData.aiSettings.preferredVideoModel}
                onValueChange={(value) => updateAiSetting('preferredVideoModel', value)}
                disabled={pricingLoading}
              >
                <SelectTrigger data-testid="select-video-model">
                  <SelectValue placeholder={pricingLoading ? "Loading pricing..." : "Select video model"} />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((model) => {
                    const pricing = getPricingInfo(model.id);
                    return (
                      <SelectItem 
                        key={model.id} 
                        value={model.id}
                        disabled={!pricingLoading && !pricing}
                      >
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{model.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {pricingLoading 
                              ? 'Loading pricing...' 
                              : pricing 
                                ? `${pricing.cost} credits • ${pricing.description}`
                                : 'Pricing unavailable'}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {!pricingLoading && !hasValidPricing(formData.aiSettings.preferredVideoModel) && (
                <p className="text-xs text-destructive">Selected model pricing not found in database</p>
              )}
            </div>

            {/* Image Model */}
            <div className="space-y-2">
              <Label>Preferred Image Model</Label>
              <Select
                value={formData.aiSettings.preferredImageModel}
                onValueChange={(value) => updateAiSetting('preferredImageModel', value)}
                disabled={pricingLoading}
              >
                <SelectTrigger data-testid="select-image-model">
                  <SelectValue placeholder={pricingLoading ? "Loading pricing..." : "Select image model"} />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((model) => {
                    const pricing = getPricingInfo(model.id);
                    return (
                      <SelectItem 
                        key={model.id} 
                        value={model.id}
                        disabled={!pricingLoading && !pricing}
                      >
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{model.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {pricingLoading 
                              ? 'Loading pricing...' 
                              : pricing 
                                ? `${pricing.cost} credits • ${pricing.description}`
                                : 'Pricing unavailable'}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {!pricingLoading && !hasValidPricing(formData.aiSettings.preferredImageModel) && (
                <p className="text-xs text-destructive">Selected model pricing not found in database</p>
              )}
            </div>

            {/* Music Model */}
            <div className="space-y-2">
              <Label>Preferred Music Model</Label>
              <Select
                value={formData.aiSettings.preferredMusicModel}
                onValueChange={(value) => updateAiSetting('preferredMusicModel', value)}
                disabled={pricingLoading}
              >
                <SelectTrigger data-testid="select-music-model">
                  <SelectValue placeholder={pricingLoading ? "Loading pricing..." : "Select music model"} />
                </SelectTrigger>
                <SelectContent>
                  {MUSIC_MODELS.map((model) => {
                    const pricing = getPricingInfo(model.id);
                    return (
                      <SelectItem 
                        key={model.id} 
                        value={model.id}
                        disabled={!pricingLoading && !pricing}
                      >
                        <div className="flex items-center justify-between gap-4 w-full">
                          <span>{model.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {pricingLoading 
                              ? 'Loading pricing...' 
                              : pricing 
                                ? `${pricing.cost} credits • ${pricing.description}`
                                : 'Pricing unavailable'}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {!pricingLoading && !hasValidPricing(formData.aiSettings.preferredMusicModel) && (
                <p className="text-xs text-destructive">Selected model pricing not found in database</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Auto-Generation Percentage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Auto-Generation Target</Label>
              <Badge variant="secondary">{formData.aiSettings.autoGenerationPercent}%</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Percentage of your content calendar the AI Agent should auto-fill
            </p>
            <Slider
              value={[formData.aiSettings.autoGenerationPercent]}
              onValueChange={([value]) => updateAiSetting('autoGenerationPercent', value)}
              min={0}
              max={100}
              step={10}
              className="w-full"
              data-testid="slider-auto-generation"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% - All manual</span>
              <span>50% - Balanced</span>
              <span>100% - Full auto</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-6">
          <Button
            onClick={handleSave}
            disabled={updateBrandKitMutation.isPending}
            data-testid="button-save-ai-settings"
          >
            {updateBrandKitMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Save AI Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
