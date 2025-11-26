import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fetchWithAuth } from "@/lib/queryClient";
import { Loader2, Video, ArrowLeft, AlertCircle, Upload, Image, Music, Film, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SidebarInset } from "@/components/ui/sidebar";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreativeEditor from '@cesdk/cesdk-js/react';
import { GuestGenerateModal } from "@/components/guest-generate-modal";

interface Generation {
  id: string;
  type: string;
  status: string;
  model: string;
  prompt: string;
  resultUrl: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function VideoEditor() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [license, setLicense] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [isLoadingLicense, setIsLoadingLicense] = useState(true);
  const [cesdkInstance, setCesdkInstance] = useState<any>(null);
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [assetType, setAssetType] = useState<'video' | 'image' | 'music'>('video');
  const [allGenerations, setAllGenerations] = useState<Generation[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  
  // Track component mount state to prevent operations on unmounted component
  const isMountedRef = useRef(true);
  const initializationIdRef = useRef(0);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const { data: firstPageData = { data: [] }, isLoading: loadingGenerations } = useQuery<any>({
    queryKey: ['/api/generations'],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    const fetchAllGenerations = async () => {
      setIsLoadingAssets(true);
      try {
        let allGens: Generation[] = [];
        let cursor: string | undefined = undefined;
        let hasMore = true;

        while (hasMore) {
          const url = cursor ? `/api/generations?cursor=${cursor}` : '/api/generations';
          const res = await fetchWithAuth(url, { method: 'GET' });
          
          if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status}`);
          }
          
          const response: any = await res.json();
          const pageData = Array.isArray(response) ? response : (response.data || []);
          const pageItems = Array.isArray(pageData) ? pageData : [];
          
          allGens = [...allGens, ...pageItems];
          cursor = response.nextCursor;
          hasMore = !!cursor;
        }

        setAllGenerations(allGens);
      } catch (error) {
        console.error('[VIDEO EDITOR] Failed to load generations:', error);
        const pageData = Array.isArray(firstPageData) ? firstPageData : (firstPageData?.data || []);
        setAllGenerations(Array.isArray(pageData) ? pageData : []);
      } finally {
        setIsLoadingAssets(false);
      }
    };

    if (!loadingGenerations && isAuthenticated) {
      fetchAllGenerations();
    }
  }, [loadingGenerations, firstPageData, isAuthenticated]);

  useEffect(() => {
    const fetchLicense = async () => {
      try {
        const res = await fetchWithAuth('/api/imgly/license', { method: 'GET' });
        
        if (!res.ok) {
          throw new Error('Failed to fetch license');
        }
        
        const data = await res.json();
        setLicense(data.license);
        setLicenseError(null);
      } catch (error) {
        console.error('[VIDEO EDITOR] Failed to load license:', error);
        setLicenseError('Unable to load the video editor. Please try again later.');
      } finally {
        setIsLoadingLicense(false);
      }
    };

    if (isAuthenticated) {
      fetchLicense();
    }
  }, [isAuthenticated]);

  const availableVideos = allGenerations.filter(
    g => g.type === 'video' && g.status === 'completed' && g.resultUrl
  );

  const availableImages = allGenerations.filter(
    g => g.type === 'image' && g.status === 'completed' && g.resultUrl
  );

  const availableMusic = allGenerations.filter(
    g => g.type === 'music' && g.status === 'completed' && g.resultUrl
  );

  const addAssetToEditor = async (url: string, type: 'video' | 'image' | 'audio') => {
    if (!isAuthenticated) {
      setShowGuestModal(true);
      return;
    }

    if (!cesdkInstance) {
      toast({
        title: "Editor not ready",
        description: "Please wait for the editor to fully load.",
        variant: "destructive",
      });
      return;
    }

    try {
      const engine = cesdkInstance.engine;
      const page = engine.scene.getCurrentPage();
      
      if (!page) {
        toast({
          title: "No page found",
          description: "Please create a scene first.",
          variant: "destructive",
        });
        return;
      }

      if (type === 'video') {
        const videoBlock = engine.block.create('video');
        engine.block.setString(videoBlock, 'video/uri', url);
        engine.block.appendChild(page, videoBlock);
        
        const pageWidth = engine.block.getWidth(page);
        const pageHeight = engine.block.getHeight(page);
        engine.block.setWidth(videoBlock, pageWidth);
        engine.block.setHeight(videoBlock, pageHeight);
        engine.block.setPositionX(videoBlock, 0);
        engine.block.setPositionY(videoBlock, 0);
      } else if (type === 'image') {
        const imageBlock = engine.block.create('image');
        engine.block.setString(imageBlock, 'image/uri', url);
        engine.block.appendChild(page, imageBlock);
        
        const pageWidth = engine.block.getWidth(page);
        const pageHeight = engine.block.getHeight(page);
        engine.block.setWidth(imageBlock, pageWidth);
        engine.block.setHeight(imageBlock, pageHeight);
        engine.block.setPositionX(imageBlock, 0);
        engine.block.setPositionY(imageBlock, 0);
      } else if (type === 'audio') {
        const audioBlock = engine.block.create('audio');
        engine.block.setString(audioBlock, 'audio/uri', url);
        engine.block.appendChild(page, audioBlock);
      }

      setShowAssetBrowser(false);
      toast({
        title: "Asset added",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} has been added to your project.`,
      });
    } catch (error) {
      console.error('[VIDEO EDITOR] Failed to add asset:', error);
      toast({
        title: "Failed to add asset",
        description: "There was an error adding the asset to your project.",
        variant: "destructive",
      });
    }
  };

  const config = {
    role: 'Adopter' as const,
    theme: 'dark' as const,
    license: license || '',
    ui: {
      elements: {
        view: 'default' as const,
        panels: {
          settings: true
        },
        navigation: {
          position: 'top' as const,
          action: {
            export: true,
            download: true,
            close: false
          }
        }
      }
    },
    callbacks: {
      onUpload: 'local' as const,
      onDownload: 'download' as const,
      onExport: 'download' as const
    }
  };

  const initEditor = useCallback(async (instance: any) => {
    // Increment initialization ID to track this specific initialization attempt
    const currentInitId = ++initializationIdRef.current;
    
    // Helper to check if this initialization is still valid
    const isStillValid = () => {
      return isMountedRef.current && currentInitId === initializationIdRef.current;
    };
    
    try {
      // Small delay to let React StrictMode complete its double-render cycle
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!isStillValid()) {
        console.log('[VIDEO EDITOR] Initialization cancelled - component unmounted or superseded');
        return;
      }
      
      // Check if the instance is still valid (not disposed)
      try {
        // Try to access a simple property to check if instance is valid
        if (!instance || !instance.engine) {
          throw new Error('Instance or engine is null');
        }
      } catch (e) {
        console.log('[VIDEO EDITOR] Instance no longer valid, skipping initialization');
        return;
      }
      
      setCesdkInstance(instance);
      
      // Create video scene first - this is the most basic operation
      if (!isStillValid()) return;
      await instance.createVideoScene();
      
      if (!isStillValid()) return;
      
      // Set page title setting
      try {
        instance.engine.editor.setSetting('page/title/show', false);
      } catch (e) {
        console.log('[VIDEO EDITOR] Could not set page title setting:', e);
      }
      
      if (!isStillValid()) return;
      setEditorReady(true);
      console.log('[VIDEO EDITOR] CreativeEditor SDK initialized successfully');
    } catch (error: any) {
      // Only show error if component is still mounted and this is the current initialization
      if (isStillValid()) {
        console.error('[VIDEO EDITOR] Failed to initialize editor:', error);
        
        // Check if it's a "deleted object" error - this means cleanup happened, not a real error
        if (error?.message?.includes('deleted object')) {
          console.log('[VIDEO EDITOR] Ignoring cleanup-related error');
          return;
        }
        
        setEditorError('There was an error setting up the video editor. Please refresh the page.');
        toast({
          title: "Editor initialization failed",
          description: "There was an error setting up the video editor.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  if (isLoadingLicense) {
    return (
      <SidebarInset>
        <div className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading video editor...</p>
          </div>
        </div>
      </SidebarInset>
    );
  }

  if (licenseError || !license || editorError) {
    return (
      <SidebarInset>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-semibold mb-2">Video Editor Unavailable</h2>
              <p className="text-muted-foreground mb-4">
                {editorError || licenseError || "The video editor is temporarily unavailable. Please try again later."}
              </p>
              <Button onClick={() => window.location.reload()} data-testid="button-retry">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-background shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-heading">Video Editor</h1>
              <p className="text-sm text-muted-foreground">Professional video editing powered by IMG.LY</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssetType('video');
                setShowAssetBrowser(true);
              }}
              data-testid="button-add-video"
            >
              <Film className="w-4 h-4 mr-2" />
              Add Video
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssetType('image');
                setShowAssetBrowser(true);
              }}
              data-testid="button-add-image"
            >
              <Image className="w-4 h-4 mr-2" />
              Add Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAssetType('music');
                setShowAssetBrowser(true);
              }}
              data-testid="button-add-music"
            >
              <Music className="w-4 h-4 mr-2" />
              Add Music
            </Button>
          </div>
        </div>

        <div className="flex-1 relative" style={{ minHeight: '700px' }}>
          <CreativeEditor
            key={`editor-${license}`}
            config={config}
            init={initEditor}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>

      <Dialog open={showAssetBrowser} onOpenChange={setShowAssetBrowser}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Add from My Library</DialogTitle>
            <DialogDescription>
              Select content from your AI generations to add to your project
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={assetType} onValueChange={(v) => setAssetType(v as 'video' | 'image' | 'music')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="video" data-testid="tab-videos">
                <Film className="w-4 h-4 mr-2" />
                Videos ({availableVideos.length})
              </TabsTrigger>
              <TabsTrigger value="image" data-testid="tab-images">
                <Image className="w-4 h-4 mr-2" />
                Images ({availableImages.length})
              </TabsTrigger>
              <TabsTrigger value="music" data-testid="tab-music">
                <Music className="w-4 h-4 mr-2" />
                Music ({availableMusic.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="video">
              <ScrollArea className="h-[400px]">
                {isLoadingAssets ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : availableVideos.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No videos available</p>
                    <p className="text-sm mt-2">Generate some videos first!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2">
                    {availableVideos.map((video) => (
                      <Card
                        key={video.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => video.resultUrl && addAssetToEditor(video.resultUrl, 'video')}
                        data-testid={`card-video-${video.id}`}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="aspect-video bg-muted rounded-md overflow-hidden">
                            {video.resultUrl && (
                              <video
                                src={video.resultUrl}
                                className="w-full h-full object-cover"
                                controls={false}
                                muted
                              />
                            )}
                          </div>
                          <div>
                            <Badge variant="secondary" className="text-xs">{video.model}</Badge>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.prompt}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="image">
              <ScrollArea className="h-[400px]">
                {isLoadingAssets ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : availableImages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No images available</p>
                    <p className="text-sm mt-2">Generate some images first!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2">
                    {availableImages.map((image) => (
                      <Card
                        key={image.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => image.resultUrl && addAssetToEditor(image.resultUrl, 'image')}
                        data-testid={`card-image-${image.id}`}
                      >
                        <CardContent className="p-2">
                          <div className="aspect-square bg-muted rounded-md overflow-hidden">
                            {image.resultUrl && (
                              <img
                                src={image.resultUrl}
                                alt={image.prompt}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{image.prompt}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="music">
              <ScrollArea className="h-[400px]">
                {isLoadingAssets ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : availableMusic.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No music available</p>
                    <p className="text-sm mt-2">Generate some music first!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 p-2">
                    {availableMusic.map((track) => (
                      <Card
                        key={track.id}
                        className="cursor-pointer hover-elevate"
                        onClick={() => track.resultUrl && addAssetToEditor(track.resultUrl, 'audio')}
                        data-testid={`card-music-${track.id}`}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center shrink-0">
                            <Music className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Badge variant="secondary" className="text-xs">{track.model}</Badge>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{track.prompt}</p>
                          </div>
                          {track.resultUrl && (
                            <audio
                              src={track.resultUrl}
                              controls
                              className="w-40 h-8"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <GuestGenerateModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        featureName="Video Editor"
      />
    </SidebarInset>
  );
}
