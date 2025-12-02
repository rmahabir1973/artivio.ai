import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <FileText className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Terms of Service
          </h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Agreement to Terms</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                By accessing or using Artivio AI ("the Service"), you agree to be bound by these Terms of Service
                ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all
                users, including visitors, registered users, and subscribers.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Description</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                Artivio AI is an AI-powered content generation platform that provides tools for creating videos,
                images, music, voice clones, talking avatars, and AI chat interactions. We offer various
                subscription plans with different credit allocations and features.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Registration</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <ul className="space-y-2">
                <li>You must be at least 13 years old to use the Service</li>
                <li>You must provide accurate and complete registration information</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You are responsible for all activities that occur under your account</li>
                <li>You must notify us immediately of any unauthorized account access</li>
                <li>One person or entity may maintain only one account</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans and Credits</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Credit System</h3>
                <p>
                  Our Service operates on a credit-based system. Different features consume different amounts of
                  credits based on complexity and processing requirements. Credit costs are displayed before
                  generation.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Monthly Allocations</h3>
                <p>
                  Subscription plans include monthly credit allocations that reset at the beginning of each billing
                  period. Unused credits do not roll over to the next month - your balance resets to your plan's
                  monthly allocation each billing cycle.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Billing</h3>
                <p>
                  Subscriptions are billed monthly or annually as selected. Payments are processed through Stripe.
                  You authorize us to charge your payment method for all fees incurred.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Refunds</h3>
                <p>
                  Credits are automatically refunded if a generation fails due to technical errors. Subscription
                  fees are generally non-refundable except as required by law or at our discretion.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>You agree not to use the Service to:</p>
              <ul className="space-y-2">
                <li>Generate content that is illegal, harmful, threatening, abusive, or defamatory</li>
                <li>Create deepfakes or misleading content without proper disclosure</li>
                <li>Violate intellectual property rights or privacy rights of others</li>
                <li>Generate content depicting minors in inappropriate situations</li>
                <li>Create spam, malware, or phishing content</li>
                <li>Impersonate others or misrepresent your identity</li>
                <li>Attempt to circumvent usage limits or abuse the credit system</li>
                <li>Reverse engineer or extract training data from AI models</li>
                <li>Resell or redistribute generated content as a competing service</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Intellectual Property Rights</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Your Content</h3>
                <p>
                  You retain ownership of content you upload to the Service. By uploading content, you grant us
                  a license to process and use it to provide our services.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Generated Content</h3>
                <p>
                  Subject to your payment of applicable fees and compliance with these Terms, you own the content
                  you generate using our Service. However, generated content may be subject to the intellectual
                  property policies of underlying AI providers.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Platform</h3>
                <p>
                  The Service, including all software, algorithms, interfaces, and documentation, is protected
                  by copyright and other intellectual property laws. You may not copy, modify, or create derivative
                  works of the Service.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Disclaimers and Limitations</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Service Availability</h3>
                <p>
                  We strive for high availability but do not guarantee uninterrupted or error-free service. We
                  may suspend or terminate the Service for maintenance, updates, or other reasons.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">AI-Generated Content</h3>
                <p>
                  AI-generated content is provided "as is" without warranties of accuracy, quality, or fitness
                  for a particular purpose. You are responsible for reviewing and verifying generated content
                  before use.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Third-Party Services</h3>
                <p>
                  Our Service integrates with third-party AI providers. We are not responsible for the
                  performance, availability, or content policies of these providers.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                To the maximum extent permitted by law, Artivio AI and its affiliates shall not be liable for
                any indirect, incidental, special, consequential, or punitive damages, including lost profits,
                lost data, or business interruption, arising from your use of the Service.
              </p>
              <p className="mt-4">
                Our total liability to you for all claims arising from the Service shall not exceed the amount
                you paid us in the 12 months preceding the claim.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Termination</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                You may terminate your account at any time through your account settings. We may suspend or
                terminate your account immediately if you violate these Terms, engage in fraudulent activity,
                or for other reasons at our discretion.
              </p>
              <p className="mt-4">
                Upon termination, your right to use the Service ceases immediately. We may delete your account
                data in accordance with our Privacy Policy.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                We may modify these Terms at any time. We will notify you of material changes via email or
                through the Service. Your continued use after changes take effect constitutes acceptance of
                the modified Terms.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Governing Law</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                These Terms are governed by the laws of the jurisdiction in which Artivio AI operates, without
                regard to conflict of law principles. Any disputes shall be resolved through binding arbitration
                or in courts of competent jurisdiction.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <p>
                For questions about these Terms of Service, please contact us:
              </p>
              <div className="mt-4">
                <p><strong>Email:</strong> hello@artivio.ai</p>
                <p><strong>Support:</strong> support@artivio.ai</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}
