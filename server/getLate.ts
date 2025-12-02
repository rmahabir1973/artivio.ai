/**
 * GetLate.dev API Service
 * 
 * A unified social media scheduling API for posting to 10 platforms.
 * https://getlate.dev/docs
 */

const GETLATE_API_URL = 'https://getlate.dev/api/v1';
const GETLATE_API_KEY = process.env.GETLATE_API_KEY;

export type SocialPlatform = 
  | 'twitter' 
  | 'instagram' 
  | 'linkedin' 
  | 'youtube' 
  | 'facebook' 
  | 'threads' 
  | 'tiktok' 
  | 'pinterest' 
  | 'reddit' 
  | 'bluesky';

export const PLATFORM_DISPLAY_NAMES: Record<SocialPlatform, string> = {
  twitter: 'X (Twitter)',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  facebook: 'Facebook',
  threads: 'Threads',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  bluesky: 'Bluesky',
};

export const PLATFORM_DAILY_CAPS: Record<SocialPlatform, number> = {
  instagram: 50,
  tiktok: 15,
  linkedin: 150,
  youtube: 10,
  facebook: 25,
  twitter: 50,
  threads: 50,
  pinterest: 20,
  reddit: 10,
  bluesky: 50,
};

export interface GetLateProfile {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface GetLateAccount {
  _id: string;
  platform: SocialPlatform;
  username?: string;
  displayName?: string;
  profileImageUrl?: string;
  isActive?: boolean;
}

export interface GetLatePlatformInvite {
  _id: string;
  token: string;
  userId: string;
  profileId: string;
  platform: SocialPlatform;
  inviterName?: string;
  inviterEmail?: string;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
  inviteUrl: string;
}

export interface GetLatePost {
  _id: string;
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledFor?: string;
  timezone?: string;
  publishedAt?: string;
  platforms: Array<{
    platform: SocialPlatform;
    accountId: string;
    customContent?: string;
    platformSpecificData?: Record<string, any>;
  }>;
  mediaItems?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostOptions {
  content: string;
  scheduledFor?: string;
  timezone?: string;
  publishNow?: boolean;
  platforms?: Array<{
    platform: SocialPlatform;
    accountId: string;
    customContent?: string;
    platformSpecificData?: Record<string, any>;
  }>;
  mediaItems?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
  queuedFromProfile?: string;
}

class GetLateService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    if (!GETLATE_API_KEY) {
      console.warn('[GetLate] API key not configured. Social media features will be unavailable.');
    }
    this.apiKey = GETLATE_API_KEY || '';
    this.baseUrl = GETLATE_API_URL;
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
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
      throw new Error(`GetLate API error (${response.status}): ${errorMessage}`);
    }
    return response.json();
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // =====================================================
  // PROFILES
  // =====================================================

  async getProfiles(): Promise<{ profiles: GetLateProfile[] }> {
    console.log('[GetLate] Fetching profiles');
    
    const response = await fetch(`${this.baseUrl}/profiles`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createProfile(name: string, description?: string, color?: string): Promise<GetLateProfile> {
    console.log(`[GetLate] Creating profile: ${name}`);
    
    const response = await fetch(`${this.baseUrl}/profiles`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name, description, color }),
    });

