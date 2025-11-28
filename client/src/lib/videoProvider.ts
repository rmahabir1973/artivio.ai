/**
 * Video Provider Utility
 * Supports Vimeo and PeerTube video embeds with normalized URL handling
 */

export type VideoProvider = 'vimeo' | 'peertube' | 'unknown';

export interface VideoInfo {
  provider: VideoProvider;
  embedUrl: string;
  originalUrl: string;
}

export interface NormalizationResult {
  success: boolean;
  info?: VideoInfo;
  error?: string;
}

/**
 * Detect video provider from URL
 */
export function detectProvider(url: string): VideoProvider {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('vimeo.com')) {
    return 'vimeo';
  }
  
  // PeerTube detection - check for common PeerTube patterns
  // PeerTube URLs typically have /videos/watch/ or /w/ paths
  if (lowerUrl.includes('/videos/watch/') || 
      lowerUrl.includes('/w/') ||
      lowerUrl.includes('/videos/embed/')) {
    return 'peertube';
  }
  
  return 'unknown';
}

/**
 * Normalize Vimeo URL to player embed format
 */
function normalizeVimeoUrl(input: string): NormalizationResult {
  try {
    let videoUrl = input.trim();
    if (!videoUrl) {
      return { success: false, error: 'Empty URL' };
    }

    // Handle protocol-relative URLs
    if (videoUrl.startsWith('//')) {
      videoUrl = `https:${videoUrl}`;
    } else if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      videoUrl = `https://${videoUrl}`;
    }

    const parsedUrl = new URL(videoUrl);
    
    if (!parsedUrl.hostname.includes('vimeo.com')) {
      return { success: false, error: 'Not a Vimeo URL' };
    }

    let finalUrl: URL;
    
    if (parsedUrl.hostname === 'player.vimeo.com') {
      finalUrl = parsedUrl;
    } else {
      let videoId: string | null = null;
      const path = parsedUrl.pathname;
      
      const videoPattern = path.match(/\/video\/(\d+)/);
      if (videoPattern) {
        videoId = videoPattern[1];
      } else if (path.match(/\/videos\/(\d+)/)) {
        const videosPattern = path.match(/\/videos\/(\d+)/);
        videoId = videosPattern![1];
      } else if (path.match(/^\/\d+$/)) {
        videoId = path.slice(1);
      } else {
        const allNumbers = path.match(/\d+/g);
        if (allNumbers && allNumbers.length > 0) {
          videoId = allNumbers[allNumbers.length - 1];
        }
      }
      
      if (!videoId) {
        return { success: false, error: 'Could not extract video ID from Vimeo URL' };
      }

      finalUrl = new URL(`https://player.vimeo.com/video/${videoId}`);
      parsedUrl.searchParams.forEach((value, key) => {
        finalUrl.searchParams.set(key, value);
      });
    }

    // Add autoplay parameters for background video
    finalUrl.searchParams.set('background', '1');
    finalUrl.searchParams.set('autoplay', '1');
    finalUrl.searchParams.set('loop', '1');
    finalUrl.searchParams.set('autopause', '0');
    finalUrl.searchParams.set('muted', '1');

    return { 
      success: true, 
      info: {
        provider: 'vimeo',
        embedUrl: finalUrl.toString(),
        originalUrl: input
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Normalize PeerTube URL to embed format
 * PeerTube URLs:
 * - https://instance.tld/videos/watch/uuid
 * - https://instance.tld/w/uuid
 * - https://instance.tld/videos/embed/uuid
 */
function normalizePeerTubeUrl(input: string): NormalizationResult {
  try {
    let videoUrl = input.trim();
    if (!videoUrl) {
      return { success: false, error: 'Empty URL' };
    }

    // Handle protocol-relative URLs
    if (videoUrl.startsWith('//')) {
      videoUrl = `https:${videoUrl}`;
    } else if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      videoUrl = `https://${videoUrl}`;
    }

    const parsedUrl = new URL(videoUrl);
    const path = parsedUrl.pathname;
    
    let videoId: string | null = null;
    
    // Pattern 1: /videos/watch/{uuid} or /videos/watch/{shortId}
    const watchPattern = path.match(/\/videos\/watch\/([a-zA-Z0-9-]+)/);
    if (watchPattern) {
      videoId = watchPattern[1];
    }
    
    // Pattern 2: /w/{uuid} (short URL)
    const shortPattern = path.match(/\/w\/([a-zA-Z0-9-]+)/);
    if (!videoId && shortPattern) {
      videoId = shortPattern[1];
    }
    
    // Pattern 3: /videos/embed/{uuid} (already embed URL)
    const embedPattern = path.match(/\/videos\/embed\/([a-zA-Z0-9-]+)/);
    if (!videoId && embedPattern) {
      videoId = embedPattern[1];
    }
    
    if (!videoId) {
      return { success: false, error: 'Could not extract video ID from PeerTube URL' };
    }

    // Construct embed URL
    const embedUrl = new URL(`https://${parsedUrl.hostname}/videos/embed/${videoId}`);
    
    // Copy over existing query parameters
    parsedUrl.searchParams.forEach((value, key) => {
      embedUrl.searchParams.set(key, value);
    });
    
    // Add autoplay and loop parameters for background video
    embedUrl.searchParams.set('autoplay', '1');
    embedUrl.searchParams.set('loop', '1');
    embedUrl.searchParams.set('muted', '1');
    embedUrl.searchParams.set('controls', '0');
    embedUrl.searchParams.set('peertubeLink', '0');

    return { 
      success: true, 
      info: {
        provider: 'peertube',
        embedUrl: embedUrl.toString(),
        originalUrl: input
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Normalize any video URL to embed format based on detected provider
 */
export function normalizeVideoUrl(input: string, forceProvider?: VideoProvider): NormalizationResult {
  if (!input || !input.trim()) {
    return { success: false, error: 'Empty URL' };
  }

  const provider = forceProvider || detectProvider(input);
  
  switch (provider) {
    case 'vimeo':
      return normalizeVimeoUrl(input);
    case 'peertube':
      return normalizePeerTubeUrl(input);
    default:
      return { success: false, error: 'Unknown video provider. Supported: Vimeo, PeerTube' };
  }
}

/**
 * Get embed URL without autoplay (for modal/user-triggered playback)
 */
export function getPlaybackEmbedUrl(input: string, forceProvider?: VideoProvider): string | null {
  const result = normalizeVideoUrl(input, forceProvider);
  if (!result.success || !result.info) return null;
  
  const url = new URL(result.info.embedUrl);
  
  if (result.info.provider === 'vimeo') {
    url.searchParams.delete('background');
    url.searchParams.set('autoplay', '0');
  } else if (result.info.provider === 'peertube') {
    url.searchParams.set('autoplay', '0');
    url.searchParams.set('controls', '1');
    url.searchParams.set('muted', '0');
  }
  
  return url.toString();
}

/**
 * Check if a URL is a valid video URL
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const provider = detectProvider(url);
  return provider !== 'unknown';
}
