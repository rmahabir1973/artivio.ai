import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Shield, Users, Key, Trash2, Edit, Plus, ToggleLeft, ToggleRight, BarChart3, TrendingUp, Activity, DollarSign, Save, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User, ApiKey, Pricing, SubscriptionPlan } from "@shared/schema";

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
  const [editPricingCost, setEditPricingCost] = useState("");
  const [addingPricing, setAddingPricing] = useState(false);
  const [newPricing, setNewPricing] = useState({ feature: "", model: "", category: "", creditCost: "" });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
    mutationFn: async ({ id, creditCost }: { id: string; creditCost: number }) => {
      return await apiRequest("PATCH", `/api/admin/pricing/${id}`, { creditCost });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      setEditingPricingId(null);
      setEditPricingCost("");
      toast({ title: "Success", description: "Pricing updated successfully" });
    },
    onError: (error: Error) => {
      setEditingPricingId(null);
      setEditPricingCost("");
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update pricing", 
        variant: "destructive" 
      });
    },
  });

  const addPricingMutation = useMutation({
    mutationFn: async (data: { feature: string; model: string; category: string; creditCost: number }) => {
      return await apiRequest("POST", "/api/admin/pricing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      setAddingPricing(false);
      setNewPricing({ feature: "", model: "", category: "", creditCost: "" });
      toast({ title: "Success", description: "Pricing entry added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add pricing", variant: "destructive" });
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
    <div className="p-8 max-w-7xl mx-auto">
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
                          {editingPricingId === pricing.id ? (
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={editPricingCost}
                              onChange={(e) => setEditPricingCost(e.target.value)}
                              className="w-24 text-right"
                              data-testid={`input-pricing-cost-${pricing.id}`}
                              autoFocus
                            />
                          ) : (
                            <span className="font-semibold" data-testid={`text-pricing-cost-value-${pricing.id}`}>
                              {pricing.creditCost.toLocaleString()}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingPricingId === pricing.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  const trimmed = editPricingCost.trim();
                                  if (trimmed === '') {
                                    toast({ title: "Error", description: "Cost cannot be empty", variant: "destructive" });
                                    return;
                                  }
                                  const cost = Number(trimmed);
                                  if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost < 0) {
                                    toast({ title: "Error", description: "Please enter a valid whole number (0 or greater)", variant: "destructive" });
                                    return;
                                  }
                                  updatePricingMutation.mutate({ id: pricing.id, creditCost: cost });
                                }}
                                disabled={updatePricingMutation.isPending}
                                data-testid={`button-save-pricing-${pricing.id}`}
                              >
                                {updatePricingMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingPricingId(null);
                                  setEditPricingCost("");
                                }}
                                disabled={updatePricingMutation.isPending}
                                data-testid={`button-cancel-pricing-${pricing.id}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPricingId(pricing.id);
                                setEditPricingCost(pricing.creditCost.toString());
                              }}
                              data-testid={`button-edit-pricing-${pricing.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const { feature, model, category, creditCost } = newPricing;
                const trimmedFeature = feature.trim();
                const trimmedModel = model.trim();
                const trimmedCategory = category.trim();
                const trimmedCost = creditCost.trim();
                
                if (!trimmedFeature || !trimmedModel || !trimmedCategory || !trimmedCost) {
                  toast({ title: "Error", description: "All fields are required and cannot be empty", variant: "destructive" });
                  return;
                }
                
                const cost = Number(trimmedCost);
                if (!Number.isFinite(cost) || !Number.isInteger(cost) || cost < 0) {
                  toast({ title: "Error", description: "Please enter a valid whole number for cost", variant: "destructive" });
                  return;
                }
                
                addPricingMutation.mutate({
                  feature: trimmedFeature,
                  model: trimmedModel,
                  category: trimmedCategory,
                  creditCost: cost,
                });
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
    </div>
  );
}
