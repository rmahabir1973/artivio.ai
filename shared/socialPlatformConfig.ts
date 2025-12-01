/**
 * Comprehensive Platform Content Types Configuration
 * Based on GetLate.dev API documentation
 * 
 * This configuration defines all supported content types for each social media platform,
 * including their requirements, constraints, and platform-specific features.
 */

export type SocialPlatform = 
  | 'instagram' 
  | 'tiktok' 
  | 'linkedin' 
  | 'youtube' 
  | 'facebook' 
  | 'x' 
  | 'threads' 
  | 'pinterest' 
  | 'bluesky'
  | 'reddit';

export type ContentType = 
  | 'post'           // Standard text/image post
  | 'reel'           // Short-form vertical video (Instagram)
  | 'story'          // 24-hour temporary content (Instagram)
  | 'carousel'       // Multiple images/videos in one post
  | 'video'          // Standard video post
  | 'short'          // YouTube Shorts
  | 'thread'         // Multi-post thread (X, Threads, Bluesky)
  | 'pin'            // Pinterest pin
  | 'link'           // Link post (Reddit)
  | 'text';          // Text-only post (Reddit)

export type MediaType = 'image' | 'video' | 'carousel';

export interface ContentTypeConfig {
  id: ContentType;
  name: string;
  description: string;
  requiresMedia: boolean;
  mediaTypes: MediaType[];
  maxMediaCount?: number;
  maxVideoDuration?: number;  // in seconds
  maxCharacters?: number;
  aspectRatios?: string[];    // e.g., ['9:16', '1:1', '4:5']
  supportsFirstComment?: boolean;
  supportsHashtags?: boolean;
  supportsMentions?: boolean;
  supportsUserTags?: boolean;
  supportsCollaborators?: boolean;
  isSchedulable?: boolean;
  platformSpecificFields?: PlatformSpecificField[];
}

export interface PlatformSpecificField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'textarea' | 'toggle' | 'number';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  maxLength?: number;
  helpText?: string;
}

export interface PlatformConfig {
  id: SocialPlatform;
  name: string;
  displayName: string;
  requiresBusinessAccount: boolean;
  businessAccountNote?: string;
  dailyLimit: number;
  maxCharacters: number;
  contentTypes: ContentTypeConfig[];
  supportsFirstComment: boolean;
  supportsThreads: boolean;
  color: string;
}

