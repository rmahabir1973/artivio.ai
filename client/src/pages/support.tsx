import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Bug, Lightbulb, MessageSquare, BookOpen, Zap, Mail } from "lucide-react";

export default function Support() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = [
    { id: "all", label: "All Topics", icon: HelpCircle },
    { id: "getting-started", label: "Getting Started", icon: Zap },
    { id: "features", label: "Features", icon: BookOpen },
    { id: "billing", label: "Billing & Credits", icon: MessageSquare },
    { id: "technical", label: "Technical", icon: Bug },
  ];

  const faqs = [
    {
      category: "getting-started",
      question: "How do I get started with Artivio AI?",
      answer: "Getting started is easy! After signing up, you'll receive free credits based on your plan. Simply choose a feature from the navigation menu (Video Generation, Image Generation, Music Generation, AI Chat, etc.) and follow the prompts. Each tool has intuitive controls and helpful tooltips to guide you through the process."
    },
    {
      category: "getting-started",
      question: "What can I create with Artivio AI?",
      answer: "Artivio AI is a comprehensive content creation platform. You can generate AI videos with Veo 3.1, Runway, and Sora 2, create stunning images with Flux and 4o Image, compose music with Suno V3.5-V5, clone voices with ElevenLabs, create talking avatars, convert audio formats, analyze images, and chat with advanced AI models like Deepseek and GPT-4o."
    },
    {
      category: "features",
      question: "How do AI video generations work?",
      answer: "Our video generation supports multiple models: Veo 3.1 (standard and fast), Runway Aleph, and Sora 2 Pro. Simply enter a text prompt describing your desired video, optionally upload reference images, select your preferred aspect ratio and duration, and click generate. Videos are processed in the background and you'll be notified when complete."
    },
    {
      category: "features",
      question: "Can I upload my own images for image-to-video?",
      answer: "Yes! Our video generation tools support image-to-video capabilities. You can upload up to 3 reference images depending on the model. Veo 3.1 supports 1-2 images in FIRST_AND_LAST_FRAMES mode, while Veo 3.1 Fast supports up to 3 images in REFERENCE_2_VIDEO mode with 16:9 aspect ratio."
    },
    {
      category: "features",
      question: "How does music generation work?",
      answer: "Our Music Studio supports Suno V3.5, V4, V4.5, V4.5 Plus, and V5 models. You can create music from text descriptions, generate custom lyrics, or extend existing audio. Advanced features include Upload & Cover (create covers of existing songs), Upload & Extend (continue songs), and full control over duration, instrumental settings, and continuation points."
    },
    {
      category: "features",
      question: "What is voice cloning and how do I use it?",
      answer: "Voice cloning allows you to create a custom voice model by uploading or recording audio samples. Once your voice is cloned, you can use it to generate speech from text with ElevenLabs integration. The feature supports multiple audio formats and provides high-quality, natural-sounding results."
    },
    {
      category: "features",
      question: "How do talking avatars work?",
      answer: "Talking avatars combine AI-generated video with text-to-speech to create realistic digital presenters. Upload an image or generate a character, provide a script, and our system will create a video where the avatar speaks your text with synchronized lip movements and natural expressions."
    },
    {
      category: "billing",
      question: "How do credits work?",
      answer: "Credits are the currency used across Artivio AI. Each feature consumes a specific number of credits based on complexity and duration. For example, a 10-second Veo video might cost 150 credits, while a Sora 2 Pro video costs more due to higher quality. You can view credit costs before generating, and your remaining balance is always visible in the header."
    },
    {
      category: "billing",
      question: "What subscription plans are available?",
      answer: "We offer three plans: Free (1,000 credits to get started), Starter ($19.99/month with 5,000 credits), and Pro ($49.99/month with 15,000 credits). Credits are replenished monthly with your subscription. You can upgrade or downgrade at any time from the Billing page."
    },
    {
      category: "billing",
      question: "What happens if I run out of credits?",
      answer: "When you run out of credits, you won't be able to start new generations until you upgrade your plan or purchase additional credits. Existing generations in progress will complete normally. You can upgrade instantly from the Billing page or by clicking the Upgrade button in the header."
    },
    {
      category: "billing",
      question: "Do credits roll over to the next month?",
      answer: "No, credits do not roll over. Your credit balance resets to your plan's monthly allocation at the start of each billing cycle. We recommend choosing a plan that matches your typical monthly usage to get the most value."
    },
    {
      category: "technical",
      question: "What file formats are supported?",
      answer: "For audio: MP3, WAV, M4A, AAC, OGG, FLAC (max 10MB). For images: JPEG, PNG, WEBP (max 10MB per image). Generated videos are provided as MP4 files in HD quality. Generated music is delivered as high-quality MP3 files with synchronized audio."
    },
    {
      category: "technical",
      question: "How long does generation take?",
      answer: "Generation times vary by complexity and current queue: Simple images (1-3 minutes), Music generations (2-5 minutes), Standard videos (5-15 minutes), Sora 2 Pro HD videos (10-30 minutes). You'll receive real-time status updates, and completed generations appear in your History page."
    },
    {
      category: "technical",
      question: "Can I download my generations?",
      answer: "Absolutely! All your generations are stored in your Library and can be downloaded anytime. Simply navigate to the History page, find your generation, and click the download button. Files are stored securely and remain accessible for the lifetime of your account."
    },
    {
      category: "technical",
      question: "What happens if a generation fails?",
      answer: "If a generation fails (due to API errors, invalid inputs, or technical issues), your credits are automatically refunded. You'll receive a notification with details about the failure. You can then try again with adjusted parameters or contact support if the issue persists."
    },
    {
      category: "features",
      question: "Can I combine multiple videos?",
      answer: "Yes! The Video Editor feature allows you to combine 2-20 AI-generated videos into a single compilation. You can drag and drop to reorder clips, and the system uses server-side FFmpeg processing for professional results. Perfect for creating montages, advertisements, or longer content pieces."
    },
    {
      category: "features",
      question: "What AI chat models are available?",
      answer: "We offer multiple cutting-edge models: Deepseek Chat and Deepseek Reasoner for efficient, intelligent conversations, and OpenAI's GPT-4o, GPT-4o Mini, o1, and o1 Mini for advanced reasoning and creative tasks. All models support streaming responses for real-time interaction, and conversation history is automatically saved."
    },
  ];

  const filteredFaqs = selectedCategory === "all" 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Support Center
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions, report bugs, or request new features
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover-elevate cursor-pointer" onClick={() => window.location.href = 'mailto:support@artivio.ai?subject=Bug Report'}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bug className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Report a Bug</CardTitle>
                <CardDescription className="text-sm">Found an issue? Let us know</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full gap-2" data-testid="button-report-bug">
                Email Support
                <Mail className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => window.location.href = 'mailto:support@artivio.ai?subject=Feature Request'}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Lightbulb className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle className="text-base">Request a Feature</CardTitle>
                <CardDescription className="text-sm">Share your ideas with us</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full gap-2" data-testid="button-request-feature">
                Email Support
                <Mail className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => window.location.href = 'mailto:support@artivio.ai'}>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <MessageSquare className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-base">Contact Support</CardTitle>
                <CardDescription className="text-sm">Get help from our team</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full gap-2" data-testid="button-contact-support">
                Email Support
                <Mail className="h-3 w-3" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
            <CardDescription>
              Browse common questions or filter by category
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Badge
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    className="cursor-pointer gap-1.5 py-1.5 px-3"
                    onClick={() => setSelectedCategory(category.id)}
                    data-testid={`filter-${category.id}`}
                  >
                    <Icon className="h-3 w-3" />
                    {category.label}
                  </Badge>
                );
              })}
            </div>

            {/* FAQ Accordion */}
            <Accordion type="single" collapsible className="w-full">
              {filteredFaqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left" data-testid={`faq-${index}`}>
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {filteredFaqs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No FAQs found in this category</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Still Need Help */}
        <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold">Still need help?</h3>
              <p className="text-muted-foreground">
                Our support team is here to assist you with any questions or issues
              </p>
              <Button 
                onClick={() => window.location.href = 'mailto:support@artivio.ai'}
                className="gap-2"
                data-testid="button-email-support"
              >
                Email Support
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
