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
    <div className="h-full flex flex-col">
      {/* New Chat Button */}
      <div className="p-3 border-b flex-shrink-0">
        <Button
          data-testid="button-new-chat"
          onClick={() => {
            handleNewChat();
            onConversationSelect?.();
          }}
          className="w-full gap-2"
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {groupedConversations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label}>
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      data-testid={`conversation-${conv.id}`}
                      className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedConversationId === conv.id
                          ? 'bg-accent/80'
                          : 'hover:bg-accent/40'
                      }`}
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        onConversationSelect?.();
                      }}
                    >
                      <p className="text-sm font-medium truncate pr-8">{conv.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {conv.provider === 'deepseek' ? 'Deepseek' : 'OpenAI'} • {conv.model}
                      </p>

                      {/* Delete button - visible on hover */}
                      <Button
                        data-testid={`button-delete-conversation-${conv.id}`}
                        size="icon"
                        variant="ghost"
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation.mutate(conv.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
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
            <div className="max-w-3xl mx-auto w-full px-4 py-6">
              {/* Empty State */}
              {!selectedConversationId && messages.length === 0 && !streamingMessage && !optimisticUserMessage && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Choose your AI provider and model, then ask anything. Your messages will be saved automatically.
                  </p>
                </div>
              )}

              {/* Messages */}
              <div className="space-y-4">
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
                    <div className="flex justify-start ml-11 gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce animation-delay-100" />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce animation-delay-200" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t bg-card/50 backdrop-blur-sm flex-shrink-0">
            <div className="max-w-3xl mx-auto space-y-3">
              {/* Provider and Model Selection */}
              <div className="flex gap-2 items-center">
                <Select
                  value={provider}
                  onValueChange={(val) => setProvider(val as 'deepseek' | 'openai')}
                  data-testid="select-provider"
                >
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deepseek">Deepseek</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={model}
                  onValueChange={setModel}
                  data-testid="select-model"
                >
                  <SelectTrigger className="flex-1 h-9">
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
              </div>

              {/* Message Input */}
              <div className="flex gap-2 items-end">
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
                  placeholder="Message Artivio AI... (Shift+Enter for new line)"
                  disabled={isStreaming}
                  className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm"
                  rows={2}
                />
                <Button
                  data-testid="button-send-message"
                  onClick={isStreaming ? stopStreaming : sendMessage}
                  disabled={!isStreaming && !message.trim()}
                  variant={isStreaming ? "destructive" : "default"}
                  size="icon"
                  className="h-[44px] w-[44px] flex-shrink-0"
                >
                  {isStreaming ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {currentCost} credits per message • Free to try all models
              </p>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}
