import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const UPLOAD_POST_API_URL = 'https://api.upload-post.com/api';
const UPLOAD_POST_API_KEY = process.env.UPLOAD_POST_API_KEY;

export type SocialPlatform = 
  | 'tiktok' 
  | 'instagram' 
  | 'linkedin' 
  | 'youtube' 
  | 'facebook' 
  | 'twitter' 
  | 'threads' 
  | 'pinterest' 
  | 'bluesky';

export const PLATFORM_DAILY_CAPS: Record<SocialPlatform, number> = {
  instagram: 50,
  tiktok: 15,
  linkedin: 150,
  youtube: 10,
  facebook: 25,
  twitter: 50,
  threads: 50,
  pinterest: 20,
  bluesky: 50,
};

export interface UploadPostProfile {
  username: string;
  created_at: string;
  social_accounts: Record<string, SocialAccountDetails | null | string>;
}

export interface SocialAccountDetails {
  display_name?: string;
  username?: string;
  social_images?: string;
}

export interface ScheduledPost {
  job_id: string;
  scheduled_date: string;
  post_type: 'video' | 'photo' | 'text';
  profile_username: string;
  title: string;
  preview_url: string | null;
}

export interface UploadVideoOptions {
  user: string;
  platforms: SocialPlatform[];
  videoUrl?: string;
  videoPath?: string;
  title: string;
  description?: string;
  scheduledDate?: string;
  asyncUpload?: boolean;
  firstComment?: string;
  platformTitles?: Partial<Record<SocialPlatform, string>>;
  tiktokOptions?: {
    privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
    disableDuet?: boolean;
    disableComment?: boolean;
    disableStitch?: boolean;
    isAigc?: boolean;
  };
  instagramOptions?: {
    mediaType?: 'REELS' | 'STORIES';
    shareToFeed?: boolean;
    collaborators?: string;
  };
  youtubeOptions?: {
    tags?: string[];
    categoryId?: string;
    privacyStatus?: 'public' | 'unlisted' | 'private';
    thumbnailUrl?: string;
    madeForKids?: boolean;
    containsSyntheticMedia?: boolean;
  };
  facebookOptions?: {
    pageId: string;
    mediaType?: 'REELS' | 'STORIES';
  };
  linkedinOptions?: {
    visibility?: 'CONNECTIONS' | 'PUBLIC' | 'LOGGED_IN';
    targetPageId?: string;
  };
}

export interface UploadPhotoOptions {
  user: string;
  platforms: SocialPlatform[];
  photoUrls?: string[];
  photoPaths?: string[];
  title: string;
  description?: string;
  scheduledDate?: string;
  asyncUpload?: boolean;
  firstComment?: string;
  platformTitles?: Partial<Record<SocialPlatform, string>>;
}

export interface UploadTextOptions {
  user: string;
  platforms: SocialPlatform[];
  text: string;
  scheduledDate?: string;
  asyncUpload?: boolean;
}

export interface AnalyticsData {
  followers?: number;
  impressions?: number;
  reach?: number;
  profile_views?: number;
  time_series?: any[];
}

