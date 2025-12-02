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

/**
 * Platform Safe Zones Configuration
 * 
 * These define the video/image dimensions and text-safe areas for each platform's
 * content types. Use these to ensure text overlays and important visual elements
 * aren't covered by platform UI elements.
 */

export interface SafeZoneArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ContentSafeZone {
  contentType: ContentType | 'video';
  videoSize: { width: number; height: number };
  textSafeArea: { width: number; height: number };
  margins: SafeZoneArea;
  gridCrop?: { width: number; height: number };
  notes?: string;
}

export interface PlatformSafeZones {
  platform: SocialPlatform;
  displayName: string;
  safeZones: ContentSafeZone[];
}

export const PLATFORM_SAFE_ZONES: PlatformSafeZones[] = [
  {
    platform: 'instagram',
    displayName: 'Instagram',
    safeZones: [
      {
        contentType: 'reel',
        videoSize: { width: 1080, height: 1920 },
        textSafeArea: { width: 900, height: 1500 },
        margins: {
          top: 110,
          bottom: 320,
          left: 60,
          right: 120
        },
        gridCrop: { width: 1080, height: 1350 },
        notes: 'Top margin clears "Reels" headline and liked by friends bubbles. Bottom margin clears profile photo, description, comments, follow, and music. Right margin clears like, comment, share buttons.'
      },
      {
        contentType: 'story',
        videoSize: { width: 1080, height: 1920 },
        textSafeArea: { width: 1080, height: 1420 },
        margins: {
          top: 250,
          bottom: 250,
          left: 60,
          right: 60
        },
        gridCrop: { width: 1080, height: 1350 },
        notes: 'Avoid top and bottom 250px. Left/right 60px can be cropped on smaller devices.'
      },
      {
        contentType: 'post',
        videoSize: { width: 1080, height: 1350 },
        textSafeArea: { width: 980, height: 1250 },
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        notes: 'Standard portrait post with minimal UI overlay.'
      }
    ]
  },
  {
    platform: 'tiktok',
    displayName: 'TikTok',
    safeZones: [
      {
        contentType: 'video',
        videoSize: { width: 1080, height: 1920 },
        textSafeArea: { width: 960, height: 1440 },
        margins: {
          top: 180,
          bottom: 300,
          left: 60,
          right: 60
        },
        gridCrop: { width: 1080, height: 1440 },
        notes: 'TikTok safe zone is center-weighted. Avoid bottom caption shelf (300px) and top for-you-page header (180px). Left/right 60px for like/share/comment buttons.'
      }
    ]
  },
  {
    platform: 'youtube',
    displayName: 'YouTube',
    safeZones: [
      {
        contentType: 'short',
        videoSize: { width: 1080, height: 1920 },
        textSafeArea: { width: 820, height: 1510 },
        margins: {
          top: 140,
          bottom: 270,
          left: 70,
          right: 190
        },
        gridCrop: { width: 1080, height: 1800 },
        notes: 'Stay within boundaries of like and comment buttons that appear during playback.'
      },
      {
        contentType: 'video',
        videoSize: { width: 1920, height: 1080 },
        textSafeArea: { width: 1540, height: 870 },
        margins: {
          top: 120,
          bottom: 120,
          left: 150,
          right: 150
        },
        gridCrop: { width: 1280, height: 720 },
        notes: 'Top margin avoids video title and channel name. Bottom margin avoids playback controls, captions, and suggested video thumbnails.'
      }
    ]
  },
  {
    platform: 'facebook',
    displayName: 'Facebook',
    safeZones: [
      {
        contentType: 'reel',
        videoSize: { width: 1080, height: 1920 },
        textSafeArea: { width: 900, height: 1500 },
        margins: {
          top: 110,
          bottom: 320,
          left: 60,
          right: 120
        },
        notes: 'Facebook Reels have similar safe zones to Instagram Reels.'
      },
      {
        contentType: 'post',
        videoSize: { width: 1200, height: 630 },
        textSafeArea: { width: 1100, height: 530 },
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        notes: 'Standard Facebook post/link preview size.'
      }
    ]
  },
  {
    platform: 'linkedin',
    displayName: 'LinkedIn',
    safeZones: [
      {
        contentType: 'post',
        videoSize: { width: 1200, height: 628 },
        textSafeArea: { width: 1100, height: 528 },
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        notes: 'LinkedIn post preview size. Keep text clear of edges.'
      },
      {
        contentType: 'video',
        videoSize: { width: 1920, height: 1080 },
        textSafeArea: { width: 1720, height: 880 },
        margins: {
          top: 100,
          bottom: 100,
          left: 100,
          right: 100
        },
        notes: 'Standard 16:9 video with safe margins for playback controls.'
      }
    ]
  },
  {
    platform: 'pinterest',
    displayName: 'Pinterest',
    safeZones: [
      {
        contentType: 'pin',
        videoSize: { width: 1000, height: 1500 },
        textSafeArea: { width: 900, height: 1350 },
        margins: {
          top: 75,
          bottom: 75,
          left: 50,
          right: 50
        },
        notes: 'Optimal 2:3 aspect ratio for pins. Keep important elements in the center.'
      }
    ]
  },
  {
    platform: 'x',
    displayName: 'X (Twitter)',
    safeZones: [
      {
        contentType: 'post',
        videoSize: { width: 1600, height: 900 },
        textSafeArea: { width: 1500, height: 800 },
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        notes: 'Standard Twitter/X image post size. 16:9 recommended.'
      }
    ]
  },
  {
    platform: 'threads',
    displayName: 'Threads',
    safeZones: [
      {
        contentType: 'post',
        videoSize: { width: 1080, height: 1350 },
        textSafeArea: { width: 980, height: 1250 },
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        notes: 'Similar to Instagram feed post safe zones.'
      }
    ]
  },
  {
    platform: 'bluesky',
    displayName: 'Bluesky',
    safeZones: [
      {
        contentType: 'post',
        videoSize: { width: 1600, height: 900 },
        textSafeArea: { width: 1500, height: 800 },
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        },
        notes: 'Standard 16:9 image size works well on Bluesky.'
      }
    ]
  },
  {
    platform: 'reddit',
    displayName: 'Reddit',
    safeZones: [
      {
        contentType: 'post',
        videoSize: { width: 1920, height: 1080 },
        textSafeArea: { width: 1720, height: 880 },
        margins: {
          top: 100,
          bottom: 100,
          left: 100,
          right: 100
        },
        notes: 'Standard 16:9 aspect ratio. Reddit supports various sizes but 16:9 is optimal for most subreddits.'
      }
    ]
  }
];

