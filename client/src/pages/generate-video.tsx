import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePricing } from "@/hooks/use-pricing";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Video, Upload, X, Info, ChevronDown, Sparkles, Zap, Film, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreditCostWarning } from "@/components/credit-cost-warning";
import { TemplateManager } from "@/components/template-manager";
import { ThreeColumnLayout } from "@/components/three-column-layout";
import { PreviewPanel } from "@/components/preview-panel";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SeedControl } from "@/components/SeedControl";
import { SavedSeedsLibrary } from "@/components/SavedSeedsLibrary";
import { useLocation } from "wouter";
import { SiGoogle } from "react-icons/si";
import { GuestGenerateModal } from "@/components/guest-generate-modal";

// Model icon component for consistent styling
const ModelIcon = ({ modelValue, className = "h-4 w-4" }: { modelValue: string; className?: string }) => {
  if (modelValue.startsWith("veo-")) {
    return <SiGoogle className={`${className} text-blue-500`} />;
  }
  if (modelValue.startsWith("runway-")) {
    return <Film className={`${className} text-purple-500`} />;
  }
  if (modelValue.startsWith("seedance-")) {
    return <Sparkles className={`${className} text-pink-500`} />;
  }
  if (modelValue.startsWith("wan-")) {
    return <Wand2 className={`${className} text-orange-500`} />;
  }
  if (modelValue.startsWith("kling-")) {
    return <Zap className={`${className} text-yellow-500`} />;
  }
  return <Video className={`${className} text-muted-foreground`} />;
};

const ASPECT_RATIO_SUPPORT: Record<string, string[]> = {
  "veo-3.1": ["16:9", "9:16"],
  "veo-3.1-fast": ["16:9", "9:16"],
  "veo-3.1-first-and-last-frames": ["16:9", "9:16"],
  "veo-3.1-fast-reference-2-video": ["16:9"],  // Reference 2 Video only supports 16:9
  "veo-3": ["16:9", "9:16"],
  "runway-gen3-alpha-turbo": ["16:9", "4:3", "1:1", "3:4", "9:16"],
  "seedance-1-pro": ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
  "seedance-1-lite": ["16:9", "4:3", "1:1", "3:4", "9:16", "9:21"],
  "wan-2.5": ["16:9", "9:16", "1:1"],
  "kling-2.5-turbo": ["16:9", "9:16", "1:1"],
  "sora-2-pro": ["16:9", "9:16", "1:1"],
};

const DURATION_SUPPORT: Record<string, number[]> = {
  "veo-3.1": [8],
  "veo-3.1-fast": [8],
  "veo-3.1-first-and-last-frames": [8],
  "veo-3.1-fast-reference-2-video": [8],
  "runway-gen3-alpha-turbo": [5, 10],
  "seedance-1-pro": [5, 10],
  "seedance-1-lite": [10],
  "wan-2.5": [5, 10],
  "kling-2.5-turbo": [5, 10],
  "sora-2-pro": [10, 15, 25],
};

const QUALITY_SUPPORT: Record<string, string[]> = {
  "sora-2-pro": ["standard", "high"],
};

const ASPECT_RATIO_LABELS: Record<string, string> = {
  "21:9": "21:9 (Ultrawide)",
  "16:9": "16:9 (Landscape)",
  "9:16": "9:16 (Portrait)",
  "4:3": "4:3 (Classic)",
  "1:1": "1:1 (Square)",
  "3:4": "3:4 (Portrait)",
  "9:21": "9:21 (Ultrawide Portrait)",
};

