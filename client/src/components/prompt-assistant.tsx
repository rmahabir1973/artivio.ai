import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Sparkles } from "lucide-react";

type PromptContext = 'video' | 'image' | 'audio' | 'avatar';

interface RefinePromptButtonProps {
  prompt: string;
  onRefined: (refined: string) => void;
  context: PromptContext;
  disabled?: boolean;
}

interface RefinePromptResponse {
  original: string;
  refined: string;
  suggestions?: string[];
}

export function RefinePromptButton({ prompt, onRefined, context, disabled = false }: RefinePromptButtonProps) {
  const { toast } = useToast();
  const [isRefining, setIsRefining] = useState(false);

  const refineMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/prompts/refine", {
        prompt,
        context,
      });
      return response.json() as Promise<RefinePromptResponse>;
    },
    onSuccess: (data) => {
      onRefined(data.refined);
      toast({
        title: "Prompt refined",
        description: "Your prompt has been enhanced for better results.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to refine prompt",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsRefining(false);
    },
  });

  const handleRefine = () => {
    if (!prompt || prompt.length < 3 || isRefining || disabled) return;
    setIsRefining(true);
    refineMutation.mutate();
  };

  const isDisabled = disabled || isRefining || prompt.length < 3;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefine}
          disabled={isDisabled}
          data-testid="button-refine-prompt"
          className="shrink-0 gap-1.5 bg-gradient-to-r from-purple-500/10 to-violet-500/10 border-purple-500/30 hover:border-purple-500/50 hover:from-purple-500/20 hover:to-violet-500/20 text-purple-400"
        >
          {isRefining ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          <span className="text-xs font-medium">Enhance with AI</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isRefining ? "Enhancing your prompt..." : "Use AI to improve your prompt for better results"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
