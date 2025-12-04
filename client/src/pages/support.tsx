import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { 
  HelpCircle, Bug, Lightbulb, MessageSquare, BookOpen, Zap, Mail, 
  Send, Ticket, Clock, CheckCircle2, AlertTriangle, Loader2,
  ArrowLeft, User, Bot, Shield
} from "lucide-react";

interface SupportTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  sentiment: string | null;
  createdAt: string;
  lastMessageAt: string;
  aiSummary: string | null;
}

interface SupportMessage {
  id: string;
  ticketId: string;
  senderType: string;
  senderName: string | null;
  bodyText: string;
  createdAt: string;
  aiGenerated: boolean;
}

export default function Support() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("faq");
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [replyMessage, setReplyMessage] = useState("");

  const { data: tickets, isLoading: ticketsLoading } = useQuery<SupportTicket[]>({
    queryKey: ['/api/support/tickets'],
    enabled: isAuthenticated,
  });

  const { data: ticketDetails, isLoading: detailsLoading } = useQuery<{
    ticket: SupportTicket;
    messages: SupportMessage[];
  }>({
    queryKey: ['/api/support/tickets', selectedTicket],
    enabled: !!selectedTicket && isAuthenticated,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string }) => {
      const res = await apiRequest('POST', '/api/support/tickets', data);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Ticket Submitted",
        description: data.message || "Your support request has been received.",
      });
      setNewTicketSubject("");
      setNewTicketMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      if (data.ticketId) {
        setSelectedTicket(data.ticketId);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit ticket",
        variant: "destructive",
      });
    }
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      return apiRequest('POST', `/api/support/tickets/${ticketId}/reply`, { message });
    },
    onSuccess: () => {
      toast({
        title: "Reply Sent",
        description: "Your message has been added to the ticket.",
      });
      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets', selectedTicket] });
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send reply",
        variant: "destructive",
      });
    }
  });

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
      answer: "Artivio AI is a comprehensive content creation platform. You can generate AI videos with Veo 3.1, Runway, and Sora 2, create stunning images with Flux and 4o Image, compose music with Suno V3.5-V5, clone voices with Fish Audio, create talking avatars, convert audio formats, analyze images, and chat with advanced AI models like Deepseek and GPT-4o."
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
      category: "billing",
      question: "How do credits work?",
      answer: "Credits are the currency used across Artivio AI. Each feature consumes a specific number of credits based on complexity and duration. You can view credit costs before generating, and your remaining balance is always visible in the header."
    },
    {
      category: "billing",
      question: "What happens if I run out of credits?",
      answer: "When you run out of credits, you won't be able to start new generations until you upgrade your plan or purchase a Credit Boost. Existing generations in progress will complete normally. You can upgrade instantly from the Billing page."
    },
    {
      category: "technical",
      question: "What file formats are supported?",
      answer: "For audio: MP3, WAV, M4A, AAC, OGG, FLAC (max 10MB). For images: JPEG, PNG, WEBP (max 10MB per image). Generated videos are provided as MP4 files in HD quality. Generated music is delivered as high-quality MP3 files."
    },
    {
      category: "technical",
      question: "What happens if a generation fails?",
      answer: "If a generation fails (due to API errors, invalid inputs, or technical issues), your credits are automatically refunded. You'll receive a notification with details about the failure. You can then try again with adjusted parameters or contact support if the issue persists."
    },
  ];

  const filteredFaqs = selectedCategory === "all" 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="default" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Open</Badge>;
      case 'pending':
        return <Badge variant="default" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
      case 'resolved':
        return <Badge variant="default" className="bg-green-500/20 text-green-400 border-green-500/30">Resolved</Badge>;
      case 'escalated':
        return <Badge variant="default" className="bg-purple-500/20 text-purple-400 border-purple-500/30">Escalated</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="default" className="bg-orange-500/20 text-orange-400 border-orange-500/30">High</Badge>;
      case 'medium':
        return <Badge variant="outline">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return null;
    }
  };

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'ai':
        return <Bot className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Support Center
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions, submit support tickets, or get help from our AI-powered support team
          </p>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="faq" className="gap-2" data-testid="tab-faq">
              <HelpCircle className="h-4 w-4" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="submit" className="gap-2" data-testid="tab-submit">
              <Send className="h-4 w-4" />
              Submit Ticket
            </TabsTrigger>
            <TabsTrigger value="tickets" className="gap-2" data-testid="tab-tickets">
              <Ticket className="h-4 w-4" />
              My Tickets
            </TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="mt-6 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('submit')}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bug className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Report a Bug</CardTitle>
                    <CardDescription className="text-sm">Found an issue? Let us know</CardDescription>
                  </div>
                </CardHeader>
              </Card>

              <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('submit')}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Lightbulb className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Request a Feature</CardTitle>
                    <CardDescription className="text-sm">Share your ideas with us</CardDescription>
                  </div>
                </CardHeader>
              </Card>

              <Card className="hover-elevate cursor-pointer" onClick={() => setActiveTab('submit')}>
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Get Help</CardTitle>
                    <CardDescription className="text-sm">Contact our support team</CardDescription>
                  </div>
                </CardHeader>
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
          </TabsContent>

          {/* Submit Ticket Tab */}
          <TabsContent value="submit" className="mt-6">
            {!isAuthenticated ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Sign in to Submit a Ticket</h3>
                  <p className="text-muted-foreground mb-4">
                    Please sign in to submit a support ticket and track your requests.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Or email us directly at{" "}
                    <a href="mailto:support@artivio.ai" className="text-primary hover:underline">
                      support@artivio.ai
                    </a>
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Submit a Support Request
                  </CardTitle>
                  <CardDescription>
                    Describe your issue and our AI-powered support will respond promptly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      placeholder="Brief description of your issue"
                      value={newTicketSubject}
                      onChange={(e) => setNewTicketSubject(e.target.value)}
                      data-testid="input-ticket-subject"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message</label>
                    <Textarea
                      placeholder="Please describe your issue in detail. Include any relevant information like error messages, steps to reproduce, or screenshots."
                      value={newTicketMessage}
                      onChange={(e) => setNewTicketMessage(e.target.value)}
                      rows={6}
                      data-testid="input-ticket-message"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      onClick={() => createTicketMutation.mutate({ 
                        subject: newTicketSubject, 
                        message: newTicketMessage 
                      })}
                      disabled={!newTicketSubject.trim() || !newTicketMessage.trim() || createTicketMutation.isPending}
                      data-testid="button-submit-ticket"
                    >
                      {createTicketMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit Ticket
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* My Tickets Tab */}
          <TabsContent value="tickets" className="mt-6">
            {!isAuthenticated ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Sign in to View Tickets</h3>
                  <p className="text-muted-foreground">
                    Please sign in to view your support ticket history.
                  </p>
                </CardContent>
              </Card>
            ) : selectedTicket && ticketDetails ? (
              /* Ticket Detail View */
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTicket(null)}
                      data-testid="button-back-to-list"
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{ticketDetails.ticket.subject}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        Created {format(new Date(ticketDetails.ticket.createdAt), 'PPp')}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(ticketDetails.ticket.status)}
                      {getPriorityBadge(ticketDetails.ticket.priority)}
                    </div>
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="pt-4">
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {ticketDetails.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.senderType === 'user' ? 'justify-end' : ''
                          }`}
                        >
                          {message.senderType !== 'user' && (
                            <div className={`p-2 rounded-full ${
                              message.senderType === 'ai' ? 'bg-purple-500/20' : 'bg-primary/20'
                            }`}>
                              {getSenderIcon(message.senderType)}
                            </div>
                          )}
                          <div className={`max-w-[80%] ${
                            message.senderType === 'user' 
                              ? 'bg-primary/10 rounded-lg rounded-tr-sm' 
                              : 'bg-muted rounded-lg rounded-tl-sm'
                          } p-3`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {message.senderType === 'user' ? 'You' : 
                                 message.senderType === 'ai' ? 'AI Support' : 
                                 message.senderName || 'Support Team'}
                              </span>
                              {message.aiGenerated && (
                                <Badge variant="secondary" className="text-xs py-0">AI</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.createdAt), 'p')}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{message.bodyText}</p>
                          </div>
                          {message.senderType === 'user' && (
                            <div className="p-2 rounded-full bg-blue-500/20">
                              {getSenderIcon(message.senderType)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  {ticketDetails.ticket.status !== 'resolved' && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Type your reply..."
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          rows={2}
                          className="flex-1"
                          data-testid="input-reply"
                        />
                        <Button
                          onClick={() => replyMutation.mutate({ 
                            ticketId: selectedTicket, 
                            message: replyMessage 
                          })}
                          disabled={!replyMessage.trim() || replyMutation.isPending}
                          data-testid="button-send-reply"
                        >
                          {replyMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* Tickets List */
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    My Support Tickets
                  </CardTitle>
                  <CardDescription>
                    View and manage your support requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : !tickets || tickets.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="font-medium">No tickets yet</p>
                      <p className="text-sm mt-1">You haven't submitted any support requests</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setActiveTab('submit')}
                        data-testid="button-create-first-ticket"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Submit Your First Ticket
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-4 rounded-lg border bg-card hover-elevate cursor-pointer"
                          onClick={() => setSelectedTicket(ticket.id)}
                          data-testid={`ticket-${ticket.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{ticket.subject}</h4>
                              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {format(new Date(ticket.createdAt), 'PPp')}
                                {ticket.category && (
                                  <>
                                    <span className="text-muted-foreground/50">•</span>
                                    <span className="capitalize">{ticket.category}</span>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getStatusBadge(ticket.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Still Need Help */}
        <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold">Prefer email?</h3>
              <p className="text-muted-foreground">
                You can also reach our support team directly via email
              </p>
              <Button 
                onClick={() => window.location.href = 'mailto:support@artivio.ai'}
                variant="outline"
                className="gap-2"
                data-testid="button-email-support"
              >
                <Mail className="h-4 w-4" />
                support@artivio.ai
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
