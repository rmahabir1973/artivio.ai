import { ModernHeader } from "@/components/modern-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <ModernHeader />
      
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Introduction</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Welcome to Artivio AI ("we," "our," or "us"). We are committed to protecting your privacy and ensuring
                the security of your personal information. This Privacy Policy explains how we collect, use, disclose,
                and safeguard your information when you use our AI content generation platform.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Account Information</h3>
                <p>
                  When you create an account, we collect your name, email address, and authentication credentials
                  through our secure Replit authentication system. We may also collect optional profile information
                  you choose to provide.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Content You Create</h3>
                <p>
                  We store the AI-generated content you create using our platform, including videos, images, music,
                  voice clones, and chat conversations. This content is associated with your account for retrieval
                  and management purposes.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Usage Data</h3>
                <p>
                  We collect information about how you interact with our platform, including feature usage, credit
                  consumption, generation parameters, and technical data such as IP address, browser type, and
                  device information.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Payment Information</h3>
                <p>
                  Payment processing is handled securely by Stripe. We do not store your full credit card details.
                  We retain transaction records and subscription information for billing and account management.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <ul className="space-y-2">
                <li>To provide and maintain our AI content generation services</li>
                <li>To process your requests and deliver generated content</li>
                <li>To manage your account and subscription</li>
                <li>To send you important updates and service notifications</li>
                <li>To improve our platform and develop new features</li>
                <li>To provide customer support and respond to inquiries</li>
                <li>To detect and prevent fraud or abuse</li>
                <li>To comply with legal obligations</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Sharing and Third Parties</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">AI Service Providers</h3>
                <p>
                  We use third-party AI services including Kie.ai, OpenAI, and Deepseek to process your content
                  generation requests. Content you submit may be sent to these services in accordance with their
                  respective privacy policies.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Payment Processors</h3>
                <p>
                  Stripe processes all payment transactions. Your payment information is handled directly by Stripe
                  and subject to their privacy policy.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Analytics and Hosting</h3>
                <p>
                  We use hosting and analytics services to operate our platform. These providers may have access
                  to aggregated, non-personal usage data.
                </p>
              </div>
              <p className="mt-4">
                We do not sell your personal information to third parties. We only share data with service providers
                necessary to operate our platform and deliver our services.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Security</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                We implement industry-standard security measures to protect your data, including encryption in
                transit and at rest, secure authentication, regular security audits, and access controls. However,
                no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Rights</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>You have the right to:</p>
              <ul className="space-y-2">
                <li>Access and download your personal data and generated content</li>
                <li>Correct inaccurate information in your account</li>
                <li>Delete your account and associated data</li>
                <li>Export your generated content</li>
                <li>Opt out of marketing communications</li>
                <li>Request information about how we use your data</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, please contact us at hello@artivio.ai
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                We retain your personal data and generated content for as long as your account is active. If you
                delete your account, we will delete your personal information and generated content within 30 days,
                except where we are required to retain data for legal or regulatory purposes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cookies and Tracking</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                We use essential cookies for authentication and session management. We do not use third-party
                advertising cookies. You can control cookies through your browser settings, though disabling
                cookies may affect platform functionality.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Our services are not intended for users under 13 years of age. We do not knowingly collect
                personal information from children under 13. If we discover we have collected data from a child
                under 13, we will delete it immediately.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of significant changes
                by email or through a prominent notice on our platform. Your continued use of Artivio AI after
                changes take effect constitutes acceptance of the updated policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="mt-4">
                <p><strong>Email:</strong> hello@artivio.ai</p>
                <p><strong>Support:</strong> https://helpdesk.artivio.ai/</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
