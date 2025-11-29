import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Sparkles } from "lucide-react";

type PromptContext = 'video' | 'image' | 'audio';

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
          variant="ghost"
          size="icon"
          onClick={handleRefine}
          disabled={isDisabled}
          data-testid="button-refine-prompt"
          className="shrink-0"
        >
          {isRefining ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isRefining ? "Refining prompt..." : "Refine prompt with AI"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
