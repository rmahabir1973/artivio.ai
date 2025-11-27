/**
 * Parse Kie.ai errors and provide user-friendly messages with recommendations
 */

export interface ParsedError {
  message: string;
  recommendation: string;
  errorType: string;
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  type: string;
  message: string;
  recommendation: string;
}> = [
  // Suno Music Errors
  {
    pattern: /prompt.*exceed.*500.*character/i,
    type: 'PROMPT_TOO_LONG',
    message: 'Music description is too long (max 500 characters)',
    recommendation: 'Shorten your music description to 500 characters or less. Be concise and focus on the key style and mood.'
  },
  {
    pattern: /lyrics.*exceed.*\d+.*character/i,
    type: 'LYRICS_TOO_LONG',
    message: 'Lyrics text is too long',
    recommendation: 'Please shorten your lyrics. Try breaking it into smaller sections or using shorter lines.'
  },
  {
    pattern: /invalid.*model|model.*not.*found/i,
    type: 'INVALID_MODEL',
    message: 'The selected model is not available',
    recommendation: 'Please select a different model from the available options.'
  },
  
  // Image Errors
  {
    pattern: /real.*person|person.*detected|face.*detected|human.*face/i,
    type: 'REAL_PERSON_DETECTED',
    message: 'The image contains a real person which is not allowed',
    recommendation: 'Please use an image without real people, such as artwork, illustrations, or abstract images.'
  },
  {
    pattern: /image.*quality|low.*resolution|resolution.*too.*low/i,
    type: 'LOW_IMAGE_QUALITY',
    message: 'Image quality is too low',
    recommendation: 'Please use a higher quality image. Try uploading an image with better resolution and clarity.'
  },
  {
    pattern: /image.*format|unsupported.*format|invalid.*format/i,
    type: 'INVALID_IMAGE_FORMAT',
    message: 'Image format is not supported',
    recommendation: 'Please use a standard image format: JPG, PNG, or WebP.'
  },
  {
    pattern: /image.*size|too.*large|exceeds.*size/i,
    type: 'IMAGE_TOO_LARGE',
    message: 'Image is too large',
    recommendation: 'Please use a smaller image file. Try compressing the image or using a lower resolution version.'
  },
  {
    pattern: /inappropriate.*content|content.*policy|violates.*policy/i,
    type: 'INAPPROPRIATE_CONTENT',
    message: 'Content violates our guidelines',
    recommendation: 'Please ensure your content follows our usage policies. Avoid offensive or explicit material.'
  },
  {
    pattern: /rejected.*google.*content.*policy|google.*content.*policy|public.*error.*minor.*upload/i,
    type: 'GOOGLE_CONTENT_POLICY',
    message: 'Content was rejected by Google\'s content policy',
    recommendation: 'Your image or prompt was flagged by Google\'s safety filters. Try using different images with less recognizable faces, or modify your prompt to be more general. Avoid photos of real people or celebrities.'
  },
  {
    pattern: /veo.*fallback|turn.*on.*veo.*3.*fallback/i,
    type: 'VEO_FALLBACK_SUGGESTION',
    message: 'Content was rejected by the primary model',
    recommendation: 'The content was flagged by safety filters. Try using different images with less recognizable faces, or use a different video model that may have different content policies.'
  },

  // Video Errors
  {
    pattern: /link.*expired|expired.*link|video.*expired|re-generate.*video|no longer accessible/i,
    type: 'VIDEO_LINK_EXPIRED',
    message: 'Video link has expired',
    recommendation: 'The video links have expired. Please re-generate the videos you want to combine, or use more recently created videos.'
  },
  {
    pattern: /aspect.*ratio|invalid.*resolution/i,
    type: 'INVALID_ASPECT_RATIO',
    message: 'Video aspect ratio or resolution is not supported',
    recommendation: 'Please adjust your video to one of the supported aspect ratios: 16:9, 9:16, 4:3, or 1:1.'
  },
  {
    pattern: /duration.*exceed|video.*too.*long|length.*too.*long/i,
    type: 'VIDEO_TOO_LONG',
    message: 'Video duration exceeds the maximum allowed',
    recommendation: 'Please use a shorter video clip. Check the duration limit for your selected model.'
  },
  {
    pattern: /video.*format|unsupported.*video|invalid.*video.*format/i,
    type: 'INVALID_VIDEO_FORMAT',
    message: 'Video format is not supported',
    recommendation: 'Please use a standard video format: MP4, WebM, or MOV.'
  },
  {
    pattern: /corrupt|damaged|invalid.*file|cannot.*read.*file/i,
    type: 'CORRUPTED_FILE',
    message: 'The file appears to be corrupted or invalid',
    recommendation: 'Please try uploading a different file or re-export the file from your video editor.'
  },

  // Audio/Music Errors
  {
    pattern: /audio.*quality|audio.*too.*short/i,
    type: 'AUDIO_QUALITY_ISSUE',
    message: 'Audio quality or length is not suitable',
    recommendation: 'Please provide clear audio with sufficient duration. Ensure the audio file is not corrupted.'
  },
  
  // API Errors
  {
    pattern: /rate.*limit|too.*many.*request/i,
    type: 'RATE_LIMIT',
    message: 'Too many requests. Please wait before trying again.',
    recommendation: 'Please wait a few minutes before attempting the generation again.'
  },
  {
    pattern: /api.*key|authentication|unauthorized/i,
    type: 'AUTH_ERROR',
    message: 'API authentication failed',
    recommendation: 'There was an issue with our service. Please try again later.'
  },
  {
    pattern: /timeout|took.*too.*long|processing.*timeout/i,
    type: 'TIMEOUT',
    message: 'Generation took too long and timed out',
    recommendation: 'Please try again with a simpler prompt or shorter content. If the issue persists, try a different model.'
  },
  {
    pattern: /server.*error|internal.*error|500/i,
    type: 'SERVER_ERROR',
    message: 'Server error occurred during processing',
    recommendation: 'Please try again in a few moments. If the problem continues, contact support.'
  },

  // Memory/Resource Errors
  {
    pattern: /out.*of.*memory|memory.*error|resource.*exhausted/i,
    type: 'RESOURCE_ERROR',
    message: 'Server ran out of resources',
    recommendation: 'Please try again with a simpler request or smaller file size.'
  }
];

export function parseKieaiError(errorMessage: string | null | undefined): ParsedError {
  if (!errorMessage) {
    return {
      message: 'Generation failed due to an unknown error',
      recommendation: 'Please try again. If the problem persists, contact support.',
      errorType: 'UNKNOWN_ERROR'
    };
  }

  // Check each pattern
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(errorMessage)) {
      return {
        message: pattern.message,
        recommendation: pattern.recommendation,
        errorType: pattern.type
      };
    }
  }

  // If no pattern matches, return the original error message
  return {
    message: errorMessage.substring(0, 200), // Limit to 200 chars
    recommendation: 'Please try again with different settings. If the issue persists, contact support.',
    errorType: 'GENERIC_ERROR'
  };
}

/**
 * Extract error message from various Kie.ai callback formats
 */
export function extractErrorMessage(callbackData: any): string | null {
  if (!callbackData) return null;

  // Try various error message fields
  const errorMessage = 
    callbackData.data?.failMsg ||
    callbackData.data?.message ||
    callbackData.data?.error ||
    callbackData.msg ||
    callbackData.message ||
    callbackData.error ||
    callbackData.errorMessage ||
    callbackData.error_message ||
    callbackData.data?.errorMessage ||
    callbackData.data?.error_message ||
    null;

  return errorMessage ? String(errorMessage) : null;
}
