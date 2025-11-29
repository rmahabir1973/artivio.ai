import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Video,
  Image as ImageIcon,
  Music,
  Wrench,
  Sparkles,
  Clock,
  Coins,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Play,
  Zap,
  Film,
  Mic,
  Headphones,
  MessageSquare,
  QrCode,
  Maximize,
  Eraser,
  ScanEye,
  Volume2,
  UserCircle,
  ArrowLeftRight,
  BookOpen,
  GraduationCap,
  Target,
  Wand2,
} from "lucide-react";
import { SiGoogle, SiOpenai, SiSoundcloud } from "react-icons/si";

type DifficultyLevel = "beginner" | "intermediate" | "advanced";

interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: DifficultyLevel;
  estimatedTime: string;
  creditCost: string;
  icon: any;
  iconColor: string;
  steps: string[];
  tips: string[];
  mistakes: string[];
  examplePrompts: string[];
  route?: string;
}

interface TutorialCategory {
  id: string;
  label: string;
  icon: any;
  iconColor: string;
  description: string;
  tutorials: Tutorial[];
}

const difficultyColors: Record<DifficultyLevel, string> = {
  beginner: "bg-green-500/20 text-green-400 border-green-500/30",
  intermediate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  advanced: "bg-red-500/20 text-red-400 border-red-500/30",
};