export function getSafeZonesForPlatform(platform: SocialPlatform): ContentSafeZone[] {
  const config = PLATFORM_SAFE_ZONES.find(p => p.platform === platform);
  return config?.safeZones || [];
}

const CONTENT_TYPE_ALIASES: Record<SocialPlatform, Record<string, ContentType | 'video'>> = {
  instagram: {
    video: 'reel',
    image: 'post',
    carousel: 'post',
  },
  facebook: {
    video: 'reel',
    image: 'post',
    carousel: 'post',
  },
  tiktok: {
    reel: 'video',
    short: 'video',
    image: 'video',
  },
  youtube: {
    reel: 'short',
    image: 'video',
  },
  linkedin: {
    image: 'post',
    carousel: 'post',
    reel: 'video',
    short: 'video',
  },
  pinterest: {
    post: 'pin',
    image: 'pin',
    video: 'pin',
  },
  x: {},
  threads: {},
  bluesky: {},
  reddit: {},
};

export function getSafeZoneForContentType(platform: SocialPlatform, contentType: ContentType | 'video'): ContentSafeZone | undefined {
  const platformZones = getSafeZonesForPlatform(platform);
  
  let exactMatch = platformZones.find(sz => sz.contentType === contentType);
  if (exactMatch) return exactMatch;
  
  const aliasMap = CONTENT_TYPE_ALIASES[platform] || {};
  const aliasedType = aliasMap[contentType];
  if (aliasedType) {
    exactMatch = platformZones.find(sz => sz.contentType === aliasedType);
    if (exactMatch) return exactMatch;
  }
  
  return platformZones[0];
}

export function isWithinSafeZone(
  platform: SocialPlatform,
  contentType: ContentType | 'video',
  position: { x: number; y: number },
  elementSize: { width: number; height: number }
): boolean {
  const safeZone = getSafeZoneForContentType(platform, contentType);
  if (!safeZone) return true;

  const { margins, videoSize } = safeZone;
  const safeLeft = margins.left;
  const safeTop = margins.top;
  const safeRight = videoSize.width - margins.right;
  const safeBottom = videoSize.height - margins.bottom;

  return (
    position.x >= safeLeft &&
    position.y >= safeTop &&
    position.x + elementSize.width <= safeRight &&
    position.y + elementSize.height <= safeBottom
  );
}

export function getSafeZoneGuidance(platform: SocialPlatform, contentType: ContentType | 'video'): string {
  const safeZone = getSafeZoneForContentType(platform, contentType);
  if (!safeZone) return '';

  const { videoSize, textSafeArea, margins, notes } = safeZone;
  
  return `Video size: ${videoSize.width}x${videoSize.height}px. ` +
    `Text-safe area: ${textSafeArea.width}x${textSafeArea.height}px. ` +
    `Margins - Top: ${margins.top}px, Bottom: ${margins.bottom}px, Left: ${margins.left}px, Right: ${margins.right}px. ` +
    (notes ? `Note: ${notes}` : '');
}
