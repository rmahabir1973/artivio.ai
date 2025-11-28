import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CreditCard, User, Mail, Calendar, Shield, ExternalLink, RefreshCw, Copy, Key, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UsageAnalytics } from "@/components/usage-analytics";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";

export default function Profile() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  // Fetch current subscription
  const { data: subscription, isLoading: subLoading, isError: subError } = useQuery<any>({
    queryKey: ["/api/subscriptions/current"],
    enabled: !!user,
    retry: 1, // Only retry once to avoid long waits
  });

  // API Keys state
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch user's API keys
  const { data: apiKeys = [], isLoading: keysLoading } = useQuery<any[]>({
    queryKey: ["/api/user/api-keys"],
    enabled: !!user,
  });

  // Create API key mutation
  const createApiKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/user/api-keys", { name });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      setCreatingApiKey(false);
      setNewKeyName("");
      setNewlyCreatedKey(data.key);
      toast({
        title: "API Key Created",
        description: "Make sure to copy your key - it won't be shown again!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create API key",
        variant: "destructive",
      });
    },
  });

  // Revoke API key mutation
  const revokeApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest("POST", `/api/user/api-keys/${keyId}/revoke`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({
        title: "API Key Revoked",
        description: "The API key has been deactivated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke API key",
        variant: "destructive",
      });
    },
  });

  // Delete API key mutation
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest("DELETE", `/api/user/api-keys/${keyId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/api-keys"] });
      toast({
        title: "API Key Deleted",
        description: "The API key has been permanently deleted",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete API key",
        variant: "destructive",
      });
    },
  });

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({
      title: "Copied!",
      description: "API key copied to clipboard",
    });
  };

  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    toast({
      title: "Refreshed",
      description: "Your profile data has been refreshed.",
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const typedUser = user as any;
  const initials = typedUser?.firstName && typedUser?.lastName
    ? `${typedUser.firstName[0]}${typedUser.lastName[0]}`
    : typedUser?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefreshData}
          data-testid="button-refresh-profile"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* User Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your personal details and account status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={typedUser?.profileImageUrl} alt={typedUser?.email || "User"} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold">
                  {typedUser?.firstName && typedUser?.lastName
                    ? `${typedUser.firstName} ${typedUser.lastName}`
                    : "User"}
                </h2>
                {typedUser?.isAdmin && (
                  <Badge variant="default" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{typedUser?.email}</span>
              </div>
              {typedUser?.createdAt && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Member since {format(new Date(typedUser.createdAt), "MMMM d, yyyy")}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                User ID
              </div>
              <p className="font-mono text-sm bg-muted px-3 py-2 rounded-md">{typedUser?.id}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Available Credits
              </div>
              <p className="text-2xl font-bold text-primary">{typedUser?.credits?.toLocaleString() || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription & Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription & Credits</CardTitle>
          <CardDescription>Manage your subscription plan and credits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : subError || !subscription ? (
            <>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold">Current Plan</p>
                  <p className="text-sm text-muted-foreground">No active subscription</p>
                </div>
                <Badge variant="secondary">Inactive</Badge>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Artivio AI uses a credit-based system. Each AI generation costs credits based on the feature and complexity.
                </p>
                <p className="text-sm text-muted-foreground">
                  Subscribe to a plan to receive monthly credits and access all features.
                </p>
              </div>

              <div className="flex gap-2">
                <Button asChild variant="default" data-testid="button-subscribe">
                  <Link href="/pricing">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Subscribe Now
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-semibold">Current Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.plan?.displayName || subscription.plan?.name || "Unknown Plan"}
                  </p>
                  {subscription.plan?.creditsPerMonth && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {subscription.plan.creditsPerMonth.toLocaleString()} credits/month
                    </p>
                  )}
                </div>
                <Badge variant={subscription.status === "active" ? "default" : subscription.status === "trialing" ? "default" : "secondary"}>
                  {subscription.status === "active" ? "Active" : subscription.status === "trialing" ? "Trial" : "Inactive"}
                </Badge>
              </div>

              {subscription?.currentPeriodEnd && (
                <div className="text-sm text-muted-foreground">
                  Next billing date: {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Artivio AI uses a credit-based system. Each AI generation costs credits based on the feature and complexity.
                </p>
                {subscription?.plan?.displayName ? (
                  <p className="text-sm text-muted-foreground">
                    Your {subscription.plan.displayName} plan includes {subscription.plan.creditsPerMonth?.toLocaleString()} credits per month.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Subscribe to a plan to receive monthly credits and access all features.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button asChild variant="default" data-testid="button-manage-subscription">
                  <Link href="/pricing">
                    <CreditCard className="h-4 w-4 mr-2" />
                    {subscription?.plan?.name ? "Manage Subscription" : "Subscribe Now"}
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Authentication & Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication & Security</CardTitle>
          <CardDescription>Manage your login and security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="font-semibold">Authentication Provider</p>
            <p className="text-sm text-muted-foreground">
              Your account uses Replit Auth, which supports multiple login methods including Google, GitHub, X (Twitter), Apple, and Email.
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <p className="font-semibold mb-2">Password Management</p>
              <p className="text-sm text-muted-foreground mb-4">
                Password reset and management are handled securely through your authentication provider.
              </p>
              <Button
                variant="outline"
                data-testid="button-reset-password"
                onClick={() => {
                  // Force full page navigation for mobile Safari compatibility
                  window.location.href = '/api/logout';
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Logout & Reset Password
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                After logging out, use the "Forgot password?" link on the login screen to reset your password.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-2">Account Security</p>
              <p className="text-sm text-muted-foreground">
                Your account is secured with industry-standard OAuth 2.0 and OpenID Connect protocols.
                All sessions are encrypted and stored securely.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help & Support Card */}
      <Card>
        <CardHeader>
          <CardTitle>Help & Support</CardTitle>
          <CardDescription>Need assistance with your account?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            For credit purchases, plan upgrades, or account issues, please contact an administrator.
          </p>
          {typedUser?.isAdmin && (
            <Button variant="outline" asChild data-testid="button-go-to-admin">
              <a href="/admin">
                <Shield className="h-4 w-4 mr-2" />
                Go to Admin Panel
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* API Keys Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys for external integrations like Tasklet AI</CardDescription>
          </div>
          <Button onClick={() => setCreatingApiKey(true)} data-testid="button-create-api-key">
            <Plus className="h-4 w-4 mr-2" />
            Create Key
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {keysLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys yet</p>
              <p className="text-sm">Create an API key to integrate with AI agents like Tasklet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key: any) => (
                <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{key.name}</p>
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "Active" : "Revoked"}
                      </Badge>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground">{key.keyPreview}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Used: {key.usageCount?.toLocaleString() || 0} times</span>
                      {key.lastUsedAt && (
                        <span>Last used: {format(new Date(key.lastUsedAt), "MMM d, yyyy")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {key.isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm("Revoke this API key? It will no longer work for authentication.")) {
                            revokeApiKeyMutation.mutate(key.id);
                          }
                        }}
                        disabled={revokeApiKeyMutation.isPending}
                        data-testid={`button-revoke-key-${key.id}`}
                      >
                        Revoke
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Delete this API key permanently? This action cannot be undone.")) {
                          deleteApiKeyMutation.mutate(key.id);
                        }
                      }}
                      disabled={deleteApiKeyMutation.isPending}
                      data-testid={`button-delete-key-${key.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="font-semibold">API Documentation</p>
            <p className="text-sm text-muted-foreground">
              Use your API keys to integrate Artivio AI with external services. Base URL: <code className="bg-muted px-1 rounded">/api/v1</code>
            </p>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mt-2">Available Endpoints:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><code className="bg-muted px-1 rounded">POST /api/v1/video/generate</code> - Generate AI videos</li>
                <li><code className="bg-muted px-1 rounded">POST /api/v1/image/generate</code> - Generate AI images</li>
                <li><code className="bg-muted px-1 rounded">POST /api/v1/audio/generate</code> - Generate AI music</li>
                <li><code className="bg-muted px-1 rounded">GET /api/v1/generations/:id</code> - Check generation status</li>
                <li><code className="bg-muted px-1 rounded">GET /api/v1/credits</code> - Check credit balance</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={creatingApiKey} onOpenChange={setCreatingApiKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for integrating with AI agents like Tasklet
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Tasklet Integration"
                data-testid="input-api-key-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingApiKey(false)} data-testid="button-cancel-create-key">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newKeyName.trim()) {
                  toast({
                    title: "Error",
                    description: "Please enter a name for your API key",
                    variant: "destructive",
                  });
                  return;
                }
                createApiKeyMutation.mutate(newKeyName);
              }}
              disabled={createApiKeyMutation.isPending}
              data-testid="button-submit-create-key"
            >
              {createApiKeyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Key"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Key Dialog */}
      <Dialog open={!!newlyCreatedKey} onOpenChange={() => setNewlyCreatedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your New API Key</DialogTitle>
            <DialogDescription>
              Copy your API key now. It will not be shown again!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <Input
                value={newlyCreatedKey || ""}
                readOnly
                className="font-mono"
                data-testid="input-new-api-key-value"
              />
              <Button
                variant="outline"
                onClick={() => newlyCreatedKey && handleCopyKey(newlyCreatedKey)}
                data-testid="button-copy-api-key"
              >
                {copiedKey ? "Copied!" : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Use this key in your Authorization header: <code className="bg-muted px-1 rounded">Bearer YOUR_API_KEY</code>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewlyCreatedKey(null)} data-testid="button-close-new-key-dialog">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage Analytics */}
      <UsageAnalytics />
    </div>
  );
}