class UploadPostService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    if (!UPLOAD_POST_API_KEY) {
      console.warn('[Upload-Post] API key not configured. Social media features will be unavailable.');
    }
    this.apiKey = UPLOAD_POST_API_KEY || '';
    this.baseUrl = UPLOAD_POST_API_URL;
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Apikey ${this.apiKey}`,
    };
  }

  private getJsonHeaders(): Record<string, string> {
    return {
      ...this.getAuthHeaders(),
      'Content-Type': 'application/json',
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`Upload-Post API error (${response.status}): ${errorMessage}`);
    }
    return response.json();
  }

  async createUserProfile(username: string): Promise<{ success: boolean; profile: UploadPostProfile }> {
    console.log(`[Upload-Post] Creating user profile: ${username}`);
    
    const response = await fetch(`${this.baseUrl}/uploadposts/users`, {
      method: 'POST',
      headers: this.getJsonHeaders(),
      body: JSON.stringify({ username }),
    });

    return this.handleResponse(response);
  }

  async getUserProfiles(): Promise<{ success: boolean; profiles: UploadPostProfile[]; limit: number; plan: string }> {
    console.log('[Upload-Post] Fetching user profiles');
    
    const response = await fetch(`${this.baseUrl}/uploadposts/users`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getUserProfile(username: string): Promise<{ success: boolean; profile: UploadPostProfile }> {
    console.log(`[Upload-Post] Fetching user profile: ${username}`);
    
    const response = await fetch(`${this.baseUrl}/uploadposts/users/${encodeURIComponent(username)}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async deleteUserProfile(username: string): Promise<{ success: boolean; message: string }> {
    console.log(`[Upload-Post] Deleting user profile: ${username}`);
    
    const response = await fetch(`${this.baseUrl}/uploadposts/users`, {
      method: 'DELETE',
      headers: this.getJsonHeaders(),
      body: JSON.stringify({ username }),
    });

    return this.handleResponse(response);
  }

  async generateJwtUrl(
    username: string,
    options?: {
      redirectUrl?: string;
      logoImage?: string;
      redirectButtonText?: string;
      connectTitle?: string;
      connectDescription?: string;
      platforms?: SocialPlatform[];
      showCalendar?: boolean;
    }
  ): Promise<{ success: boolean; access_url: string; duration: string }> {
    console.log(`[Upload-Post] Generating JWT URL for user: ${username}`);
    
    const body: any = { username };
    if (options?.redirectUrl) body.redirect_url = options.redirectUrl;
    if (options?.logoImage) body.logo_image = options.logoImage;
    if (options?.redirectButtonText) body.redirect_button_text = options.redirectButtonText;
    if (options?.connectTitle) body.connect_title = options.connectTitle;
    if (options?.connectDescription) body.connect_description = options.connectDescription;
    if (options?.platforms) body.platforms = options.platforms;
    if (options?.showCalendar !== undefined) body.show_calendar = options.showCalendar;

    const response = await fetch(`${this.baseUrl}/uploadposts/users/generate-jwt`, {
      method: 'POST',
      headers: this.getJsonHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse(response);
  }

  async validateJwt(jwtToken: string): Promise<{ success: boolean; profile?: UploadPostProfile; isValid?: boolean; reason?: string }> {
    console.log('[Upload-Post] Validating JWT token');
    
    const response = await fetch(`${this.baseUrl}/uploadposts/users/validate-jwt`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
      },
    });

    return this.handleResponse(response);
  }

  async uploadVideo(options: UploadVideoOptions): Promise<any> {
    console.log(`[Upload-Post] Uploading video for user: ${options.user} to platforms: ${options.platforms.join(', ')}`);
    
    const formData = new FormData();
    
    formData.append('user', options.user);
    options.platforms.forEach(platform => {
      formData.append('platform[]', platform === 'twitter' ? 'x' : platform);
    });
    formData.append('title', options.title);
    
    if (options.videoUrl) {
      formData.append('video', options.videoUrl);
    } else if (options.videoPath) {
      const videoStream = fs.createReadStream(options.videoPath);
      formData.append('video', videoStream, path.basename(options.videoPath));
    } else {
      throw new Error('Either videoUrl or videoPath must be provided');
    }
    
    if (options.description) formData.append('description', options.description);
    if (options.scheduledDate) formData.append('scheduled_date', options.scheduledDate);
    if (options.asyncUpload !== undefined) formData.append('async_upload', String(options.asyncUpload));
    if (options.firstComment) formData.append('first_comment', options.firstComment);
    
    if (options.platformTitles) {
      Object.entries(options.platformTitles).forEach(([platform, title]) => {
        if (title) formData.append(`${platform}_title`, title);
      });
    }
    
    if (options.tiktokOptions) {
      if (options.tiktokOptions.privacyLevel) formData.append('privacy_level', options.tiktokOptions.privacyLevel);
      if (options.tiktokOptions.disableDuet) formData.append('disable_duet', 'true');
      if (options.tiktokOptions.disableComment) formData.append('disable_comment', 'true');
      if (options.tiktokOptions.disableStitch) formData.append('disable_stitch', 'true');
      if (options.tiktokOptions.isAigc) formData.append('is_aigc', 'true');
    }
    
    if (options.instagramOptions) {
      if (options.instagramOptions.mediaType) formData.append('media_type', options.instagramOptions.mediaType);
      if (options.instagramOptions.shareToFeed !== undefined) formData.append('share_to_feed', String(options.instagramOptions.shareToFeed));
      if (options.instagramOptions.collaborators) formData.append('collaborators', options.instagramOptions.collaborators);
    }
    
    if (options.youtubeOptions) {
      if (options.youtubeOptions.tags) formData.append('tags', JSON.stringify(options.youtubeOptions.tags));
      if (options.youtubeOptions.categoryId) formData.append('categoryId', options.youtubeOptions.categoryId);
      if (options.youtubeOptions.privacyStatus) formData.append('privacyStatus', options.youtubeOptions.privacyStatus);
      if (options.youtubeOptions.thumbnailUrl) formData.append('thumbnail_url', options.youtubeOptions.thumbnailUrl);
      if (options.youtubeOptions.madeForKids !== undefined) formData.append('madeForKids', String(options.youtubeOptions.madeForKids));
      if (options.youtubeOptions.containsSyntheticMedia) formData.append('containsSyntheticMedia', 'true');
    }
    
    if (options.facebookOptions) {
      formData.append('facebook_page_id', options.facebookOptions.pageId);
      if (options.facebookOptions.mediaType) formData.append('facebook_media_type', options.facebookOptions.mediaType);
    }
    
    if (options.linkedinOptions) {
      if (options.linkedinOptions.visibility) formData.append('visibility', options.linkedinOptions.visibility);
      if (options.linkedinOptions.targetPageId) formData.append('target_linkedin_page_id', options.linkedinOptions.targetPageId);
    }

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    return this.handleResponse(response);
  }

  async uploadPhoto(options: UploadPhotoOptions): Promise<any> {
    console.log(`[Upload-Post] Uploading photo for user: ${options.user} to platforms: ${options.platforms.join(', ')}`);
    
    const formData = new FormData();
    
    formData.append('user', options.user);
    options.platforms.forEach(platform => {
      formData.append('platform[]', platform === 'twitter' ? 'x' : platform);
    });
    formData.append('title', options.title);
    
    if (options.photoUrls && options.photoUrls.length > 0) {
      options.photoUrls.forEach((url, index) => {
        formData.append(`photo${index > 0 ? index + 1 : ''}`, url);
      });
    } else if (options.photoPaths && options.photoPaths.length > 0) {
      options.photoPaths.forEach((photoPath, index) => {
        const photoStream = fs.createReadStream(photoPath);
        formData.append(`photo${index > 0 ? index + 1 : ''}`, photoStream, path.basename(photoPath));
      });
    } else {
      throw new Error('Either photoUrls or photoPaths must be provided');
    }
    
    if (options.description) formData.append('description', options.description);
    if (options.scheduledDate) formData.append('scheduled_date', options.scheduledDate);
    if (options.asyncUpload !== undefined) formData.append('async_upload', String(options.asyncUpload));
    if (options.firstComment) formData.append('first_comment', options.firstComment);
    
    if (options.platformTitles) {
      Object.entries(options.platformTitles).forEach(([platform, title]) => {
        if (title) formData.append(`${platform}_title`, title);
      });
    }

    const response = await fetch(`${this.baseUrl}/upload_photos`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    return this.handleResponse(response);
  }

  async uploadText(options: UploadTextOptions): Promise<any> {
    console.log(`[Upload-Post] Uploading text for user: ${options.user} to platforms: ${options.platforms.join(', ')}`);
    
    const formData = new FormData();
    
    formData.append('user', options.user);
    options.platforms.forEach(platform => {
      formData.append('platform[]', platform === 'twitter' ? 'x' : platform);
    });
    formData.append('title', options.text);
    
    if (options.scheduledDate) formData.append('scheduled_date', options.scheduledDate);
    if (options.asyncUpload !== undefined) formData.append('async_upload', String(options.asyncUpload));

    const response = await fetch(`${this.baseUrl}/upload_text`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    return this.handleResponse(response);
  }

  async getUploadStatus(requestId: string): Promise<any> {
    console.log(`[Upload-Post] Checking upload status: ${requestId}`);
    
    const response = await fetch(`${this.baseUrl}/uploadposts/status?request_id=${requestId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getUploadHistory(options?: { page?: number; limit?: number }): Promise<any> {
    console.log('[Upload-Post] Fetching upload history');
    
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    
    const url = `${this.baseUrl}/uploadposts/history${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getScheduledPosts(): Promise<ScheduledPost[]> {
    console.log('[Upload-Post] Fetching scheduled posts');
    
    const response = await fetch(`${this.baseUrl}/uploadposts/schedule`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async cancelScheduledPost(jobId: string): Promise<{ success: boolean; message: string }> {
    console.log(`[Upload-Post] Cancelling scheduled post: ${jobId}`);
    
    const response = await fetch(`${this.baseUrl}/uploadposts/schedule/${jobId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async editScheduledPost(
    jobId: string,
    updates: { scheduledDate?: string; title?: string; caption?: string }
  ): Promise<{ success: boolean; job_id: string; scheduled_date?: string; title?: string; caption?: string }> {
    console.log(`[Upload-Post] Editing scheduled post: ${jobId}`);
    
    const body: any = {};
    if (updates.scheduledDate) body.scheduled_date = updates.scheduledDate;
    if (updates.title) body.title = updates.title;
    if (updates.caption) body.caption = updates.caption;
    
    const response = await fetch(`${this.baseUrl}/uploadposts/schedule/${jobId}`, {
      method: 'PATCH',
      headers: this.getJsonHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse(response);
  }

  async getAnalytics(profileUsername: string): Promise<{ success: boolean; analytics: AnalyticsData }> {
    console.log(`[Upload-Post] Fetching analytics for: ${profileUsername}`);
    
    const response = await fetch(`${this.baseUrl}/analytics/${encodeURIComponent(profileUsername)}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getFacebookPages(profileUsername?: string): Promise<{ success: boolean; pages: Array<{ page_id: string; page_name: string; profile: string }> }> {
    console.log('[Upload-Post] Fetching Facebook pages');
    
    const params = new URLSearchParams();
    if (profileUsername) params.set('profile', profileUsername);
    
    const url = `${this.baseUrl}/uploadposts/facebook/pages${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getLinkedInPages(profileUsername?: string): Promise<{ success: boolean; pages: Array<{ organization_urn: string; company_name: string; vanity_url?: string; logo_url?: string }> }> {
    console.log('[Upload-Post] Fetching LinkedIn pages');
    
    const params = new URLSearchParams();
    if (profileUsername) params.set('profile', profileUsername);
    
    const url = `${this.baseUrl}/uploadposts/linkedin/pages${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getPinterestBoards(profileUsername?: string): Promise<{ success: boolean; boards: Array<{ board_id: string; board_name: string; profile: string }> }> {
    console.log('[Upload-Post] Fetching Pinterest boards');
    
    const params = new URLSearchParams();
    if (profileUsername) params.set('profile', profileUsername);
    
    const url = `${this.baseUrl}/uploadposts/pinterest/boards${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

export const uploadPostService = new UploadPostService();
