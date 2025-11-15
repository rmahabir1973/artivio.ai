import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Video,
  Image as ImageIcon,
  Music,
  Sparkles,
  TrendingUp,
  Users,
  Heart,
  Briefcase,
  GraduationCap,
  ShoppingCart,
  Instagram,
  Film,
  Mic,
  Globe,
  Crown
} from "lucide-react";
import { Link } from "wouter";

export default function Workflows() {
  // Helper function to determine the route based on workflow features
  const getWorkflowRoute = (features: string[]): string => {
    if (features.includes("Video Generation")) return "/generate/video";
    if (features.includes("Image Generation")) return "/generate/image";
    if (features.includes("Music Generation")) return "/generate/music";
    if (features.includes("AI Chat")) return "/chat";
    return "/";
  };

  const workflows = [
    {
      id: 1,
      title: "One-Click Ad Generation",
      description: "Upload a product image and brand assets, then generate professional video advertisements in seconds using Veo 3.1. Perfect for social media marketing and e-commerce.",
      icon: ShoppingCart,
      category: "Marketing",
      steps: [
        "Upload product image",
        "Add brand logo or celebrity image",
        "Generate video with Veo 3.1",
        "Download HD advertisement"
      ],
      features: ["Video Generation", "Image Upload"],
      difficulty: "Beginner",
      estimatedTime: "5 minutes",
      credits: 150
    },
    {
      id: 2,
      title: "Social Media Content Factory",
      description: "Create a complete social media content package: generate images with Flux, add music with Suno, and combine into shareable video posts.",
      icon: Instagram,
      category: "Social Media",
      steps: [
        "Generate branded images with Flux",
        "Create background music with Suno",
        "Generate promotional video with Sora 2",
        "Combine assets with Video Editor"
      ],
      features: ["Image Generation", "Music Generation", "Video Generation"],
      difficulty: "Intermediate",
      estimatedTime: "15 minutes",
      credits: 400
    },
    {
      id: 3,
      title: "Product Demo Video Creator",
      description: "Transform product images into engaging demo videos with talking avatar narration and background music. Ideal for e-commerce and product launches.",
      icon: Video,
      category: "E-commerce",
      steps: [
        "Upload product images",
        "Create video from images with Veo",
        "Generate voiceover script with AI Chat",
        "Add talking avatar presenter",
        "Mix with background music"
      ],
      features: ["Video Generation", "Talking Avatars", "Music Generation", "AI Chat"],
      difficulty: "Advanced",
      estimatedTime: "25 minutes",
      credits: 600
    },
    {
      id: 4,
      title: "Music Video Production",
      description: "Compose original music with Suno, generate matching visuals with Sora 2, and create a complete music video with synchronized audio.",
      icon: Film,
      category: "Entertainment",
      steps: [
        "Generate original song with Suno V5",
        "Create visual scenes with Sora 2 Pro",
        "Combine clips with Video Editor",
        "Export with native synchronized audio"
      ],
      features: ["Music Generation", "Video Generation", "Video Editor"],
      difficulty: "Intermediate",
      estimatedTime: "30 minutes",
      credits: 800
    },
    {
      id: 5,
      title: "Educational Course Content",
      description: "Create professional educational videos with AI-generated visuals, voice cloning for consistent narration, and background music.",
      icon: GraduationCap,
      category: "Education",
      steps: [
        "Write script with AI Chat",
        "Clone your voice for narration",
        "Generate educational visuals with Veo",
        "Add subtle background music",
        "Combine into lecture series"
      ],
      features: ["AI Chat", "Voice Cloning", "Video Generation", "Music Generation"],
      difficulty: "Advanced",
      estimatedTime: "40 minutes",
      credits: 700
    },
    {
      id: 6,
      title: "Podcast to Video Converter",
      description: "Transform audio podcasts into engaging video content with generated visuals, subtitles, and talking avatar hosts.",
      icon: Mic,
      category: "Content Creation",
      steps: [
        "Upload podcast audio",
        "Generate visual scenes with Runway",
        "Create talking avatar for host segments",
        "Combine audio and video",
        "Export for YouTube or social platforms"
      ],
      features: ["Audio Converter", "Video Generation", "Talking Avatars"],
      difficulty: "Intermediate",
      estimatedTime: "20 minutes",
      credits: 500
    },
    {
      id: 7,
      title: "Brand Story Video",
      description: "Tell your brand's story with AI-generated cinematic videos, custom music, and professional narration. Perfect for company websites and presentations.",
      icon: Briefcase,
      category: "Business",
      steps: [
        "Write brand narrative with AI Chat",
        "Generate cinematic scenes with Sora 2 Pro",
        "Compose brand anthem with Suno",
        "Add professional voice with TTS",
        "Combine into cohesive story"
      ],
      features: ["AI Chat", "Video Generation", "Music Generation", "Text to Speech"],
      difficulty: "Advanced",
      estimatedTime: "50 minutes",
      credits: 1000
    },
    {
      id: 8,
      title: "Viral Meme Generator",
      description: "Create trending meme content with image generation, video effects, and catchy music for maximum engagement.",
      icon: TrendingUp,
      category: "Social Media",
      steps: [
        "Generate meme template with 4o Image",
        "Add motion with Veo 3.1 Fast",
        "Create funny audio with Suno",
        "Export for TikTok/Instagram"
      ],
      features: ["Image Generation", "Video Generation", "Music Generation"],
      difficulty: "Beginner",
      estimatedTime: "10 minutes",
      credits: 250
    },
    {
      id: 9,
      title: "Real Estate Virtual Tour",
      description: "Create immersive property tour videos with AI-generated walkthroughs, professional narration, and ambient music.",
      icon: Globe,
      category: "Real Estate",
      steps: [
        "Upload property images",
        "Generate smooth transitions with Veo",
        "Clone agent's voice for narration",
        "Add ambient background music",
        "Combine into virtual tour"
      ],
      features: ["Video Generation", "Voice Cloning", "Music Generation"],
      difficulty: "Intermediate",
      estimatedTime: "30 minutes",
      credits: 650
    },
    {
      id: 10,
      title: "Influencer Collaboration Package",
      description: "Create complete influencer campaign assets including branded videos, custom music, and promotional images.",
      icon: Users,
      category: "Marketing",
      steps: [
        "Generate branded visuals with Flux Kontext",
        "Create campaign video with Runway",
        "Compose signature jingle with Suno",
        "Analyze results with AI Chat insights"
      ],
      features: ["Image Generation", "Video Generation", "Music Generation", "AI Chat"],
      difficulty: "Intermediate",
      estimatedTime: "35 minutes",
      credits: 750
    },
    {
      id: 11,
      title: "Event Highlight Reel",
      description: "Transform event photos into dynamic highlight videos with music and effects. Perfect for weddings, conferences, and celebrations.",
      icon: Heart,
      category: "Events",
      steps: [
        "Upload event images",
        "Generate transitions with Veo",
        "Create emotional soundtrack with Suno",
        "Combine clips with Video Editor",
        "Export in HD quality"
      ],
      features: ["Video Generation", "Music Generation", "Video Editor"],
      difficulty: "Beginner",
      estimatedTime: "15 minutes",
      credits: 400
    },
    {
      id: 12,
      title: "AI News Anchor",
      description: "Create professional news segments with talking avatar anchors, generated B-roll footage, and news music beds.",
      icon: Crown,
      category: "Media",
      steps: [
        "Write news script with AI Chat",
        "Generate talking avatar anchor",
        "Create B-roll footage with Sora 2",
        "Add news music bed with Suno",
        "Combine into broadcast package"
      ],
      features: ["AI Chat", "Talking Avatars", "Video Generation", "Music Generation"],
      difficulty: "Advanced",
      estimatedTime: "45 minutes",
      credits: 900
    },
    {
      id: 13,
      title: "Cover Song Video Creator",
      description: "Create cover song videos by uploading audio, generating music video visuals, and adding artistic effects.",
      icon: Music,
      category: "Entertainment",
      steps: [
        "Upload song or use Music Studio Cover feature",
        "Generate artistic visuals with Runway",
        "Create synchronized video scenes",
        "Export with high-quality audio"
      ],
      features: ["Music Generation", "Video Generation"],
      difficulty: "Intermediate",
      estimatedTime: "20 minutes",
      credits: 500
    },
    {
      id: 14,
      title: "Meditation & Wellness Content",
      description: "Produce calming meditation videos with AI-generated nature scenes, soothing voice guidance, and ambient soundscapes.",
      icon: Sparkles,
      category: "Wellness",
      steps: [
        "Generate peaceful nature scenes with Veo",
        "Create ambient music with Suno",
        "Add guided meditation voiceover with TTS",
        "Combine into relaxation videos"
      ],
      features: ["Video Generation", "Music Generation", "Text to Speech"],
      difficulty: "Beginner",
      estimatedTime: "25 minutes",
      credits: 450
    },
    {
      id: 15,
      title: "Product Comparison Video",
      description: "Create side-by-side product comparison videos with AI-generated visualizations, narration, and professional presentation.",
      icon: Zap,
      category: "E-commerce",
      steps: [
        "Generate product visuals with 4o Image",
        "Create comparison animations with Veo",
        "Write comparison script with AI Chat",
        "Add professional narration with Voice Clone",
        "Combine into persuasive video"
      ],
      features: ["Image Generation", "Video Generation", "AI Chat", "Voice Cloning"],
      difficulty: "Advanced",
      estimatedTime: "35 minutes",
      credits: 700
    }
  ];

  const categories = Array.from(new Set(workflows.map(w => w.category)));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Workflow Automation</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Pre-Built Workflows
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Chain AI features together to automate complex creative tasks. Choose from 15 proven workflows
            that combine video, image, music generation, and more.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <Badge
              key={category}
              variant="outline"
              className="cursor-pointer hover-elevate"
              data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {category}
            </Badge>
          ))}
        </div>

        {/* Workflows Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <Card key={workflow.id} className="hover-elevate flex flex-col">
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {workflow.category}
                    </Badge>
                  </div>
                  <div>
                    <CardTitle className="text-lg mb-2">{workflow.title}</CardTitle>
                    <CardDescription className="text-sm line-clamp-2">
                      {workflow.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col gap-4">
                  {/* Workflow Steps */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">WORKFLOW STEPS</p>
                    <ol className="space-y-1.5 text-sm">
                      {workflow.steps.slice(0, 3).map((step, idx) => (
                        <li key={idx} className="flex gap-2 text-muted-foreground">
                          <span className="text-primary font-medium">{idx + 1}.</span>
                          <span className="line-clamp-1">{step}</span>
                        </li>
                      ))}
                      {workflow.steps.length > 3 && (
                        <li className="text-xs text-muted-foreground/70">
                          + {workflow.steps.length - 3} more steps
                        </li>
                      )}
                    </ol>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Difficulty</p>
                      <Badge 
                        variant={workflow.difficulty === "Beginner" ? "default" : workflow.difficulty === "Intermediate" ? "secondary" : "outline"} 
                        className="mt-1"
                      >
                        {workflow.difficulty}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Est. Time</p>
                      <p className="font-medium mt-1">{workflow.estimatedTime}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Estimated Credits</p>
                      <p className="font-medium mt-1 text-primary">{workflow.credits} credits</p>
                    </div>
                  </div>

                  {/* Features Used */}
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t">
                    {workflow.features.slice(0, 2).map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {workflow.features.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{workflow.features.length - 2}
                      </Badge>
                    )}
                  </div>

                  {/* Action */}
                  <Link href={getWorkflowRoute(workflow.features)}>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2 gap-2"
                      data-testid={`workflow-start-${workflow.id}`}
                    >
                      <Zap className="h-4 w-4" />
                      Start Workflow
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Sparkles className="h-12 w-12 mx-auto text-primary" />
              <h3 className="text-2xl font-bold">Create Your Own Workflow</h3>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                These workflows are just the beginning. Combine any of our features to create your own
                custom automation pipelines. The possibilities are endless!
              </p>
              <Link href="/">
                <Button data-testid="button-explore-features">
                  Explore All Features
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