// Platform-specific configurations based on GetLate.dev API
export const PLATFORM_CONFIGS: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    id: 'instagram',
    name: 'instagram',
    displayName: 'Instagram',
    requiresBusinessAccount: true,
    businessAccountNote: 'Requires a Business account. Personal and Creator accounts are not supported by the Instagram API.',
    dailyLimit: 50,
    maxCharacters: 2200,
    supportsFirstComment: true,
    supportsThreads: false,
    color: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
    contentTypes: [
      {
        id: 'post',
        name: 'Feed Post',
        description: 'Standard image or video post to your feed',
        requiresMedia: true,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 1,
        maxVideoDuration: 3600, // 60 minutes
        maxCharacters: 2200,
        aspectRatios: ['1:1', '4:5', '1.91:1'],
        supportsFirstComment: true,
        supportsHashtags: true,
        supportsMentions: true,
        supportsUserTags: true,
        supportsCollaborators: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'firstComment',
            label: 'First Comment',
            type: 'textarea',
            maxLength: 2200,
            helpText: 'Auto-post a comment after publishing (great for extra hashtags)',
            placeholder: 'Add hashtags or links here...'
          },
          {
            key: 'collaborators',
            label: 'Collaborators',
            type: 'text',
            helpText: 'Up to 3 usernames without @ (comma-separated)',
            placeholder: 'username1, username2'
          }
        ]
      },
      {
        id: 'carousel',
        name: 'Carousel',
        description: 'Multiple images or videos in a single swipeable post',
        requiresMedia: true,
        mediaTypes: ['carousel'],
        maxMediaCount: 10,
        maxCharacters: 2200,
        aspectRatios: ['1:1', '4:5'],
        supportsFirstComment: true,
        supportsHashtags: true,
        supportsMentions: true,
        supportsUserTags: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'firstComment',
            label: 'First Comment',
            type: 'textarea',
            maxLength: 2200,
            helpText: 'Auto-post a comment after publishing'
          }
        ]
      },
      {
        id: 'reel',
        name: 'Reel',
        description: 'Short-form vertical video content (up to 90 seconds)',
        requiresMedia: true,
        mediaTypes: ['video'],
        maxMediaCount: 1,
        maxVideoDuration: 90,
        maxCharacters: 2200,
        aspectRatios: ['9:16'],
        supportsFirstComment: true,
        supportsHashtags: true,
        supportsMentions: true,
        supportsCollaborators: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'firstComment',
            label: 'First Comment',
            type: 'textarea',
            maxLength: 2200,
            helpText: 'Auto-post a comment after the reel is published'
          },
          {
            key: 'collaborators',
            label: 'Collaborators',
            type: 'text',
            helpText: 'Up to 3 usernames without @ (comma-separated)'
          }
        ]
      },
      {
        id: 'story',
        name: 'Story',
        description: '24-hour temporary content visible to followers',
        requiresMedia: true,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 1,
        maxVideoDuration: 60,
        aspectRatios: ['9:16'],
        supportsFirstComment: false,
        supportsHashtags: false,
        supportsMentions: true,
        isSchedulable: true
      }
    ]
  },

  tiktok: {
    id: 'tiktok',
    name: 'tiktok',
    displayName: 'TikTok',
    requiresBusinessAccount: false,
    dailyLimit: 15,
    maxCharacters: 2200,
    supportsFirstComment: false,
    supportsThreads: false,
    color: 'bg-black',
    contentTypes: [
      {
        id: 'video',
        name: 'Video',
        description: 'Short-form video content (up to 10 minutes)',
        requiresMedia: true,
        mediaTypes: ['video'],
        maxMediaCount: 1,
        maxVideoDuration: 600, // 10 minutes
        maxCharacters: 2200,
        aspectRatios: ['9:16', '1:1'],
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'privacyLevel',
            label: 'Privacy',
            type: 'select',
            options: [
              { value: 'PUBLIC_TO_EVERYONE', label: 'Public' },
              { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Friends Only' },
              { value: 'SELF_ONLY', label: 'Private' }
            ],
            helpText: 'Who can view this video'
          },
          {
            key: 'draft',
            label: 'Send to Drafts',
            type: 'toggle',
            helpText: 'Save to TikTok Creator Inbox instead of publishing directly'
          }
        ]
      }
    ]
  },

  linkedin: {
    id: 'linkedin',
    name: 'linkedin',
    displayName: 'LinkedIn',
    requiresBusinessAccount: false,
    dailyLimit: 150,
    maxCharacters: 3000,
    supportsFirstComment: true,
    supportsThreads: false,
    color: 'bg-[#0A66C2]',
    contentTypes: [
      {
        id: 'post',
        name: 'Post',
        description: 'Professional text post with optional media',
        requiresMedia: false,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 9, // LinkedIn supports multiple images
        maxVideoDuration: 600,
        maxCharacters: 3000,
        supportsFirstComment: true,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'firstComment',
            label: 'First Comment',
            type: 'textarea',
            maxLength: 1250,
            helpText: 'Auto-post a comment after publishing'
          }
        ]
      },
      {
        id: 'carousel',
        name: 'Document/Carousel',
        description: 'Multi-page document carousel for slides',
        requiresMedia: true,
        mediaTypes: ['carousel'],
        maxMediaCount: 9,
        maxCharacters: 3000,
        supportsHashtags: true,
        isSchedulable: true
      }
    ]
  },

  youtube: {
    id: 'youtube',
    name: 'youtube',
    displayName: 'YouTube',
    requiresBusinessAccount: false,
    dailyLimit: 10,
    maxCharacters: 5000,
    supportsFirstComment: true,
    supportsThreads: false,
    color: 'bg-[#FF0000]',
    contentTypes: [
      {
        id: 'video',
        name: 'Video',
        description: 'Long-form video content',
        requiresMedia: true,
        mediaTypes: ['video'],
        maxMediaCount: 1,
        maxCharacters: 5000,
        aspectRatios: ['16:9', '4:3'],
        supportsFirstComment: true,
        supportsHashtags: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'title',
            label: 'Video Title',
            type: 'text',
            required: true,
            maxLength: 100,
            placeholder: 'Enter video title'
          },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            maxLength: 5000,
            placeholder: 'Video description...'
          },
          {
            key: 'privacyStatus',
            label: 'Privacy',
            type: 'select',
            options: [
              { value: 'public', label: 'Public' },
              { value: 'unlisted', label: 'Unlisted' },
              { value: 'private', label: 'Private' }
            ]
          },
          {
            key: 'firstComment',
            label: 'First Comment',
            type: 'textarea',
            maxLength: 10000,
            helpText: 'Auto-post a comment after video is published'
          }
        ]
      },
      {
        id: 'short',
        name: 'Short',
        description: 'Vertical short-form video (auto-detected for videos under 3 min)',
        requiresMedia: true,
        mediaTypes: ['video'],
        maxMediaCount: 1,
        maxVideoDuration: 180, // 3 minutes max for Shorts
        maxCharacters: 100,
        aspectRatios: ['9:16'],
        supportsHashtags: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'title',
            label: 'Short Title',
            type: 'text',
            required: true,
            maxLength: 100,
            placeholder: 'Enter short title'
          },
          {
            key: 'privacyStatus',
            label: 'Privacy',
            type: 'select',
            options: [
              { value: 'public', label: 'Public' },
              { value: 'unlisted', label: 'Unlisted' },
              { value: 'private', label: 'Private' }
            ]
          }
        ]
      }
    ]
  },

  facebook: {
    id: 'facebook',
    name: 'facebook',
    displayName: 'Facebook',
    requiresBusinessAccount: false,
    dailyLimit: 25,
    maxCharacters: 63206,
    supportsFirstComment: true,
    supportsThreads: false,
    color: 'bg-[#1877F2]',
    contentTypes: [
      {
        id: 'post',
        name: 'Post',
        description: 'Standard post with optional media',
        requiresMedia: false,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 10,
        maxVideoDuration: 14400, // 4 hours
        maxCharacters: 63206,
        supportsFirstComment: true,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'firstComment',
            label: 'First Comment',
            type: 'textarea',
            maxLength: 8000,
            helpText: 'Auto-post a comment after publishing'
          }
        ]
      },
      {
        id: 'carousel',
        name: 'Carousel',
        description: 'Multiple images in a swipeable format',
        requiresMedia: true,
        mediaTypes: ['carousel'],
        maxMediaCount: 10,
        maxCharacters: 63206,
        supportsHashtags: true,
        isSchedulable: true
      },
      {
        id: 'reel',
        name: 'Reel',
        description: 'Short-form vertical video content',
        requiresMedia: true,
        mediaTypes: ['video'],
        maxMediaCount: 1,
        maxVideoDuration: 90,
        maxCharacters: 2200,
        aspectRatios: ['9:16'],
        supportsHashtags: true,
        isSchedulable: true
      }
    ]
  },

  x: {
    id: 'x',
    name: 'x',
    displayName: 'X (Twitter)',
    requiresBusinessAccount: false,
    dailyLimit: 50,
    maxCharacters: 280, // 25000 for Premium
    supportsFirstComment: false,
    supportsThreads: true,
    color: 'bg-black',
    contentTypes: [
      {
        id: 'post',
        name: 'Tweet',
        description: 'Standard tweet with optional media',
        requiresMedia: false,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 4, // 4 images OR 1 video
        maxVideoDuration: 140, // 2:20 for standard accounts
        maxCharacters: 280,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true
      },
      {
        id: 'thread',
        name: 'Thread',
        description: 'Multi-tweet thread for longer content',
        requiresMedia: false,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 4,
        maxCharacters: 280,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'threadItems',
            label: 'Thread Posts',
            type: 'textarea',
            helpText: 'Each line becomes a separate tweet in the thread',
            placeholder: 'First tweet\nSecond tweet\nThird tweet...'
          }
        ]
      }
    ]
  },

  threads: {
    id: 'threads',
    name: 'threads',
    displayName: 'Threads',
    requiresBusinessAccount: false,
    dailyLimit: 50,
    maxCharacters: 500,
    supportsFirstComment: false,
    supportsThreads: true,
    color: 'bg-black',
    contentTypes: [
      {
        id: 'post',
        name: 'Post',
        description: 'Standard text post with optional media',
        requiresMedia: false,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 10,
        maxCharacters: 500,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true
      },
      {
        id: 'thread',
        name: 'Thread',
        description: 'Multi-post thread for longer content',
        requiresMedia: false,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 10,
        maxCharacters: 500,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'threadItems',
            label: 'Thread Posts',
            type: 'textarea',
            helpText: 'Each line becomes a separate post in the thread',
            placeholder: 'First post\nSecond post\nThird post...'
          }
        ]
      }
    ]
  },

  pinterest: {
    id: 'pinterest',
    name: 'pinterest',
    displayName: 'Pinterest',
    requiresBusinessAccount: false,
    dailyLimit: 20,
    maxCharacters: 500,
    supportsFirstComment: false,
    supportsThreads: false,
    color: 'bg-[#E60023]',
    contentTypes: [
      {
        id: 'pin',
        name: 'Pin',
        description: 'Visual pin with link',
        requiresMedia: true,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 1,
        maxCharacters: 500,
        aspectRatios: ['2:3', '1:1'],
        supportsHashtags: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'boardId',
            label: 'Board',
            type: 'select',
            required: true,
            helpText: 'Select the Pinterest board to pin to',
            options: [] // Populated dynamically
          },
          {
            key: 'link',
            label: 'Destination URL',
            type: 'text',
            placeholder: 'https://example.com',
            helpText: 'Link when users click the pin'
          },
          {
            key: 'title',
            label: 'Pin Title',
            type: 'text',
            maxLength: 100,
            placeholder: 'Enter pin title'
          }
        ]
      }
    ]
  },

  bluesky: {
    id: 'bluesky',
    name: 'bluesky',
    displayName: 'Bluesky',
    requiresBusinessAccount: false,
    dailyLimit: 50,
    maxCharacters: 300,
    supportsFirstComment: false,
    supportsThreads: true,
    color: 'bg-[#0085FF]',
    contentTypes: [
      {
        id: 'post',
        name: 'Post',
        description: 'Standard post with optional images',
        requiresMedia: false,
        mediaTypes: ['image'],
        maxMediaCount: 4,
        maxCharacters: 300,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true
      },
      {
        id: 'thread',
        name: 'Thread',
        description: 'Multi-post thread for longer content',
        requiresMedia: false,
        mediaTypes: ['image'],
        maxMediaCount: 4,
        maxCharacters: 300,
        supportsHashtags: true,
        supportsMentions: true,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'threadItems',
            label: 'Thread Posts',
            type: 'textarea',
            helpText: 'Each line becomes a separate post in the thread',
            placeholder: 'First post\nSecond post\nThird post...'
          }
        ]
      }
    ]
  },

  reddit: {
    id: 'reddit',
    name: 'reddit',
    displayName: 'Reddit',
    requiresBusinessAccount: false,
    dailyLimit: 10,
    maxCharacters: 40000,
    supportsFirstComment: false,
    supportsThreads: false,
    color: 'bg-[#FF4500]',
    contentTypes: [
      {
        id: 'text',
        name: 'Text Post',
        description: 'Self-post with text content',
        requiresMedia: false,
        mediaTypes: [],
        maxCharacters: 40000,
        supportsHashtags: false,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'subreddit',
            label: 'Subreddit',
            type: 'text',
            required: true,
            placeholder: 'r/subredditname',
            helpText: 'Target subreddit for your post'
          },
          {
            key: 'title',
            label: 'Post Title',
            type: 'text',
            required: true,
            maxLength: 300,
            placeholder: 'Enter post title'
          }
        ]
      },
      {
        id: 'link',
        name: 'Link Post',
        description: 'Share a URL with the community',
        requiresMedia: false,
        mediaTypes: [],
        maxCharacters: 300,
        supportsHashtags: false,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'subreddit',
            label: 'Subreddit',
            type: 'text',
            required: true,
            placeholder: 'r/subredditname',
            helpText: 'Target subreddit for your post'
          },
          {
            key: 'title',
            label: 'Post Title',
            type: 'text',
            required: true,
            maxLength: 300,
            placeholder: 'Enter post title'
          },
          {
            key: 'url',
            label: 'URL',
            type: 'text',
            required: true,
            placeholder: 'https://example.com',
            helpText: 'Link to share'
          }
        ]
      },
      {
        id: 'post',
        name: 'Media Post',
        description: 'Share images or videos',
        requiresMedia: true,
        mediaTypes: ['image', 'video'],
        maxMediaCount: 1,
        maxCharacters: 300,
        supportsHashtags: false,
        isSchedulable: true,
        platformSpecificFields: [
          {
            key: 'subreddit',
            label: 'Subreddit',
            type: 'text',
            required: true,
            placeholder: 'r/subredditname',
            helpText: 'Target subreddit for your post'
          },
          {
            key: 'title',
            label: 'Post Title',
            type: 'text',
            required: true,
            maxLength: 300,
            placeholder: 'Enter post title'
          }
        ]
      }
    ]
  }
};