const tutorialCategories: TutorialCategory[] = [
  {
    id: "video",
    label: "AI Video Generation",
    icon: Video,
    iconColor: "text-blue-400",
    description: "Create stunning AI-generated videos with multiple models",
    tutorials: [
      {
        id: "video-generation",
        title: "Video Generation Basics",
        description: "Learn to create AI videos with Veo 3.1, Runway Gen-3, Kling 2.5, Seedance, and Wan 2.5",
        difficulty: "beginner",
        estimatedTime: "10 min",
        creditCost: "50-200 credits",
        icon: Video,
        iconColor: "text-blue-400",
        route: "/generate/video",
        steps: [
          "Navigate to Video Generation from the sidebar or Create menu",
          "Select your preferred AI model from the dropdown (Veo 3.1 Fast recommended for beginners)",
          "Write a detailed prompt describing your desired video content",
          "Choose aspect ratio (16:9 for landscape, 9:16 for portrait/social media)",
          "Select video duration (5-10 seconds depending on model)",
          "Optionally upload reference images for image-to-video generation",
          "Click 'Generate Video' and wait for processing (2-15 minutes)",
          "Preview your video and download when satisfied",
        ],
        tips: [
          "Start with Veo 3.1 Fast for quick iterations while crafting prompts",
          "Use Veo 3.1 Quality for final renders with synchronized audio",
          "Runway Gen-3 Alpha Turbo is excellent for dynamic action scenes",
          "Kling 2.5 Turbo offers great value with consistent quality",
          "Seedance models excel at dance and movement-based content",
          "Wan 2.5 is ideal for artistic and stylized animations",
        ],
        mistakes: [
          "Writing prompts that are too vague - be specific about actions, lighting, and style",
          "Ignoring aspect ratio requirements for your target platform",
          "Starting with expensive models before testing prompt concepts",
          "Not specifying camera movements (pan, zoom, tracking shot)",
          "Forgetting to include lighting and atmosphere descriptions",
        ],
        examplePrompts: [
          "A golden retriever running through a sunlit meadow, slow motion, cinematic lighting, shallow depth of field, 4K quality",
          "Futuristic cityscape at night with flying cars and neon signs, cyberpunk aesthetic, rain reflections on wet streets, drone shot",
          "A coffee cup on a wooden table, steam rising gently, morning light through window, cozy cafe atmosphere, macro lens",
          "Abstract fluid art morphing between vibrant colors, smooth transitions, mesmerizing patterns, dark background",
        ],
      },
      {
        id: "sora-2-pro",
        title: "Sora 2 Pro Advanced Features",
        description: "Master Sora 2 Pro including Storyboard and First/Last Frames features",
        difficulty: "advanced",
        estimatedTime: "20 min",
        creditCost: "200-500 credits",
        icon: Sparkles,
        iconColor: "text-purple-400",
        route: "/generate/sora",
        steps: [
          "Navigate to Sora 2 Pro from the Video section in the sidebar",
          "Choose your generation mode: Text-to-Video, First/Last Frames, or Storyboard",
          "For Text-to-Video: Enter a detailed cinematic prompt",
          "For First/Last Frames: Upload start and end frame images to control the narrative arc",
          "For Storyboard: Create a sequence of scenes with individual prompts",
          "Select duration (10, 15, or 25 seconds) and quality level (standard or high)",
          "Choose aspect ratio: 16:9, 9:16, or 1:1",
          "Generate and review your cinematic video",
        ],
        tips: [
          "Sora 2 Pro excels at cinematic, narrative-driven content",
          "Use First/Last Frames mode to ensure specific start and end compositions",
          "Storyboard mode is perfect for creating coherent multi-scene narratives",
          "High quality mode is worth the extra credits for final productions",
          "Longer durations (25s) work best for establishing shots and slow reveals",
          "Combine with the Video Editor to create longer compositions",
        ],
        mistakes: [
          "Not utilizing the unique Storyboard feature for complex narratives",
          "Using standard quality when high quality would better serve the content",
          "Ignoring the First/Last Frames mode for controlled transformations",
          "Writing prompts that don't leverage Sora's cinematic strengths",
        ],
        examplePrompts: [
          "Epic mountain sunrise timelapse, clouds flowing through valleys, golden hour lighting, cinematic drone ascending shot, 8K photorealistic",
          "Ballet dancer performing fouette turns in abandoned theater, dust particles in spotlight, dramatic shadows, 35mm film grain",
          "A letter being written with fountain pen, ink flowing onto aged paper, close-up revealing emotional words, vintage desk setting",
        ],
      },
      {
        id: "image-to-video",
        title: "Image-to-Video Workflows",
        description: "Transform static images into dynamic videos with AI",
        difficulty: "intermediate",
        estimatedTime: "15 min",
        creditCost: "75-150 credits",
        icon: Film,
        iconColor: "text-cyan-400",
        route: "/generate/video",
        steps: [
          "Go to Video Generation and select a model that supports image input",
          "Enable image upload mode (toggle or upload button)",
          "Upload 1-3 reference images depending on the model:",
          "  - Veo 3.1: 1-2 images for FIRST_AND_LAST_FRAMES mode",
          "  - Veo 3.1 Fast Reference: Up to 3 images (16:9 only)",
          "  - Runway/Seedance: 1 primary reference image",
          "Write a prompt describing how you want the image animated",
          "Specify camera movement and any transformations",
          "Generate and refine as needed",
        ],
        tips: [
          "High-resolution, well-lit images produce better results",
          "Choose images with clear subjects and minimal clutter",
          "Describe the desired motion explicitly in your prompt",
          "Use First/Last Frame mode when you want specific start and end states",
          "Reference 2 Video mode creates style-consistent animations",
          "Product photography and portraits work exceptionally well",
        ],
        mistakes: [
          "Uploading blurry or low-resolution source images",
          "Not describing the motion you want to see",
          "Using images that are too complex or busy",
          "Forgetting that aspect ratio must match your source image",
          "Expecting the AI to understand implicit motion without guidance",
        ],
        examplePrompts: [
          "[With portrait image] Gentle breeze moving through hair, subtle smile emerging, soft lighting, cinematic close-up",
          "[With product image] Slow 360-degree rotation, spotlight highlighting details, professional studio lighting, smooth motion",
          "[With landscape image] Camera slowly pushing forward, clouds drifting, time-lapse lighting changes, epic reveal",
        ],
      },
      {
        id: "video-transitions",
        title: "Video Transitions & Morphing",
        description: "Create seamless transitions and morphing effects between images",
        difficulty: "intermediate",
        estimatedTime: "12 min",
        creditCost: "100-175 credits",
        icon: ArrowLeftRight,
        iconColor: "text-orange-400",
        route: "/generate/transition",
        steps: [
          "Navigate to Transition from the Video section in the sidebar",
          "Upload your first (start) image - this will be the beginning of the transition",
          "Upload your second (end) image - this will be the final frame",
          "Write a prompt describing the transition style and any intermediate states",
          "Select aspect ratio matching your images",
          "Choose duration (longer = smoother transitions)",
          "Generate and preview the morphing effect",
        ],
        tips: [
          "Images with similar compositions morph more smoothly",
          "Use consistent lighting between start and end images",
          "Describe intermediate states for more controlled transitions",
          "Great for before/after reveals and transformations",
          "Combine multiple transitions in the Video Editor for sequences",
          "Works beautifully with product shots and character transformations",
        ],
        mistakes: [
          "Using drastically different compositions that confuse the AI",
          "Inconsistent aspect ratios between source images",
          "Not providing guidance about the transition style",
          "Expecting realistic morphs between unrelated subjects",
        ],
        examplePrompts: [
          "Smooth morphing transition, dreamlike quality, soft focus shift, elegant transformation",
          "Seasons changing from summer to winter, time-lapse style, same location perspective",
          "Day to night transition, gradual lighting change, stars appearing, peaceful mood",
        ],
      },
    ],
  },
  {
    id: "image",
    label: "AI Image Generation",
    icon: ImageIcon,
    iconColor: "text-pink-400",
    description: "Generate and edit stunning images with cutting-edge AI models",
    tutorials: [
      {
        id: "text-to-image",
        title: "Text-to-Image Generation",
        description: "Create images from text with Seedream 4.0, 4o Image, Flux Kontext, and Nano Banana",
        difficulty: "beginner",
        estimatedTime: "8 min",
        creditCost: "10-50 credits",
        icon: ImageIcon,
        iconColor: "text-pink-400",
        route: "/generate/image",
        steps: [
          "Navigate to Image Generation from the sidebar",
          "Select your preferred AI model from the dropdown",
          "Write a detailed prompt describing your desired image",
          "Choose aspect ratio (1:1 for social, 16:9 for headers, etc.)",
          "Optionally enable negative prompt to exclude unwanted elements",
          "For batch generation (Seedream), specify number of images",
          "Click Generate and wait 30-90 seconds",
          "Download or use for further editing/video generation",
        ],
        tips: [
          "4o Image (OpenAI): Best for accurate text rendering in images, ideal for memes, posters, and designs with text",
          "Flux Kontext: Excellent for vivid scenes with strong subject consistency across multiple generations",
          "Nano Banana: Ultra-fast generation, great for rapid iteration and editing workflows",
          "Seedream 4.0: Up to 4K resolution with batch generation (up to 4 images at once)",
          "Include art style references: 'oil painting style', 'digital art', 'photorealistic'",
          "Specify lighting conditions for consistent results",
        ],
        mistakes: [
          "Prompts that are too short or vague",
          "Not specifying art style or medium",
          "Ignoring aspect ratio for intended use case",
          "Conflicting descriptions in the same prompt",
          "Not using negative prompts when needed",
        ],
        examplePrompts: [
          "A cozy reading nook with floor-to-ceiling bookshelves, warm afternoon light streaming through a window, comfortable armchair, steaming cup of tea, photorealistic, 8K detail",
          "Mystical forest at twilight, bioluminescent mushrooms, fireflies, ancient trees with twisted roots, fantasy art style, volumetric fog",
          "Modern minimalist logo design for a tech startup called 'Nexus', clean lines, gradient blue to purple, white background, vector art style",
          "Street food market in Tokyo at night, neon signs reflecting on wet pavement, steam rising from food stalls, vibrant colors, cinematic photography",
        ],
      },
      {
        id: "image-editing",
        title: "Image Editing & Enhancement",
        description: "Edit and enhance existing images using AI-powered tools",
        difficulty: "intermediate",
        estimatedTime: "10 min",
        creditCost: "15-40 credits",
        icon: Wand2,
        iconColor: "text-violet-400",
        route: "/generate/image",
        steps: [
          "Go to Image Generation and enable 'Edit Mode' or upload an image",
          "Upload your source image to be edited",
          "For Flux Kontext: Describe the edits you want in your prompt",
          "For Nano Banana: Use specific editing instructions",
          "The AI will apply your requested changes while preserving the base image",
          "Compare results and iterate with adjusted prompts if needed",
          "Download your enhanced image",
        ],
        tips: [
          "Be specific about what to change and what to preserve",
          "Flux Kontext maintains strong consistency with the original",
          "Use editing for style transfer, object addition/removal, and enhancements",
          "Chain multiple edits for complex transformations",
          "Reference the original elements you want to keep unchanged",
        ],
        mistakes: [
          "Not clearly specifying which elements to preserve",
          "Expecting complete image replacement instead of editing",
          "Using low-quality source images",
          "Vague editing instructions that confuse the AI",
        ],
        examplePrompts: [
          "Change the background to a tropical beach sunset, keep the person unchanged",
          "Add a subtle golden hour glow to the entire scene, enhance warmth",
          "Replace the car with a vintage 1960s Mustang, same angle and lighting",
          "Transform this photo into a Studio Ghibli anime style illustration",
        ],
      },
      {
        id: "multi-image-generation",
        title: "Batch & Multi-Image Generation",
        description: "Generate multiple image variations efficiently",
        difficulty: "intermediate",
        estimatedTime: "8 min",
        creditCost: "40-200 credits",
        icon: Sparkles,
        iconColor: "text-amber-400",
        route: "/generate/image",
        steps: [
          "Select Seedream 4.0 (supports batch generation up to 4 images)",
          "Or use Midjourney v7 for 4 style variations",
          "Write your prompt with enough detail for consistent results",
          "Set the number of images to generate",
          "Review all generated variations",
          "Select the best result for final use",
          "Consider using the best variation as a reference for video generation",
        ],
        tips: [
          "Midjourney v7 automatically generates 4 unique variations",
          "Seedream batch mode is efficient for testing concepts",
          "Use batch generation to explore style variations",
          "Compare results to find the optimal composition",
          "Higher detail prompts lead to more consistent batches",
        ],
        mistakes: [
          "Using batch mode for very different concepts (use separate generations instead)",
          "Not taking advantage of variations for A/B testing",
          "Ignoring good variations because of one preferred element",
        ],
        examplePrompts: [
          "Product photography of wireless earbuds on marble surface, soft studio lighting, multiple angles exploration",
          "Character portrait variations: wise elderly wizard, long white beard, magical staff, fantasy art style",
        ],
      },
    ],
  },
  {
    id: "audio",
    label: "Audio & Music",
    icon: Music,
    iconColor: "text-purple-400",
    description: "Generate music, sound effects, speech, and more",
    tutorials: [
      {
        id: "music-generation",
        title: "Music Generation with Suno",
        description: "Create original music using Suno V3.5, V4, V4.5, V4.5 Plus, and V5",
        difficulty: "beginner",
        estimatedTime: "12 min",
        creditCost: "50-150 credits",
        icon: Music,
        iconColor: "text-purple-400",
        route: "/generate/music",
        steps: [
          "Navigate to Music Generation from the Audio & Music section",
          "Select your Suno model version (V4.5 Plus or V5 recommended)",
          "Enter a text prompt describing your desired music style, mood, and instruments",
          "Optionally add custom lyrics in the lyrics field",
          "Set duration (up to 8 minutes with V4.5+)",
          "Choose genre/style from presets or describe your own",
          "Toggle 'Instrumental' if you don't want vocals",
          "Click Generate and wait 2-5 minutes for your track",
        ],
        tips: [
          "V5 offers the most advanced AI capabilities and natural vocals",
          "V4.5 Plus provides premium quality with extended duration support",
          "Reference specific artists for style guidance (e.g., 'in the style of Coldplay')",
          "Include tempo and energy level in your prompt",
          "Describe instruments specifically for more control",
          "Use the lyrics field for verses, chorus, and bridges",
        ],
        mistakes: [
          "Prompts that are too abstract without musical direction",
          "Not specifying whether you want vocals or instrumental",
          "Expecting exact reproductions of copyrighted songs",
          "Writing lyrics without verse/chorus structure markers",
          "Ignoring genre-specific conventions",
        ],
        examplePrompts: [
          "Upbeat electronic dance track with synthesizer leads, driving bass, energetic drops, festival anthem vibe, 128 BPM",
          "Melancholic piano ballad with orchestral strings, emotional crescendo, cinematic score feeling, minor key",
          "Lo-fi hip hop beat with jazzy piano samples, vinyl crackle, mellow drums, perfect for studying, relaxed mood",
          "Epic orchestral trailer music with booming drums, brass fanfares, building tension, heroic resolution",
        ],
      },
      {
        id: "custom-lyrics",
        title: "Creating Custom Lyrics & Songs",
        description: "Write and generate songs with your own lyrics",
        difficulty: "intermediate",
        estimatedTime: "15 min",
        creditCost: "75-150 credits",
        icon: Mic,
        iconColor: "text-rose-400",
        route: "/generate/music?tab=lyrics",
        steps: [
          "Go to Music Generation and switch to the Lyrics tab",
          "Use the AI Lyrics Generator to create lyrics from a theme, or write your own",
          "Structure your lyrics with [Verse], [Chorus], [Bridge] markers",
          "Switch to Generate tab and paste your lyrics in the lyrics field",
          "Describe the musical style and arrangement in the prompt field",
          "Select a model (V4.5+ handles complex lyrics better)",
          "Generate and listen to how the AI interprets your lyrics",
        ],
        tips: [
          "Use standard song structure markers for best results",
          "Keep verses consistent in syllable count for natural flow",
          "The chorus should be memorable and catchy",
          "Describe vocal style: 'female soprano', 'raspy male voice', etc.",
          "Include emotional direction for each section",
        ],
        mistakes: [
          "Lyrics without clear structure markers",
          "Inconsistent line lengths causing awkward phrasing",
          "Not matching lyrical content to musical style",
          "Overcomplicated verses that are hard to sing",
        ],
        examplePrompts: [
          "[Verse 1] Walking down these empty streets at night / City lights reflecting off the rain / [Chorus] But I keep holding on, holding on to you",
        ],
      },
      {
        id: "sound-effects",
        title: "Sound Effects with ElevenLabs",
        description: "Generate custom sound effects for any project",
        difficulty: "beginner",
        estimatedTime: "5 min",
        creditCost: "10-30 credits",
        icon: Volume2,
        iconColor: "text-green-400",
        route: "/sound-effects",
        steps: [
          "Navigate to Sound Effects from the Audio & Music section",
          "Describe the sound effect you need in detail",
          "Specify duration if important for your use case",
          "Include context about where it will be used (video game, film, etc.)",
          "Generate and preview the sound effect",
          "Download in high-quality audio format",
        ],
        tips: [
          "Be specific about the sound characteristics: 'deep rumbling thunder with distant crack'",
          "Mention the environment: 'footsteps on gravel in an empty warehouse'",
          "Reference familiar sounds for clarity",
          "Layer multiple generated sounds for complex audio design",
          "Great for video projects, games, and podcasts",
        ],
        mistakes: [
          "Overly vague descriptions like 'explosion sound'",
          "Not specifying duration needs",
          "Expecting musical content from sound effect generator",
        ],
        examplePrompts: [
          "Futuristic sci-fi door whooshing open with hydraulic hiss, 2 seconds",
          "Campfire crackling with occasional pop, ambient forest sounds, 10 seconds loop",
          "Magical spell casting sound with shimmering chimes and energy buildup",
          "Vintage typewriter rapid typing with bell ding at the end",
        ],
      },
      {
        id: "text-to-speech",
        title: "Text-to-Speech Generation",
        description: "Convert text to natural-sounding speech with various voices",
        difficulty: "beginner",
        estimatedTime: "8 min",
        creditCost: "5-25 credits",
        icon: Headphones,
        iconColor: "text-teal-400",
        route: "/text-to-speech",
        steps: [
          "Navigate to Text to Speech from the Audio & Music section",
          "Enter or paste the text you want converted to speech",
          "Browse and select from available voice options",
          "Preview different voices to find the right match",
          "Adjust parameters like stability and style if available",
          "Generate the speech audio",
          "Download the audio file for use in your projects",
        ],
        tips: [
          "Match voice characteristics to your content (professional, casual, etc.)",
          "Use punctuation to control pacing and pauses",
          "Ellipsis (...) creates natural pauses",
          "Test with short passages before generating long content",
          "Great for voiceovers, audiobooks, and presentations",
        ],
        mistakes: [
          "Not testing voice selection before generating long content",
          "Ignoring punctuation's effect on speech rhythm",
          "Choosing mismatched voice style for content type",
        ],
        examplePrompts: [
          "Welcome to Artivio AI, where creativity meets artificial intelligence. Today, we'll explore the endless possibilities...",
          "Breaking news: Scientists have discovered a new method for sustainable energy production that could revolutionize...",
        ],
      },
      {
        id: "voice-cloning",
        title: "Voice Cloning",
        description: "Create custom AI voices from audio samples",
        difficulty: "advanced",
        estimatedTime: "20 min",
        creditCost: "100-200 credits",
        icon: Mic,
        iconColor: "text-indigo-400",
        route: "/voice-clone",
        steps: [
          "Navigate to Voice Cloning from the Audio & Music section",
          "Choose to record directly or upload existing audio samples",
          "For recording: Use a quiet environment and speak clearly for 30+ seconds",
          "For uploading: Provide high-quality audio with clear speech",
          "Submit the sample for voice cloning processing",
          "Once cloned, your custom voice appears in the voice selection",
          "Use your cloned voice in Text-to-Speech for personalized content",
        ],
        tips: [
          "High-quality, noise-free recordings produce better clones",
          "Speak naturally with varied intonation for realistic results",
          "Longer samples (1-3 minutes) create more accurate clones",
          "Avoid background music or noise in samples",
          "Test the cloned voice with different content types",
          "Perfect for consistent brand voice across content",
        ],
        mistakes: [
          "Recording in noisy environments",
          "Using samples with background music",
          "Very short recording samples",
          "Monotone speech without natural variation",
          "Low-quality audio equipment or compression artifacts",
        ],
        examplePrompts: [
          "Record a 60-second sample reading varied content with natural emotion and pacing",
        ],
      },
      {
        id: "lip-sync",
        title: "Lip Sync Video Creation",
        description: "Create talking videos with synchronized lip movements",
        difficulty: "advanced",
        estimatedTime: "25 min",
        creditCost: "150-300 credits",
        icon: Video,
        iconColor: "text-pink-400",
        route: "/lip-sync",
        steps: [
          "Navigate to Lip Sync from the Audio & Music section",
          "Upload a portrait image or video of the person/character",
          "Ensure the face is clearly visible, front-facing preferred",
          "Upload or generate the audio for lip syncing (speech or song)",
          "Or use Text-to-Speech to generate audio directly",
          "Configure sync settings if available",
          "Generate the lip-synced video",
          "Review and download the final talking video",
        ],
        tips: [
          "Front-facing portraits with neutral expressions work best",
          "Clear, high-resolution source images improve quality",
          "Match audio length to desired video length",
          "Great for creating digital presenters and spokespersons",
          "Can be combined with AI-generated character images",
          "Use for educational content, marketing, and entertainment",
        ],
        mistakes: [
          "Using profile or extreme angle images",
          "Low-resolution or blurry source images",
          "Audio that doesn't match the character's appearance",
          "Expecting perfect results with challenging poses",
        ],
        examplePrompts: [
          "Upload a professional headshot and pair with a scripted product introduction",
          "Generate an AI character portrait and add voiceover for a virtual assistant",
        ],
      },
    ],
  },
  {
    id: "tools",
    label: "AI Tools",
    icon: Wrench,
    iconColor: "text-emerald-400",
    description: "Powerful AI-powered utility tools for content creation",
    tutorials: [
      {
        id: "image-analysis",
        title: "Image Analysis (GPT-4o Vision)",
        description: "Analyze images and extract detailed information with AI",
        difficulty: "beginner",
        estimatedTime: "5 min",
        creditCost: "5-15 credits",
        icon: ScanEye,
        iconColor: "text-amber-400",
        route: "/analyze-image",
        steps: [
          "Navigate to Image Analysis from the Tools section",
          "Upload the image you want to analyze",
          "Optionally specify what aspects you want analyzed",
          "Click Analyze to process the image with GPT-4o Vision",
          "Review the detailed analysis and extracted information",
          "Use insights for content creation, description writing, or understanding",
        ],
        tips: [
          "Great for generating alt text and image descriptions",
          "Use for content moderation and image understanding",
          "Ask specific questions about image elements",
          "Helpful for reverse-engineering prompt ideas from images",
          "Can identify objects, text, emotions, and artistic styles",
        ],
        mistakes: [
          "Uploading very low-resolution images",
          "Expecting perfect text extraction from stylized fonts",
          "Not asking specific questions when needed",
        ],
        examplePrompts: [
          "What objects are in this image and where are they positioned?",
          "Describe the artistic style and color palette of this image",
          "What emotion or mood does this image convey?",
        ],
      },
      {
        id: "video-editor",
        title: "Video Editor & Combiner",
        description: "Combine multiple clips into one seamless video",
        difficulty: "intermediate",
        estimatedTime: "15 min",
        creditCost: "20-50 credits",
        icon: Film,
        iconColor: "text-blue-400",
        route: "/video-editor",
        steps: [
          "Navigate to Video Editor from the sidebar",
          "Add videos by uploading files or selecting from your library",
          "Drag and drop to arrange clips in your desired order",
          "Optionally trim clips or adjust timing",
          "Preview the combined sequence",
          "Click Combine to render the final video",
          "Download your seamless combined video",
        ],
        tips: [
          "Use consistent aspect ratios across all clips for best results",
          "The editor supports 2-20 clips per combination",
          "Perfect for creating montages, compilations, and longer narratives",
          "Server-side FFmpeg processing ensures professional results",
          "Great for combining AI-generated segments into cohesive stories",
        ],
        mistakes: [
          "Mixing different aspect ratios (causes letterboxing)",
          "Not previewing before final render",
          "Exceeding the 20 clip limit",
        ],
        examplePrompts: [
          "Combine 5 product showcase clips into a smooth 30-second advertisement",
          "Merge multiple AI-generated scenes into a narrative short film",
        ],
      },
      {
        id: "qr-generator",
        title: "QR Code Generator",
        description: "Create customized QR codes with logos and styling",
        difficulty: "beginner",
        estimatedTime: "5 min",
        creditCost: "5-10 credits",
        icon: QrCode,
        iconColor: "text-violet-400",
        route: "/qr-generator",
        steps: [
          "Navigate to QR Generator from the Tools section",
          "Enter the URL or text content for your QR code",
          "Customize colors for the pattern and background",
          "Optionally upload a logo to embed in the center",
          "Adjust size and error correction level",
          "Generate and preview your QR code",
          "Download in your preferred format",
        ],
        tips: [
          "Higher error correction allows for more aggressive customization",
          "Keep sufficient contrast between pattern and background",
          "Test your QR code with multiple devices before distributing",
          "Logo embedding works best with simple, centered designs",
          "SVG format provides perfect scaling for any size",
        ],
        mistakes: [
          "Low contrast making codes unscannable",
          "Oversized logos that obscure too much data",
          "Not testing the final QR code",
        ],
        examplePrompts: [
          "Create a purple and white QR code linking to artivio.ai with company logo centered",
        ],
      },
      {
        id: "image-upscaler",
        title: "Image Upscaler (Topaz)",
        description: "Enhance image resolution and quality with AI upscaling",
        difficulty: "beginner",
        estimatedTime: "3 min",
        creditCost: "10-25 credits",
        icon: Maximize,
        iconColor: "text-cyan-400",
        route: "/topaz-upscaler",
        steps: [
          "Navigate to Image Upscaler from the Tools section",
          "Upload the image you want to enhance",
          "Select the upscaling factor (2x, 4x, etc.)",
          "Choose optimization settings if available",
          "Click Upscale to process",
          "Compare before/after results",
          "Download your high-resolution image",
        ],
        tips: [
          "Works best with images that aren't heavily compressed",
          "Great for preparing images for large format printing",
          "Can rescue older or lower-resolution photos",
          "Process AI-generated images for higher resolution outputs",
          "Topaz AI preserves details while reducing artifacts",
        ],
        mistakes: [
          "Expecting miracles from extremely low-resolution sources",
          "Over-upscaling beyond practical use needs",
          "Not checking for artifacts in the upscaled result",
        ],
        examplePrompts: [
          "Upscale a 512x512 AI-generated image to 2048x2048 for print quality",
        ],
      },
      {
        id: "video-upscaler",
        title: "Video Upscaler (Topaz)",
        description: "Enhance video resolution and quality",
        difficulty: "intermediate",
        estimatedTime: "10 min",
        creditCost: "50-100 credits",
        icon: Maximize,
        iconColor: "text-blue-400",
        route: "/topaz-video-upscaler",
        steps: [
          "Navigate to Video Upscaler from the sidebar",
          "Upload the video you want to enhance",
          "Select target resolution (1080p, 4K, etc.)",
          "Choose enhancement presets if available",
          "Start the upscaling process (may take several minutes)",
          "Preview the enhanced result",
          "Download your high-resolution video",
        ],
        tips: [
          "Processing time depends on video length and target resolution",
          "Excellent for enhancing AI-generated videos for professional use",
          "Can improve older footage or compressed video sources",
          "Queue multiple videos for batch processing",
        ],
        mistakes: [
          "Uploading extremely long videos without considering processing time",
          "Expecting perfect results from heavily compressed sources",
        ],
        examplePrompts: [
          "Upscale a Veo-generated 720p video to crisp 4K resolution",
        ],
      },
      {
        id: "background-remover",
        title: "Background Remover",
        description: "Remove backgrounds from images with AI precision",
        difficulty: "beginner",
        estimatedTime: "3 min",
        creditCost: "5-15 credits",
        icon: Eraser,
        iconColor: "text-rose-400",
        route: "/background-remover",
        steps: [
          "Navigate to Background Remover from the Tools section",
          "Upload an image with a subject you want to isolate",
          "The AI automatically detects and removes the background",
          "Preview the result with transparent background",
          "Download as PNG (preserves transparency)",
          "Use in designs, compositions, or other projects",
        ],
        tips: [
          "Works best with clear subject separation from background",
          "PNG format preserves the transparent background",
          "Great for product photography, portraits, and objects",
          "Can handle complex edges like hair and fur",
          "Use results directly in design software",
        ],
        mistakes: [
          "Expecting perfect results with camouflaged subjects",
          "Saving as JPEG (loses transparency)",
          "Not checking edges carefully before use",
        ],
        examplePrompts: [
          "Remove background from product photo for e-commerce listing",
          "Isolate person from portrait for composite image creation",
        ],
      },
      {
        id: "ai-chat",
        title: "AI Chat Assistant",
        description: "Chat with advanced AI models for help and creativity",
        difficulty: "beginner",
        estimatedTime: "Ongoing",
        creditCost: "1-10 credits per message",
        icon: MessageSquare,
        iconColor: "text-emerald-400",
        route: "/chat",
        steps: [
          "Navigate to AI Chat from the Tools section",
          "Select your preferred AI model (GPT-4o, Deepseek, o1, etc.)",
          "Type your question or creative prompt",
          "Receive streaming responses in real-time",
          "Continue the conversation with follow-up questions",
          "Start new conversations as needed",
          "Chat history is automatically saved for reference",
        ],
        tips: [
          "GPT-4o offers excellent general-purpose responses",
          "Deepseek Reasoner is great for complex reasoning tasks",
          "o1 models excel at detailed analysis and planning",
          "Use chat to brainstorm prompts for image/video generation",
          "Ask for help refining your creative ideas",
          "Great for learning about AI content creation techniques",
        ],
        mistakes: [
          "Not providing enough context for complex questions",
          "Ignoring the model's strengths for different task types",
          "Very long single messages instead of conversational flow",
        ],
        examplePrompts: [
          "Help me write a prompt for generating a cinematic video of a space station",
          "What are some creative ways to use AI-generated music in my YouTube videos?",
          "Analyze this prompt and suggest improvements for better image generation results",
        ],
      },
    ],
  },
];