    return this.handleResponse(response);
  }

  async updateProfile(profileId: string, updates: { name?: string; description?: string; color?: string }): Promise<GetLateProfile> {
    console.log(`[GetLate] Updating profile: ${profileId}`);
    
    const response = await fetch(`${this.baseUrl}/profiles/${profileId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    return this.handleResponse(response);
  }

  async deleteProfile(profileId: string): Promise<void> {
    console.log(`[GetLate] Deleting profile: ${profileId}`);
    
    const response = await fetch(`${this.baseUrl}/profiles/${profileId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GetLate API error (${response.status}): ${errorText}`);
    }
  }

  // =====================================================
  // ACCOUNTS (Connected Social Media Accounts)
  // =====================================================

  async getAccounts(profileId?: string): Promise<{ accounts: GetLateAccount[] }> {
    console.log('[GetLate] Fetching accounts', profileId ? `for profile: ${profileId}` : '');
    
    // Fetch accounts with optional profileId filter
    const url = profileId 
      ? `${this.baseUrl}/accounts?profileId=${profileId}`
      : `${this.baseUrl}/accounts`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const result = await this.handleResponse<{ accounts: GetLateAccount[] }>(response);
    console.log(`[GetLate] Accounts API returned ${result.accounts?.length || 0} accounts`);
    
    return result;
  }

  async disconnectAccount(accountId: string): Promise<void> {
    console.log(`[GetLate] Disconnecting account: ${accountId}`);
    
    const response = await fetch(`${this.baseUrl}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[GetLate] Failed to disconnect account. Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`GetLate API error (${response.status}): ${errorText}`);
    }
    
    console.log(`[GetLate] Successfully disconnected account: ${accountId}`);
  }

  async getConnectUrl(profileId: string, platform: SocialPlatform, redirectUrl: string): Promise<string> {
    console.log(`[GetLate] Getting connect URL for ${platform} on profile ${profileId} with redirect to ${redirectUrl}`);
    
    // Build the request URL with profileId and redirect_url
    const params = new URLSearchParams({ 
      profileId,
      redirect_url: redirectUrl 
    });
    
    const url = `${this.baseUrl}/connect/${platform}?${params.toString()}`;
    console.log(`[GetLate] Calling: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    console.log(`[GetLate] Connect response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[GetLate] Failed to get connect URL. Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`Failed to get OAuth URL from GetLate: ${response.status} - ${errorText}`);
    }

    // GetLate returns JSON with authUrl field
    const data = await response.json();
    console.log(`[GetLate] Connect response:`, JSON.stringify(data));
    
    // Check for authUrl (primary) or other possible field names
    const authUrl = data.authUrl || data.url || data.redirectUrl || data.oauthUrl;
    
    if (!authUrl) {
      console.error(`[GetLate] No authUrl in response:`, data);
      throw new Error('GetLate response missing authUrl');
    }
    
    console.log(`[GetLate] Got authUrl: ${authUrl}`);
    return authUrl;
  }

  /**
   * Connect Bluesky using identifier (handle or email) and app password
   * Bluesky doesn't use OAuth - it uses a special credentials endpoint
   * POST /v1/connect/bluesky/credentials
   */
  async connectBlueskyWithCredentials(
    profileId: string,
    identifier: string,
    appPassword: string,
    redirectUri: string
  ): Promise<{ success: boolean; account?: GetLateAccount; message?: string }> {
    console.log(`[GetLate] Connecting Bluesky with credentials for profile ${profileId}`);
    console.log(`[GetLate] Identifier: ${identifier}, redirectUri: ${redirectUri}`);
    
    // Clean the identifier - remove @ symbol if present
    const cleanIdentifier = identifier.startsWith('@') ? identifier.slice(1) : identifier;
    console.log(`[GetLate] Cleaned identifier: ${cleanIdentifier}`);
    
    // Generate a state parameter for security (include profileId for our own tracking)
    const state = `bluesky_${profileId}_${Date.now()}`;
    
    // GetLate expects only these 4 fields in the body
    // profileId should be passed as a query parameter like other connect endpoints
    const requestBody = {
      identifier: cleanIdentifier,
      appPassword: appPassword,
      state: state,
      redirectUri: redirectUri,
    };
    
    console.log(`[GetLate] Request body (password hidden):`, { 
      ...requestBody, 
      appPassword: '***hidden***' 
    });
    
    // Add profileId as query parameter (consistent with other connect endpoints)
    const url = `${this.baseUrl}/connect/bluesky/credentials?profileId=${encodeURIComponent(profileId)}`;
    console.log(`[GetLate] Calling URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(requestBody),
    });

    console.log(`[GetLate] Bluesky credentials response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[GetLate] Bluesky credentials failed. Status: ${response.status}, Body: ${errorText}`);
      throw new Error(`Failed to connect Bluesky: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`[GetLate] Bluesky credentials response:`, JSON.stringify(data));
    
    return {
      success: true,
      account: data.account,
      message: data.message || 'Bluesky connected successfully',
    };
  }

  // =====================================================
  // PLATFORM INVITES (For client OAuth onboarding)
  // =====================================================

  async getPlatformInvites(profileId?: string): Promise<{ invites: GetLatePlatformInvite[] }> {
    console.log('[GetLate] Fetching platform invites');
    
    const url = profileId 
      ? `${this.baseUrl}/platform-invites?profileId=${profileId}`
      : `${this.baseUrl}/platform-invites`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createPlatformInvite(profileId: string, platform: SocialPlatform): Promise<{ invite: GetLatePlatformInvite }> {
    console.log(`[GetLate] Creating platform invite for ${platform} on profile ${profileId}`);
    
    const response = await fetch(`${this.baseUrl}/platform-invites`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ profileId, platform }),
    });

    return this.handleResponse(response);
  }

  async revokePlatformInvite(inviteId: string): Promise<void> {
    console.log(`[GetLate] Revoking platform invite: ${inviteId}`);
    
    const response = await fetch(`${this.baseUrl}/platform-invites?id=${inviteId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GetLate API error (${response.status}): ${errorText}`);
    }
  }

  // =====================================================
  // POSTS
  // =====================================================

  async getPosts(options?: {
    page?: number;
    limit?: number;
    status?: 'draft' | 'scheduled' | 'published' | 'failed';
    platform?: SocialPlatform;
    profileId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ posts: GetLatePost[]; total?: number }> {
    console.log('[GetLate] Fetching posts');
    
    const params = new URLSearchParams();
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);
    if (options?.platform) params.set('platform', options.platform);
    if (options?.profileId) params.set('profileId', options.profileId);
    if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options?.dateTo) params.set('dateTo', options.dateTo);
    
    const url = `${this.baseUrl}/posts${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getPost(postId: string): Promise<GetLatePost> {
    console.log(`[GetLate] Fetching post: ${postId}`);
    
    const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createPost(options: CreatePostOptions): Promise<GetLatePost> {
    console.log('[GetLate] Creating post');
    
    const response = await fetch(`${this.baseUrl}/posts`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(options),
    });

    return this.handleResponse(response);
  }

  async updatePost(postId: string, updates: Partial<CreatePostOptions>): Promise<GetLatePost> {
    console.log(`[GetLate] Updating post: ${postId}`);
    
    const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    return this.handleResponse(response);
  }

  async deletePost(postId: string): Promise<void> {
    console.log(`[GetLate] Deleting post: ${postId}`);
    
    const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GetLate API error (${response.status}): ${errorText}`);
    }
  }

  // =====================================================
  // QUEUE
  // =====================================================

  async getNextQueueSlot(profileId: string): Promise<{ scheduledFor: string; timezone: string }> {
    console.log(`[GetLate] Getting next queue slot for profile: ${profileId}`);
    
    const response = await fetch(`${this.baseUrl}/queue/next-slot?profileId=${profileId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // =====================================================
  // USERS (For team management)
  // =====================================================

  async getUsers(): Promise<{ users: Array<{ _id: string; email: string; name?: string }> }> {
    console.log('[GetLate] Fetching users');
    
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  async findOrCreateArtivioProfile(): Promise<GetLateProfile> {
    const { profiles } = await this.getProfiles();
    
    const artivioProfile = profiles.find(p => p.name === 'artivio');
    if (artivioProfile) {
      return artivioProfile;
    }

    return this.createProfile('artivio', 'Artivio AI Social Media Hub', '#6366f1');
  }

  async ensureUserProfile(userId: string, userName?: string): Promise<GetLateProfile> {
    const profileName = `artivio_${userId.replace(/-/g, '').substring(0, 16)}`;
    
    const { profiles } = await this.getProfiles();
    const existingProfile = profiles.find(p => p.name === profileName);
    
    if (existingProfile) {
      return existingProfile;
    }

    const description = userName 
      ? `${userName}'s Artivio Social Hub`
      : 'Artivio Social Media Hub';
    
    return this.createProfile(profileName, description, '#6366f1');
  }
}

export const getLateService = new GetLateService();

// Social Media Poster constants
export const SOCIAL_POSTER_PRODUCT_ID = 'prod_TWdKgoLE1kfn4o';
export const SOCIAL_POSTER_PRICE_ID = 'price_1SZa3PKvkQlROMzf7X2POgZX';