// Helper functions
export function getPlatformConfig(platform: SocialPlatform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

export function getContentTypes(platform: SocialPlatform): ContentTypeConfig[] {
  return PLATFORM_CONFIGS[platform]?.contentTypes || [];
}

export function getContentType(platform: SocialPlatform, contentType: ContentType): ContentTypeConfig | undefined {
  return PLATFORM_CONFIGS[platform]?.contentTypes.find(ct => ct.id === contentType);
}

export function getDefaultContentType(platform: SocialPlatform): ContentType {
  const config = PLATFORM_CONFIGS[platform];
  return config?.contentTypes[0]?.id || 'post';
}

export function platformSupportsMedia(platform: SocialPlatform): boolean {
  const contentTypes = getContentTypes(platform);
  return contentTypes.some(ct => ct.mediaTypes.length > 0);
}

export function platformRequiresMedia(platform: SocialPlatform, contentType: ContentType): boolean {
  const ct = getContentType(platform, contentType);
  return ct?.requiresMedia || false;
}

export function getMaxCharacters(platform: SocialPlatform, contentType?: ContentType): number {
  if (contentType) {
    const ct = getContentType(platform, contentType);
    return ct?.maxCharacters || PLATFORM_CONFIGS[platform].maxCharacters;
  }
  return PLATFORM_CONFIGS[platform].maxCharacters;
}

export function getPlatformSpecificFields(platform: SocialPlatform, contentType: ContentType): PlatformSpecificField[] {
  const ct = getContentType(platform, contentType);
  return ct?.platformSpecificFields || [];
}

// Optimal posting times by platform and content type (for AI Strategist)
export const OPTIMAL_POSTING_TIMES: Record<SocialPlatform, Record<ContentType, string[]>> = {
  instagram: {
    post: ['11:00', '14:00', '19:00'],
    reel: ['09:00', '12:00', '19:00', '21:00'],
    story: ['08:00', '12:00', '18:00', '22:00'],
    carousel: ['10:00', '14:00', '18:00'],
    video: ['12:00', '19:00'],
    short: [],
    thread: [],
    pin: [],
    link: [],
    text: []
  },
  tiktok: {
    video: ['07:00', '10:00', '15:00', '19:00', '22:00'],
    post: [],
    reel: [],
    story: [],
    carousel: [],
    short: [],
    thread: [],
    pin: [],
    link: [],
    text: []
  },
  linkedin: {
    post: ['07:30', '08:00', '12:00', '17:00'],
    carousel: ['09:00', '12:00', '16:00'],
    video: ['10:00', '14:00'],
    reel: [],
    story: [],
    short: [],
    thread: [],
    pin: [],
    link: [],
    text: []
  },
  youtube: {
    video: ['14:00', '16:00', '18:00'],
    short: ['12:00', '15:00', '20:00'],
    post: [],
    reel: [],
    story: [],
    carousel: [],
    thread: [],
    pin: [],
    link: [],
    text: []
  },
  facebook: {
    post: ['09:00', '13:00', '16:00'],
    carousel: ['10:00', '14:00'],
    reel: ['12:00', '19:00'],
    video: ['14:00', '19:00'],
    story: [],
    short: [],
    thread: [],
    pin: [],
    link: [],
    text: []
  },
  x: {
    post: ['08:00', '12:00', '17:00', '21:00'],
    thread: ['09:00', '14:00', '18:00'],
    video: ['12:00', '18:00'],
    reel: [],
    story: [],
    carousel: [],
    short: [],
    pin: [],
    link: [],
    text: []
  },
  threads: {
    post: ['10:00', '14:00', '20:00'],
    thread: ['11:00', '15:00', '19:00'],
    video: [],
    reel: [],
    story: [],
    carousel: [],
    short: [],
    pin: [],
    link: [],
    text: []
  },
  pinterest: {
    pin: ['14:00', '20:00', '21:00'],
    post: [],
    video: [],
    reel: [],
    story: [],
    carousel: [],
    short: [],
    thread: [],
    link: [],
    text: []
  },
  bluesky: {
    post: ['09:00', '13:00', '18:00'],
    thread: ['10:00', '15:00', '19:00'],
    video: [],
    reel: [],
    story: [],
    carousel: [],
    short: [],
    pin: [],
    link: [],
    text: []
  },
  reddit: {
    text: ['08:00', '12:00', '18:00'],
    link: ['09:00', '13:00', '17:00'],
    post: ['10:00', '14:00', '19:00'],
    video: [],
    reel: [],
    story: [],
    carousel: [],
    short: [],
    thread: [],
    pin: []
  }
};

// Content type distribution recommendations for AI Strategist
export const CONTENT_MIX_RECOMMENDATIONS: Record<SocialPlatform, Record<ContentType, number>> = {
  instagram: {
    reel: 40,      // 40% Reels for algorithm boost
    post: 30,      // 30% Feed posts
    carousel: 20,  // 20% Carousels for engagement
    story: 10,     // 10% Stories
    video: 0,
    short: 0,
    thread: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  tiktok: {
    video: 100,
    post: 0,
    reel: 0,
    story: 0,
    carousel: 0,
    short: 0,
    thread: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  linkedin: {
    post: 50,
    carousel: 30,
    video: 20,
    reel: 0,
    story: 0,
    short: 0,
    thread: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  youtube: {
    video: 60,
    short: 40,
    post: 0,
    reel: 0,
    story: 0,
    carousel: 0,
    thread: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  facebook: {
    post: 40,
    reel: 30,
    carousel: 20,
    video: 10,
    story: 0,
    short: 0,
    thread: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  x: {
    post: 70,
    thread: 20,
    video: 10,
    reel: 0,
    story: 0,
    carousel: 0,
    short: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  threads: {
    post: 70,
    thread: 30,
    video: 0,
    reel: 0,
    story: 0,
    carousel: 0,
    short: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  pinterest: {
    pin: 100,
    post: 0,
    video: 0,
    reel: 0,
    story: 0,
    carousel: 0,
    short: 0,
    thread: 0,
    link: 0,
    text: 0
  },
  bluesky: {
    post: 70,
    thread: 30,
    video: 0,
    reel: 0,
    story: 0,
    carousel: 0,
    short: 0,
    pin: 0,
    link: 0,
    text: 0
  },
  reddit: {
    text: 40,
    link: 35,
    post: 25,
    video: 0,
    reel: 0,
    story: 0,
    carousel: 0,
    short: 0,
    thread: 0,
    pin: 0
  }
};
