import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Music, AudioLines, ArrowRight, Mic, Layers } from "lucide-react";

export default function AudioConverter() {
  const [, setLocation] = useLocation();

  return (
    <SidebarInset>
      <div className="h-full overflow-y-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="space-y-2 mb-8">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <AudioLines className="h-10 w-10 text-primary" />
              Audio Processing
            </h1>
            <p className="text-lg text-muted-foreground">
              Audio processing features are now integrated into Music Studio
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5 text-primary" />
                Audio Processing Moved to Music Studio
              </CardTitle>
              <CardDescription>
                WAV conversion, vocal removal, and stem separation are now available 
                directly in the Music Studio for your Suno-generated tracks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AudioLines className="h-4 w-4 text-primary" />
                    WAV Conversion
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Convert your Suno tracks to high-quality WAV format
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Mic className="h-4 w-4 text-primary" />
                    Vocal Removal
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Separate vocals from instrumental tracks
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Layers className="h-4 w-4 text-primary" />
                    Stem Separation
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Split into drums, bass, vocals, and more
                  </p>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={() => setLocation("/generate-music?tab=process")}
                  size="lg"
                  className="w-full md:w-auto"
                  data-testid="button-go-to-music-studio"
                >
                  Go to Music Studio
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Note: These features work with music generated through Suno. 
                Generate music first, then process it with these tools.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarInset>
  );
}
