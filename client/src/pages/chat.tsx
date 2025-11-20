import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset } from "@/components/ui/sidebar";
import { Trash2, Plus, Send, Sparkles, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePricing } from "@/hooks/use-pricing";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CreditDisplay } from "@/components/credit-display";
import { fetchWithAuth } from "@/lib/authBridge";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Merge model info with dynamic pricing for each provider
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

  // Fetch conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/chat/conversations'],
  });

  // Fetch messages for selected conversation
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/chat/conversations', selectedConversationId],
    enabled: !!selectedConversationId,
  });

  // Delete conversation mutation
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      await apiRequest("DELETE", `/api/chat/conversations/${conversationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] });
      setSelectedConversationId(null);
      toast({
        title: "Conversation deleted",
        description: "The conversation has been removed.",
      });
    },
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Update model when provider changes
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
      toast({
        title: "Stopped",
        description: "Response generation stopped",
      });
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message;
    setMessage('');
    setIsStreaming(true);
    setStreamingMessage('');
    setOptimisticUserMessage(userMessage); // Show user message optimistically

    try {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const requestBody: any = {
        message: userMessage,
        provider,
        model,
      };
      
      // Only include conversationId if it exists
      if (selectedConversationId) {
        requestBody.conversationId = selectedConversationId;
      }

      // fetchWithAuth automatically adds Authorization header and retries on 401
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
              // Conversation completed successfully
              setIsStreaming(false);
              setOptimisticUserMessage('');
              abortControllerRef.current = null; // Clear controller after successful completion
              
              const finalConvId = data.conversationId || selectedConversationId;
              
              // Update conversation ID if this was a new conversation
              if (data.conversationId && !selectedConversationId) {
                setSelectedConversationId(data.conversationId);
              }
              
              // Refresh conversations and messages with the correct conversationId
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations'] }),
                queryClient.invalidateQueries({ queryKey: ['/api/chat/conversations', finalConvId] }),
                queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] }),
              ]);
              
              // Small delay to ensure queries have refetched before clearing streaming message
              setTimeout(() => {
                setStreamingMessage('');
              }, 100);
            } else {
              // Streaming chunk - accumulate content
              setStreamingMessage(prev => prev + data.content);
            }
          }
        }
      }
    } catch (error: any) {
      // Check if this was an intentional abort (user clicked Stop)
      const isAborted = error.name === 'AbortError' || abortControllerRef.current === null;
      
      if (!isAborted) {
        console.error('Chat error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to send message",
          variant: "destructive",
        });
      }
      
      // Clean up state regardless of error type
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

  return (
    <SidebarInset>
      <div className="flex h-full">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <Button
            data-testid="button-new-chat"
            onClick={handleNewChat}
            className="w-full"
            variant="default"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <Card
                key={conv.id}
                data-testid={`conversation-${conv.id}`}
                className={`p-3 cursor-pointer hover-elevate active-elevate-2 ${
                  selectedConversationId === conv.id ? 'bg-accent' : ''
                }`}
                onClick={() => setSelectedConversationId(conv.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {conv.provider === 'deepseek' ? 'Deepseek' : 'OpenAI'} • {conv.model}
                    </p>
                  </div>
                  <Button
                    data-testid={`button-delete-conversation-${conv.id}`}
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation.mutate(conv.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">AI Chat</h1>
          </div>
          <CreditDisplay />
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {!selectedConversationId && messages.length === 0 && !streamingMessage && !optimisticUserMessage && (
              <div className="text-center py-12">
                <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-2xl font-semibold mb-2">Start a conversation</h2>
                <p className="text-muted-foreground">
                  Choose a provider and model below, then send your first message
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                data-testid={`message-${msg.id}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card
                  className={`p-4 max-w-3xl ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-card'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.creditsCost > 0 && (
                    <p className="text-xs mt-2 opacity-70">
                      Cost: {msg.creditsCost} credits
                    </p>
                  )}
                </Card>
              </div>
            ))}

            {/* Optimistic user message while streaming */}
            {optimisticUserMessage && (
              <div className="flex justify-end" data-testid="optimistic-user-message">
                <Card className="p-4 max-w-3xl bg-primary text-primary-foreground">
                  <p className="text-sm whitespace-pre-wrap">{optimisticUserMessage}</p>
                </Card>
              </div>
            )}

            {streamingMessage && (
              <div className="flex justify-start" data-testid="streaming-message">
                <Card className="p-4 max-w-3xl bg-card">
                  <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-xs text-muted-foreground">Generating...</p>
                  </div>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Provider and Model Selection */}
            <div className="flex gap-3">
              <Select
                value={provider}
                onValueChange={(val) => setProvider(val as 'deepseek' | 'openai')}
                data-testid="select-provider"
              >
                <SelectTrigger className="w-40">
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
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_MODELS[provider].map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} ({m.cost} credits/message)
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
                    if (!isStreaming) {
                      sendMessage();
                    }
                  }
                }}
                placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                disabled={isStreaming}
                className="flex-1 min-h-[60px] max-h-[200px] resize-y"
                rows={3}
              />
              <Button
                data-testid="button-send-message"
                onClick={isStreaming ? stopStreaming : sendMessage}
                disabled={!isStreaming && !message.trim()}
                variant={isStreaming ? "destructive" : "default"}
              >
                {isStreaming ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Cost: {currentCost} credits per message
            </p>
          </div>
        </div>
      </div>
      </div>
    </SidebarInset>
  );
}
