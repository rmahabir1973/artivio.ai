import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Card } from "@/components/ui/card";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type MessageRole = 'user' | 'assistant';

interface ChatMessageProps {
  role: MessageRole;
  content: string;
  creditsCost?: number;
}

export function ChatMessage({ role, content, creditsCost }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3 mb-4`}>
      <div className={`max-w-3xl flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-secondary text-secondary-foreground'
        }`}>
          {isUser ? 'You' : 'AI'}[0]
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <Card className={`p-4 ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-3xl rounded-tr-sm'
              : 'bg-card rounded-3xl rounded-tl-sm border border-border/30'
          }`}>
            <div className="prose dark:prose-invert prose-sm max-w-none [&_*]:my-1 [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0 [&_code]:bg-black/20 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-black/40 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_a]:text-blue-400 [&_a]:hover:underline [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  code: ({ node, inline, className, children, ...props }: any) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return inline ? (
                      <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <div className="relative group my-2">
                        <pre className="bg-black/40 p-3 rounded-lg overflow-x-auto font-mono text-xs">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2"
                          onClick={() => navigator.clipboard.writeText(String(children))}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            {creditsCost !== undefined && creditsCost > 0 && (
              <div className="text-xs mt-3 pt-3 border-t border-white/10 opacity-70">
                Cost: {creditsCost} credits
              </div>
            )}
          </Card>

          {/* Copy button for assistant messages */}
          {!isUser && (
            <div className="flex justify-start mt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={copyToClipboard}
                className="text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
