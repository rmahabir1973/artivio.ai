import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Shield, Users, Key, Trash2, Edit, Plus, ToggleLeft, ToggleRight, BarChart3, TrendingUp, Activity, DollarSign, Save, X, FileText, ArrowUp, ArrowDown, Info, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { User, ApiKey, Pricing, SubscriptionPlan, HomePageContent, Announcement, PlanEconomics, Generation } from "@shared/schema";

interface UserWithSubscription extends User {
  subscription: {
    id: string;
    planId: string;
    status: string;
    plan: SubscriptionPlan;
  } | null;
}

interface AnalyticsData {
  totalUsers: number;
  totalCreditsSpent: number;
  totalGenerations: number;
  popularFeatures: Array<{ feature: string; count: number; credits: number }>;
}

export default function Admin() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState("");
  const [addingApiKey, setAddingApiKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [editingPricingId, setEditingPricingId] = useState<string | null>(null);
  const [editPricing, setEditPricing] = useState({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
  const [addingPricing, setAddingPricing] = useState(false);
  const [newPricing, setNewPricing] = useState({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
  const [editingEconomics, setEditingEconomics] = useState(false);
  const [economicsForm, setEconomicsForm] = useState({ 
    kiePurchaseAmount: "50", 
    kieCreditAmount: "10000", 
    userCreditAmount: "15000", 
    profitMargin: "50" 
  });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanData, setEditPlanData] = useState({
    name: "",
    displayName: "",
    description: "",
    price: "",
    billingPeriod: "monthly" as "monthly" | "annual" | "trial",
    creditsPerMonth: "",
    stripePriceId: "",
    stripeProductId: ""
  });
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlanData, setNewPlanData] = useState({
    name: "",
    displayName: "",
    description: "",
    price: "",
    billingPeriod: "monthly" as "monthly" | "annual" | "trial",
    creditsPerMonth: "",
  });
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  
  // Home page content state
  const [editingHomePage, setEditingHomePage] = useState(false);
  const [homePageFormData, setHomePageFormData] = useState({
    heroTitle: "",
    heroSubtitle: "",
    heroVideoUrl: "",
    heroImageUrl: "",
    featureVideoUrl: "",
    featureImageUrl: "",
    featureMusicUrl: "",
    creatorsTitle: "",
    creatorsDescription: "",
    creatorsImageUrl: "",
    businessTitle: "",
    businessDescription: "",
    businessImageUrl: "",
  });
  const [showcaseDialogOpen, setShowcaseDialogOpen] = useState(false);
  const [showcaseEditIndex, setShowcaseEditIndex] = useState<number | null>(null);
  const [showcaseVideo, setShowcaseVideo] = useState({ url: "", title: "", description: "" });
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);
  const [faqEditIndex, setFaqEditIndex] = useState<number | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  
  // Announcements state
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    message: "",
    type: "info" as "info" | "warning" | "success" | "promo",
    targetPlans: [] as string[],
    isActive: true,
    startDate: "",
    endDate: "",
  });

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
      return;
    }

    if (!authLoading && isAuthenticated && !(user as any)?.isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin panel.",
        variant: "destructive",
      });
    }
  }, [isAuthenticated, authLoading, user, toast]);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithSubscription[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/plans"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/admin/api-keys"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: pricingList = [], isLoading: pricingLoading } = useQuery<Pricing[]>({
    queryKey: ["/api/admin/pricing"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: planEconomicsData, isLoading: economicsLoading } = useQuery<PlanEconomics>({
    queryKey: ["/api/admin/plan-economics"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: homePageContent, isLoading: homePageLoading } = useQuery<HomePageContent>({
    queryKey: ["/api/admin/homepage"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery<Announcement[]>({
    queryKey: ["/api/admin/announcements"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  const { data: adminGenerations = [], isLoading: generationsLoading } = useQuery<Generation[]>({
    queryKey: ["/api/admin/generations"],
    enabled: isAuthenticated && (user as any)?.isAdmin,
  });

  useEffect(() => {
    if (homePageContent && !editingHomePage) {
      setHomePageFormData({
        heroTitle: homePageContent.heroTitle || "",
        heroSubtitle: homePageContent.heroSubtitle || "",
        heroVideoUrl: homePageContent.heroVideoUrl || "",
        heroImageUrl: homePageContent.heroImageUrl || "",
        featureVideoUrl: homePageContent.featureVideoUrl || "",
        featureImageUrl: homePageContent.featureImageUrl || "",
        featureMusicUrl: homePageContent.featureMusicUrl || "",
        creatorsTitle: homePageContent.creatorsTitle || "",
        creatorsDescription: homePageContent.creatorsDescription || "",
        creatorsImageUrl: homePageContent.creatorsImageUrl || "",
        businessTitle: homePageContent.businessTitle || "",
        businessDescription: homePageContent.businessDescription || "",
        businessImageUrl: homePageContent.businessImageUrl || "",
      });
    }
  }, [homePageContent, editingHomePage]);

  useEffect(() => {
    if (planEconomicsData && !editingEconomics) {
      setEconomicsForm({
        kiePurchaseAmount: planEconomicsData.kiePurchaseAmount.toString(),
        kieCreditAmount: planEconomicsData.kieCreditAmount.toString(),
        userCreditAmount: planEconomicsData.userCreditAmount.toString(),
        profitMargin: planEconomicsData.profitMargin.toString(),
      });
    }
  }, [planEconomicsData, editingEconomics]);

  const calculateSuggestedCredits = (kieCost: number, economics: PlanEconomics | undefined) => {
    if (!kieCost || !economics) return null;
    const kieRate = economics.kiePurchaseAmount / economics.kieCreditAmount;
    const yourCost = kieCost * kieRate;
    const withMargin = yourCost * (1 + economics.profitMargin / 100);
    const userRate = economics.kiePurchaseAmount / economics.userCreditAmount;
    const suggestedUserCredits = Math.ceil(withMargin / userRate);
    return {
      yourCost,
      withMargin,
      suggestedUserCredits,
      details: {
        kieRate: kieRate.toFixed(4),
        userRate: userRate.toFixed(4),
        margin: economics.profitMargin,
      }
    };
  };

  const updateCreditsMutation = useMutation({
    mutationFn: async ({ userId, credits }: { userId: string; credits: number }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/credits`, { credits });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Credits updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditingUserId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update credits",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string | null }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/subscription`, { planId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User plan updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    },
  });

  const toggleApiKeyMutation = useMutation({
    mutationFn: async ({ keyId, isActive }: { keyId: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/api-keys/${keyId}`, { isActive });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "API key status updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update API key",
        variant: "destructive",
      });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/admin/pricing/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      setEditingPricingId(null);
      setEditPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
      toast({ title: "Success", description: "Pricing updated successfully" });
    },
    onError: (error: Error) => {
      setEditingPricingId(null);
      setEditPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update pricing", 
        variant: "destructive" 
      });
    },
  });

  const addPricingMutation = useMutation({
    mutationFn: async (data: { feature: string; model: string; category: string; creditCost: number; kieCreditCost?: number; description?: string }) => {
      return await apiRequest("POST", "/api/admin/pricing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      setAddingPricing(false);
      setNewPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
      toast({ title: "Success", description: "Pricing entry added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add pricing", variant: "destructive" });
    },
  });

  const updateEconomicsMutation = useMutation({
    mutationFn: async (data: { kiePurchaseAmount: number; kieCreditAmount: number; userCreditAmount: number; profitMargin: number }) => {
      return await apiRequest("PATCH", "/api/admin/plan-economics", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plan-economics"] });
      setEditingEconomics(false);
      toast({ title: "Success", description: "Plan economics updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update plan economics", variant: "destructive" });
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: { name: string; displayName: string; description: string; price: number; creditsPerMonth: number }) => {
      return await apiRequest("POST", "/api/admin/plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setCreatingPlan(false);
      setNewPlanData({ name: "", displayName: "", description: "", price: "", creditsPerMonth: "" });
      toast({ title: "Success", description: "Plan created successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create plan", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, ...updates }: { planId: string; [key: string]: any }) => {
      return await apiRequest("PATCH", `/api/admin/plans/${planId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setEditingPlanId(null);
      setEditPlanData({ name: "", displayName: "", description: "", price: "", creditsPerMonth: "", stripePriceId: "", stripeProductId: "" });
      toast({ title: "Success", description: "Plan updated successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update plan", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return await apiRequest("DELETE", `/api/admin/plans/${planId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setDeletingPlanId(null);
      toast({ title: "Success", description: "Plan deleted successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to delete plan", variant: "destructive" });
    },
  });

  const reorderPlanMutation = useMutation({
    mutationFn: async ({ planId, direction }: { planId: string; direction: 'up' | 'down' }) => {
      return await apiRequest("PATCH", `/api/admin/plans/${planId}/reorder`, { direction });
    },
    onSuccess: (updatedPlans) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({ 
        title: "Success", 
        description: `Plan reordered successfully!`,
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to reorder plan", 
        variant: "destructive" 
      });
    },
  });

  const updateHomePageMutation = useMutation({
    mutationFn: async (data: Partial<HomePageContent>) => {
      return await apiRequest("PATCH", "/api/admin/homepage", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage"] });
      setEditingHomePage(false);
      toast({ title: "Success", description: "Home page content updated successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update home page content", variant: "destructive" });
    },
  });

  const addApiKeyMutation = useMutation({
    mutationFn: async ({ keyName, keyValue }: { keyName: string; keyValue: string }) => {
      return await apiRequest("POST", "/api/admin/api-keys", { keyName, keyValue });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "API key added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setAddingApiKey(false);
      setNewKeyName("");
      setNewKeyValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add API key",
        variant: "destructive",
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest("DELETE", `/api/admin/api-keys/${keyId}`, {});
    },
    onSuccess: () => {
      toast({ title: "Success", description: "API key deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !(user as any)?.isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Shield className="h-10 w-10 text-primary" />
          Admin Panel
        </h1>
        <p className="text-lg text-muted-foreground">
          Manage users and API keys
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-8">
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="api-keys" data-testid="tab-api-keys">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="pricing" data-testid="tab-pricing">
            <DollarSign className="h-4 w-4 mr-2" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">
            <TrendingUp className="h-4 w-4 mr-2" />
            Subscription Plans
          </TabsTrigger>
          <TabsTrigger value="content" data-testid="tab-content">
            <FileText className="h-4 w-4 mr-2" />
            Home Page
          </TabsTrigger>
          <TabsTrigger value="announcements" data-testid="tab-announcements">
            <Activity className="h-4 w-4 mr-2" />
            Announcements
          </TabsTrigger>
          <TabsTrigger value="showcase" data-testid="tab-showcase">
            <Eye className="h-4 w-4 mr-2" />
            Showcase
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all users</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email || 'N/A'}</TableCell>
                        <TableCell>
                          {u.firstName || u.lastName 
                            ? `${u.firstName || ''} ${u.lastName || ''}`.trim() 
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {editingUserId === u.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={editCredits}
                                onChange={(e) => setEditCredits(e.target.value)}
                                className="w-24"
                                data-testid={`input-credits-${u.id}`}
                              />
                              <Button
                                size="sm"
                                onClick={() => {
                                  updateCreditsMutation.mutate({
                                    userId: u.id,
                                    credits: parseInt(editCredits),
                                  });
                                }}
                                data-testid={`button-save-credits-${u.id}`}
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <span>{u.credits?.toLocaleString() ?? 0}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {plansLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm text-muted-foreground">Loading...</span>
                            </div>
                          ) : (
                            <Select
                              value={u.subscription?.planId || 'none'}
                              onValueChange={(value) => {
                                updateSubscriptionMutation.mutate({
                                  userId: u.id,
                                  planId: value === 'none' ? null : value,
                                });
                              }}
                              disabled={updateSubscriptionMutation.isPending}
                            >
                              <SelectTrigger className="w-32" data-testid={`select-plan-${u.id}`}>
                                <SelectValue>
                                  {u.subscription?.plan?.name || 'No Plan'}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Plan</SelectItem>
                                {plans.map((plan) => (
                                  <SelectItem key={plan.id} value={plan.id}>
                                    {plan.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.isAdmin ? "default" : "secondary"}>
                            {u.isAdmin ? 'Admin' : 'User'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.createdAt ? formatDistanceToNow(new Date(u.createdAt), { addSuffix: true }) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingUserId(u.id);
                                setEditCredits(u.credits?.toString() ?? "0");
                              }}
                              data-testid={`button-edit-${u.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this user?')) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                              data-testid={`button-delete-${u.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total API Calls</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {apiKeys.reduce((sum, key) => sum + (key.usageCount || 0), 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all {apiKeys.length} keys
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {apiKeys.filter(k => k.isActive).length} / {apiKeys.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((apiKeys.filter(k => k.isActive).length / Math.max(apiKeys.length, 1)) * 100).toFixed(0)}% active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Usage/Key</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(apiKeys.reduce((sum, key) => sum + (key.usageCount || 0), 0) / Math.max(apiKeys.length, 1)).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Calls per key
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>API Key Management</CardTitle>
                <CardDescription>
                  Manage round-robin API keys for load balancing
                </CardDescription>
              </div>
              <Button onClick={() => setAddingApiKey(true)} data-testid="button-add-api-key">
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            </CardHeader>
            <CardContent>
              {keysLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {apiKeys.map((key) => (
                    <Card key={key.id} className={key.isActive ? "border-primary" : "border-muted"}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{key.keyName}</CardTitle>
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-sm">
                          <p className="text-muted-foreground">Usage Count</p>
                          <p className="text-2xl font-bold">{key.usageCount}</p>
                        </div>
                        {key.lastUsedAt && (
                          <div className="text-sm">
                            <p className="text-muted-foreground">Last Used</p>
                            <p>{formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true })}</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              toggleApiKeyMutation.mutate({
                                keyId: key.id,
                                isActive: !key.isActive,
                              });
                            }}
                            data-testid={`button-toggle-${key.id}`}
                          >
                            {key.isActive ? (
                              <>
                                <ToggleRight className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete the API key "${key.keyName}"?`)) {
                                deleteApiKeyMutation.mutate(key.id);
                              }
                            }}
                            data-testid={`button-delete-key-${key.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {apiKeys.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No API keys configured. Add your first key to get started.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalUsers?.toLocaleString() ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalGenerations?.toLocaleString() ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Credits Spent</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalCreditsSpent?.toLocaleString() ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active API Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {keysLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="text-2xl font-bold">{apiKeys?.filter(k => k.isActive).length ?? 0}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Popular Features</CardTitle>
              <CardDescription>Most used AI generation features</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : analytics?.popularFeatures && analytics.popularFeatures.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-right">Generations</TableHead>
                      <TableHead className="text-right">Credits Used</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.popularFeatures.map((feature, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium capitalize">
                          {feature.feature.replace(/-/g, ' ')}
                        </TableCell>
                        <TableCell className="text-right">{feature.count.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{feature.credits.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No generation data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Plan Economics Configuration</CardTitle>
                <CardDescription>Configure your Kie.ai purchase plan and desired profit margin</CardDescription>
              </div>
              <Button 
                onClick={() => setEditingEconomics(true)} 
                data-testid="button-edit-economics"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Economics
              </Button>
            </CardHeader>
            <CardContent>
              {economicsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : planEconomicsData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground">Kie.ai Purchase Plan</Label>
                      <p className="text-2xl font-bold" data-testid="text-kie-rate">
                        ${planEconomicsData.kiePurchaseAmount} = {planEconomicsData.kieCreditAmount.toLocaleString()} credits
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground">User Selling Plan</Label>
                      <p className="text-2xl font-bold" data-testid="text-user-rate">
                        ${planEconomicsData.kiePurchaseAmount} = {planEconomicsData.userCreditAmount.toLocaleString()} credits
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground">Kie Cost per Credit</Label>
                      <p className="text-lg font-semibold" data-testid="text-kie-cost-per-credit">
                        ${(planEconomicsData.kiePurchaseAmount / planEconomicsData.kieCreditAmount).toFixed(4)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground">User Revenue per Credit</Label>
                      <p className="text-lg font-semibold" data-testid="text-user-revenue-per-credit">
                        ${(planEconomicsData.kiePurchaseAmount / planEconomicsData.userCreditAmount).toFixed(4)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-muted-foreground">Effective Multiplier</Label>
                      <p className="text-lg font-semibold text-primary" data-testid="text-effective-multiplier">
                        {(planEconomicsData.userCreditAmount / planEconomicsData.kieCreditAmount).toFixed(2)}x
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <Label className="text-sm font-semibold text-muted-foreground">Profit Margin Target</Label>
                    <p className="text-lg font-semibold" data-testid="text-profit-margin">
                      {planEconomicsData.profitMargin}%
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No economics configuration found. Click Edit Economics to set up your pricing.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pricing Management</CardTitle>
                <CardDescription>Configure credit costs for all AI features and models</CardDescription>
              </div>
              <Button onClick={() => setAddingPricing(true)} data-testid="button-add-pricing">
                <Plus className="h-4 w-4 mr-2" />
                Add Pricing
              </Button>
            </CardHeader>
            <CardContent>
              {pricingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : pricingList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pricing entries found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead data-testid="text-pricing-header-feature">Feature</TableHead>
                      <TableHead data-testid="text-pricing-header-model">Model</TableHead>
                      <TableHead data-testid="text-pricing-header-category">Category</TableHead>
                      <TableHead className="text-right" data-testid="text-pricing-header-cost">Credit Cost</TableHead>
                      <TableHead className="text-right" data-testid="text-pricing-header-actions">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricingList.map((pricing) => (
                      <TableRow key={pricing.id} data-testid={`pricing-row-${pricing.id}`}>
                        <TableCell className="font-medium capitalize" data-testid={`text-pricing-feature-${pricing.id}`}>
                          {pricing.feature.replace(/-/g, ' ')}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={`text-pricing-model-${pricing.id}`}>
                          {pricing.model}
                        </TableCell>
                        <TableCell data-testid={`text-pricing-category-${pricing.id}`}>
                          <Badge variant="outline" className="capitalize">
                            {pricing.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold" data-testid={`text-pricing-cost-value-${pricing.id}`}>
                            {pricing.creditCost.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPricingId(pricing.id);
                              setEditPricing({
                                feature: pricing.feature,
                                model: pricing.model,
                                category: pricing.category,
                                creditCost: pricing.creditCost.toString(),
                                kieCreditCost: pricing.kieCreditCost?.toString() || "",
                                description: pricing.description || "",
                              });
                            }}
                            data-testid={`button-edit-pricing-${pricing.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>
                  Manage subscription plans, pricing, and Stripe configuration
                </CardDescription>
              </div>
              <Button onClick={() => setCreatingPlan(true)} data-testid="button-create-plan">
                <Plus className="h-4 w-4 mr-2" />
                Create New Plan
              </Button>
            </CardHeader>
            <CardContent>
              {plansLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Order</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Display Name</TableHead>
                      <TableHead>Billing Period</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Credits/Month</TableHead>
                      <TableHead>Stripe</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans.map((plan, index) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium" data-testid={`text-plan-sort-order-${plan.id}`}>
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">{plan.sortOrder}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium font-mono text-sm" data-testid={`text-plan-name-${plan.id}`}>
                          {plan.name}
                        </TableCell>
                        <TableCell data-testid={`text-plan-display-name-${plan.id}`}>
                          {plan.displayName}
                        </TableCell>
                        <TableCell data-testid={`text-plan-billing-period-${plan.id}`}>
                          <Badge variant={plan.billingPeriod === 'monthly' ? 'default' : plan.billingPeriod === 'annual' ? 'secondary' : 'outline'} className="capitalize text-xs">
                            {plan.billingPeriod}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-plan-price-${plan.id}`}>
                          ${(plan.price / 100).toFixed(2)}/{plan.billingPeriod === 'monthly' ? 'mo' : 'yr'}
                        </TableCell>
                        <TableCell data-testid={`text-plan-credits-${plan.id}`}>
                          {plan.creditsPerMonth.toLocaleString()}
                        </TableCell>
                        <TableCell data-testid={`text-plan-stripe-status-${plan.id}`}>
                          {plan.stripePriceId && plan.stripeProductId ? (
                            <Badge variant="default" className="text-xs">Configured</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Not Set</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reorderPlanMutation.mutate({ planId: plan.id, direction: 'up' })}
                              disabled={index === 0 || reorderPlanMutation.isPending}
                              title="Move up"
                              data-testid={`button-reorder-up-${plan.id}`}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reorderPlanMutation.mutate({ planId: plan.id, direction: 'down' })}
                              disabled={index === plans.length - 1 || reorderPlanMutation.isPending}
                              title="Move down"
                              data-testid={`button-reorder-down-${plan.id}`}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPlanId(plan.id);
                                setEditPlanData({
                                  name: plan.name,
                                  displayName: plan.displayName,
                                  description: plan.description || "",
                                  price: (plan.price / 100).toString(),
                                  billingPeriod: plan.billingPeriod as "monthly" | "annual" | "trial",
                                  creditsPerMonth: plan.creditsPerMonth.toString(),
                                  stripePriceId: plan.stripePriceId || "",
                                  stripeProductId: plan.stripeProductId || "",
                                });
                              }}
                              data-testid={`button-edit-plan-${plan.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingPlanId(plan.id)}
                              data-testid={`button-delete-plan-${plan.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Hero Section</CardTitle>
                <CardDescription>Manage the main hero section of the home page</CardDescription>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="heroTitle">Hero Title</Label>
                        <Input
                          id="heroTitle"
                          value={homePageFormData.heroTitle}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroTitle: e.target.value })}
                          placeholder="Create any video you can imagine"
                          data-testid="input-hero-title"
                        />
                      </div>
                      <div>
                        <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                        <Input
                          id="heroSubtitle"
                          value={homePageFormData.heroSubtitle}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroSubtitle: e.target.value })}
                          placeholder="Generate stunning videos, images, and music"
                          data-testid="input-hero-subtitle"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="heroVideoUrl">Hero Video URL (Vimeo)</Label>
                        <Input
                          id="heroVideoUrl"
                          value={homePageFormData.heroVideoUrl}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroVideoUrl: e.target.value })}
                          placeholder="https://player.vimeo.com/video/..."
                          data-testid="input-hero-video-url"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Vimeo player URL</p>
                      </div>
                      <div>
                        <Label htmlFor="heroImageUrl">Hero Image URL (fallback)</Label>
                        <Input
                          id="heroImageUrl"
                          value={homePageFormData.heroImageUrl}
                          onChange={(e) => setHomePageFormData({ ...homePageFormData, heroImageUrl: e.target.value })}
                          placeholder="https://..."
                          data-testid="input-hero-image-url"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Used if no video URL provided</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        updateHomePageMutation.mutate({
                          heroTitle: homePageFormData.heroTitle.trim() || undefined,
                          heroSubtitle: homePageFormData.heroSubtitle.trim() || undefined,
                          heroVideoUrl: homePageFormData.heroVideoUrl.trim() || undefined,
                          heroImageUrl: homePageFormData.heroImageUrl.trim() || undefined,
                        });
                      }}
                      disabled={updateHomePageMutation.isPending}
                      data-testid="button-save-hero"
                    >
                      {updateHomePageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Hero Section
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Section Videos</CardTitle>
                <CardDescription>Vimeo video URLs for the three feature sections on the landing page</CardDescription>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="featureVideoUrl">"Create videos that captivate" Section Video URL (Vimeo)</Label>
                      <Input
                        id="featureVideoUrl"
                        value={homePageFormData.featureVideoUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, featureVideoUrl: e.target.value })}
                        placeholder="https://player.vimeo.com/video/..."
                        data-testid="input-feature-video-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Video placeholder for "Create videos that captivate" section</p>
                    </div>
                    <div>
                      <Label htmlFor="featureImageUrl">"Images that inspire" Section Video URL (Vimeo)</Label>
                      <Input
                        id="featureImageUrl"
                        value={homePageFormData.featureImageUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, featureImageUrl: e.target.value })}
                        placeholder="https://player.vimeo.com/video/..."
                        data-testid="input-feature-image-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Video placeholder for "Images that inspire" section</p>
                    </div>
                    <div>
                      <Label htmlFor="featureMusicUrl">"Music that moves" Section Video URL (Vimeo)</Label>
                      <Input
                        id="featureMusicUrl"
                        value={homePageFormData.featureMusicUrl}
                        onChange={(e) => setHomePageFormData({ ...homePageFormData, featureMusicUrl: e.target.value })}
                        placeholder="https://player.vimeo.com/video/..."
                        data-testid="input-feature-music-url"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Video placeholder for "Music that moves" section</p>
                    </div>
                    <Button
                      onClick={() => {
                        updateHomePageMutation.mutate({
                          featureVideoUrl: homePageFormData.featureVideoUrl.trim() || undefined,
                          featureImageUrl: homePageFormData.featureImageUrl.trim() || undefined,
                          featureMusicUrl: homePageFormData.featureMusicUrl.trim() || undefined,
                        });
                      }}
                      disabled={updateHomePageMutation.isPending}
                      data-testid="button-save-feature-videos"
                    >
                      {updateHomePageMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Feature Videos
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
                <div>
                  <CardTitle>Showcase Videos</CardTitle>
                  <CardDescription>Manage the showcase video gallery (max 3 videos)</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if ((homePageContent?.showcaseVideos || []).length >= 3) {
                      toast({ title: "Maximum reached", description: "You can only have up to 3 showcase videos", variant: "destructive" });
                      return;
                    }
                    setShowcaseEditIndex(null);
                    setShowcaseVideo({ url: "", title: "", description: "" });
                    setShowcaseDialogOpen(true);
                  }}
                  data-testid="button-add-showcase-video"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Video
                </Button>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (homePageContent?.showcaseVideos || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No showcase videos added yet. Click "Add Video" to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(homePageContent?.showcaseVideos || []).map((video, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium truncate">{video.url}</p>
                              {video.title && <p className="text-xs text-muted-foreground">{video.title}</p>}
                              {video.description && <p className="text-xs text-muted-foreground">{video.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setShowcaseEditIndex(index);
                                  setShowcaseVideo({
                                    url: video.url,
                                    title: video.title || "",
                                    description: video.description || "",
                                  });
                                  setShowcaseDialogOpen(true);
                                }}
                                data-testid={`button-edit-showcase-${index}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const updated = [...(homePageContent?.showcaseVideos || [])];
                                updated.splice(index, 1);
                                updateHomePageMutation.mutate({ showcaseVideos: updated });
                              }}
                              data-testid={`button-delete-showcase-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Creators Section</CardTitle>
                  <CardDescription>Content for creators/individuals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="creatorsTitle">Title</Label>
                    <Input
                      id="creatorsTitle"
                      value={homePageFormData.creatorsTitle}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, creatorsTitle: e.target.value })}
                      placeholder="Creators"
                      data-testid="input-creators-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creatorsDescription">Description</Label>
                    <Textarea
                      id="creatorsDescription"
                      value={homePageFormData.creatorsDescription}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, creatorsDescription: e.target.value })}
                      placeholder="Description for creators..."
                      rows={3}
                      data-testid="input-creators-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creatorsImageUrl">Image URL</Label>
                    <Input
                      id="creatorsImageUrl"
                      value={homePageFormData.creatorsImageUrl}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, creatorsImageUrl: e.target.value })}
                      placeholder="https://..."
                      data-testid="input-creators-image-url"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      updateHomePageMutation.mutate({
                        creatorsTitle: homePageFormData.creatorsTitle.trim() || undefined,
                        creatorsDescription: homePageFormData.creatorsDescription.trim() || undefined,
                        creatorsImageUrl: homePageFormData.creatorsImageUrl.trim() || undefined,
                      });
                    }}
                    disabled={updateHomePageMutation.isPending}
                    data-testid="button-save-creators"
                  >
                    {updateHomePageMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Business Section</CardTitle>
                  <CardDescription>Content for businesses</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="businessTitle">Title</Label>
                    <Input
                      id="businessTitle"
                      value={homePageFormData.businessTitle}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, businessTitle: e.target.value })}
                      placeholder="Businesses"
                      data-testid="input-business-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessDescription">Description</Label>
                    <Textarea
                      id="businessDescription"
                      value={homePageFormData.businessDescription}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, businessDescription: e.target.value })}
                      placeholder="Description for businesses..."
                      rows={3}
                      data-testid="input-business-description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="businessImageUrl">Image URL</Label>
                    <Input
                      id="businessImageUrl"
                      value={homePageFormData.businessImageUrl}
                      onChange={(e) => setHomePageFormData({ ...homePageFormData, businessImageUrl: e.target.value })}
                      placeholder="https://..."
                      data-testid="input-business-image-url"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      updateHomePageMutation.mutate({
                        businessTitle: homePageFormData.businessTitle.trim() || undefined,
                        businessDescription: homePageFormData.businessDescription.trim() || undefined,
                        businessImageUrl: homePageFormData.businessImageUrl.trim() || undefined,
                      });
                    }}
                    disabled={updateHomePageMutation.isPending}
                    data-testid="button-save-business"
                  >
                    {updateHomePageMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 gap-2">
                <div>
                  <CardTitle>FAQs</CardTitle>
                  <CardDescription>Manage frequently asked questions</CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setFaqEditIndex(null);
                    setFaqQuestion("");
                    setFaqAnswer("");
                    setFaqDialogOpen(true);
                  }}
                  data-testid="button-add-faq"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add FAQ
                </Button>
              </CardHeader>
              <CardContent>
                {homePageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (homePageContent?.faqs || []).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No FAQs added yet. Click "Add FAQ" to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(homePageContent?.faqs || []).map((faq, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-medium">{faq.question}</p>
                              <p className="text-sm text-muted-foreground">{faq.answer}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setFaqEditIndex(index);
                                  setFaqQuestion(faq.question);
                                  setFaqAnswer(faq.answer);
                                  setFaqDialogOpen(true);
                                }}
                                data-testid={`button-edit-faq-${index}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const updated = [...(homePageContent?.faqs || [])];
                                  updated.splice(index, 1);
                                  updateHomePageMutation.mutate({ faqs: updated });
                                }}
                                data-testid={`button-delete-faq-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="announcements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Announcement Management</CardTitle>
                <CardDescription>Create and manage announcement bars with plan targeting</CardDescription>
              </div>
              <Button
                onClick={() => {
                  setAnnouncementForm({
                    message: "",
                    type: "info",
                    targetPlans: [],
                    isActive: true,
                    startDate: "",
                    endDate: "",
                  });
                  setEditingAnnouncementId(null);
                  setCreatingAnnouncement(true);
                }}
                data-testid="button-create-announcement"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Announcement
              </Button>
            </CardHeader>
            <CardContent>
              {announcementsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No announcements yet. Create one to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <Card key={announcement.id} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={announcement.type === "warning" ? "destructive" : "default"}>
                                {announcement.type}
                              </Badge>
                              <Badge variant={announcement.isActive ? "default" : "secondary"}>
                                {announcement.isActive ? "Active" : "Inactive"}
                              </Badge>
                              {announcement.targetPlans && announcement.targetPlans.length > 0 ? (
                                <Badge variant="outline">
                                  {announcement.targetPlans.join(", ")}
                                </Badge>
                              ) : (
                                <Badge variant="outline">All Plans</Badge>
                              )}
                            </div>
                            <p className="text-sm">{announcement.message}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {announcement.startDate && (
                                <span>Start: {new Date(announcement.startDate).toLocaleDateString()}</span>
                              )}
                              {announcement.endDate && (
                                <span>End: {new Date(announcement.endDate).toLocaleDateString()}</span>
                              )}
                              <span>Updated {formatDistanceToNow(new Date(announcement.updatedAt))} ago</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAnnouncementForm({
                                  message: announcement.message,
                                  type: announcement.type as any,
                                  targetPlans: announcement.targetPlans || [],
                                  isActive: announcement.isActive,
                                  startDate: announcement.startDate ? new Date(announcement.startDate).toISOString().slice(0, 16) : "",
                                  endDate: announcement.endDate ? new Date(announcement.endDate).toISOString().slice(0, 16) : "",
                                });
                                setEditingAnnouncementId(announcement.id);
                                setCreatingAnnouncement(true);
                              }}
                              data-testid={`button-edit-announcement-${announcement.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                if (confirm(`Delete announcement: "${announcement.message}"?`)) {
                                  try {
                                    await apiRequest("DELETE", `/api/admin/announcements/${announcement.id}`, {});
                                    queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
                                    toast({
                                      title: "Success",
                                      description: "Announcement deleted successfully",
                                    });
                                  } catch (error: any) {
                                    toast({
                                      title: "Error",
                                      description: error.message || "Failed to delete announcement",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                              data-testid={`button-delete-announcement-${announcement.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="showcase">
          <Card>
            <CardHeader>
              <CardTitle>Showcase Management</CardTitle>
              <CardDescription>Manage which videos appear on the Video Models showcase page</CardDescription>
            </CardHeader>
            <CardContent>
              {generationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : adminGenerations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed video generations found
                </div>
              ) : (
                <>
                  <div className="mb-4 text-sm text-muted-foreground">
                    {adminGenerations.filter(g => g.isShowcase).length} of {adminGenerations.length} videos in showcase
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Preview</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-center">Showcase</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminGenerations.map((generation) => (
                        <TableRow key={generation.id}>
                          <TableCell>
                            <video 
                              src={generation.resultUrl || ''} 
                              className="w-20 h-12 object-cover rounded"
                              muted
                              data-testid={`video-preview-${generation.id}`}
                            />
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="line-clamp-2 text-sm">{generation.prompt}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{generation.model}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground font-mono">
                            {generation.userId.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(generation.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant={generation.isShowcase ? "default" : "outline"}
                              size="sm"
                              onClick={async () => {
                                try {
                                  await apiRequest("PATCH", `/api/admin/generations/${generation.id}/showcase`, {
                                    isShowcase: !generation.isShowcase
                                  });
                                  queryClient.invalidateQueries({ queryKey: ["/api/admin/generations"] });
                                  queryClient.invalidateQueries({ queryKey: ["/api/showcase-videos"] });
                                  toast({
                                    title: "Success",
                                    description: generation.isShowcase ? "Removed from showcase" : "Added to showcase",
                                  });
                                } catch (error: any) {
                                  toast({
                                    title: "Error",
                                    description: error.message || "Failed to update showcase status",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-toggle-showcase-${generation.id}`}
                            >
                              {generation.isShowcase ? "Remove" : "Add"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Showcase Video Dialog */}
      <Dialog open={showcaseDialogOpen} onOpenChange={setShowcaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showcaseEditIndex !== null ? "Edit" : "Add"} Showcase Video</DialogTitle>
            <DialogDescription>
              Enter video details for the showcase gallery
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="showcaseVideoUrl">Video URL *</Label>
              <Input
                id="showcaseVideoUrl"
                value={showcaseVideo.url}
                onChange={(e) => setShowcaseVideo({ ...showcaseVideo, url: e.target.value })}
                placeholder="https://player.vimeo.com/video/..."
                data-testid="input-showcase-video-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must be a vimeo.com URL (e.g., https://player.vimeo.com/video/123456789)
              </p>
            </div>
            <div>
              <Label htmlFor="showcaseVideoTitle">Title (optional)</Label>
              <Input
                id="showcaseVideoTitle"
                value={showcaseVideo.title}
                onChange={(e) => setShowcaseVideo({ ...showcaseVideo, title: e.target.value })}
                placeholder="Video title..."
                data-testid="input-showcase-video-title"
              />
            </div>
            <div>
              <Label htmlFor="showcaseVideoDescription">Description (optional)</Label>
              <Textarea
                id="showcaseVideoDescription"
                value={showcaseVideo.description}
                onChange={(e) => setShowcaseVideo({ ...showcaseVideo, description: e.target.value })}
                placeholder="Video description..."
                rows={3}
                data-testid="input-showcase-video-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowcaseDialogOpen(false)} data-testid="button-cancel-showcase">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const trimmedUrl = showcaseVideo.url.trim();
                const trimmedTitle = showcaseVideo.title.trim();
                const trimmedDescription = showcaseVideo.description.trim();
                
                if (!trimmedUrl) {
                  toast({ title: "Error", description: "Video URL is required", variant: "destructive" });
                  return;
                }
                if (!trimmedUrl.includes('vimeo.com')) {
                  toast({ title: "Error", description: "Must be a Vimeo URL", variant: "destructive" });
                  return;
                }
                
                const updated = [...(homePageContent?.showcaseVideos || [])];
                const videoData: { url: string; title?: string; description?: string } = {
                  url: trimmedUrl,
                };
                
                if (trimmedTitle) {
                  videoData.title = trimmedTitle;
                }
                if (trimmedDescription) {
                  videoData.description = trimmedDescription;
                }
                
                if (showcaseEditIndex !== null) {
                  updated[showcaseEditIndex] = videoData;
                } else {
                  updated.push(videoData);
                }
                
                updateHomePageMutation.mutate({ showcaseVideos: updated });
                setShowcaseDialogOpen(false);
              }}
              disabled={updateHomePageMutation.isPending}
              data-testid="button-save-showcase"
            >
              {updateHomePageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FAQ Dialog */}
      <Dialog open={faqDialogOpen} onOpenChange={setFaqDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{faqEditIndex !== null ? "Edit" : "Add"} FAQ</DialogTitle>
            <DialogDescription>
              Add a frequently asked question and its answer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="faqQuestion">Question</Label>
              <Input
                id="faqQuestion"
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                placeholder="What is Artivio AI?"
                data-testid="input-faq-question"
              />
            </div>
            <div>
              <Label htmlFor="faqAnswer">Answer</Label>
              <Textarea
                id="faqAnswer"
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                placeholder="Artivio AI is a comprehensive platform..."
                rows={4}
                data-testid="input-faq-answer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFaqDialogOpen(false)} data-testid="button-cancel-faq">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const trimmedQuestion = faqQuestion.trim();
                const trimmedAnswer = faqAnswer.trim();
                
                if (!trimmedQuestion || !trimmedAnswer) {
                  toast({ title: "Error", description: "Question and answer are required", variant: "destructive" });
                  return;
                }
                
                const updated = [...(homePageContent?.faqs || [])];
                if (faqEditIndex !== null) {
                  updated[faqEditIndex] = { question: trimmedQuestion, answer: trimmedAnswer };
                } else {
                  updated.push({ question: trimmedQuestion, answer: trimmedAnswer });
                }
                
                updateHomePageMutation.mutate({ faqs: updated });
                setFaqDialogOpen(false);
              }}
              disabled={updateHomePageMutation.isPending}
              data-testid="button-save-faq"
            >
              {updateHomePageMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add API Key Dialog */}
      <Dialog open={addingApiKey} onOpenChange={setAddingApiKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add API Key</DialogTitle>
            <DialogDescription>
              Add a new Kie.ai API key for round-robin rotation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="e.g., My Kie.ai Key #1"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                data-testid="input-new-key-name"
              />
            </div>
            <div>
              <Label htmlFor="keyValue">API Key Value</Label>
              <Input
                id="keyValue"
                type="password"
                placeholder="Paste your Kie.ai API key here"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                data-testid="input-new-key-value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (newKeyName.trim() && newKeyValue.trim()) {
                  addApiKeyMutation.mutate({ 
                    keyName: newKeyName.trim(), 
                    keyValue: newKeyValue.trim() 
                  });
                }
              }}
              disabled={!newKeyName.trim() || !newKeyValue.trim() || addApiKeyMutation.isPending}
              data-testid="button-submit-new-key"
            >
              {addApiKeyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Economics Dialog */}
      <Dialog open={editingEconomics} onOpenChange={(open) => {
        if (!open) {
          setEditingEconomics(false);
          if (planEconomicsData) {
            setEconomicsForm({
              kiePurchaseAmount: planEconomicsData.kiePurchaseAmount.toString(),
              kieCreditAmount: planEconomicsData.kieCreditAmount.toString(),
              userCreditAmount: planEconomicsData.userCreditAmount.toString(),
              profitMargin: planEconomicsData.profitMargin.toString(),
            });
          }
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Plan Economics</DialogTitle>
            <DialogDescription>
              Configure your Kie.ai purchase plan and desired profit margin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kie-purchase">Kie.ai Purchase Amount ($)</Label>
                <Input
                  id="kie-purchase"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="50"
                  value={economicsForm.kiePurchaseAmount}
                  onChange={(e) => setEconomicsForm({ ...economicsForm, kiePurchaseAmount: e.target.value })}
                  data-testid="input-kie-purchase-amount"
                />
              </div>
              <div>
                <Label htmlFor="kie-credits">Kie.ai Credits Received</Label>
                <Input
                  id="kie-credits"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="10000"
                  value={economicsForm.kieCreditAmount}
                  onChange={(e) => setEconomicsForm({ ...economicsForm, kieCreditAmount: e.target.value })}
                  data-testid="input-kie-credit-amount"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-credits">User Credits to Sell</Label>
                <Input
                  id="user-credits"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="15000"
                  value={economicsForm.userCreditAmount}
                  onChange={(e) => setEconomicsForm({ ...economicsForm, userCreditAmount: e.target.value })}
                  data-testid="input-user-credit-amount"
                />
              </div>
              <div>
                <Label htmlFor="profit-margin">Profit Margin Target (%)</Label>
                <Input
                  id="profit-margin"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="50"
                  value={economicsForm.profitMargin}
                  onChange={(e) => setEconomicsForm({ ...economicsForm, profitMargin: e.target.value })}
                  data-testid="input-profit-margin"
                />
              </div>
            </div>

            {economicsForm.kiePurchaseAmount && economicsForm.kieCreditAmount && economicsForm.userCreditAmount && (
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <h4 className="font-semibold text-sm">Real-Time Calculator Preview</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Kie Rate</p>
                    <p className="font-semibold" data-testid="preview-kie-rate">
                      ${economicsForm.kiePurchaseAmount} = {Number(economicsForm.kieCreditAmount).toLocaleString()} credits
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">User Rate</p>
                    <p className="font-semibold" data-testid="preview-user-rate">
                      ${economicsForm.kiePurchaseAmount} = {Number(economicsForm.userCreditAmount).toLocaleString()} credits
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Multiplier</p>
                    <p className="font-semibold text-primary" data-testid="preview-multiplier">
                      {(Number(economicsForm.userCreditAmount) / Number(economicsForm.kieCreditAmount)).toFixed(2)}x
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-muted-foreground text-xs">Example:</p>
                  <p className="text-sm font-medium" data-testid="preview-example">
                    If Kie charges 35 credits, you charge ~{Math.round(35 * (Number(economicsForm.userCreditAmount) / Number(economicsForm.kieCreditAmount)))} user credits 
                    ({economicsForm.profitMargin}% margin)
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingEconomics(false)}
              data-testid="button-cancel-economics"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const kiePurchase = Number(economicsForm.kiePurchaseAmount);
                const kieCredit = Number(economicsForm.kieCreditAmount);
                const userCredit = Number(economicsForm.userCreditAmount);
                const margin = Number(economicsForm.profitMargin);

                if (!Number.isFinite(kiePurchase) || kiePurchase < 1) {
                  toast({ title: "Error", description: "Please enter a valid Kie purchase amount", variant: "destructive" });
                  return;
                }
                if (!Number.isFinite(kieCredit) || kieCredit < 1) {
                  toast({ title: "Error", description: "Please enter a valid Kie credit amount", variant: "destructive" });
                  return;
                }
                if (!Number.isFinite(userCredit) || userCredit < 1) {
                  toast({ title: "Error", description: "Please enter a valid user credit amount", variant: "destructive" });
                  return;
                }
                if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
                  toast({ title: "Error", description: "Please enter a profit margin between 0 and 100", variant: "destructive" });
                  return;
                }

                updateEconomicsMutation.mutate({
                  kiePurchaseAmount: Math.round(kiePurchase),
                  kieCreditAmount: Math.round(kieCredit),
                  userCreditAmount: Math.round(userCredit),
                  profitMargin: Math.round(margin),
                });
              }}
              disabled={updateEconomicsMutation.isPending}
              data-testid="button-save-economics"
            >
              {updateEconomicsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Economics
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Pricing Dialog */}
      <Dialog open={editingPricingId !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingPricingId(null);
          setEditPricing({ feature: "", model: "", category: "", creditCost: "", kieCreditCost: "", description: "" });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pricing Entry</DialogTitle>
            <DialogDescription>
              Update pricing configuration for this model
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-feature">Feature</Label>
              <Input
                id="edit-feature"
                placeholder="e.g., video, image, music, chat"
                value={editPricing.feature}
                onChange={(e) => setEditPricing({ ...editPricing, feature: e.target.value })}
                data-testid="input-edit-pricing-feature"
              />
            </div>
            <div>
              <Label htmlFor="edit-model">Model Name</Label>
              <Input
                id="edit-model"
                placeholder="e.g., veo-3.1, gpt-4o"
                value={editPricing.model}
                onChange={(e) => setEditPricing({ ...editPricing, model: e.target.value })}
                data-testid="input-edit-pricing-model"
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                placeholder="e.g., generation, chat, voice, audio"
                value={editPricing.category}
                onChange={(e) => setEditPricing({ ...editPricing, category: e.target.value })}
                data-testid="input-edit-pricing-category"
              />
            </div>
            <div>
              <Label htmlFor="edit-kieCreditCost">Kie Credit Cost</Label>
              <Input
                id="edit-kieCreditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 35"
                value={editPricing.kieCreditCost}
                onChange={(e) => setEditPricing({ ...editPricing, kieCreditCost: e.target.value })}
                data-testid="input-edit-kie-credit-cost"
              />
            </div>
            {editPricing.kieCreditCost && Number(editPricing.kieCreditCost) > 0 && (
              <div className="p-4 bg-muted/5 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">Auto-Calculator</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on your Plan Economics settings</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {planEconomicsData ? (
                  (() => {
                    const calc = calculateSuggestedCredits(Number(editPricing.kieCreditCost), planEconomicsData);
                    return calc ? (
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">Input: Kie charges {editPricing.kieCreditCost} credits</p>
                        <p className="text-muted-foreground">Your cost: ${calc.yourCost.toFixed(4)}</p>
                        <p className="text-muted-foreground">With {calc.details.margin}% margin: ${calc.withMargin.toFixed(4)}</p>
                        <p className="font-semibold text-primary">→ Suggested: {calc.suggestedUserCredits} user credits</p>
                      </div>
                    ) : null;
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground">Configure Plan Economics first</p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="edit-creditCost">Credit Cost</Label>
              <Input
                id="edit-creditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 100"
                value={editPricing.creditCost}
                onChange={(e) => setEditPricing({ ...editPricing, creditCost: e.target.value })}
                data-testid="input-edit-pricing-cost"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Input
                id="edit-description"
                placeholder="e.g., High-quality video generation"
                value={editPricing.description}
                onChange={(e) => setEditPricing({ ...editPricing, description: e.target.value })}
                data-testid="input-edit-pricing-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const { feature, model, category, creditCost, kieCreditCost, description } = editPricing;
                const trimmedFeature = feature.trim();
                const trimmedModel = model.trim();
                const trimmedCategory = category.trim();
                const trimmedCost = creditCost.trim();
                const trimmedKieCost = kieCreditCost.trim();
                const trimmedDescription = description.trim();
                
                if (!trimmedFeature || !trimmedModel || !trimmedCategory || !trimmedCost) {
                  toast({ title: "Error", description: "Feature, Model, Category, and Cost are required", variant: "destructive" });
                  return;
                }
                
                const cost = Number(trimmedCost);
                if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost < 0) {
                  toast({ title: "Error", description: "Please enter a valid whole number for cost", variant: "destructive" });
                  return;
                }
                
                const updates: any = {
                  feature: trimmedFeature,
                  model: trimmedModel,
                  category: trimmedCategory,
                  creditCost: cost,
                };
                
                if (trimmedKieCost) {
                  const kieCost = Number(trimmedKieCost);
                  if (!Number.isFinite(kieCost) || !Number.isInteger(kieCost) || kieCost < 0) {
                    toast({ title: "Error", description: "Please enter a valid whole number for Kie credit cost", variant: "destructive" });
                    return;
                  }
                  updates.kieCreditCost = kieCost;
                }
                
                if (trimmedDescription) {
                  updates.description = trimmedDescription;
                }
                
                if (editingPricingId) {
                  updatePricingMutation.mutate({ id: editingPricingId, updates });
                }
              }}
              disabled={updatePricingMutation.isPending}
              data-testid="button-submit-edit-pricing"
            >
              {updatePricingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Pricing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Pricing Dialog */}
      <Dialog open={addingPricing} onOpenChange={setAddingPricing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pricing Entry</DialogTitle>
            <DialogDescription>
              Add a new pricing configuration for an AI model or feature
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="feature">Feature</Label>
              <Input
                id="feature"
                placeholder="e.g., video, image, music, chat"
                value={newPricing.feature}
                onChange={(e) => setNewPricing({ ...newPricing, feature: e.target.value })}
                data-testid="input-new-pricing-feature"
              />
            </div>
            <div>
              <Label htmlFor="model">Model Name</Label>
              <Input
                id="model"
                placeholder="e.g., veo-3.1, gpt-4o"
                value={newPricing.model}
                onChange={(e) => setNewPricing({ ...newPricing, model: e.target.value })}
                data-testid="input-new-pricing-model"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g., generation, chat, voice, audio"
                value={newPricing.category}
                onChange={(e) => setNewPricing({ ...newPricing, category: e.target.value })}
                data-testid="input-new-pricing-category"
              />
            </div>
            <div>
              <Label htmlFor="kieCreditCost">Kie Credit Cost</Label>
              <Input
                id="kieCreditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 35"
                value={newPricing.kieCreditCost}
                onChange={(e) => setNewPricing({ ...newPricing, kieCreditCost: e.target.value })}
                data-testid="input-kie-credit-cost"
              />
            </div>
            {newPricing.kieCreditCost && Number(newPricing.kieCreditCost) > 0 && (
              <div className="p-4 bg-muted/5 rounded-lg border space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">Auto-Calculator</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Based on your Plan Economics settings</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {planEconomicsData ? (
                  (() => {
                    const calc = calculateSuggestedCredits(Number(newPricing.kieCreditCost), planEconomicsData);
                    return calc ? (
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">Input: Kie charges {newPricing.kieCreditCost} credits</p>
                        <p className="text-muted-foreground">Your cost: ${calc.yourCost.toFixed(4)}</p>
                        <p className="text-muted-foreground">With {calc.details.margin}% margin: ${calc.withMargin.toFixed(4)}</p>
                        <p className="font-semibold text-primary">→ Suggested: {calc.suggestedUserCredits} user credits</p>
                      </div>
                    ) : null;
                  })()
                ) : (
                  <p className="text-sm text-muted-foreground">Configure Plan Economics first</p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="creditCost">Credit Cost</Label>
              <Input
                id="creditCost"
                type="number"
                min="0"
                step="1"
                placeholder="e.g., 100"
                value={newPricing.creditCost}
                onChange={(e) => setNewPricing({ ...newPricing, creditCost: e.target.value })}
                data-testid="input-new-pricing-cost"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="e.g., High-quality video generation"
                value={newPricing.description}
                onChange={(e) => setNewPricing({ ...newPricing, description: e.target.value })}
                data-testid="input-new-pricing-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const { feature, model, category, creditCost, kieCreditCost, description } = newPricing;
                const trimmedFeature = feature.trim();
                const trimmedModel = model.trim();
                const trimmedCategory = category.trim();
                const trimmedCost = creditCost.trim();
                const trimmedKieCost = kieCreditCost.trim();
                const trimmedDescription = description.trim();
                
                if (!trimmedFeature || !trimmedModel || !trimmedCategory || !trimmedCost) {
                  toast({ title: "Error", description: "Feature, Model, Category, and Cost are required", variant: "destructive" });
                  return;
                }
                
                const cost = Number(trimmedCost);
                if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost < 0) {
                  toast({ title: "Error", description: "Please enter a valid whole number for cost", variant: "destructive" });
                  return;
                }
                
                const mutationData: any = {
                  feature: trimmedFeature,
                  model: trimmedModel,
                  category: trimmedCategory,
                  creditCost: cost,
                  description: trimmedDescription || undefined,
                };
                
                if (trimmedKieCost) {
                  const kieCost = Number(trimmedKieCost);
                  if (!Number.isFinite(kieCost) || !Number.isInteger(kieCost) || kieCost < 0) {
                    toast({ title: "Error", description: "Please enter a valid whole number for Kie credit cost", variant: "destructive" });
                    return;
                  }
                  mutationData.kieCreditCost = kieCost;
                }
                
                addPricingMutation.mutate(mutationData);
              }}
              disabled={addPricingMutation.isPending}
              data-testid="button-submit-new-pricing"
            >
              {addPricingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Pricing"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Plan Dialog */}
      <Dialog open={creatingPlan || editingPlanId !== null} onOpenChange={(open) => {
        if (!open) {
          setCreatingPlan(false);
          setEditingPlanId(null);
          setEditPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "", stripePriceId: "", stripeProductId: "" });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? "Edit Plan" : "Create New Plan"}</DialogTitle>
            <DialogDescription>
              {editingPlanId ? "Update the subscription plan details below." : "Create a new subscription plan with pricing and credits."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-name">Name (unique ID)</Label>
                <Input
                  id="plan-name"
                  placeholder="e.g., premium, enterprise"
                  value={creatingPlan ? newPlanData.name : editPlanData.name}
                  onChange={(e) => creatingPlan 
                    ? setNewPlanData({ ...newPlanData, name: e.target.value })
                    : setEditPlanData({ ...editPlanData, name: e.target.value })
                  }
                  data-testid="input-plan-name"
                />
              </div>
              <div>
                <Label htmlFor="plan-display-name">Display Name</Label>
                <Input
                  id="plan-display-name"
                  placeholder="e.g., Premium Plan"
                  value={creatingPlan ? newPlanData.displayName : editPlanData.displayName}
                  onChange={(e) => creatingPlan
                    ? setNewPlanData({ ...newPlanData, displayName: e.target.value })
                    : setEditPlanData({ ...editPlanData, displayName: e.target.value })
                  }
                  data-testid="input-plan-display-name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                placeholder="Brief description of the plan"
                value={creatingPlan ? newPlanData.description : editPlanData.description}
                onChange={(e) => creatingPlan
                  ? setNewPlanData({ ...newPlanData, description: e.target.value })
                  : setEditPlanData({ ...editPlanData, description: e.target.value })
                }
                data-testid="input-plan-description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-price">Price (USD/month) - Legacy</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="9.99"
                  value={creatingPlan ? newPlanData.price : editPlanData.price}
                  onChange={(e) => creatingPlan
                    ? setNewPlanData({ ...newPlanData, price: e.target.value })
                    : setEditPlanData({ ...editPlanData, price: e.target.value })
                  }
                  data-testid="input-plan-price"
                />
              </div>
              <div>
                <Label htmlFor="plan-credits">Credits/Month</Label>
                <Input
                  id="plan-credits"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="1000"
                  value={creatingPlan ? newPlanData.creditsPerMonth : editPlanData.creditsPerMonth}
                  onChange={(e) => creatingPlan
                    ? setNewPlanData({ ...newPlanData, creditsPerMonth: e.target.value })
                    : setEditPlanData({ ...editPlanData, creditsPerMonth: e.target.value })
                  }
                  data-testid="input-plan-credits"
                />
              </div>
            </div>
            <div className="pt-4 border-t">
              <Label htmlFor="plan-billing-period">Billing Period</Label>
              <Select
                value={creatingPlan ? newPlanData.billingPeriod : editPlanData.billingPeriod}
                onValueChange={(value) => creatingPlan
                  ? setNewPlanData({ ...newPlanData, billingPeriod: value as "monthly" | "annual" | "trial" })
                  : setEditPlanData({ ...editPlanData, billingPeriod: value as "monthly" | "annual" | "trial" })
                }
              >
                <SelectTrigger data-testid="select-plan-billing-period">
                  <SelectValue placeholder="Select billing period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!creatingPlan && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <Label htmlFor="plan-stripe-price-id">Stripe Price ID (optional)</Label>
                  <Input
                    id="plan-stripe-price-id"
                    placeholder="price_xxxxxxxxxxxxx"
                    value={editPlanData.stripePriceId}
                    onChange={(e) => setEditPlanData({ ...editPlanData, stripePriceId: e.target.value })}
                    data-testid="input-plan-stripe-price-id"
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="plan-stripe-product-id">Stripe Product ID (optional)</Label>
                  <Input
                    id="plan-stripe-product-id"
                    placeholder="prod_xxxxxxxxxxxxx"
                    value={editPlanData.stripeProductId}
                    onChange={(e) => setEditPlanData({ ...editPlanData, stripeProductId: e.target.value })}
                    data-testid="input-plan-stripe-product-id"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreatingPlan(false);
                setEditingPlanId(null);
                setEditPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "", stripePriceId: "", stripeProductId: "" });
                setNewPlanData({ name: "", displayName: "", description: "", price: "", billingPeriod: "monthly", creditsPerMonth: "" });
              }}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              data-testid="button-cancel-plan-dialog"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const data = creatingPlan ? newPlanData : editPlanData;
                const name = data.name.trim();
                const displayName = data.displayName.trim();
                const description = data.description.trim();
                const priceStr = data.price.trim();
                const creditsStr = data.creditsPerMonth.trim();

                if (!name || !displayName || !priceStr || !creditsStr) {
                  toast({ title: "Error", description: "Name, Display Name, Price, and Credits are required", variant: "destructive" });
                  return;
                }

                const price = parseFloat(priceStr);
                const credits = parseInt(creditsStr);

                if (isNaN(price) || price < 0) {
                  toast({ title: "Error", description: "Price must be a valid positive number", variant: "destructive" });
                  return;
                }

                if (isNaN(credits) || credits < 0) {
                  toast({ title: "Error", description: "Credits must be a valid positive number", variant: "destructive" });
                  return;
                }

                const priceInCents = Math.round(price * 100);

                if (creatingPlan) {
                  const createData: any = {
                    name,
                    displayName,
                    description,
                    price: priceInCents,
                    billingPeriod: newPlanData.billingPeriod,
                    creditsPerMonth: credits,
                  };
                  createPlanMutation.mutate(createData);
                } else {
                  const updates: any = {
                    planId: editingPlanId!,
                    name,
                    displayName,
                    description,
                    price: priceInCents,
                    billingPeriod: editPlanData.billingPeriod,
                    creditsPerMonth: credits,
                  };
                  
                  const stripePriceId = editPlanData.stripePriceId.trim();
                  const stripeProductId = editPlanData.stripeProductId.trim();
                  if (stripePriceId) updates.stripePriceId = stripePriceId;
                  if (stripeProductId) updates.stripeProductId = stripeProductId;

                  updatePlanMutation.mutate(updates);
                }
              }}
              disabled={createPlanMutation.isPending || updatePlanMutation.isPending}
              data-testid="button-save-plan-dialog"
            >
              {createPlanMutation.isPending || updatePlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {creatingPlan ? "Creating..." : "Saving..."}
                </>
              ) : (
                creatingPlan ? "Create Plan" : "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation */}
      <AlertDialog open={deletingPlanId !== null} onOpenChange={(open) => !open && setDeletingPlanId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the plan "{plans.find(p => p.id === deletingPlanId)?.displayName || 'Unknown'}". 
              {' '}Users with active subscriptions to this plan will not be affected, but you cannot delete a plan that has active subscriptions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePlanMutation.isPending} data-testid="button-cancel-delete-plan">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPlanId && deletePlanMutation.mutate(deletingPlanId)}
              disabled={deletePlanMutation.isPending}
              data-testid="button-confirm-delete-plan"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePlanMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Plan"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Announcement Dialog */}
      <Dialog open={creatingAnnouncement} onOpenChange={setCreatingAnnouncement}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAnnouncementId ? "Edit" : "Create"} Announcement</DialogTitle>
            <DialogDescription>
              Configure announcement bar with plan targeting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="announcement-message">Message *</Label>
              <Textarea
                id="announcement-message"
                value={announcementForm.message}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                placeholder="Enter announcement message..."
                rows={3}
                maxLength={500}
                data-testid="input-announcement-message"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {announcementForm.message.length}/500 characters
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="announcement-type">Type</Label>
                <Select
                  value={announcementForm.type}
                  onValueChange={(value: any) => setAnnouncementForm({ ...announcementForm, type: value })}
                >
                  <SelectTrigger data-testid="select-announcement-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="warning">Warning (Yellow)</SelectItem>
                    <SelectItem value="success">Success (Green)</SelectItem>
                    <SelectItem value="promo">Promo (Purple)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <div className="flex items-center space-x-2 h-9">
                  <input
                    type="checkbox"
                    id="announcement-active"
                    checked={announcementForm.isActive}
                    onChange={(e) => setAnnouncementForm({ ...announcementForm, isActive: e.target.checked })}
                    className="h-4 w-4"
                    data-testid="checkbox-announcement-active"
                  />
                  <Label htmlFor="announcement-active" className="cursor-pointer">
                    Active
                  </Label>
                </div>
              </div>
            </div>
            <div>
              <Label>Target Plans (leave empty for all plans)</Label>
              <div className="flex gap-2 mt-2">
                {["free", "starter", "pro"].map((plan) => (
                  <div key={plan} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`plan-${plan}`}
                      checked={announcementForm.targetPlans.includes(plan)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAnnouncementForm({
                            ...announcementForm,
                            targetPlans: [...announcementForm.targetPlans, plan],
                          });
                        } else {
                          setAnnouncementForm({
                            ...announcementForm,
                            targetPlans: announcementForm.targetPlans.filter((p) => p !== plan),
                          });
                        }
                      }}
                      className="h-4 w-4"
                      data-testid={`checkbox-plan-${plan}`}
                    />
                    <Label htmlFor={`plan-${plan}`} className="capitalize cursor-pointer">
                      {plan}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="announcement-start">Start Date (optional)</Label>
                <Input
                  id="announcement-start"
                  type="datetime-local"
                  value={announcementForm.startDate}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, startDate: e.target.value })}
                  data-testid="input-announcement-start"
                />
              </div>
              <div>
                <Label htmlFor="announcement-end">End Date (optional)</Label>
                <Input
                  id="announcement-end"
                  type="datetime-local"
                  value={announcementForm.endDate}
                  onChange={(e) => setAnnouncementForm({ ...announcementForm, endDate: e.target.value })}
                  data-testid="input-announcement-end"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatingAnnouncement(false)}
              data-testid="button-cancel-announcement"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!announcementForm.message.trim()) {
                  toast({
                    title: "Error",
                    description: "Message is required",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  const payload = {
                    message: announcementForm.message.trim(),
                    type: announcementForm.type,
                    targetPlans: announcementForm.targetPlans.length > 0 ? announcementForm.targetPlans : null,
                    isActive: announcementForm.isActive,
                    startDate: announcementForm.startDate || null,
                    endDate: announcementForm.endDate || null,
                  };
                  
                  if (editingAnnouncementId) {
                    await apiRequest("PATCH", `/api/admin/announcements/${editingAnnouncementId}`, payload);
                  } else {
                    await apiRequest("POST", "/api/admin/announcements", payload);
                  }
                  
                  queryClient.invalidateQueries({ queryKey: ["/api/admin/announcements"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/announcements/active"] });
                  setCreatingAnnouncement(false);
                  toast({
                    title: "Success",
                    description: `Announcement ${editingAnnouncementId ? "updated" : "created"} successfully`,
                  });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || `Failed to ${editingAnnouncementId ? "update" : "create"} announcement`,
                    variant: "destructive",
                  });
                }
              }}
              data-testid="button-save-announcement"
            >
              {editingAnnouncementId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