const VIDEO_MODEL_INFO = [
  { 
    value: "veo-3.1-fast", 
    label: "Veo 3.1 Fast", 
    description: "Faster generation, great quality", 
    duration: "8s",
    supportsImages: true,
    maxImages: 3 
  },
  { 
    value: "veo-3.1", 
    label: "Veo 3.1 Quality", 
    description: "HD quality with synchronized audio", 
    duration: "8s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "runway-gen3-alpha-turbo", 
    label: "Runway Gen-3", 
    description: "HD quality video generation", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "seedance-1-lite", 
    label: "Seedance 1.0 Lite", 
    description: "720p fast generation", 
    duration: "10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "seedance-1-pro", 
    label: "Seedance 1.0 Pro", 
    description: "Cinematic quality with camera control", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "wan-2.5", 
    label: "Wan 2.5", 
    description: "Native audio sync & lip-sync support", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
  { 
    value: "kling-2.5-turbo", 
    label: "Kling 2.5 Turbo", 
    description: "Fast, fluid motion with realistic physics", 
    duration: "5s, 10s",
    supportsImages: true,
    maxImages: 1 
  },
];


export default function GenerateVideo() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const { getModelCost, pricingQuery } = usePricing();
  const { markStepComplete } = useOnboarding();
  const [, navigate] = useLocation();
  
  // Simple state management - default to text-to-video with Veo 3.1 Fast
  const [model, setModel] = useState('veo-3.1-fast');
  const [generationType, setGenerationType] = useState<"text-to-video" | "image-to-video" | "first-and-last-frames-to-video" | "reference-2-video">('text-to-video');
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [duration, setDuration] = useState(5);
  const [quality, setQuality] = useState("720p");
  const [soraQuality, setSoraQuality] = useState("standard"); // For Sora 2 Pro (Standard/High)
  const [resolution, setResolution] = useState("720p"); // For Seedance and Wan models
  const [cameraFixed, setCameraFixed] = useState(false); // For Seedance models
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [seedLocked, setSeedLocked] = useState(false);
  const [negativePrompt, setNegativePrompt] = useState(""); // For Wan and Kling models
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(true); // For Wan model
  const [cfgScale, setCfgScale] = useState(0.5); // For Kling model (0-1, step 0.1)
  const [showGuestModal, setShowGuestModal] = useState(false);

  // Merge model info with dynamic pricing
  const [videoModels, setVideoModels] = useState(() => VIDEO_MODEL_INFO.map(m => ({
    ...m,
    cost: 0,
  })));
  
  useEffect(() => {
    // Update videoModels whenever pricing data changes, resolution, or duration changes
    // pricingQuery.dataUpdatedAt only changes when TanStack refetches, so no infinite loop
    const nextModels = VIDEO_MODEL_INFO.map(m => ({
      ...m,
      // For Runway, Seedance Pro, Seedance Lite, Wan 2.5, and Sora 2 Pro, use composite/suffix keys for pricing lookup
      cost: m.value === 'runway-gen3-alpha-turbo'
        ? (getModelCost(`runway-gen3-alpha-turbo-${duration}s`, 400) || 0)
        : m.value === 'seedance-1-pro' 
          ? (getModelCost(`seedance-1-pro-${duration}s-${resolution}`, 400) || 0)
          : m.value === 'seedance-1-lite' 
            ? (getModelCost(`seedance-1-lite-${resolution}`, 400) || 0)
            : m.value === 'wan-2.5'
              ? (getModelCost(`wan-2.5-${duration}s-${resolution}`, 400) || 0)
              : m.value === 'kling-2.5-turbo'
                ? (getModelCost(
                    generationType === 'text-to-video' 
                      ? 'kling-2.5-turbo-t2v'
                      : `kling-2.5-turbo-i2v-${duration}s`, 
                    400
                  ) || 0)
                : m.value === 'veo-3.1' && (generationType === 'first-and-last-frames-to-video')
                  ? (getModelCost('veo-3.1-first-and-last-frames', 400) || 0)
                  : m.value === 'veo-3.1-fast' && (generationType === 'reference-2-video')
                    ? (getModelCost('veo-3.1-fast-reference-2-video', 400) || 0)
                    : (getModelCost(m.value, 400) || 0),
    }));
    
    setVideoModels(nextModels);
  }, [pricingQuery.dataUpdatedAt, getModelCost, resolution, duration, generationType, soraQuality]);
  
  const VIDEO_MODELS = videoModels;
  
  // Generation result state
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);
  
  // Helper to check if current model supports seeds
  const modelSupportsSeed = () => {
    return model.startsWith('veo-') || model.startsWith('seedance-') || model.startsWith('wan-');
  };
  
  // Helper to check if current model should NOT have resolution parameter
  const modelSkipsResolution = () => {
    return model.startsWith('veo-3.1');
  };

  // Handle model change with synchronous duration clamping
  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    
    // Synchronously clamp duration to ensure valid state immediately
    const supportedDurations = DURATION_SUPPORT[newModel] || [5, 8, 10];
    if (!supportedDurations.includes(duration)) {
      setDuration(supportedDurations[0]);
    }
  };

  // Load template handler
  const handleLoadTemplate = (template: any) => {
    setPrompt(template.prompt);
    if (template.model) {
      setModel(template.model);
      if (template.generationType) {
        setGenerationType(template.generationType);
      }
    }
    if (template.parameters) {
      if (template.parameters.aspectRatio) setAspectRatio(template.parameters.aspectRatio);
      if (template.parameters.duration) setDuration(template.parameters.duration);
      // Only load quality if not Runway Gen-3 (which always uses 720p)
      if (template.parameters.quality && template.model !== 'runway-gen3-alpha-turbo') {
        setQuality(template.parameters.quality);
      }
    }
  };

  // Guest browsing allowed - no auto-redirect to login
  // Users will see the guest modal when they try to generate

  // Load seed from sessionStorage (from history "Use Seed" button) - only once on mount
  useEffect(() => {
    console.log(`🌱 [SEED MOUNT] useEffect triggered - checking sessionStorage`);
    const savedSeed = sessionStorage.getItem('regenerateSeed');
    console.log(`🌱 [SEED MOUNT] sessionStorage.getItem('regenerateSeed') = ${savedSeed}`);
    if (savedSeed) {
      const seedValue = parseInt(savedSeed, 10);
      console.log(`🌱 [SEED MOUNT] Parsed seedValue: ${seedValue}, isNaN: ${isNaN(seedValue)}`);
      // Always apply valid seeds, regardless of current model (user can change model later)
      if (!isNaN(seedValue) && seedValue >= 1 && seedValue <= 2147483647) {
        console.log(`🌱 [SEED MOUNT] ✓ Valid seed - calling setSeed(${seedValue}) and setSeedLocked(true)`);
        setSeed(seedValue);
        setSeedLocked(true); // Lock the seed when loading from history
      } else {
        console.log(`🌱 [SEED MOUNT] ✗ Invalid seed - out of range or NaN`);
      }
      // Always clear the stored seed after consuming it (even if invalid)
      sessionStorage.removeItem('regenerateSeed');
      console.log(`🌱 [SEED MOUNT] Cleared sessionStorage`);
    } else {
      console.log(`🌱 [SEED MOUNT] No seed found in sessionStorage`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - run only once on mount

  // Poll for generation result when generationId is set
  const { data: pollData } = useQuery<any>({
    queryKey: ["/api/generations", generationId],
    queryFn: async () => {
      if (!generationId) return null;
      return await apiRequest("GET", `/api/generations/${generationId}`);
    },
    enabled: isAuthenticated && !!generationId && isGenerating,
    refetchInterval: 2000, // Poll every 2 seconds while generating
    refetchOnWindowFocus: false,
  });

  // Update generatedVideo when poll data arrives with resultUrl
  useEffect(() => {
    if (pollData?.resultUrl) {
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      toast({
        title: "Video Generated!",
        description: "Your video is ready to view and download.",
      });
    } else if (pollData?.status === 'failed' || pollData?.status === 'failure') {
      setGeneratedVideo(pollData);
      setIsGenerating(false);
      setGenerationId(null); // Stop polling
      toast({
        title: "Generation Failed",
        description: pollData?.errorMessage || "Failed to generate video",
        variant: "destructive",
      });
    }
  }, [pollData, toast]);

  const selectedModel = VIDEO_MODELS.find(m => m.value === model);
  const maxImages = selectedModel?.maxImages || 1;

  // Trim reference images when model changes (enforce max images limit)
  useEffect(() => {
    if (referenceImages.length > maxImages) {
      setReferenceImages(prev => prev.slice(0, maxImages));
      toast({
        title: "Images Adjusted",
        description: `${selectedModel?.label} supports up to ${maxImages} image${maxImages > 1 ? 's' : ''}. Extra images removed.`,
      });
    }
  }, [model, maxImages, referenceImages.length, selectedModel?.label, toast]);

  // Auto-adjust duration when model changes to ensure it's supported
  useEffect(() => {
    const supportedDurations = DURATION_SUPPORT[model] || [5, 8, 10];
    
    // If current duration is not supported by the new model, auto-adjust to first supported duration
    if (!supportedDurations.includes(duration)) {
      // Always use the first supported duration to ensure users see all options
      const firstDuration = supportedDurations[0];
      
      setDuration(firstDuration);
      
      const modelLabel = VIDEO_MODEL_INFO.find(m => m.value === model)?.label || model;
      toast({
        title: "Duration Adjusted",
        description: `${modelLabel} supports: ${supportedDurations.join('s, ')}s. Duration set to ${firstDuration}s.`,
      });
    }
  }, [model, duration, toast]);

  // Auto-adjust aspect ratio when switching models
  useEffect(() => {
    const supportedRatios = ASPECT_RATIO_SUPPORT[model] || ["16:9", "9:16"];
    
    if (!supportedRatios.includes(aspectRatio)) {
      setAspectRatio('16:9');
      const modelName = selectedModel?.label || model;
      toast({
        title: "Aspect Ratio Adjusted",
        description: `${modelName} doesn't support ${aspectRatio}. Aspect ratio set to 16:9.`,
      });
    }
  }, [model, aspectRatio, toast, selectedModel?.label]);

  // Auto-switch to text-to-video when model doesn't support image modes
  useEffect(() => {
    if (selectedModel && !selectedModel.supportsImages && (generationType === "image-to-video" || generationType === "first-and-last-frames-to-video" || generationType === "reference-2-video")) {
      setGenerationType("text-to-video");
      setReferenceImages([]);
      toast({
        title: "Mode switched to Text to Video",
        description: `${selectedModel.label} does not support image modes. Use Veo 3.1 for First & Last Frames, or Veo 3.1 Fast for Reference 2 Video.`,
        variant: "default",
      });
    }
  }, [model, selectedModel, generationType, toast]);

  // Auto-switch from Veo 3.1 Quality to Veo 3.1 Fast when Reference Video is selected
  useEffect(() => {
    if (model === 'veo-3.1' && generationType === 'reference-2-video') {
      setModel('veo-3.1-fast');
      toast({
        title: "Model switched to Veo 3.1 Fast",
        description: "Reference Video only supports Veo 3.1 Fast. Model has been automatically switched.",
        variant: "default",
      });
    }
  }, [model, generationType, toast]);

  // Auto-reset quality to 720p when Runway Gen-3 is selected
  useEffect(() => {
    if (model === 'runway-gen3-alpha-turbo' && quality !== '720p') {
      setQuality('720p');
    }
  }, [model, quality]);

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/generate/video", data);
    },
    onSuccess: (data: any) => {
      setGenerationId(data.generationId);
      setIsGenerating(true);
      setGeneratedVideo(null);
      toast({
        title: "Generation Started",
        description: "Your video is being generated. Watch the preview panel for progress.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/generations"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 500);
        return;
      }
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (referenceImages.length >= maxImages) {
      toast({
        title: "Image Limit Reached",
        description: `${selectedModel?.label} supports up to ${maxImages} reference image${maxImages > 1 ? 's' : ''}.`,
        variant: "destructive",
      });
      return;
    }

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setReferenceImages(prev => [...prev, base64String]);
        setUploadingImage(false);
      };
      reader.onerror = () => {
        toast({
          title: "Upload Failed",
          description: "Failed to read image file.",
          variant: "destructive",
        });
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload image.",
        variant: "destructive",
      });
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = () => {
    // Guest check - prompt sign up if not authenticated
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    // DEBUG: Log current state at time of generation
    console.log(`🌱 [GENERATE DEBUG] Current state: seed=${seed}, seedLocked=${seedLocked}, model=${model}`);
    
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a description for your video.",
        variant: "destructive",
      });
      return;
    }

    if ((generationType === "image-to-video" || generationType === "reference-2-video") && referenceImages.length === 0) {
      toast({
        title: "Reference Image(s) Required",
        description: generationType === "reference-2-video" 
          ? "Please upload reference images for material-to-video generation."
          : "Please upload at least one reference image for image-to-video generation.",
        variant: "destructive",
      });
      return;
    }
    
    if (generationType === "first-and-last-frames-to-video" && referenceImages.length < 2) {
      toast({
        title: "Two Reference Images Required",
        description: "Please upload first and last frame images for first-and-last-frames-to-video generation.",
        variant: "destructive",
      });
      return;
    }

    // Final guard: ensure reference images don't exceed model limit
    if (referenceImages.length > maxImages) {
      toast({
        title: "Too Many Images",
        description: `${selectedModel?.label} supports up to ${maxImages} image${maxImages > 1 ? 's' : ''}.`,
        variant: "destructive",
      });
      return;
    }

    // Validate duration for model
    const supportedDurations = DURATION_SUPPORT[model] || [5, 8, 10];
    if (!supportedDurations.includes(duration)) {
      const modelLabel = VIDEO_MODEL_INFO.find(m => m.value === model)?.label || model;
      toast({
        title: "Invalid Duration",
        description: `${modelLabel} supports: ${supportedDurations.join('s, ')}s only.`,
        variant: "destructive",
      });
      return;
    }

    // Defensive credit check - prevent API call if insufficient credits
    const userCredits = (user as any)?.credits;
    const modelCost = selectedModel?.cost || 0;
    
    if (typeof userCredits === 'number' && userCredits < modelCost) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${modelCost} credits but only have ${userCredits}. Please upgrade your plan.`,
        variant: "destructive",
      });
      return;
    }

    // Build parameters with seed support (Veo uses array 'seeds', others use singular 'seed')
    const parameters: any = {
      duration,
    };
    
    // Only include quality for models that use it (not Runway, Seedance, Wan 2.5, Kling 2.5 Turbo, or Sora 2 Pro)
    if (model !== 'runway-gen3-alpha-turbo' && !model.startsWith('seedance-') && model !== 'wan-2.5' && model !== 'kling-2.5-turbo' && model !== 'sora-2-pro') {
      parameters.quality = quality;
    }
    
    // Add aspectRatio only if NOT (Seedance + image-to-video) or (Veo 3.1 models - resolution auto-detected)
    // For Seedance image-to-video, aspect ratio is determined by the input image
    // For Veo 3.1 models, resolution/aspect ratio defaults are determined by API
    const isSeedanceImageToVideo = model.startsWith('seedance-') && generationType === 'image-to-video';
    if (!isSeedanceImageToVideo && !modelSkipsResolution()) {
      parameters.aspectRatio = aspectRatio;
    } else if (!modelSkipsResolution()) {
      parameters.aspectRatio = aspectRatio;  // Veo 3.1 still needs aspect ratio
    } else if (model === 'veo-3.1-fast-reference-2-video') {
      parameters.aspectRatio = '16:9'; // Reference 2 Video only supports 16:9
    } else {
      parameters.aspectRatio = aspectRatio;
    }
    
    // Add resolution and cameraFixed for Seedance models (NOT for Veo 3.1)
    if (model.startsWith('seedance-') && !modelSkipsResolution()) {
      parameters.resolution = resolution;
      parameters.cameraFixed = cameraFixed;
    }
    
    // Add resolution, negativePrompt, and enablePromptExpansion for Wan 2.5 (NOT for Veo 3.1)
    if (model === 'wan-2.5' && !modelSkipsResolution()) {
      parameters.resolution = resolution;
      parameters.negativePrompt = negativePrompt;
      parameters.enablePromptExpansion = enablePromptExpansion;
    }
    
    // Add negativePrompt and cfgScale for Kling 2.5
    if (model === 'kling-2.5-turbo') {
      parameters.negativePrompt = negativePrompt;
      parameters.cfgScale = cfgScale;
    }
    
    // Add quality for Sora 2 Pro
    if (model === 'sora-2-pro') {
      parameters.soraQuality = soraQuality; // 'standard' or 'high'
      parameters.nFrames = String(duration); // Convert duration to string for Sora 2 API
    }
    
    // Add seed if model supports it and seed is provided
    // CRITICAL: Also check sessionStorage as fallback (in case useEffect didn't run yet)
    let effectiveSeed = seed;
    console.log(`🌱 [SEED TRACE] Step 1 - Initial seed state: ${seed}, seedLocked: ${seedLocked}`);
    
    if (!effectiveSeed) {
      const storedSeed = sessionStorage.getItem('regenerateSeed');
      console.log(`🌱 [SEED TRACE] Step 2 - sessionStorage fallback check: ${storedSeed}`);
      if (storedSeed) {
        const parsedSeed = parseInt(storedSeed, 10);
        if (!isNaN(parsedSeed) && parsedSeed >= 1) {
          effectiveSeed = parsedSeed;
          setSeed(parsedSeed); // Update state for UI
          setSeedLocked(true);
          sessionStorage.removeItem('regenerateSeed');
          console.log(`🌱 [SEED TRACE] Step 2b - Loaded from sessionStorage: ${parsedSeed}`);
        }
      }
    }
    
    console.log(`🌱 [SEED TRACE] Step 3 - effectiveSeed after fallback: ${effectiveSeed}`);
    console.log(`🌱 [SEED TRACE] Step 4 - modelSupportsSeed(): ${modelSupportsSeed()}, model: ${model}`);
    
    if (modelSupportsSeed() && effectiveSeed) {
      console.log(`🌱 [SEED TRACE] Step 5 - Adding seed to parameters: ${effectiveSeed}`);
      if (model.startsWith('veo-')) {
        parameters.seeds = [effectiveSeed]; // Veo uses array format
        console.log(`🌱 [SEED TRACE] Step 5b - Veo format: parameters.seeds = [${effectiveSeed}]`);
      } else {
        parameters.seed = effectiveSeed; // Seedance/Wan use singular
        console.log(`🌱 [SEED TRACE] Step 5b - Non-Veo format: parameters.seed = ${effectiveSeed}`);
      }
    } else {
      console.log(`🌱 [SEED TRACE] Step 5 - NOT adding seed. modelSupportsSeed=${modelSupportsSeed()}, effectiveSeed=${effectiveSeed}`);
    }
    
    console.log(`🌱 [SEED TRACE] Step 6 - Final parameters:`, JSON.stringify(parameters));
    
    // Map generation types to the correct model names
    let finalModel = model;
    let finalGenerationType = generationType;
    
    if (model === 'veo-3.1' && generationType === 'first-and-last-frames-to-video') {
      finalModel = 'veo-3.1-first-and-last-frames';
      finalGenerationType = 'image-to-video'; // API treats it as image-to-video
    } else if (model === 'veo-3.1-fast' && generationType === 'reference-2-video') {
      finalModel = 'veo-3.1-fast-reference-2-video';
      finalGenerationType = 'image-to-video'; // API treats it as image-to-video
    }
    
    generateMutation.mutate({
      model: finalModel,
      prompt,
      generationType: finalGenerationType,
      referenceImages: (generationType === "image-to-video" || generationType === "first-and-last-frames-to-video" || generationType === "reference-2-video") ? referenceImages : undefined,
      parameters,
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
    <ThreeColumnLayout
      form={
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Generation Settings</CardTitle>
                <CardDescription>Configure your video parameters</CardDescription>
              </div>
              <TemplateManager
                featureType="video"
                onLoadTemplate={handleLoadTemplate}
                currentPrompt={prompt}
                currentModel={model}
                currentParameters={{ aspectRatio, duration, quality }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Generation Type Tabs */}
            <Tabs value={generationType} onValueChange={(value) => setGenerationType(value as "text-to-video" | "image-to-video" | "first-and-last-frames-to-video" | "reference-2-video")}>
              <TabsList className="grid w-full grid-cols-2" data-testid="tabs-generation-type">
                <TabsTrigger value="text-to-video" data-testid="tab-text-to-video" className="text-xs sm:text-sm">
                  Text
                </TabsTrigger>
                <TabsTrigger 
                  value="image-to-video" 
                  data-testid="tab-image-to-video"
                  disabled={!selectedModel?.supportsImages}
                  className="text-xs sm:text-sm"
                >
                  Image
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text-to-video" className="space-y-6 mt-6">
                <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Text to Video</p>
                    <p className="text-sm text-muted-foreground">
                      Generate videos from text descriptions using AI models
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="image-to-video" className="space-y-6 mt-6">
                <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">Image to Video</p>
                    <p className="text-sm text-muted-foreground">
                      Upload {maxImages === 1 ? "1 reference image" : `up to ${maxImages} reference images`} to guide video generation
                    </p>
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-3">
                  <Label>Reference Images ({referenceImages.length}/{maxImages})</Label>
                  
                  {referenceImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {referenceImages.map((img, index) => (
                        <div key={index} className="relative group">
                          <img 
                            src={img} 
                            alt={`Reference ${index + 1}`}
                            className="w-full h-24 object-cover rounded-md border-2 border-border"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                            data-testid={`button-remove-image-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <Badge className="absolute bottom-1 left-1 text-xs">
                            {index + 1}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {referenceImages.length < maxImages && (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                        data-testid="input-upload-image"
                      />
                      <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors">
                        {uploadingImage ? (
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm font-medium">Upload Reference Image</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Click to select an image file
                            </p>
                          </>
                        )}
                      </div>
                    </label>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="first-and-last-frames-to-video" className="space-y-6 mt-6">
                <div className="bg-muted/50 rounded-md p-4 flex gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-sm">First & Last Frames</p>
                    <p className="text-sm text-muted-foreground">
                      Upload a first frame and last frame to guide video generation
                    </p>
                  </div>
                </div>

                {/* First and Last Frames Upload */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label>Select First Frame Image</Label>
                    {referenceImages.length > 0 && (
                      <div className="relative group">
                        <img 
                          src={referenceImages[0]} 
                          alt="First Frame"
                          className="w-full h-40 object-cover rounded-md border-2 border-border"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(0)}
                          data-testid="button-remove-first-frame"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {referenceImages.length === 0 && (
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setReferenceImages(prev => [...prev, reader.result as string]);
                              };
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                          disabled={uploadingImage}
                          data-testid="input-upload-first-frame"
                        />
                        <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors">
                          {uploadingImage ? (
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <>
                              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm font-medium">Upload First Frame</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Drag or click to upload
                              </p>
                            </>
                          )}
                        </div>
                      </label>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>Select Last Frame Image</Label>
                    {referenceImages.length > 1 && (
                      <div className="relative group">
                        <img 
                          src={referenceImages[1]} 
                          alt="Last Frame"
                          className="w-full h-40 object-cover rounded-md border-2 border-border"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(1)}
                          data-testid="button-remove-last-frame"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {referenceImages.length < 2 && (
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setReferenceImages(prev => [...prev, reader.result as string]);
                              };
                              reader.readAsDataURL(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                          disabled={uploadingImage || referenceImages.length === 0}
                          data-testid="input-upload-last-frame"
                        />
                        <div className="border-2 border-dashed border-border rounded-md p-6 hover-elevate active-elevate-2 cursor-pointer text-center transition-colors">
                          {uploadingImage ? (
                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                          ) : (
                            <>
                              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm font-medium">Upload Last Frame</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Drag or click to upload
                              </p>
                            </>
                          )}
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Model Selection */}
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={model} onValueChange={handleModelChange}>
                <SelectTrigger id="model" data-testid="select-video-model">
                  <div className="flex items-center gap-2">
                    <ModelIcon modelValue={model} />
                    <span>{selectedModel?.label || model} ({selectedModel?.cost || 0} credits)</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_MODELS.map((m) => {
                    const isDisabledForReference = m.value === 'veo-3.1' && generationType === 'reference-2-video';
                    return (
                      <SelectItem 
                        key={m.value} 
                        value={m.value}
                        disabled={isDisabledForReference}
                        className={isDisabledForReference ? "opacity-50" : ""}
                      >
                        <div className="flex items-center gap-2">
                          <ModelIcon modelValue={m.value} />
                          <span className={isDisabledForReference ? "text-muted-foreground" : ""}>
                            {m.label} ({m.cost} credits)
                            {isDisabledForReference && " - Not supported for Reference Video"}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedModel?.description && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{selectedModel.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Duration: {selectedModel.duration} • Max images: {selectedModel.maxImages}
                  </p>
                </div>
              )}
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Video Description</Label>
              <Textarea
                id="prompt"
                placeholder={
                  generationType === "text-to-video" 
                    ? "Describe the video you want to create... (e.g., 'A serene sunset over mountains with birds flying')"
                    : "Describe how the reference image(s) should animate... (e.g., 'The scene slowly zooms in as clouds drift across the sky')"
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                data-testid="input-video-prompt"
              />
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger id="duration" data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(DURATION_SUPPORT[model] || [5, 8, 10]).map((dur) => (
                    <SelectItem key={dur} value={String(dur)}>
                      {dur} seconds
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(DURATION_SUPPORT[model] || []).length < 3 && (
                <p className="text-xs text-muted-foreground">
                  {selectedModel?.label || model} supports: {(DURATION_SUPPORT[model] || [5, 8, 10]).join('s, ')}s
                </p>
              )}
            </div>

            {/* Quality - Hidden for Runway Gen-3, Seedance, Wan 2.5, Kling 2.5 Turbo, Sora 2 Pro, and Veo 3.1 models */}
            {model !== 'runway-gen3-alpha-turbo' && !model.startsWith('seedance-') && model !== 'wan-2.5' && model !== 'kling-2.5-turbo' && model !== 'sora-2-pro' && !model.startsWith('veo-') && (
              <div className="space-y-2">
                <Label htmlFor="quality">Quality</Label>
                <Select value={quality} onValueChange={setQuality}>
                  <SelectTrigger id="quality" data-testid="select-quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sora 2 Pro Quality Selector */}
            {model === 'sora-2-pro' && (
              <div className="space-y-2">
                <Label htmlFor="sora-quality">Video Quality</Label>
                <Select value={soraQuality} onValueChange={setSoraQuality}>
                  <SelectTrigger id="sora-quality" data-testid="select-sora-quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  High quality provides better detail and clarity
                </p>
              </div>
            )}

            {/* Resolution - Only for Seedance models */}
            {model.startsWith('seedance-') && (
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger id="resolution" data-testid="select-resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p (Fast)</SelectItem>
                    <SelectItem value="720p">720p (Balanced)</SelectItem>
                    <SelectItem value="1080p">1080p (High Quality)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Higher resolution costs more credits
                </p>
              </div>
            )}

            {/* Camera Fixed Toggle - Only for Seedance models */}
            {model.startsWith('seedance-') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="camera-fixed">Camera Fixed</Label>
                  <Switch
                    id="camera-fixed"
                    checked={cameraFixed}
                    onCheckedChange={setCameraFixed}
                    data-testid="switch-camera-fixed"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Lock camera position to prevent movement
                </p>
              </div>
            )}

            {/* Resolution - Only for Wan 2.5 */}
            {model === 'wan-2.5' && (
              <div className="space-y-2">
                <Label htmlFor="wan-resolution">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger id="wan-resolution" data-testid="select-wan-resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="720p">720p (Balanced)</SelectItem>
                    <SelectItem value="1080p">1080p (High Quality)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Higher resolution costs more credits
                </p>
              </div>
            )}

            {/* Negative Prompt - For Wan 2.5 and Kling 2.5 */}
            {(model === 'wan-2.5' || model === 'kling-2.5-turbo') && (
              <div className="space-y-2">
                <Label htmlFor="negative-prompt">Negative Prompt (Optional)</Label>
                <Textarea
                  id="negative-prompt"
                  placeholder="Describe what you want to avoid in the video..."
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={3}
                  maxLength={model === 'kling-2.5-turbo' ? 2496 : 500}
                  data-testid="textarea-negative-prompt"
                />
                <p className="text-xs text-muted-foreground">
                  Max {model === 'kling-2.5-turbo' ? '2496' : '500'} characters - Describe content to avoid
                </p>
              </div>
            )}

            {/* CFG Scale - Only for Kling 2.5 */}
            {model === 'kling-2.5-turbo' && (
              <div className="space-y-2">
                <Label htmlFor="cfg-scale">CFG Scale: {cfgScale.toFixed(1)}</Label>
                <Slider
                  id="cfg-scale"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[cfgScale]}
                  onValueChange={(value) => setCfgScale(value[0])}
                  data-testid="slider-cfg-scale"
                />
                <p className="text-xs text-muted-foreground">
                  How closely the model follows your prompt (0 = loose, 1 = strict)
                </p>
              </div>
            )}

            {/* Enable Prompt Expansion - Only for Wan 2.5 */}
            {model === 'wan-2.5' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt-expansion">Enable Prompt Expansion</Label>
                  <Switch
                    id="prompt-expansion"
                    checked={enablePromptExpansion}
                    onCheckedChange={setEnablePromptExpansion}
                    data-testid="switch-prompt-expansion"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use AI to enhance and expand your prompt
                </p>
              </div>
            )}

            {/* Aspect Ratio - Hidden for Seedance image-to-video (aspect determined by input image) */}
            {!(model.startsWith('seedance-') && generationType === 'image-to-video') && (
              <div className="space-y-2">
                <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger id="aspectRatio" data-testid="select-aspect-ratio">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(ASPECT_RATIO_SUPPORT[model] || ["16:9", "9:16"]).map((ratio) => (
                      <SelectItem key={ratio} value={ratio}>
                        {ASPECT_RATIO_LABELS[ratio] || ratio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(ASPECT_RATIO_SUPPORT[model] || []).length < 4 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedModel?.label || model} supports: {(ASPECT_RATIO_SUPPORT[model] || ["16:9", "9:16"]).join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Seed Control - Only show for models that support it */}
            {modelSupportsSeed() && (
              <>
                <SeedControl
                  seed={seed}
                  onSeedChange={setSeed}
                  locked={seedLocked}
                  onLockChange={setSeedLocked}
                />
                
                {/* Seed Library Actions */}
                <div className="flex gap-2">
                  <SavedSeedsLibrary
                    currentSeed={seed}
                    onApplySeed={(appliedSeed) => {
                      setSeed(appliedSeed);
                      setSeedLocked(true); // Lock when applying a saved seed
                    }}
                  />
                </div>
              </>
            )}

            {/* Credit Cost Warning */}
            {selectedModel && (
              <CreditCostWarning 
                cost={selectedModel.cost} 
                featureName={`${selectedModel.label} video generation`}
              />
            )}

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={
                generateMutation.isPending || 
                (user && typeof (user as any).credits === 'number' && (user as any).credits < (selectedModel?.cost || 0))
              }
              className="w-full"
              size="lg"
              data-testid="button-generate-video"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (user && typeof (user as any).credits === 'number' && (user as any).credits < (selectedModel?.cost || 0)) ? (
                <>Insufficient Credits - Upgrade Plan</>
              ) : (
                <>Generate Video ({selectedModel?.cost} credits)</>
              )}
            </Button>
            {/* Model Comparison - Collapsible */}
            <Collapsible className="mt-6">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full" onClick={() => navigate("/video-models")} data-testid="button-view-all-models">
                  <ChevronDown className="mr-2 h-4 w-4" />
                  View All Models & Showcase
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                {VIDEO_MODELS.map((m) => (
                  <Card 
                    key={m.value} 
                    className={`hover-elevate active-elevate-2 cursor-pointer transition-colors ${model === m.value ? "border-primary" : ""}`}
                    onClick={() => setModel(m.value)}
                    data-testid={`card-model-${m.value}`}
                  >
                    <CardHeader className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <ModelIcon modelValue={m.value} className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{m.label}</CardTitle>
                            <CardDescription className="text-xs">{m.description}</CardDescription>
                          </div>
                        </div>
                        {m.supportsImages && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {m.maxImages === 1 ? "1 img" : `${m.maxImages} imgs`}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-bold">{m.cost} credits</span>
                        <span className="text-muted-foreground text-xs">{m.duration}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>

            {/* Tips & Best Practices */}
            <Collapsible className="mt-6">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  <ChevronDown className="mr-2 h-4 w-4" />
                  Tips & Best Practices
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Master Prompt Engineering</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Be descriptive about motion, cinematography style, and pacing. Include camera directions like "zoom in," "pan across," or "slow motion."</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Select Correct Aspect Ratio</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Use 16:9 for standard videos and YouTube, 9:16 for mobile and TikTok, 4:3 for special uses. Different models support different ratios.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Use Reference Images Effectively</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Upload clear, high-quality images for image-to-video (Grok, Veo, Runway, etc.). They guide the generation and quality matters significantly.</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Choose Model Based on Your Needs</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">Veo 3.1 for quality, Runway for speed, Grok for creative animation, Sora 2 Pro for advanced storytelling. Test to find your preferred balance.</p>
                  </CardContent>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      }
      preview={
        <PreviewPanel
          status={
            isGenerating ? "generating" :
            generatedVideo?.resultUrl ? "completed" :
            generatedVideo?.status === 'failed' ? "failed" :
            "idle"
          }
          title="Video Preview"
          description="Your generated video will appear here"
          resultUrl={generatedVideo?.resultUrl}
          resultType="video"
          errorMessage={generatedVideo?.errorMessage}
          onDownload={() => {
            if (generatedVideo?.id) {
              window.location.href = `/api/generations/${generatedVideo.id}/download`;
            }
          }}
        />
      }
    />

    <GuestGenerateModal
      open={showGuestModal}
      onOpenChange={setShowGuestModal}
      featureName="Videos"
    />
  </>
  );
}
