import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageSquare, Send, Sparkles, Zap, Globe, Users } from "lucide-react";

export default function Contact() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Create mailto link
    const mailtoLink = `mailto:hello@artivio.ai?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    )}`;

    // Open mailto
    window.location.href = mailtoLink;

    toast({
      title: "Opening Email Client",
      description: "Your default email client should open with your message pre-filled.",
    });

    // Reset form
    setFormData({
      name: "",
      email: "",
      subject: "",
      message: ""
    });

    setIsSubmitting(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Industry Leader in AI</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Get in Touch with Artivio AI
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            As a pioneering force in the AI content generation space, we're here to help you unlock
            the full potential of artificial intelligence for your creative projects
          </p>
        </div>

        {/* About Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Global Innovation</CardTitle>
              <CardDescription>
                Leading the AI revolution with cutting-edge video, image, and music generation technology
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <Zap className="h-6 w-6 text-purple-500" />
              </div>
              <CardTitle className="text-lg">Cutting-Edge Tech</CardTitle>
              <CardDescription>
                Integrating the latest AI models from OpenAI, Deepseek, Runway, and more into one platform
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                <Users className="h-6 w-6 text-green-500" />
              </div>
              <CardTitle className="text-lg">Creator-First</CardTitle>
              <CardDescription>
                Empowering creators, businesses, and innovators to bring their visions to life with AI
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Send Us a Message
              </CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you as soon as possible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    data-testid="input-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    data-testid="input-subject"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Tell us more about your inquiry..."
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={6}
                    data-testid="input-message"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full gap-2" 
                  disabled={isSubmitting}
                  data-testid="button-submit-contact"
                >
                  <Send className="h-4 w-4" />
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Direct Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <a 
                    href="mailto:hello@artivio.ai" 
                    className="text-primary hover:underline font-medium"
                    data-testid="link-email"
                  >
                    hello@artivio.ai
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Support Portal</p>
                  <a 
                    href="https://helpdesk.artivio.ai/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                    data-testid="link-helpdesk"
                  >
                    helpdesk.artivio.ai
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
              <CardHeader>
                <CardTitle>About Artivio AI</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>Artivio AI</strong> is at the forefront of the artificial intelligence revolution,
                  providing creators and businesses with the most comprehensive AI content generation platform
                  available today.
                </p>
                <p>
                  Our platform seamlessly integrates cutting-edge AI models including <strong>Sora 2 Pro</strong>,
                  <strong>Veo 3.1</strong>, <strong>Runway</strong>, <strong>Flux</strong>, <strong>Suno V5</strong>,
                  <strong>ElevenLabs</strong>, and more—all accessible through a single, intuitive interface.
                </p>
                <p>
                  Whether you're creating marketing videos, generating original music, designing stunning images,
                  or building conversational AI experiences, Artivio AI empowers you to achieve professional
                  results in minutes, not hours.
                </p>
                <p className="pt-2 border-t">
                  <strong className="text-primary">Join thousands of creators</strong> who trust Artivio AI
                  to power their creative workflows and bring their visions to life with the latest in AI technology.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Business Inquiries</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Interested in enterprise solutions, partnerships, or custom integrations? We'd love to hear
                  from you.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.href = "mailto:hello@artivio.ai?subject=Business Inquiry"}
                  data-testid="button-business-inquiry"
                >
                  Contact Business Team
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
