import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarInset } from "@/components/ui/sidebar";
import { Trash2, Plus, Send, Sparkles, Square, MessageSquare, Menu, ArrowUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CreditDisplay } from "@/components/credit-display";
import { fetchWithAuth } from "@/lib/authBridge";
import { ChatMessage } from "@/components/chat-message";
import { groupConversationsByDate } from "@/lib/dateGrouping";
import { format } from "date-fns";

type Message = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  creditsCost: number;
  createdAt: string;
};

type Conversation = {
  id: string;
  userId: string;
  title: string;
  provider: 'deepseek' | 'openai';
  model: string;
  createdAt: string;
  updatedAt: string;
};

const PROVIDER_MODEL_INFO = {
  deepseek: [
    { value: 'deepseek-chat', label: 'Deepseek Chat' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
};

export default function Chat() {
  const { toast } = useToast();
  const { getModelCost } = usePricing();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [provider, setProvider] = useState<'deepseek' | 'openai'>('deepseek');
  const [model, setModel] = useState('deepseek-chat');
  const [message, setMessage] = useState('');
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState('');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const PROVIDER_MODELS = useMemo(() => ({
    deepseek: PROVIDER_MODEL_INFO.deepseek.map(m => ({
      ...m,
      cost: getModelCost(m.value, 5),
    })),
    openai: PROVIDER_MODEL_INFO.openai.map(m => ({
      ...m,
      cost: getModelCost(m.value, 10),
    })),
  }), [getModelCost]);

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/chat/conversations'],
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/chat/conversations', selectedConversationId],
    enabled: !!selectedConversationId,
  });

  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest("DELETE", `/api/chat/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setSelectedConversationId(null);
      toast({
        title: "Chat deleted",
        description: "The conversation has been removed.",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  useEffect(() => {
    const models = PROVIDER_MODELS[provider];
    if (models.length > 0) {
      setModel(models[0].value);
    }
  }, [provider]);

  const stopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingMessage('');
      setOptimisticUserMessage('');
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message;
    setMessage('');
    setIsStreaming(true);
    setStreamingMessage('');
    setOptimisticUserMessage(userMessage);

    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const requestBody: any = {
        message: userMessage,
        provider,
        model,
      };
      
      if (selectedConversationId) {
        requestBody.conversationId = selectedConversationId;
      }

      const response = await fetchWithAuth('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.error) {
              throw new Error(data.error);
            }

            if (data.done) {
              setIsStreaming(false);
              setOptimisticUserMessage('');
              abortControllerRef.current = null;
              
              const finalConvId = data.conversationId || selectedConversationId;
              
              if (data.conversationId && !selectedConversationId) {
                setSelectedConversationId(data.conversationId);
              }
              
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations', finalConvId] }),
                queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }),
              ]);
              
              setTimeout(() => {
                setStreamingMessage('');
              }, 100);
            } else {
              setStreamingMessage(prev => prev + data.content);
            }
          }
        }
      }
    } catch (error: any) {
      const isAborted = error.name === 'AbortError' || abortControllerRef.current === null;
      
      if (!isAborted) {
        console.error('Chat error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to send message",
          variant: "destructive",
        });
      }
      
      setIsStreaming(false);
      setStreamingMessage('');
      setOptimisticUserMessage('');
      abortControllerRef.current = null;
    }
  };

  const handleNewChat = () => {
    setSelectedConversationId(null);
    setMessage('');
    setStreamingMessage('');
    setOptimisticUserMessage('');
  };

  const currentCost = PROVIDER_MODELS[provider].find(m => m.value === model)?.cost || 10;
  const groupedConversations = groupConversationsByDate(conversations);

  const ConversationsList = ({ onConversationSelect }: { onConversationSelect?: () => void }) => (
    <div className="h-full flex flex-col bg-muted/20">
      {/* New Chat Button */}
      <div className="p-3 flex-shrink-0">
        <Button
          data-testid="button-new-chat"
          onClick={() => {
            handleNewChat();
            onConversationSelect?.();
          }}
          className="w-full gap-2 rounded-xl h-10 font-medium"
          variant="default"
        >
          <Plus className="w-4 h-4" />
          New chat
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-6 pb-4">
          {groupedConversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label}>
                <p className="px-3 py-2 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      data-testid={`conversation-${conv.id}`}
                      className={`group relative px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                        selectedConversationId === conv.id
                          ? 'bg-accent shadow-sm'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        onConversationSelect?.();
                      }}
                    >
                      <p className="text-[13px] font-medium truncate pr-7 leading-tight">{conv.title}</p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${conv.provider === 'deepseek' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        {conv.provider === 'deepseek' ? 'Deepseek' : 'OpenAI'}
                      </p>

                      {/* Delete button - visible on hover */}
                      <Button
                        data-testid={`button-delete-conversation-${conv.id}`}
                        size="icon"
                        variant="ghost"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation.mutate(conv.id);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <SidebarInset>
      <div className="flex h-screen w-full bg-background">
        {/* Mobile Conversations Sheet */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="left" className="w-80 p-0 flex flex-col lg:hidden border-r">
            <SheetHeader className="sr-only">
              <SheetTitle>Conversations</SheetTitle>
            </SheetHeader>
            <ConversationsList onConversationSelect={() => setMobileSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:w-64 border-r bg-card/50 flex-col sticky top-0 h-screen overflow-hidden">
          <ConversationsList />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="h-14 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Button
                data-testid="button-mobile-menu"
                size="icon"
                variant="ghost"
                className="lg:hidden"
                onClick={() => setMobileSheetOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h1 className="font-semibold">AI Chat</h1>
              </div>
            </div>
            <CreditDisplay />
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1">
            <div className="min-h-full">
              {/* Empty State */}
              {!selectedConversationId && messages.length === 0 && !streamingMessage && !optimisticUserMessage && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] py-16 text-center px-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
                    <Sparkles className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-3 tracking-tight">How can I help you today?</h2>
                  <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
                    Ask me anything — from coding help to creative writing. I can explain concepts, write code, analyze data, and much more.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    <span className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">Write code</span>
                    <span className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">Explain concepts</span>
                    <span className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">Debug errors</span>
                    <span className="px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">Creative writing</span>
                  </div>
                  <p className="text-xs text-muted-foreground/40 mt-8">v2.2.0</p>
                </div>
              )}

              {/* Messages */}
              <div>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    creditsCost={msg.creditsCost}
                  />
                ))}

                {/* Optimistic User Message */}
                {optimisticUserMessage && (
                  <ChatMessage role="user" content={optimisticUserMessage} />
                )}

                {/* Streaming Message */}
                {streamingMessage && (
                  <div data-testid="streaming-message">
                    <ChatMessage role="assistant" content={streamingMessage} />
                    <div className="max-w-3xl mx-auto px-4 py-2">
                      <div className="flex items-center gap-1.5 ml-12">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t bg-gradient-to-t from-background to-background/80 backdrop-blur-xl flex-shrink-0">
            <div className="max-w-3xl mx-auto p-4 space-y-3">
              {/* Message Input Container */}
              <div className="relative rounded-2xl border bg-card shadow-sm overflow-hidden">
                {/* Provider and Model Selection - Inline */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
                  <Select
                    value={provider}
                    onValueChange={(val) => setProvider(val as 'deepseek' | 'openai')}
                    data-testid="select-provider"
                  >
                    <SelectTrigger className="w-auto h-7 px-2.5 text-xs border-0 bg-transparent hover:bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deepseek">Deepseek</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>

                  <span className="text-muted-foreground/40">•</span>

                  <Select
                    value={model}
                    onValueChange={setModel}
                    data-testid="select-model"
                  >
                    <SelectTrigger className="w-auto h-7 px-2.5 text-xs border-0 bg-transparent hover:bg-muted">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_MODELS[provider].map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label} ({m.cost} credits)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className="text-xs text-muted-foreground ml-auto">
                    {currentCost} credits
                  </span>
                </div>

                {/* Text Input */}
                <div className="flex items-end gap-2 p-3">
                  <Textarea
                    data-testid="input-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isStreaming && message.trim()) {
                          sendMessage();
                        }
                      }
                    }}
                    placeholder="Ask anything..."
                    disabled={isStreaming}
                    className="flex-1 min-h-[24px] max-h-[200px] resize-none text-[15px] border-0 shadow-none focus-visible:ring-0 p-0 bg-transparent placeholder:text-muted-foreground/50"
                    rows={1}
                  />
                  <Button
                    data-testid="button-send-message"
                    onClick={isStreaming ? stopStreaming : sendMessage}
                    disabled={!isStreaming && !message.trim()}
                    variant={isStreaming ? "destructive" : "default"}
                    size="icon"
                    className="h-9 w-9 rounded-xl flex-shrink-0 transition-all"
                  >
                    {isStreaming ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <ArrowUp className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground/60 text-center">
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