const gettingStartedSteps = [
  {
    title: "Create Your Account",
    description: "Sign up to receive your free starter credits and access all features",
    icon: UserCircle,
  },
  {
    title: "Explore the Dashboard",
    description: "Navigate the sidebar to discover all available AI tools and features",
    icon: Target,
  },
  {
    title: "Start with Simple Prompts",
    description: "Begin with clear, descriptive prompts and iterate based on results",
    icon: Lightbulb,
  },
  {
    title: "Check Credit Costs",
    description: "Review credit requirements before generating to manage your balance",
    icon: Coins,
  },
  {
    title: "Build Your Library",
    description: "All your generations are saved in My Library for easy access",
    icon: BookOpen,
  },
];

function TutorialCard({ tutorial }: { tutorial: Tutorial }) {
  const Icon = tutorial.icon;
  
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={tutorial.id} className="border rounded-lg mb-4 overflow-hidden">
        <AccordionTrigger className="px-4 py-4 hover:no-underline" data-testid={`tutorial-${tutorial.id}`}>
          <div className="flex items-start gap-4 w-full text-left">
            <div className={`p-2 rounded-lg bg-gradient-to-br from-primary/10 to-purple-500/10`}>
              <Icon className={`h-5 w-5 ${tutorial.iconColor}`} />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{tutorial.title}</h3>
                <Badge variant="outline" className={`text-xs ${difficultyColors[tutorial.difficulty]}`}>
                  {tutorial.difficulty}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{tutorial.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {tutorial.estimatedTime}
                </span>
                <span className="flex items-center gap-1">
                  <Coins className="h-3 w-3" />
                  {tutorial.creditCost}
                </span>
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-6 pt-2">
            {/* Steps */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <Play className="h-4 w-4 text-blue-400" />
                Step-by-Step Instructions
              </h4>
              <ol className="space-y-2 ml-6">
                {tutorial.steps.map((step, index) => (
                  <li key={index} className="text-sm text-muted-foreground list-decimal">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {/* Tips */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                Pro Tips
              </h4>
              <ul className="space-y-2 ml-6">
                {tutorial.tips.map((tip, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-400 mt-1 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Mistakes */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                Common Mistakes to Avoid
              </h4>
              <ul className="space-y-2 ml-6">
                {tutorial.mistakes.map((mistake, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-red-400 flex-shrink-0">-</span>
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Example Prompts */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-purple-400" />
                Example Prompts
              </h4>
              <div className="space-y-2">
                {tutorial.examplePrompts.map((prompt, index) => (
                  <div 
                    key={index} 
                    className="text-sm bg-muted/50 rounded-lg p-3 border border-muted-foreground/10"
                  >
                    <code className="text-muted-foreground">{prompt}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            {tutorial.route && (
              <div className="pt-2">
                <Link href={tutorial.route}>
                  <Button className="gap-2" data-testid={`button-try-${tutorial.id}`}>
                    Try This Feature
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export default function Tutorials() {
  const [selectedCategory, setSelectedCategory] = useState("video");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4" data-testid="tutorials-hero">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Tutorials & Learning Center
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Master AI content creation with step-by-step guides, pro tips, and example prompts for every feature
          </p>
        </div>

        {/* Getting Started */}
        <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20" data-testid="getting-started">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Getting Started
            </CardTitle>
            <CardDescription>
              New to Artivio AI? Follow these steps to begin your creative journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {gettingStartedSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div 
                    key={index} 
                    className="flex flex-col items-center text-center space-y-2 p-4"
                    data-testid={`getting-started-step-${index}`}
                  >
                    <div className="relative">
                      <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <h3 className="font-medium text-sm">{step.title}</h3>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-transparent p-0">
            {tutorialCategories.map((category) => {
              const Icon = category.icon;
              return (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-primary/10 data-[state=active]:border-primary/30 border rounded-lg"
                  data-testid={`tab-${category.id}`}
                >
                  <Icon className={`h-4 w-4 ${category.iconColor}`} />
                  <span className="hidden sm:inline">{category.label}</span>
                  <span className="sm:hidden">{category.label.split(' ')[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tutorialCategories.map((category) => {
            const CategoryIcon = category.icon;
            return (
              <TabsContent key={category.id} value={category.id} className="space-y-6">
                {/* Category Header */}
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className={`p-3 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10`}>
                      <CategoryIcon className={`h-6 w-6 ${category.iconColor}`} />
                    </div>
                    <div>
                      <CardTitle>{category.label}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>

                {/* Tutorials List */}
                <div data-testid={`tutorials-list-${category.id}`}>
                  {category.tutorials.map((tutorial) => (
                    <TutorialCard key={tutorial.id} tutorial={tutorial} />
                  ))}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Credit Cost Reference */}
        <Card data-testid="credit-reference">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-yellow-400" />
              Credit Cost Reference
            </CardTitle>
            <CardDescription>
              Typical credit costs for each feature category
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-sm">Video Generation</span>
                </div>
                <p className="text-2xl font-bold">50-500</p>
                <p className="text-xs text-muted-foreground">credits per video</p>
              </div>
              <div className="p-4 rounded-lg border bg-pink-500/5 border-pink-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4 text-pink-400" />
                  <span className="font-medium text-sm">Image Generation</span>
                </div>
                <p className="text-2xl font-bold">10-50</p>
                <p className="text-xs text-muted-foreground">credits per image</p>
              </div>
              <div className="p-4 rounded-lg border bg-purple-500/5 border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Music className="h-4 w-4 text-purple-400" />
                  <span className="font-medium text-sm">Audio & Music</span>
                </div>
                <p className="text-2xl font-bold">10-200</p>
                <p className="text-xs text-muted-foreground">credits per generation</p>
              </div>
              <div className="p-4 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="h-4 w-4 text-emerald-400" />
                  <span className="font-medium text-sm">AI Tools</span>
                </div>
                <p className="text-2xl font-bold">5-100</p>
                <p className="text-xs text-muted-foreground">credits per use</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Still Need Help */}
        <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold">Still have questions?</h3>
              <p className="text-muted-foreground">
                Visit our Support Center for FAQs or contact our team for personalized help
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/support">
                  <Button variant="outline" className="gap-2" data-testid="button-support">
                    Visit Support Center
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button className="gap-2" data-testid="button-start-creating">
                    Start Creating
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
