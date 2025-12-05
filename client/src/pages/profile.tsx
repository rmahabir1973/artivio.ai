import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, CreditCard, User, Mail, Calendar, Shield, ExternalLink, RefreshCw, Key } from "lucide-react";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { UsageAnalytics } from "@/components/usage-analytics";
import { useQuery } from "@tanstack/react-query";
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
              Your account uses Artivio's secure authentication system with Google OAuth integration. You can sign in using your Google account or email and password.
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
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            For credit purchases, plan upgrades, billing questions, or any account issues, our support team is here to help.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="default" asChild data-testid="button-open-support">
              <Link href="/support">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Support Ticket
              </Link>
            </Button>
            {typedUser?.isAdmin && (
              <Button variant="outline" asChild data-testid="button-go-to-admin">
                <a href="/admin">
                  <Shield className="h-4 w-4 mr-2" />
                  Go to Admin Panel
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API Access Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Access
          </CardTitle>
          <CardDescription>Integrate Artivio AI with your applications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              API access is available upon request for enterprise customers and developers who want to integrate Artivio AI's powerful generation capabilities into their own applications.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              With API access, you can programmatically generate videos, images, and audio using your credit balance.
            </p>
          </div>
          <Button variant="outline" asChild data-testid="button-request-api-access">
            <Link href="/support">
              <Key className="h-4 w-4 mr-2" />
              Request API Access
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Usage Analytics */}
      <UsageAnalytics />
    </div>
  );
}
