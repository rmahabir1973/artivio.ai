/**
 * Vimeo URL normalization utility
 * Handles all common Vimeo URL formats and preserves query parameters
 */

export interface VimeoNormalizationResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Normalize any Vimeo URL to player.vimeo.com format with autoplay parameters
 * Preserves existing query parameters (like ?h= tokens for private videos)
 * 
 * Supported formats:
 * - https://vimeo.com/12345
 * - https://vimeo.com/channels/staffpicks/12345
 * - https://vimeo.com/showcase/123/video/456
 * - https://vimeo.com/album/123/video/456
 * - https://vimeo.com/groups/name/videos/12345
 * - https://player.vimeo.com/video/12345
 * - //player.vimeo.com/video/12345 (protocol-relative)
 * - player.vimeo.com/video/12345 (scheme-less)
 * - All of the above with ?h=abc or other query parameters
 */
export function normalizeVimeoUrl(input: string): VimeoNormalizationResult {
  try {
    // Trim and validate input
    let videoUrl = input.trim();
    if (!videoUrl) {
      return { success: false, error: 'Empty URL' };
    }

    // Handle protocol-relative URLs (//player.vimeo.com/...)
    if (videoUrl.startsWith('//')) {
      videoUrl = `https:${videoUrl}`;
    }
    // Prepend https:// if no protocol is present
    else if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      videoUrl = `https://${videoUrl}`;
    }

    // Parse URL to extract components
    const parsedUrl = new URL(videoUrl);
    
    // Validate it's a Vimeo URL
    if (!parsedUrl.hostname.includes('vimeo.com')) {
      return { success: false, error: 'Not a Vimeo URL' };
    }

    let finalUrl: URL;
    
    // If already a player URL, use it directly
    if (parsedUrl.hostname === 'player.vimeo.com') {
      finalUrl = parsedUrl;
    } else {
      // Extract video ID from various Vimeo URL patterns
      // Priority order: look for specific patterns first, then fallback to last numeric segment
      
      let videoId: string | null = null;
      const path = parsedUrl.pathname;
      
      // Pattern 1: /video/{id} (showcase, album, groups)
      const videoPattern = path.match(/\/video\/(\d+)/);
      if (videoPattern) {
        videoId = videoPattern[1];
      }
      // Pattern 2: /videos/{id} (groups, channels)
      else if (path.match(/\/videos\/(\d+)/)) {
        const videosPattern = path.match(/\/videos\/(\d+)/);
        videoId = videosPattern![1];
      }
      // Pattern 3: Simple /{id} (direct video links)
      else if (path.match(/^\/\d+$/)) {
        videoId = path.slice(1); // Remove leading slash
      }
      // Pattern 4: Fallback - last numeric segment in path
      else {
        const allNumbers = path.match(/\d+/g);
        if (allNumbers && allNumbers.length > 0) {
          videoId = allNumbers[allNumbers.length - 1];
        }
      }
      
      if (!videoId) {
        return { success: false, error: 'Could not extract video ID from URL' };
      }

      // Create player URL preserving original query parameters
      finalUrl = new URL(`https://player.vimeo.com/video/${videoId}`);
      
      // Copy over existing query parameters (like ?h= tokens)
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

    return { success: true, url: finalUrl.toString() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
