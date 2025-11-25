import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { Copy, Check, User, Sparkles } from "lucide-react";
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCodeBlock = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isUser = role === 'user';

  return (
    <div className={`group py-6 ${isUser ? '' : 'bg-muted/30'}`}>
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex gap-4">
          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
            isUser 
              ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
              : 'bg-gradient-to-br from-emerald-500 to-teal-600'
          }`}>
            {isUser ? (
              <User className="w-4 h-4 text-white" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {isUser ? 'You' : 'Artivio AI'}
              </span>
              {creditsCost !== undefined && creditsCost > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {creditsCost} credits
                </span>
              )}
            </div>

            <div className="prose dark:prose-invert prose-sm max-w-none 
              prose-p:leading-relaxed prose-p:my-3
              prose-headings:mt-6 prose-headings:mb-3
              prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
              prose-ul:my-3 prose-ol:my-3 prose-li:my-1
              prose-strong:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-primary prose-blockquote:bg-muted/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
              prose-hr:my-6">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  code: ({ node, inline, className, children, ...props }: any) => {
                    const codeContent = String(children).replace(/\n$/, '');
                    const match = /language-(\w+)/.exec(className || '');
                    const language = match ? match[1] : '';
                    
                    if (inline) {
                      return (
                        <code 
                          className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono text-foreground" 
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    
                    return (
                      <div className="relative group/code my-4 rounded-lg overflow-hidden border border-border/50">
                        <div className="flex items-center justify-between bg-muted/80 px-4 py-2 border-b border-border/50">
                          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            {language || 'code'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => copyCodeBlock(codeContent)}
                          >
                            {copiedCode === codeContent ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="bg-[#1e1e1e] dark:bg-[#0d0d0d] p-4 overflow-x-auto">
                          <code className="text-[13px] font-mono leading-relaxed text-gray-200" {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  },
                  p: ({ children }) => (
                    <p className="text-[15px] leading-7 text-foreground/90">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 list-disc pl-6">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="space-y-2 list-decimal pl-6">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="text-[15px] leading-7 text-foreground/90">{children}</li>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            {!isUser && (
              <div className="flex items-center gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyToClipboard}
                  className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy response
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
