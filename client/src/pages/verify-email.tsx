import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, Mail, Sparkles } from "lucide-react";

type VerificationStatus = "loading" | "success" | "error" | "expired";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (data.success) {
          setStatus("success");
          setMessage(data.message || "Your email has been verified successfully!");
        } else {
          if (data.error === "TOKEN_EXPIRED") {
            setStatus("expired");
          } else {
            setStatus("error");
          }
          setMessage(data.message || "Verification failed.");
        }
      } catch (error) {
        setStatus("error");
        setMessage("An error occurred during verification. Please try again.");
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-black p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-8 w-8 text-purple-400" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Artivio AI
            </h1>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {status === "loading" && (
                <Loader2 className="h-12 w-12 text-purple-400 animate-spin" />
              )}
              {status === "success" && (
                <CheckCircle className="h-12 w-12 text-green-500" />
              )}
              {status === "error" && (
                <XCircle className="h-12 w-12 text-red-500" />
              )}
              {status === "expired" && (
                <Mail className="h-12 w-12 text-yellow-500" />
              )}
            </div>
            <CardTitle>
              {status === "loading" && "Verifying your email..."}
              {status === "success" && "Email Verified!"}
              {status === "error" && "Verification Failed"}
              {status === "expired" && "Link Expired"}
            </CardTitle>
            <CardDescription className="mt-2">
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status === "success" && (
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => setLocation("/login")}
                data-testid="button-go-to-login"
              >
                Continue to Login
              </Button>
            )}
            
            {status === "expired" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Your verification link has expired. Request a new one to verify your email.
                </p>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setLocation("/resend-verification")}
                  data-testid="button-resend-verification"
                >
                  Request New Link
                </Button>
              </div>
            )}
            
            {status === "error" && (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setLocation("/resend-verification")}
                  data-testid="button-resend-verification"
                >
                  Request New Verification Link
                </Button>
                <Button
                  className="w-full"
                  variant="ghost"
                  onClick={() => setLocation("/login")}
                  data-testid="button-back-to-login"
                >
                  Back to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
