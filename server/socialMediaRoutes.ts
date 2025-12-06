import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import multer from "multer";
import { db } from "./db";
import { storage } from "./storage";
import { requireJWT } from "./jwtMiddleware";
import { getLateService, PLATFORM_DAILY_CAPS, type SocialPlatform, SOCIAL_POSTER_PRICE_ID } from "./getLate";
import { uploadBuffer, isS3Enabled, type S3Prefix } from "./services/awsS3";
import {
  socialProfiles,
  socialAccounts,
  socialGoals,
  socialPosts,
  socialAnalytics,
  socialBrandKits,
  socialBrandMaterials,
  socialBrandAssets,
  socialBrandScanJobs,
  aiContentPlans,
  socialHubAssets,
  generations,
  insertSocialGoalSchema,
  updateSocialGoalSchema,
  insertSocialPostSchema,
  updateSocialPostSchema,
  insertSocialBrandKitSchema,
  insertSocialBrandMaterialSchema,
  insertSocialBrandAssetSchema,
  insertSocialHubAssetSchema,
} from "@shared/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import { 
  PLATFORM_CONFIGS, 
  OPTIMAL_POSTING_TIMES, 
  CONTENT_MIX_RECOMMENDATIONS, 
  getContentTypes, 
  type ContentType, 
  type SocialPlatform as PlatformType 
} from "../shared/socialPlatformConfig";

const ARTIVIO_LOGO_URL = "https://artivio.ai/logo.png";

// Secure in-memory store for pending OAuth invites (URL never exposed to frontend)
interface PendingInvite {
  url: string;
  platform: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  consumed: boolean;
  nonce: string;
}
const pendingInvites = new Map<string, PendingInvite>();

// Generate cryptographically secure nonce
function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(32);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < 32; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

// Validate URL is from allowed OAuth domains
// GetLate returns the actual platform OAuth URLs, so we need to allow all major platform domains
const ALLOWED_OAUTH_HOSTS = [
  // GetLate domains
  'getlate.dev',
  'www.getlate.dev',
  'app.getlate.dev',
  'api.getlate.dev',
  'auth.getlate.dev',
  // LinkedIn OAuth
  'linkedin.com',
  'www.linkedin.com',
  'api.linkedin.com',
  // Facebook/Meta OAuth (used by Facebook, Instagram, Threads)
  'facebook.com',
  'www.facebook.com',
  'api.facebook.com',
  'm.facebook.com',
  // Instagram OAuth (Instagram uses its own OAuth endpoint, not Facebook's)
  'instagram.com',
  'www.instagram.com',
  'api.instagram.com',
  // Threads OAuth (Threads has its own API domain)
  'threads.net',
  'www.threads.net',
  'graph.threads.net',
  // Google OAuth (used by YouTube)
  'accounts.google.com',
  'google.com',
  'www.google.com',
  // Twitter/X OAuth
  'twitter.com',
  'api.twitter.com',
  'x.com',
  'api.x.com',
  // TikTok OAuth
  'tiktok.com',
  'www.tiktok.com',
  'open.tiktokapis.com',
  // Pinterest OAuth
  'pinterest.com',
  'www.pinterest.com',
  'api.pinterest.com',
  // Reddit OAuth
  'reddit.com',
  'www.reddit.com',
  'oauth.reddit.com',
  // Bluesky OAuth
  'bsky.social',
  'bsky.app',
];

// Map frontend platform IDs to GetLate API platform IDs
// Frontend uses "x" for Twitter/X, but GetLate API expects "twitter"
const PLATFORM_ID_MAP: Record<string, SocialPlatform> = {
  'x': 'twitter',
  'twitter': 'twitter',
  'instagram': 'instagram',
  'linkedin': 'linkedin',
  'youtube': 'youtube',
  'facebook': 'facebook',
  'threads': 'threads',
  'tiktok': 'tiktok',
  'pinterest': 'pinterest',
  'reddit': 'reddit',
  'bluesky': 'bluesky',
};

// Reverse map: GetLate API platform IDs to frontend platform IDs
// GetLate returns "twitter" but frontend uses "x"
const GETLATE_TO_FRONTEND_MAP: Record<SocialPlatform, string> = {
  'twitter': 'x',  // GetLate's "twitter" maps to frontend's "x"
  'instagram': 'instagram',
  'linkedin': 'linkedin',
  'youtube': 'youtube',
  'facebook': 'facebook',
  'threads': 'threads',
  'tiktok': 'tiktok',
  'pinterest': 'pinterest',
  'reddit': 'reddit',
  'bluesky': 'bluesky',
};

function mapToGetLatePlatform(frontendPlatform: string): SocialPlatform {
  const mapped = PLATFORM_ID_MAP[frontendPlatform.toLowerCase()];
  if (!mapped) {
    throw new Error(`Unknown platform: ${frontendPlatform}`);
  }
  return mapped;
}

function mapToFrontendPlatform(getLatePlatform: SocialPlatform): string {
  return GETLATE_TO_FRONTEND_MAP[getLatePlatform] || getLatePlatform;
}

function isAllowedOAuthDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      console.warn(`[Social] OAuth URL rejected: non-HTTPS protocol ${parsed.protocol}`);
      return false;
    }
    // Must be exact match to allowed hosts (no wildcard subdomains)
    if (!ALLOWED_OAUTH_HOSTS.includes(parsed.hostname)) {
      console.warn(`[Social] OAuth URL rejected: unknown host ${parsed.hostname}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Clean up expired invites every 5 minutes
setInterval(() => {
  const now = new Date();
  const keysToDelete: string[] = [];
  pendingInvites.forEach((invite, id) => {
    // Delete if expired, consumed, or older than 30 minutes
    if (invite.expiresAt < now || invite.consumed || (now.getTime() - invite.createdAt.getTime()) > 30 * 60 * 1000) {
      keysToDelete.push(id);
    }
  });
  keysToDelete.forEach(id => pendingInvites.delete(id));
}, 5 * 60 * 1000);

// Middleware to check if user has Social Media Poster access
async function requireSocialPoster(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        requiresSubscription: true,
        priceId: SOCIAL_POSTER_PRICE_ID,
      });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has Social Poster access
    if (!user.hasSocialPoster) {
      return res.status(403).json({ 
        message: 'Social Media Poster subscription required',
        requiresSubscription: true,
        priceId: SOCIAL_POSTER_PRICE_ID,
        upgradeUrl: '/social/upgrade',
      });
    }

    next();
  } catch (error: any) {
    console.error('[Social] Subscription check failed:', error);
    res.status(500).json({ message: 'Failed to verify subscription' });
  }
}

export function registerSocialMediaRoutes(app: Express) {
  
  // =====================================================
  // SOCIAL POSTER SUBSCRIPTION STATUS
  // =====================================================

  // Check if user has Social Poster access (public endpoint for UI gating)
  app.get('/api/social/subscription-status', requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        hasSocialPoster: user.hasSocialPoster || false,
        socialPosterSubscriptionId: user.socialPosterSubscriptionId || null,
        priceId: SOCIAL_POSTER_PRICE_ID,
      });
    } catch (error: any) {
      console.error('[Social] Error checking subscription status:', error);
      res.status(500).json({ message: 'Failed to check subscription status' });
    }
  });

  // =====================================================
  // SOCIAL PROFILE MANAGEMENT
  // =====================================================

  // Get current user's social profile
  app.get('/api/social/profile', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ profile: null, hasProfile: false });
      }

      // Get connected accounts
      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.socialProfileId, profile.id));

      // Get goals
      const [goals] = await db
        .select()
        .from(socialGoals)
        .where(eq(socialGoals.socialProfileId, profile.id))
        .limit(1);

      res.json({
        profile,
        accounts,
        goals,
        hasProfile: true,
      });
    } catch (error: any) {
      console.error('[Social] Error fetching profile:', error);
      res.status(500).json({ message: 'Failed to fetch social profile', error: error.message });
    }
  });

  // Create/initialize social profile for user
  app.post('/api/social/profile/init', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined;

      // Check if profile already exists
      const [existingProfile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (existingProfile) {
        // If profile exists but no GetLate profile ID, create one
        if (!existingProfile.getLateProfileId && getLateService.isConfigured()) {
          try {
            const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
            await db
              .update(socialProfiles)
              .set({ getLateProfileId: getLateProfile._id })
              .where(eq(socialProfiles.id, existingProfile.id));
            
            const updatedProfile = { ...existingProfile, getLateProfileId: getLateProfile._id };
            return res.json({ profile: updatedProfile, created: false, getLateCreated: true });
          } catch (error: any) {
            console.error('[Social] Failed to create GetLate profile:', error);
          }
        }
        return res.json({ profile: existingProfile, created: false });
      }

      // Create profile in GetLate.dev
      let getLateProfileId: string | null = null;
      if (getLateService.isConfigured()) {
        try {
          const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
          getLateProfileId = getLateProfile._id;
          console.log(`[Social] Created GetLate profile: ${getLateProfileId}`);
        } catch (error: any) {
          console.error('[Social] Failed to create GetLate profile:', error);
          // Continue without GetLate - can be linked later
        }
      }

      // Create profile in our database
      const [newProfile] = await db
        .insert(socialProfiles)
        .values({
          userId,
          getLateProfileId,
          isActive: true,
        })
        .returning();

      res.json({ profile: newProfile, created: true });
    } catch (error: any) {
      console.error('[Social] Error creating profile:', error);
      res.status(500).json({ message: 'Failed to create social profile', error: error.message });
    }
  });

  // DEPRECATED: Legacy endpoint - returns error directing to secure flow
  // Use /api/social/accounts/connect instead for secure OAuth with nonce protection
  app.post('/api/social/connect-url', requireJWT, requireSocialPoster, async (req: any, res) => {
    return res.status(410).json({ 
      message: 'This endpoint has been deprecated. Please use the Connect button in the dashboard.',
      redirect: '/social/connect'
    });
  });

  // Sync connected accounts from GetLate
  app.post('/api/social/sync-accounts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      if (!getLateService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // Get user's social profile
      let [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Auto-link GetLate profile if missing
      if (!profile.getLateProfileId) {
        const user = await storage.getUser(userId);
        const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined;
        const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
        
        await db
          .update(socialProfiles)
          .set({ getLateProfileId: getLateProfile._id })
          .where(eq(socialProfiles.id, profile.id));
        
        profile = { ...profile, getLateProfileId: getLateProfile._id };
        console.log(`[Social] Auto-linked GetLate profile during sync: ${getLateProfile._id}`);
      }

      // Get accounts from GetLate
      const getLateProfileId = profile.getLateProfileId || undefined;
      const { accounts: getLateAccounts } = await getLateService.getAccounts(getLateProfileId);
      console.log(`[Social] GetLate returned ${getLateAccounts?.length || 0} accounts:`, JSON.stringify(getLateAccounts, null, 2));
      const syncedAccounts: any[] = [];

      // Process each account from GetLate
      for (const account of getLateAccounts) {
        const dailyCap = PLATFORM_DAILY_CAPS[account.platform] || 25;
        
        // Map GetLate platform name to frontend platform name (e.g., "twitter" -> "x")
        const frontendPlatform = mapToFrontendPlatform(account.platform);
        
        // Always treat accounts from GetLate as connected - if they weren't connected,
        // GetLate wouldn't return them in the accounts list. The isActive field from GetLate
        // might indicate other states (like rate limiting) but not connection status.
        const isConnected = true;
        console.log(`[Social] Processing account: GetLate platform=${account.platform} -> frontend platform=${frontendPlatform}, getLateIsActive: ${account.isActive}, marking as connected`);

        // Upsert account - use frontend platform name for storage
        const [syncedAccount] = await db
          .insert(socialAccounts)
          .values({
            socialProfileId: profile.id,
            platform: frontendPlatform,  // Use frontend platform name (e.g., "x" not "twitter")
            platformUsername: account.username || null,
            platformDisplayName: account.displayName || null,
            platformImageUrl: account.profileImageUrl || null,
            isConnected,
            dailyCap,
            metadata: { getLateAccountId: account._id, getLatePlatform: account.platform },
          })
          .onConflictDoUpdate({
            target: [socialAccounts.socialProfileId, socialAccounts.platform],
            set: {
              platformUsername: account.username || null,
              platformDisplayName: account.displayName || null,
              platformImageUrl: account.profileImageUrl || null,
              isConnected,
              metadata: { getLateAccountId: account._id, getLatePlatform: account.platform },
              updatedAt: new Date(),
            },
          })
          .returning();

        syncedAccounts.push(syncedAccount);
      }

      // Update connected accounts count
      await db
        .update(socialProfiles)
        .set({
          connectedAccountsCount: syncedAccounts.length,
          lastSyncAt: new Date(),
        })
        .where(eq(socialProfiles.id, profile.id));

      res.json({
        synced: true,
        accounts: syncedAccounts,
        accountCount: syncedAccounts.length,
      });
    } catch (error: any) {
      console.error('[Social] Error syncing accounts:', error);
      res.status(500).json({ message: 'Failed to sync accounts', error: error.message });
    }
  });

  // Get connected accounts
  app.get('/api/social/accounts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json([]);
      }

      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.isConnected, true)
        ));

      // Map to frontend expected format
      // Normalize legacy "twitter" platform to "x" (Twitter rebranded to X)
      // Use a Map to deduplicate - if both twitter and x exist, keep x
      const accountsMap = new Map<string, typeof accounts[0]>();
      for (const acc of accounts) {
        const normalizedPlatform = acc.platform === 'twitter' ? 'x' : acc.platform;
        // If we already have this platform, prefer the one that's not legacy "twitter"
        if (!accountsMap.has(normalizedPlatform) || acc.platform === 'x') {
          accountsMap.set(normalizedPlatform, acc);
        }
      }

      const mappedAccounts = Array.from(accountsMap.values()).map(acc => ({
        id: acc.id,
        platform: acc.platform === 'twitter' ? 'x' : acc.platform, // Normalize to "x"
        platformAccountId: acc.platformUsername || '',
        accountUsername: acc.platformUsername || acc.platformDisplayName || '',
        connected: acc.isConnected,
        postsToday: acc.postsToday || 0,
        dailyLimit: acc.dailyCap || 3,
      }));

      res.json(mappedAccounts);
    } catch (error: any) {
      console.error('[Social] Error fetching accounts:', error);
      res.status(500).json({ message: 'Failed to fetch accounts', error: error.message });
    }
  });

  // Connect a social account (gets OAuth authUrl from GetLate with redirect back to our app)
  app.post('/api/social/accounts/connect', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { platform } = req.body;

      if (!platform) {
        return res.status(400).json({ message: 'Platform is required' });
      }

      if (!getLateService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      let [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      // Auto-create profile if needed
      if (!profile) {
        const user = await storage.getUser(userId);
        const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined;
        const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
        
        const [newProfile] = await db
          .insert(socialProfiles)
          .values({
            userId,
            getLateProfileId: getLateProfile._id,
            isActive: true,
          })
          .returning();
        profile = newProfile;
        console.log(`[Social] Auto-created profile with GetLate ID: ${getLateProfile._id}`);
      }

      // Auto-link GetLate profile if missing
      if (!profile.getLateProfileId) {
        const user = await storage.getUser(userId);
        const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined;
        const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
        
        await db
          .update(socialProfiles)
          .set({ getLateProfileId: getLateProfile._id })
          .where(eq(socialProfiles.id, profile.id));
        
        profile = { ...profile, getLateProfileId: getLateProfile._id };
        console.log(`[Social] Auto-linked GetLate profile: ${getLateProfile._id}`);
      }

      // Map frontend platform ID to GetLate API platform ID (e.g., "x" -> "twitter")
      const getLatePlatform = mapToGetLatePlatform(platform);
      console.log(`[Social] Mapping platform: ${platform} -> ${getLatePlatform}`);
      
      // Build the callback URL that GetLate will redirect to after OAuth
      const artivioBaseUrl = process.env.PRODUCTION_URL || 'https://artivio.replit.app';
      const callbackUrl = `${artivioBaseUrl}/social/oauth-callback?platform=${platform}&success=true`;
      
      // Call GetLate's /v1/connect/{platform} endpoint with redirect_url
      // This returns an authUrl that we redirect the user to
      const authUrl = await getLateService.getConnectUrl(
        profile.getLateProfileId!,
        getLatePlatform,
        callbackUrl
      );

      console.log(`[Social] Got authUrl for ${getLatePlatform}, will redirect to ${callbackUrl} after OAuth`);

      // Validate the authUrl is from an allowed OAuth domain
      if (!isAllowedOAuthDomain(authUrl)) {
        console.error(`[Social] Invalid OAuth URL domain: ${authUrl}`);
        return res.status(500).json({ message: 'Invalid OAuth URL received' });
      }

      // Generate a secure nonce for this connection attempt
      const nonce = generateNonce();
      const connectionId = `conn_${Date.now()}_${nonce.substring(0, 8)}`;
      
      // Store connection attempt for verification
      pendingInvites.set(connectionId, {
        url: authUrl,
        platform,
        userId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        createdAt: new Date(),
        consumed: false,
        nonce,
      });

      res.json({
        authUrl, // Direct OAuth URL from GetLate - redirect user here
        connectionId,
        platform,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    } catch (error: any) {
      console.error('[Social] Error generating connect URL:', error);
      res.status(500).json({ message: 'Failed to generate connect URL', error: error.message });
    }
  });

  // Secure endpoint to get OAuth URL - prevents URL from being exposed in frontend code
  // This is called by the proxy page to get the actual redirect URL server-side
  app.get('/api/social/oauth-url/:inviteId', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { inviteId } = req.params;
      const { nonce } = req.query;

      // Look up the pending invite
      const invite = pendingInvites.get(inviteId);

      if (!invite) {
        return res.status(404).json({ 
          message: 'Invite not found or expired. Please try connecting again.' 
        });
      }

      // Verify nonce matches (prevents replay attacks)
      if (!nonce || invite.nonce !== nonce) {
        console.warn(`[Social] Invalid nonce for invite ${inviteId}`);
        return res.status(403).json({ 
          message: 'Invalid invite token. Please try connecting again.' 
        });
      }

      // Verify the invite belongs to this user
      if (invite.userId !== userId) {
        console.warn(`[Social] User ${userId} tried to access invite belonging to ${invite.userId}`);
        return res.status(403).json({ 
          message: 'Not authorized to use this invite' 
        });
      }

      // Check if already consumed (single-use)
      if (invite.consumed) {
        return res.status(410).json({ 
          message: 'This invite has already been used. Please try connecting again.' 
        });
      }

      // Check if expired
      if (invite.expiresAt < new Date()) {
        pendingInvites.delete(inviteId);
        return res.status(410).json({ 
          message: 'Invite has expired. Please try connecting again.' 
        });
      }

      // Mark as consumed and delete immediately to prevent race conditions
      invite.consumed = true;
      const authUrl = invite.url;
      const invitePlatform = invite.platform;
      
      // Delete immediately after capturing the URL
      pendingInvites.delete(inviteId);

      // Return the actual OAuth URL
      res.json({
        authUrl,
        platform: invitePlatform,
      });
    } catch (error: any) {
      console.error('[Social] Error fetching OAuth URL:', error);
      res.status(500).json({ message: 'Failed to get authorization URL', error: error.message });
    }
  });

  // Connect Bluesky with credentials (handle/email + app password)
  // Bluesky uses a special credentials endpoint instead of OAuth
  app.post('/api/social/accounts/connect-bluesky', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { identifier, appPassword } = req.body;

      console.log(`[Social] Bluesky connection request for user ${userId}`);
      console.log(`[Social] Identifier: ${identifier}`);

      if (!identifier || !appPassword) {
        return res.status(400).json({ message: 'Handle/email and app password are required' });
      }

      if (!getLateService.isConfigured()) {
        return res.status(503).json({ message: 'Social media posting service not configured' });
      }

      // Get or create social profile
      let [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        // Create profile - will get GetLate profile linked below
        const [newProfile] = await db
          .insert(socialProfiles)
          .values({ userId, isActive: true })
          .returning();
        profile = newProfile;
      }

      // Ensure GetLate profile exists
      if (!profile.getLateProfileId) {
        const user = await storage.getUser(userId);
        const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : undefined;
        const getLateProfile = await getLateService.ensureUserProfile(userId, userName);
        
        await db
          .update(socialProfiles)
          .set({ getLateProfileId: getLateProfile._id })
          .where(eq(socialProfiles.id, profile.id));
        
        profile = { ...profile, getLateProfileId: getLateProfile._id };
        console.log(`[Social] Auto-linked GetLate profile for Bluesky: ${getLateProfile._id}`);
      }

      // Build redirect URI
      const artivioBaseUrl = process.env.PRODUCTION_URL || 'https://artivio.replit.app';
      const redirectUri = `${artivioBaseUrl}/social/oauth-callback?platform=bluesky&success=true`;

      // Call GetLate's special Bluesky credentials endpoint
      // State format per GetLate docs: "{userId}_{profileId}"
      const result = await getLateService.connectBlueskyWithCredentials(
        userId,
        profile.getLateProfileId!,
        identifier,
        appPassword,
        redirectUri
      );

      console.log(`[Social] Bluesky connection result:`, result);

      // Trigger a sync to update local database with the new account
      try {
        const { accounts: getLateAccounts } = await getLateService.getAccounts(profile.getLateProfileId || undefined);
        const blueskyAccount = getLateAccounts.find(a => a.platform === 'bluesky');
        
        if (blueskyAccount) {
          const dailyCap = PLATFORM_DAILY_CAPS['bluesky'] || 50;
          const frontendPlatform = mapToFrontendPlatform('bluesky');
          
          // Upsert the Bluesky account
          await db
            .insert(socialAccounts)
            .values({
              socialProfileId: profile.id,
              platform: frontendPlatform,
              platformUsername: blueskyAccount.username || null,
              platformDisplayName: blueskyAccount.displayName || null,
              platformImageUrl: blueskyAccount.profileImageUrl || null,
              isConnected: true,
              dailyCap,
              metadata: { getLateAccountId: blueskyAccount._id, getLatePlatform: 'bluesky' },
            })
            .onConflictDoUpdate({
              target: [socialAccounts.socialProfileId, socialAccounts.platform],
              set: {
                platformUsername: blueskyAccount.username || null,
                platformDisplayName: blueskyAccount.displayName || null,
                platformImageUrl: blueskyAccount.profileImageUrl || null,
                isConnected: true,
                metadata: { getLateAccountId: blueskyAccount._id, getLatePlatform: 'bluesky' },
                updatedAt: new Date(),
              },
            });
          
          // Update connected count
          const connectedCount = await db
            .select()
            .from(socialAccounts)
            .where(and(
              eq(socialAccounts.socialProfileId, profile.id),
              eq(socialAccounts.isConnected, true)
            ));
          
          await db
            .update(socialProfiles)
            .set({
              connectedAccountsCount: connectedCount.length,
              lastSyncAt: new Date(),
            })
            .where(eq(socialProfiles.id, profile.id));
        }
      } catch (syncError: any) {
        console.warn(`[Social] Bluesky sync warning: ${syncError.message}`);
        // Don't fail the connection if sync fails
      }

      res.json({
        success: true,
        message: result.message || 'Bluesky connected successfully',
      });
    } catch (error: any) {
      console.error('[Social] Error connecting Bluesky:', error);
      res.status(500).json({ 
        message: 'Failed to connect Bluesky', 
        error: error.message 
      });
    }
  });

  // Disconnect a social account
  app.delete('/api/social/accounts/:accountId', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { accountId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Verify account belongs to user's profile
      const [account] = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.id, accountId),
          eq(socialAccounts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }

      // First, disconnect from GetLate API if we have the GetLate account ID
      const getLateAccountId = (account.metadata as any)?.getLateAccountId;
      if (getLateAccountId && getLateService.isConfigured()) {
        try {
          await getLateService.disconnectAccount(getLateAccountId);
          console.log(`[Social] Successfully disconnected account from GetLate: ${getLateAccountId}`);
        } catch (getLateError: any) {
          // Log but don't fail - the account might already be disconnected on GetLate's side
          console.warn(`[Social] GetLate disconnect warning: ${getLateError.message}`);
        }
      }

      // Mark as disconnected in local DB (we keep the record for history)
      await db
        .update(socialAccounts)
        .set({
          isConnected: false,
          updatedAt: new Date(),
        })
        .where(eq(socialAccounts.id, accountId));

      // Update connected count
      await db
        .update(socialProfiles)
        .set({
          connectedAccountsCount: Math.max(0, profile.connectedAccountsCount - 1),
        })
        .where(eq(socialProfiles.id, profile.id));

      res.json({ disconnected: true });
    } catch (error: any) {
      console.error('[Social] Error disconnecting account:', error);
      res.status(500).json({ message: 'Failed to disconnect account', error: error.message });
    }
  });

  // =====================================================
  // GOALS / AI STRATEGY
  // =====================================================

  // Get or create goals
  app.get('/api/social/goals', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json([]);
      }

      const goals = await db
        .select()
        .from(socialGoals)
        .where(eq(socialGoals.socialProfileId, profile.id))
        .orderBy(desc(socialGoals.createdAt));

      // Map to frontend expected format
      const mappedGoals = goals.map(goal => ({
        id: goal.id,
        goal: goal.primaryGoal,
        platforms: goal.preferredPlatforms || [],
        duration: '1week',
        businessDescription: goal.targetAudience || '',
        targetAudience: goal.targetAudience || '',
        aiGeneratedPlan: null,
        status: goal.isActive ? 'active' : 'paused',
        createdAt: goal.createdAt?.toISOString() || new Date().toISOString(),
      }));

      res.json(mappedGoals);
    } catch (error: any) {
      console.error('[Social] Error fetching goals:', error);
      res.status(500).json({ message: 'Failed to fetch goals', error: error.message });
    }
  });

  // Create or update goals
  app.post('/api/social/goals', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Map frontend field names to backend field names
      // Frontend sends: goal, platforms, duration, businessDescription, targetAudience
      // Backend expects: primaryGoal, preferredPlatforms, postingFrequency, brandTopics, targetAudience
      const goalData = {
        socialProfileId: profile.id,
        primaryGoal: req.body.primaryGoal || req.body.goal, // Accept both field names
        postingFrequency: req.body.postingFrequency || req.body.duration || 'daily',
        brandTopics: req.body.brandTopics || (req.body.businessDescription ? [req.body.businessDescription] : []),
        targetAudience: req.body.targetAudience || null,
        brandVoice: req.body.brandVoice || 'professional',
        preferredPlatforms: req.body.preferredPlatforms || req.body.platforms || [],
        websiteUrl: req.body.websiteUrl || null,
        isActive: true,
      };
      
      // Validate required fields
      if (!goalData.primaryGoal) {
        return res.status(400).json({ message: 'Primary goal is required' });
      }

      // Check if goals exist
      const [existingGoals] = await db
        .select()
        .from(socialGoals)
        .where(eq(socialGoals.socialProfileId, profile.id))
        .limit(1);

      let goals;
      if (existingGoals) {
        [goals] = await db
          .update(socialGoals)
          .set({
            ...goalData,
            updatedAt: new Date(),
          })
          .where(eq(socialGoals.id, existingGoals.id))
          .returning();
      } else {
        [goals] = await db
          .insert(socialGoals)
          .values(goalData)
          .returning();
      }

      res.json({ goals, created: !existingGoals });
    } catch (error: any) {
      console.error('[Social] Error saving goals:', error);
      res.status(500).json({ message: 'Failed to save goals', error: error.message });
    }
  });

  // =====================================================
  // POSTS / SCHEDULING
  // =====================================================

  // Get all posts (with optional filters)
  app.get('/api/social/posts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { status, startDate, endDate, limit = 50 } = req.query;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json([]);
      }

      let query = db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.socialProfileId, profile.id))
        .orderBy(desc(socialPosts.scheduledAt))
        .limit(Number(limit));

      const posts = await query;

      // Filter in memory for now (can optimize with proper query builder later)
      let filteredPosts = posts;
      if (status) {
        filteredPosts = filteredPosts.filter(p => p.status === status);
      }
      if (startDate) {
        const start = new Date(startDate as string);
        filteredPosts = filteredPosts.filter(p => p.scheduledAt && p.scheduledAt >= start);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        filteredPosts = filteredPosts.filter(p => p.scheduledAt && p.scheduledAt <= end);
      }

      // Map to frontend expected format
      const mappedPosts = filteredPosts.map(post => ({
        id: post.id,
        platform: (post.platforms as string[])?.[0] || 'unknown',
        platforms: post.platforms || [],
        caption: post.title || '',
        hashtags: post.hashtags || [],
        mediaType: post.mediaType || 'text',
        mediaUrl: post.mediaUrl || undefined,
        scheduledFor: post.scheduledAt?.toISOString() || new Date().toISOString(),
        status: post.status,
        aiGenerated: post.aiGenerated || false,
        // New fields for enhanced content types
        contentType: post.contentType || post.postType || 'post',
        mediaItems: post.mediaItems || null,
        platformSpecificData: post.platformSpecificData || null,
        // AI Media Generation fields
        imagePrompt: post.imagePrompt || null,
        videoPrompt: post.videoPrompt || null,
        mediaMode: post.mediaMode || null,
        mediaGenerationStatus: post.mediaGenerationStatus || null,
      }));

      // Debug: Log first few posts with dates
      if (mappedPosts.length > 0) {
        console.log(`[Social Posts] Returning ${mappedPosts.length} posts, first 5:`, mappedPosts.slice(0, 5).map(p => ({
          id: p.id.slice(0, 8),
          scheduledFor: p.scheduledFor,
          status: p.status,
          aiGenerated: p.aiGenerated
        })));
      }

      res.json(mappedPosts);
    } catch (error: any) {
      console.error('[Social] Error fetching posts:', error);
      res.status(500).json({ message: 'Failed to fetch posts', error: error.message });
    }
  });

  // Create a new post
  app.post('/api/social/posts', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const postData = {
        socialProfileId: profile.id,
        postType: req.body.postType || 'text',
        platforms: req.body.platforms || [],
        title: req.body.title,
        description: req.body.description || null,
        platformTitles: req.body.platformTitles || null,
        mediaUrl: req.body.mediaUrl || null,
        mediaType: req.body.mediaType || null,
        thumbnailUrl: req.body.thumbnailUrl || null,
        hashtags: req.body.hashtags || [],
        firstComment: req.body.firstComment || null,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        status: req.body.scheduledAt ? 'scheduled' : 'draft',
        aiGenerated: req.body.aiGenerated || false,
        aiPromptUsed: req.body.aiPromptUsed || null,
        generationId: req.body.generationId || null,
        // New fields for enhanced content types
        contentType: req.body.contentType || null,
        mediaItems: req.body.mediaItems || null,
        platformSpecificData: req.body.platformSpecificData || null,
      };

      const [post] = await db
        .insert(socialPosts)
        .values(postData)
        .returning();

      res.json({ post });
    } catch (error: any) {
      console.error('[Social] Error creating post:', error);
      res.status(500).json({ message: 'Failed to create post', error: error.message });
    }
  });

  // Update a post
  app.patch('/api/social/posts/:postId', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Verify post belongs to user
      const [existingPost] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.platformTitles !== undefined) updateData.platformTitles = req.body.platformTitles;
      if (req.body.hashtags !== undefined) updateData.hashtags = req.body.hashtags;
      if (req.body.firstComment !== undefined) updateData.firstComment = req.body.firstComment;
      if (req.body.scheduledAt !== undefined) updateData.scheduledAt = new Date(req.body.scheduledAt);
      if (req.body.status !== undefined) updateData.status = req.body.status;

      const [updatedPost] = await db
        .update(socialPosts)
        .set(updateData)
        .where(eq(socialPosts.id, postId))
        .returning();

      res.json({ post: updatedPost });
    } catch (error: any) {
      console.error('[Social] Error updating post:', error);
      res.status(500).json({ message: 'Failed to update post', error: error.message });
    }
  });

  // Bulk delete posts - MUST be before /:postId route to avoid matching "bulk" as a postId
  app.delete('/api/social/posts/bulk', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { mode, startDate, endDate } = req.query;

      // Validate mode
      if (!mode || !['all', 'week'].includes(mode as string)) {
        return res.status(400).json({ message: 'Invalid mode. Must be "all" or "week"' });
      }

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      let postsToDelete: any[] = [];

      if (mode === 'all') {
        // Delete all posts
        postsToDelete = await db
          .select()
          .from(socialPosts)
          .where(eq(socialPosts.socialProfileId, profile.id));
        console.log(`[Social] Bulk delete all: found ${postsToDelete.length} posts for profile ${profile.id}`);
      } else if (mode === 'week') {
        // Validate date inputs
        if (!startDate || !endDate) {
          return res.status(400).json({ message: 'startDate and endDate required for week mode' });
        }
        
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        
        // Validate parsed dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
        }
        
        // Set start to beginning of day and end to end of day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        console.log(`[Social] Bulk delete week: searching ${start.toISOString()} to ${end.toISOString()}`);

        postsToDelete = await db
          .select()
          .from(socialPosts)
          .where(and(
            eq(socialPosts.socialProfileId, profile.id),
            gte(socialPosts.scheduledAt, start),
            lte(socialPosts.scheduledAt, end)
          ));
        console.log(`[Social] Bulk delete week: found ${postsToDelete.length} posts`);
      } else {
        return res.status(400).json({ message: 'Invalid mode or missing date range' });
      }

      if (postsToDelete.length === 0) {
        return res.json({ deleted: 0, message: 'No posts to delete' });
      }

      // Cancel scheduled posts in GetLate
      for (const post of postsToDelete) {
        if (post.getLatePostId && post.status === 'scheduled') {
          try {
            await getLateService.deletePost(post.getLatePostId);
          } catch (error) {
            console.error('[Social] Failed to cancel GetLate post:', post.id, error);
          }
        }
      }

      // Delete all posts
      const postIds = postsToDelete.map(p => p.id);
      await db
        .delete(socialPosts)
        .where(inArray(socialPosts.id, postIds));

      console.log(`[Social] Bulk deleted ${postIds.length} posts for user ${userId}`);
      res.json({ deleted: postIds.length });
    } catch (error: any) {
      console.error('[Social] Error bulk deleting posts:', error);
      res.status(500).json({ message: 'Failed to bulk delete posts', error: error.message });
    }
  });

  // Delete a post
  app.delete('/api/social/posts/:postId', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Verify post belongs to user
      const [existingPost] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!existingPost) {
        return res.status(404).json({ message: 'Post not found' });
      }

      // If post is scheduled in GetLate, cancel it
      if (existingPost.getLatePostId && existingPost.status === 'scheduled') {
        try {
          await getLateService.deletePost(existingPost.getLatePostId);
        } catch (error) {
          console.error('[Social] Failed to cancel GetLate post:', error);
        }
      }

      await db
        .delete(socialPosts)
        .where(eq(socialPosts.id, postId));

      res.json({ deleted: true });
    } catch (error: any) {
      console.error('[Social] Error deleting post:', error);
      res.status(500).json({ message: 'Failed to delete post', error: error.message });
    }
  });

  // Schedule a post (sends to GetLate)
  app.post('/api/social/posts/:postId/schedule', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!getLateService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      if (!profile.getLateProfileId) {
        return res.status(400).json({ message: 'GetLate profile not linked' });
      }

      // Get post
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      if (!post.scheduledAt) {
        return res.status(400).json({ message: 'Post must have a scheduled date' });
      }

      // Get connected accounts to find account IDs for each platform
      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.isConnected, true)
        ));

      // Build platforms array for GetLate
      const platformsForPost = (post.platforms as string[]).map(platform => {
        const account = accounts.find(a => a.platform === platform);
        const accountMetadata = account?.metadata as { getLateAccountId?: string } | null;
        return {
          platform: platform as SocialPlatform,
          accountId: accountMetadata?.getLateAccountId || '',
        };
      }).filter(p => p.accountId);

      if (platformsForPost.length === 0) {
        return res.status(400).json({ message: 'No connected accounts found for selected platforms' });
      }

      // Create post in GetLate
      const getLatePost = await getLateService.createPost({
        content: post.title + (post.description ? '\n\n' + post.description : ''),
        scheduledFor: post.scheduledAt.toISOString(),
        timezone: 'UTC',
        platforms: platformsForPost,
        mediaItems: post.mediaUrl ? [{
          type: post.postType === 'video' ? 'video' : 'image',
          url: post.mediaUrl,
        }] : undefined,
        queuedFromProfile: profile.getLateProfileId || undefined,
      });

      // Update post with GetLate ID
      const [updatedPost] = await db
        .update(socialPosts)
        .set({
          getLatePostId: getLatePost._id,
          status: 'scheduled',
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, postId))
        .returning();

      res.json({ post: updatedPost, getLatePost });
    } catch (error: any) {
      console.error('[Social] Error scheduling post:', error);
      res.status(500).json({ message: 'Failed to schedule post', error: error.message });
    }
  });

  // Publish a post immediately
  app.post('/api/social/posts/:postId/publish', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { postId } = req.params;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!getLateService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      if (!profile.getLateProfileId) {
        return res.status(400).json({ message: 'GetLate profile not linked' });
      }

      // Get post
      const [post] = await db
        .select()
        .from(socialPosts)
        .where(and(
          eq(socialPosts.id, postId),
          eq(socialPosts.socialProfileId, profile.id)
        ))
        .limit(1);

      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }

      // Get connected accounts to find account IDs for each platform
      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.isConnected, true)
        ));

      // Build platforms array for GetLate
      const platformsForPost = (post.platforms as string[]).map(platform => {
        const account = accounts.find(a => a.platform === platform);
        const accountMetadata = account?.metadata as { getLateAccountId?: string } | null;
        return {
          platform: platform as SocialPlatform,
          accountId: accountMetadata?.getLateAccountId || '',
        };
      }).filter(p => p.accountId);

      if (platformsForPost.length === 0) {
        return res.status(400).json({ message: 'No connected accounts found for selected platforms' });
      }

      // Create post in GetLate with publishNow flag
      const getLatePost = await getLateService.createPost({
        content: post.title + (post.description ? '\n\n' + post.description : ''),
        publishNow: true,
        platforms: platformsForPost,
        mediaItems: post.mediaUrl ? [{
          type: post.postType === 'video' ? 'video' : 'image',
          url: post.mediaUrl,
        }] : undefined,
        queuedFromProfile: profile.getLateProfileId || undefined,
      });

      // Update post status
      const [updatedPost] = await db
        .update(socialPosts)
        .set({
          getLatePostId: getLatePost._id,
          status: 'publishing',
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, postId))
        .returning();

      res.json({ post: updatedPost, getLatePost });
    } catch (error: any) {
      console.error('[Social] Error publishing post:', error);
      res.status(500).json({ message: 'Failed to publish post', error: error.message });
    }
  });

  // =====================================================
  // ANALYTICS
  // =====================================================

  // Get analytics summary
  app.get('/api/social/analytics', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { timeRange = '7days', platform } = req.query;
      
      const validTimeRanges = ['7days', '30days', '90days'];
      const normalizedTimeRange = validTimeRanges.includes(timeRange) ? timeRange as '7days' | '30days' | '90days' : '7days';

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json(null);
      }

      const { socialAnalyticsService } = await import('./services/socialAnalyticsService');
      const analytics = await socialAnalyticsService.getAnalytics(
        profile.id,
        normalizedTimeRange,
        platform as string | undefined
      );

      const connectedAccounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.isConnected, true)
        ));

      const connectedPlatforms = connectedAccounts.map(a => a.platform?.toLowerCase()).filter(Boolean);

      const overall = {
        totalFollowers: 0,
        totalImpressions: 0,
        avgEngagement: analytics.overall.successRate,
        postsPublished: analytics.overall.publishedPosts,
        totalPosts: analytics.overall.totalPosts,
        scheduledPosts: analytics.overall.scheduledPosts,
        failedPosts: analytics.overall.failedPosts,
        successRate: analytics.overall.successRate,
        aiGeneratedRatio: analytics.overall.aiGeneratedRatio,
        platformCount: analytics.overall.platformCount,
        avgPostsPerDay: analytics.overall.avgPostsPerDay,
      };

      const platforms = analytics.platforms
        .filter(p => connectedPlatforms.includes(p.platform))
        .map(p => ({
          platform: p.platform,
          followers: 0,
          followersChange: 0,
          impressions: 0,
          impressionsChange: 0,
          engagement: p.successRate,
          engagementChange: 0,
          postsThisWeek: p.postsPublished,
          postsTotal: p.postsTotal,
          postsScheduled: p.postsScheduled,
          postsFailed: p.postsFailed,
          successRate: p.successRate,
          aiGeneratedCount: p.aiGeneratedCount,
          manualCount: p.manualCount,
          avgPostsPerDay: p.avgPostsPerDay,
          contentTypes: p.contentTypes,
          lastPostDate: p.lastPostDate,
        }));

      const allPlatformsWithData = [...platforms];
      for (const platform of connectedPlatforms) {
        if (!allPlatformsWithData.find(p => p.platform === platform)) {
          allPlatformsWithData.push({
            platform: platform as string,
            followers: 0,
            followersChange: 0,
            impressions: 0,
            impressionsChange: 0,
            engagement: 0,
            engagementChange: 0,
            postsThisWeek: 0,
            postsTotal: 0,
            postsScheduled: 0,
            postsFailed: 0,
            successRate: 0,
            aiGeneratedCount: 0,
            manualCount: 0,
            avgPostsPerDay: 0,
            contentTypes: {},
            lastPostDate: null,
          });
        }
      }

      res.json({
        overall,
        platforms: allPlatformsWithData,
        timeline: analytics.timeline,
        topContentTypes: analytics.topContentTypes,
        bestPostingTimes: analytics.bestPostingTimes,
        connectedPlatforms,
        timeRange: normalizedTimeRange,
      });
    } catch (error: any) {
      console.error('[Social] Error fetching analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
    }
  });

  // Sync analytics from GetLate (placeholder - GetLate analytics API TBD)
  app.post('/api/social/analytics/sync', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      if (!getLateService.isConfigured()) {
        return res.status(503).json({ message: 'Social media integration is not configured' });
      }

      // GetLate analytics API is not yet available - return empty for now
      res.json({
        synced: true,
        analytics: {},
        message: 'Analytics sync coming soon',
      });
    } catch (error: any) {
      console.error('[Social] Error syncing analytics:', error);
      res.status(500).json({ message: 'Failed to sync analytics', error: error.message });
    }
  });

  // =====================================================
  // PLATFORM INFO
  // =====================================================

  // Get platform daily caps
  app.get('/api/social/platform-caps', requireJWT, requireSocialPoster, async (req: any, res) => {
    res.json({ caps: PLATFORM_DAILY_CAPS });
  });

  // Get Facebook pages for user (placeholder - handled by GetLate connect flow)
  app.get('/api/social/facebook/pages', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      // GetLate handles Facebook page selection during the OAuth connect flow
      // Return connected Facebook account info from our database
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ pages: [] });
      }

      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.platform, 'facebook'),
          eq(socialAccounts.isConnected, true)
        ));

      res.json({ 
        pages: accounts.map(a => ({
          id: a.id,
          name: a.platformDisplayName || a.platformUsername,
          connected: a.isConnected,
        }))
      });
    } catch (error: any) {
      console.error('[Social] Error fetching Facebook pages:', error);
      res.status(500).json({ message: 'Failed to fetch Facebook pages', error: error.message });
    }
  });

  // Get LinkedIn pages for user (placeholder - handled by GetLate connect flow)
  app.get('/api/social/linkedin/pages', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ pages: [] });
      }

      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.platform, 'linkedin'),
          eq(socialAccounts.isConnected, true)
        ));

      res.json({ 
        pages: accounts.map(a => ({
          id: a.id,
          name: a.platformDisplayName || a.platformUsername,
          connected: a.isConnected,
        }))
      });
    } catch (error: any) {
      console.error('[Social] Error fetching LinkedIn pages:', error);
      res.status(500).json({ message: 'Failed to fetch LinkedIn pages', error: error.message });
    }
  });

  // Get Pinterest boards for user (placeholder - handled by GetLate connect flow)
  app.get('/api/social/pinterest/boards', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ boards: [] });
      }

      const accounts = await db
        .select()
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.socialProfileId, profile.id),
          eq(socialAccounts.platform, 'pinterest'),
          eq(socialAccounts.isConnected, true)
        ));

      res.json({ 
        boards: accounts.map(a => ({
          id: a.id,
          name: a.platformDisplayName || a.platformUsername,
          connected: a.isConnected,
        }))
      });
    } catch (error: any) {
      console.error('[Social] Error fetching Pinterest boards:', error);
      res.status(500).json({ message: 'Failed to fetch Pinterest boards', error: error.message });
    }
  });

  // Get scheduled posts from GetLate
  app.get('/api/social/scheduled', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ scheduledPosts: [] });
      }

      if (!getLateService.isConfigured() || !profile.getLateProfileId) {
        // Fall back to database posts
        const posts = await db
          .select()
          .from(socialPosts)
          .where(and(
            eq(socialPosts.socialProfileId, profile.id),
            eq(socialPosts.status, 'scheduled')
          ))
          .orderBy(desc(socialPosts.scheduledAt));

        return res.json({ scheduledPosts: posts });
      }

      // Get scheduled posts from GetLate
      const { posts } = await getLateService.getPosts({
        status: 'scheduled',
        profileId: profile.getLateProfileId,
      });

      res.json({ scheduledPosts: posts });
    } catch (error: any) {
      console.error('[Social] Error fetching scheduled posts:', error);
      res.status(500).json({ message: 'Failed to fetch scheduled posts', error: error.message });
    }
  });

  // Get post history from GetLate
  app.get('/api/social/history', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { page, limit } = req.query;

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.json({ posts: [], total: 0 });
      }

      if (!getLateService.isConfigured() || !profile.getLateProfileId) {
        // Fall back to database posts
        const posts = await db
          .select()
          .from(socialPosts)
          .where(eq(socialPosts.socialProfileId, profile.id))
          .orderBy(desc(socialPosts.createdAt))
          .limit(Number(limit) || 50);

        return res.json({ posts, total: posts.length });
      }

      const history = await getLateService.getPosts({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
        profileId: profile.getLateProfileId,
      });

      res.json(history);
    } catch (error: any) {
      console.error('[Social] Error fetching history:', error);
      res.status(500).json({ message: 'Failed to fetch history', error: error.message });
    }
  });

  // =====================================================
  // AI CONTENT GENERATION
  // =====================================================

  // Generate AI caption and hashtags for a post
  app.post('/api/social/ai/generate-caption', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { platform, contentType, topic, tone, targetAudience, includeEmoji, language } = req.body;

      if (!topic) {
        return res.status(400).json({ message: 'Topic is required for caption generation' });
      }

      // Platform-specific character limits and hashtag recommendations (verified official limits)
      const platformSpecs: Record<string, { charLimit: number; hashtagLimit: number; style: string }> = {
        instagram: { charLimit: 2200, hashtagLimit: 30, style: 'engaging, visual, story-driven' },
        tiktok: { charLimit: 2200, hashtagLimit: 5, style: 'trendy, casual, hook-driven' },
        linkedin: { charLimit: 3000, hashtagLimit: 5, style: 'professional, thought-leadership' },
        youtube: { charLimit: 5000, hashtagLimit: 15, style: 'searchable, detailed, informative' },
        facebook: { charLimit: 63206, hashtagLimit: 5, style: 'conversational, community-focused' },
        x: { charLimit: 280, hashtagLimit: 2, style: 'concise, punchy, trending' },
        threads: { charLimit: 500, hashtagLimit: 5, style: 'conversational, authentic' },
        pinterest: { charLimit: 500, hashtagLimit: 20, style: 'inspirational, searchable, descriptive' },
        bluesky: { charLimit: 300, hashtagLimit: 3, style: 'casual, authentic, community' },
      };

      const specs = platformSpecs[platform.toLowerCase()] || platformSpecs.instagram;

      const systemPrompt = `You are an expert social media content creator. Generate engaging content for ${platform} with these specifications:
- Character limit: ${specs.charLimit} characters (STRICTLY ENFORCE)
- Maximum hashtags: ${specs.hashtagLimit} (without the # symbol in your response)
- Style: ${specs.style}
- Tone: ${tone || 'professional'}
${targetAudience ? `- Target audience: ${targetAudience}` : ''}
${includeEmoji ? '- Include relevant emojis' : '- Minimal or no emojis'}
${language ? `- Language: ${language}` : '- Language: English'}

IMPORTANT: Return ONLY valid JSON without any markdown formatting, code fences, or extra text.
Response format:
{"caption": "caption text", "hashtags": ["tag1", "tag2"], "callToAction": "cta text", "contentTips": ["tip1", "tip2"]}`;

      const userPrompt = `Create a ${contentType || 'text'} post about: ${topic}`;

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      
      if (!OPENAI_API_KEY) {
        return res.status(503).json({ message: 'AI content generation is not configured' });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error('[Social AI] OpenAI API error:', response.status);
        return res.status(502).json({ message: 'AI service temporarily unavailable' });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return res.status(502).json({ message: 'AI service returned empty response' });
      }

      // Clean markdown fencing and parse JSON
      let cleanedContent = content.trim();
      // Remove markdown code fences (```json ... ``` or ``` ... ```)
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      
      try {
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Post-process to enforce platform limits
          let caption = String(parsed.caption || '').trim();
          let hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags : [];
          
          // Truncate caption to platform limit
          if (caption.length > specs.charLimit) {
            caption = caption.substring(0, specs.charLimit - 3) + '...';
          }
          
          // Limit hashtags and remove # if present
          hashtags = hashtags
            .slice(0, specs.hashtagLimit)
            .map((tag: string) => String(tag).replace(/^#/, '').trim())
            .filter((tag: string) => tag.length > 0);
          
          res.json({
            caption,
            hashtags,
            callToAction: String(parsed.callToAction || '').trim(),
            contentTips: Array.isArray(parsed.contentTips) ? parsed.contentTips : [],
            platform,
            enforced: { charLimit: specs.charLimit, hashtagLimit: specs.hashtagLimit },
          });
        } else {
          // Fallback: return truncated raw content as caption
          let caption = cleanedContent;
          if (caption.length > specs.charLimit) {
            caption = caption.substring(0, specs.charLimit - 3) + '...';
          }
          res.json({
            caption,
            hashtags: [],
            callToAction: '',
            contentTips: [],
            platform,
            enforced: { charLimit: specs.charLimit, hashtagLimit: specs.hashtagLimit },
          });
        }
      } catch (parseError) {
        console.error('[Social AI] JSON parse error');
        // Fallback with truncation
        let caption = cleanedContent;
        if (caption.length > specs.charLimit) {
          caption = caption.substring(0, specs.charLimit - 3) + '...';
        }
        res.json({
          caption,
          hashtags: [],
          callToAction: '',
          contentTips: [],
          platform,
          enforced: { charLimit: specs.charLimit, hashtagLimit: specs.hashtagLimit },
        });
      }
    } catch (error: any) {
      console.error('[Social AI] Caption generation error');
      res.status(500).json({ message: 'Failed to generate caption' });
    }
  });

  // Helper function to generate content plan for a batch of platforms
  async function generatePlanForPlatforms(
    platformBatch: string[], 
    durationDays: number, 
    goal: string, 
    businessDescription: string, 
    targetAudience: string,
    OPENAI_API_KEY: string,
    brandContext: string = '',
    automationLevel: 'manual' | 'ai_suggests' | 'semi_auto' | 'full_auto' = 'ai_suggests',
    featuredMediaTypes: string[] = ['text', 'image']
  ): Promise<{ posts: any[], strategy: string, weeklyThemes: string[], tips: string[] }> {
    // Build platform-specific configuration info for AI prompt
    const platformInfo = platformBatch.map((platform: string) => {
      const config = PLATFORM_CONFIGS[platform as PlatformType];
      const contentTypes = getContentTypes(platform as PlatformType);
      const optimalTimes = OPTIMAL_POSTING_TIMES[platform as PlatformType];
      const contentMix = CONTENT_MIX_RECOMMENDATIONS[platform as PlatformType];
      
      if (!config) return null;
      
      const validContentTypes = contentTypes.map(ct => ({
        id: ct.id,
        name: ct.name,
        description: ct.description,
        requiresMedia: ct.requiresMedia
      }));
      
      const timesInfo = Object.entries(optimalTimes)
        .filter(([_, times]) => (times as string[]).length > 0)
        .map(([type, times]) => `${type}: ${(times as string[]).join(', ')}`);
      
      const mixInfo = Object.entries(contentMix)
        .filter(([_, pct]) => (pct as number) > 0)
        .map(([type, pct]) => `${type}: ${pct}%`);
      
      return {
        platform,
        displayName: config.displayName,
        maxCharacters: config.maxCharacters,
        dailyLimit: config.dailyLimit,
        contentTypes: validContentTypes.map(ct => ct.id),
        contentTypeDetails: validContentTypes,
        optimalTimes: timesInfo,
        contentMix: mixInfo
      };
    }).filter(Boolean);

    const platformConfigText = platformInfo.map((p: any) => `
${p.displayName} (${p.platform}):
  - Content Types: ${p.contentTypes.join(', ')}
  - Character Limit: ${p.maxCharacters}
  - Daily Post Limit: ${p.dailyLimit}
  - Optimal Posting Times: ${p.optimalTimes.join('; ') || 'Flexible'}
  - Content Type Details:
${p.contentTypeDetails.map((ct: any) => `    * ${ct.id}: ${ct.description}${ct.requiresMedia ? ' (requires media)' : ''}`).join('\n')}`
    ).join('\n');

    // Limit posts per platform based on duration (1 post every 2-3 days per platform)
    const postsPerPlatform = Math.min(Math.ceil(durationDays / 2), 7);

    // Determine if we should generate media prompts based on automation level
    const includeMediaPrompts = automationLevel !== 'manual';
    const canGenerateImages = featuredMediaTypes.includes('image');
    const canGenerateVideos = featuredMediaTypes.includes('video');
    
    // Build media prompt instructions based on automation level
    let mediaPromptInstructions = '';
    if (automationLevel === 'manual') {
      mediaPromptInstructions = `
MEDIA MODE: Manual
- Do NOT include imagePrompt or videoPrompt fields
- User will create all media content themselves`;
    } else if (automationLevel === 'ai_suggests') {
      mediaPromptInstructions = `
MEDIA MODE: AI Suggests
- Include detailed "imagePrompt" for posts that need images${canGenerateImages ? ' (user can copy this to generate with AI tools)' : ''}
- Include detailed "videoPrompt" for posts that need videos${canGenerateVideos ? ' (user can copy this to generate with AI tools)' : ''}
- Make prompts specific and actionable (describe scene, style, mood, colors, text overlays)
- Consider platform aspect ratios: Instagram/TikTok (9:16), YouTube (16:9), LinkedIn/Facebook (1:1 or 4:5)`;
    } else {
      mediaPromptInstructions = `
MEDIA MODE: ${automationLevel === 'full_auto' ? 'Full Automation' : 'Semi-Automatic'}
- Include detailed "imagePrompt" for image generation${canGenerateImages ? ' (AI will generate automatically)' : ''}
- Include detailed "videoPrompt" for video generation${canGenerateVideos ? (automationLevel === 'full_auto' ? ' (AI will generate automatically)' : ' (user will approve/create)') : ''}
- Make prompts highly detailed for AI generation (scene, composition, lighting, style, mood, colors)
- Include text overlay specifications if needed (keep within platform safe zones)
- Consider platform aspect ratios: Instagram/TikTok (9:16), YouTube (16:9), LinkedIn/Facebook (1:1 or 4:5)`;
    }

    const systemPrompt = `You are an expert social media strategist. Create a focused content plan.

BUSINESS CONTEXT:
Business: ${businessDescription || 'Not specified'}
Goal: ${goal.trim()}
Target audience: ${targetAudience || 'General audience'}
Duration: ${durationDays} days
${brandContext ? `
${brandContext}
Use the brand identity, voice, and preferences above to create highly personalized content that matches the brand's personality.` : ''}

PLATFORM CONFIGURATIONS:
${platformConfigText}

CONTENT TYPE REFERENCE:
- Instagram: 'post', 'reel', 'story', 'carousel'
- YouTube: 'video', 'short'
- TikTok: 'video'
- LinkedIn: 'post', 'carousel'
- Facebook: 'post', 'carousel', 'reel'
- X/Twitter: 'post', 'thread'
- Threads: 'post', 'thread'
- Pinterest: 'pin'
- Bluesky: 'post', 'thread'
${mediaPromptInstructions}

REQUIREMENTS:
1. Create exactly ${postsPerPlatform} posts per platform (${platformBatch.length * postsPerPlatform} total)
2. Use ONLY valid contentType values from the reference above
3. Distribute posts evenly across ${durationDays} days
4. Keep captions concise (under 100 characters for caption ideas)
${includeMediaPrompts ? `5. For visual content types (reel, video, short, story, carousel, pin), include imagePrompt or videoPrompt as appropriate` : ''}

Return ONLY valid JSON:
{
  "strategy": "Brief strategy (1-2 sentences)",
  "weeklyThemes": ["Theme 1", "Theme 2"],
  "posts": [{"day": 1, "platform": "instagram", "time": "09:00", "contentType": "reel", "topic": "Topic", "captionIdea": "Brief caption", "hashtags": ["tag1"]${includeMediaPrompts ? ', "imagePrompt": "Detailed prompt for AI image generation or null", "videoPrompt": "Detailed prompt for AI video generation or null"' : ''}}],
  "tips": ["Tip 1"]
}`;

    // Add 60-second timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    console.log(`[Social AI] Calling OpenAI API for platforms: ${platformBatch.join(', ')}`);
    const startTime = Date.now();
    
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a ${durationDays}-day content plan for: ${platformBatch.join(', ')}` },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`[Social AI] OpenAI API responded in ${elapsed}ms for platforms: ${platformBatch.join(', ')}`);

    if (!response.ok) {
      console.error(`[Social AI] OpenAI API returned status ${response.status}`);
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI service returned empty response');
    }

    // Clean and parse JSON
    let cleanedContent = content.trim();
    cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      strategy: String(parsed.strategy || ''),
      weeklyThemes: Array.isArray(parsed.weeklyThemes) ? parsed.weeklyThemes : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
    };
  }

  // Generate AI content plan based on goals
  app.post('/api/social/ai/generate-plan', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { goal, platforms, duration, startDate: startDateStr, businessDescription, targetAudience } = req.body;
      
      // Parse start date or default to tomorrow
      const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      console.log(`[Social AI] Using start date: ${startDate.toISOString()}`);

      // Validate required fields
      if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
        return res.status(400).json({ message: 'Goal is required' });
      }
      if (!Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({ message: 'At least one platform is required' });
      }

      const validPlatforms = ['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook', 'x', 'threads', 'pinterest', 'bluesky'];
      const filteredPlatforms = platforms.filter((p: string) => validPlatforms.includes(p.toLowerCase()));
      if (filteredPlatforms.length === 0) {
        return res.status(400).json({ message: 'No valid platforms provided' });
      }

      const [profile] = await db
        .select()
        .from(socialProfiles)
        .where(eq(socialProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found. Please initialize your profile first.' });
      }

      // Load Brand Kit for enhanced personalization
      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });
      
      // Use Brand Kit data to enhance the business context if available
      let enhancedBusinessDescription = businessDescription || '';
      let enhancedTargetAudience = targetAudience || '';
      let brandContext = '';
      
      // Content Prefs - defaults
      let automationLevel: 'manual' | 'ai_suggests' | 'semi_auto' | 'full_auto' = 'ai_suggests';
      let featuredMediaTypes: string[] = ['text', 'image'];
      let preferredImageModel = 'flux-kontext';
      let preferredVideoModel = 'wan-2.5';
      
      if (brandKit) {
        console.log(`[Social AI] Using Brand Kit: ${brandKit.name}`);
        
        // Extract brand info
        const overview = brandKit.businessOverview as any || {};
        const demographics = brandKit.customerDemographics as any || {};
        const voice = brandKit.brandVoice as any || {};
        const prefs = brandKit.contentPreferences as any || {};
        
        // Extract AI settings from Content Prefs
        const aiSettings = prefs.aiSettings || {};
        automationLevel = aiSettings.automationLevel || 'ai_suggests';
        featuredMediaTypes = prefs.featuredMediaTypes || ['text', 'image'];
        preferredImageModel = aiSettings.preferredImageModel || 'flux-kontext';
        preferredVideoModel = aiSettings.preferredVideoModel || 'wan-2.5';
        
        console.log(`[Social AI] Automation Level: ${automationLevel}, Featured Media: ${featuredMediaTypes.join(', ')}`);
        console.log(`[Social AI] Preferred Models - Image: ${preferredImageModel}, Video: ${preferredVideoModel}`);
        
        // Enhance business description with brand kit data if not provided
        if (!businessDescription && overview.coreIdentity) {
          enhancedBusinessDescription = `${brandKit.name}: ${overview.coreIdentity}`;
        }
        
        // Enhance target audience with demographics if not provided
        if (!targetAudience && demographics.primarySegments?.length > 0) {
          enhancedTargetAudience = demographics.primarySegments.join(', ');
          if (demographics.ageRange) {
            enhancedTargetAudience += ` (${demographics.ageRange})`;
          }
        }
        
        // Build rich brand context for AI
        brandContext = `
BRAND IDENTITY:
- Brand Name: ${brandKit.name}
- Core Identity: ${overview.coreIdentity || 'Not specified'}
- Primary Positioning: ${overview.primaryPositioning || 'Not specified'}
- Competitive Advantages: ${(overview.competitiveAdvantages || []).join(', ') || 'Not specified'}

BRAND VOICE:
- Tone: ${(voice.tone || []).join(', ') || 'Professional, friendly'}
- Character Traits: ${(voice.character || []).join(', ') || 'Expert, helpful'}
- Emotions to Evoke: ${(voice.emotions || []).join(', ') || 'Trust, confidence'}

TARGET AUDIENCE:
- Segments: ${(demographics.primarySegments || []).join(', ') || 'General audience'}
- Age Range: ${demographics.ageRange || 'All ages'}
- Interests: ${(demographics.interests || []).join(', ') || 'Not specified'}
- Pain Points: ${(demographics.painPoints || []).join(', ') || 'Not specified'}

CONTENT PREFERENCES:
- Featured Media: ${(prefs.featuredMediaTypes || ['text', 'image']).join(', ')}
- Topics to Avoid: ${(prefs.topicsToAvoid || []).join(', ') || 'None'}
`;
      }

      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      
      if (!OPENAI_API_KEY) {
        return res.status(503).json({ message: 'AI content generation is not configured' });
      }

      const durationDays = duration === '1week' ? 7 : duration === '2weeks' ? 14 : 30;

      // OPTIMIZATION: Process platforms in batches to prevent timeout
      // Batch size of 3 platforms keeps each API call under 30 seconds
      const BATCH_SIZE = 3;
      const platformBatches: string[][] = [];
      for (let i = 0; i < filteredPlatforms.length; i += BATCH_SIZE) {
        platformBatches.push(filteredPlatforms.slice(i, i + BATCH_SIZE));
      }

      console.log(`[Social AI] Processing ${filteredPlatforms.length} platforms in ${platformBatches.length} batches`);

      // Process batches sequentially to avoid rate limits
      const allPosts: any[] = [];
      let combinedStrategy = '';
      let combinedThemes: string[] = [];
      let combinedTips: string[] = [];

      for (let i = 0; i < platformBatches.length; i++) {
        const batch = platformBatches[i];
        console.log(`[Social AI] Processing batch ${i + 1}/${platformBatches.length}: ${batch.join(', ')}`);
        
        const batchStartTime = Date.now();
        try {
          const result = await generatePlanForPlatforms(
            batch, 
            durationDays, 
            goal.trim(), 
            enhancedBusinessDescription, 
            enhancedTargetAudience,
            OPENAI_API_KEY,
            brandContext,
            automationLevel,
            featuredMediaTypes
          );
          
          const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
          console.log(`[Social AI] Batch ${i + 1} completed in ${batchDuration}s with ${result.posts.length} posts`);
          
          allPosts.push(...result.posts);
          if (i === 0) {
            combinedStrategy = result.strategy;
            combinedThemes = result.weeklyThemes;
            combinedTips = result.tips;
          } else {
            combinedTips.push(...result.tips.slice(0, 2));
          }
        } catch (batchError: any) {
          const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(1);
          const errorType = batchError.name === 'AbortError' ? 'TIMEOUT' : 'ERROR';
          console.error(`[Social AI] Batch ${i + 1} ${errorType} after ${batchDuration}s:`, batchError.message);
          // Continue with other batches even if one fails
        }
      }

      if (allPosts.length === 0) {
        return res.status(502).json({ message: 'Failed to generate content plan. Please try again with fewer platforms.' });
      }

      const plan = {
        strategy: combinedStrategy || 'AI-generated content strategy',
        weeklyThemes: Array.from(new Set(combinedThemes)).slice(0, 5),
        posts: allPosts,
        tips: Array.from(new Set(combinedTips)).slice(0, 5),
      };

      console.log(`[Social AI] Generated ${allPosts.length} total posts from ${platformBatches.length} batches`);
      console.log(`[Social AI] Post days:`, allPosts.map(p => ({ day: p.day, time: p.time, platform: p.platform })));

      // Save as a goal with the AI-generated plan
      const goalData = {
        socialProfileId: profile.id,
        primaryGoal: goal.trim(),
        postingFrequency: duration === '1week' ? 'daily' : 'weekly',
        brandTopics: plan.weeklyThemes.slice(0, 10),
        targetAudience: targetAudience?.trim() || null,
        preferredPlatforms: filteredPlatforms,
        isActive: true,
      };

      const [newGoal] = await db
        .insert(socialGoals)
        .values(goalData)
        .returning();

      // Create posts from the AI-generated plan
      const postsCreated: any[] = [];
      
      for (const postPlan of plan.posts) {
        try {
          // Calculate the scheduled date based on day number from the start date
          const scheduledDate = new Date(startDate);
          scheduledDate.setDate(startDate.getDate() + (postPlan.day - 1));
          
          // Parse time if provided (format: "09:00" or "14:30")
          if (postPlan.time && typeof postPlan.time === 'string') {
            const [hours, minutes] = postPlan.time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
              scheduledDate.setHours(hours, minutes, 0, 0);
            }
          }

          // Determine the platform and get valid content type
          const targetPlatform = postPlan.platform?.toLowerCase() || filteredPlatforms[0];
          const platformConfig = PLATFORM_CONFIGS[targetPlatform as PlatformType];
          const validContentTypes = platformConfig?.contentTypes.map(ct => ct.id) || ['post'];
          
          // Validate and normalize the content type
          let contentType = postPlan.contentType || 'post';
          if (!validContentTypes.includes(contentType as ContentType)) {
            // Fall back to the first valid content type for this platform
            contentType = validContentTypes[0];
          }
          
          // Determine postType based on content type
          let postType = 'text';
          const contentTypeConfig = platformConfig?.contentTypes.find(ct => ct.id === contentType);
          if (contentTypeConfig) {
            if (contentTypeConfig.requiresMedia) {
              postType = contentTypeConfig.mediaTypes.includes('video') ? 'video' : 'photo';
            }
          }

          const postData = {
            socialProfileId: profile.id,
            postType,
            contentType,
            platforms: [targetPlatform],
            title: postPlan.captionIdea || postPlan.topic || 'AI-generated post',
            description: postPlan.topic || null,
            hashtags: Array.isArray(postPlan.hashtags) ? postPlan.hashtags : [],
            platformSpecificData: postPlan.platformSpecificData || null,
            scheduledAt: scheduledDate,
            status: 'scheduled',
            aiGenerated: true,
            aiPromptUsed: `Goal: ${goal.trim()}`,
            // AI Media Generation fields
            imagePrompt: postPlan.imagePrompt || null,
            videoPrompt: postPlan.videoPrompt || null,
            mediaMode: automationLevel,
            mediaGenerationStatus: automationLevel === 'manual' ? null : 'pending',
          };

          const [createdPost] = await db
            .insert(socialPosts)
            .values(postData)
            .returning();
          
          postsCreated.push({
            id: createdPost.id,
            platform: postData.platforms[0],
            contentType: postData.contentType,
            caption: postData.title,
            scheduledFor: scheduledDate.toISOString(),
            status: 'scheduled',
          });
          
          // For semi_auto and full_auto modes, enqueue media generation jobs
          if ((automationLevel === 'semi_auto' || automationLevel === 'full_auto') && 
              (postPlan.imagePrompt || postPlan.videoPrompt)) {
            try {
              const { enqueueMediaGenerations } = await import('./services/socialMediaGeneration');
              const result = await enqueueMediaGenerations(
                createdPost.id,
                userId,
                automationLevel,
                postPlan.imagePrompt || null,
                postPlan.videoPrompt || null,
                preferredImageModel,
                preferredVideoModel,
                '16:9'
              );
              
              if (result.success) {
                console.log(`[Social AI] Enqueued ${result.jobCount} media generation jobs for post ${createdPost.id}, total credits: ${result.totalCredits}`);
              } else {
                console.warn(`[Social AI] Failed to enqueue media generation for post ${createdPost.id}: ${result.error}`);
              }
            } catch (enqueueError) {
              console.error(`[Social AI] Error enqueueing media generation for post ${createdPost.id}:`, enqueueError);
            }
          }
        } catch (postError) {
          console.error('[Social AI] Error creating post:', postError);
          // Continue with other posts
        }
      }

      console.log(`[Social AI] Created ${postsCreated.length} posts from AI plan`);
      console.log(`[Social AI] Created post dates:`, postsCreated.map(p => ({ id: p.id, scheduledFor: p.scheduledFor })));

      res.json({
        goal: {
          id: newGoal.id,
          goal: newGoal.primaryGoal,
          platforms: newGoal.preferredPlatforms,
          duration,
          status: 'active',
          createdAt: newGoal.createdAt?.toISOString(),
        },
        plan,
        postsCreated: postsCreated.length,
      });
    } catch (error: any) {
      console.error('[Social AI] Plan generation error');
      res.status(500).json({ message: 'Failed to generate plan' });
    }
  });

  // ================================
  // Brand Kit Routes
  // ================================

  // Get or create brand kit for user
  app.get("/api/social/brand-kit", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's social profile
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Get brand kit for this profile
      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      res.json(brandKit);
    } catch (error: any) {
      console.error('[Brand Kit] Get error:', error);
      res.status(500).json({ message: 'Failed to get brand kit' });
    }
  });

  // Create brand kit
  app.post("/api/social/brand-kit", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get or create social profile
      let profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        const [newProfile] = await db
          .insert(socialProfiles)
          .values({ userId, isActive: true })
          .returning();
        profile = newProfile;
      }

      // Check if brand kit already exists
      const existingKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (existingKit) {
        return res.json(existingKit);
      }

      // Create new brand kit
      const [brandKit] = await db
        .insert(socialBrandKits)
        .values({
          socialProfileId: profile.id,
          name: req.body.name || 'My Brand',
        })
        .returning();

      res.json(brandKit);
    } catch (error: any) {
      console.error('[Brand Kit] Create error:', error);
      res.status(500).json({ message: 'Failed to create brand kit' });
    }
  });

  // Update brand kit
  app.patch("/api/social/brand-kit", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get user's social profile
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      // Get brand kit
      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      // Update brand kit
      const updateData: any = {};
      
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.businessOverview !== undefined) updateData.businessOverview = req.body.businessOverview;
      if (req.body.competitors !== undefined) updateData.competitors = req.body.competitors;
      if (req.body.customerDemographics !== undefined) updateData.customerDemographics = req.body.customerDemographics;
      if (req.body.visualIdentityDescription !== undefined) updateData.visualIdentityDescription = req.body.visualIdentityDescription;
      if (req.body.logos !== undefined) updateData.logos = req.body.logos;
      if (req.body.colors !== undefined) updateData.colors = req.body.colors;
      if (req.body.fonts !== undefined) updateData.fonts = req.body.fonts;
      if (req.body.brandVoice !== undefined) updateData.brandVoice = req.body.brandVoice;
      if (req.body.contentPreferences !== undefined) updateData.contentPreferences = req.body.contentPreferences;
      if (req.body.linkedinPersona !== undefined) updateData.linkedinPersona = req.body.linkedinPersona;

      const [updatedKit] = await db
        .update(socialBrandKits)
        .set(updateData)
        .where(eq(socialBrandKits.id, brandKit.id))
        .returning();

      res.json(updatedKit);
    } catch (error: any) {
      console.error('[Brand Kit] Update error:', error);
      res.status(500).json({ message: 'Failed to update brand kit' });
    }
  });

  // Get brand kit materials (website URLs)
  app.get("/api/social/brand-kit/materials", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.json([]);
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.json([]);
      }

      const materials = await db.query.socialBrandMaterials.findMany({
        where: eq(socialBrandMaterials.brandKitId, brandKit.id),
        orderBy: desc(socialBrandMaterials.createdAt),
      });

      res.json(materials);
    } catch (error: any) {
      console.error('[Brand Kit] Get materials error:', error);
      res.status(500).json({ message: 'Failed to get materials' });
    }
  });

  // Add brand kit material
  app.post("/api/social/brand-kit/materials", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      const { name, url, type = 'website', fileType = 'website' } = req.body;

      if (!name || !url) {
        return res.status(400).json({ message: 'Name and URL are required' });
      }

      const [material] = await db
        .insert(socialBrandMaterials)
        .values({
          brandKitId: brandKit.id,
          name,
          url,
          type,
          fileType,
        })
        .returning();

      res.json(material);
    } catch (error: any) {
      console.error('[Brand Kit] Add material error:', error);
      res.status(500).json({ message: 'Failed to add material' });
    }
  });

  // Delete brand kit material
  app.delete("/api/social/brand-kit/materials/:id", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const materialId = req.params.id;
      
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      // Verify material belongs to this brand kit
      const material = await db.query.socialBrandMaterials.findFirst({
        where: and(
          eq(socialBrandMaterials.id, materialId),
          eq(socialBrandMaterials.brandKitId, brandKit.id),
        ),
      });

      if (!material) {
        return res.status(404).json({ message: 'Material not found' });
      }

      await db
        .delete(socialBrandMaterials)
        .where(eq(socialBrandMaterials.id, materialId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Brand Kit] Delete material error:', error);
      res.status(500).json({ message: 'Failed to delete material' });
    }
  });

  // Get brand kit assets
  app.get("/api/social/brand-kit/assets", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.json([]);
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.json([]);
      }

      const assets = await db.query.socialBrandAssets.findMany({
        where: eq(socialBrandAssets.brandKitId, brandKit.id),
        orderBy: desc(socialBrandAssets.createdAt),
      });

      res.json(assets);
    } catch (error: any) {
      console.error('[Brand Kit] Get assets error:', error);
      res.status(500).json({ message: 'Failed to get assets' });
    }
  });

  // Accept a suggested asset (add to library)
  app.post("/api/social/brand-kit/assets/:assetId/accept", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { assetId } = req.params;
      
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      // Verify asset belongs to this brand kit
      const asset = await db.query.socialBrandAssets.findFirst({
        where: and(
          eq(socialBrandAssets.id, assetId),
          eq(socialBrandAssets.brandKitId, brandKit.id),
        ),
      });

      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      await db
        .update(socialBrandAssets)
        .set({ 
          isSuggested: false,
          approvedAt: new Date(),
        })
        .where(eq(socialBrandAssets.id, assetId));

      res.json({ success: true, message: 'Asset added to library' });
    } catch (error: any) {
      console.error('[Brand Kit] Accept asset error:', error);
      res.status(500).json({ message: 'Failed to accept asset' });
    }
  });

  // Dismiss a suggested asset
  app.delete("/api/social/brand-kit/assets/:assetId/dismiss", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { assetId } = req.params;
      
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      // Verify asset belongs to this brand kit and is suggested
      const asset = await db.query.socialBrandAssets.findFirst({
        where: and(
          eq(socialBrandAssets.id, assetId),
          eq(socialBrandAssets.brandKitId, brandKit.id),
        ),
      });

      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      await db
        .delete(socialBrandAssets)
        .where(eq(socialBrandAssets.id, assetId));

      res.json({ success: true, message: 'Asset dismissed' });
    } catch (error: any) {
      console.error('[Brand Kit] Dismiss asset error:', error);
      res.status(500).json({ message: 'Failed to dismiss asset' });
    }
  });

  // Delete an asset from library
  app.delete("/api/social/brand-kit/assets/:assetId", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { assetId } = req.params;
      
      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      const asset = await db.query.socialBrandAssets.findFirst({
        where: and(
          eq(socialBrandAssets.id, assetId),
          eq(socialBrandAssets.brandKitId, brandKit.id),
        ),
      });

      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      await db
        .delete(socialBrandAssets)
        .where(eq(socialBrandAssets.id, assetId));

      res.json({ success: true, message: 'Asset deleted' });
    } catch (error: any) {
      console.error('[Brand Kit] Delete asset error:', error);
      res.status(500).json({ message: 'Failed to delete asset' });
    }
  });

  app.post("/api/social/brand-kit/scan", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: 'URL is required' });
      }

      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: 'Invalid URL format' });
      }

      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      const [scanJob] = await db
        .insert(socialBrandScanJobs)
        .values({
          brandKitId: brandKit.id,
          targetUrl: url,
          status: 'pending',
        })
        .returning();

      await db
        .update(socialBrandKits)
        .set({ scanStatus: 'scanning' })
        .where(eq(socialBrandKits.id, brandKit.id));

      const { processScanJob } = await import('./services/websiteScanner');
      processScanJob(scanJob.id).catch(err => {
        console.error('[Brand Kit] Background scan failed:', err);
      });

      res.json({
        jobId: scanJob.id,
        status: 'pending',
        message: 'Website scan started',
      });
    } catch (error: any) {
      console.error('[Brand Kit] Scan error:', error);
      res.status(500).json({ message: 'Failed to start website scan' });
    }
  });

  app.get("/api/social/brand-kit/scan/:jobId", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { jobId } = req.params;
      const { getScanJobStatus } = await import('./services/websiteScanner');
      const job = await getScanJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Scan job not found' });
      }

      res.json({
        jobId: job.id,
        status: job.status,
        scanResult: job.scanResult,
        error: job.error,
        completedAt: job.completedAt,
      });
    } catch (error: any) {
      console.error('[Brand Kit] Get scan status error:', error);
      res.status(500).json({ message: 'Failed to get scan status' });
    }
  });

  app.post("/api/social/brand-kit/analyze", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      const { analyzeAndApplyBrand } = await import('./services/aiBrandAnalyzer');
      const analysis = await analyzeAndApplyBrand(brandKit.id);

      if (analysis.error) {
        return res.status(500).json({ 
          message: 'AI analysis failed', 
          error: analysis.error 
        });
      }

      res.json({
        success: true,
        message: 'Brand analyzed and updated successfully',
        analysis,
      });
    } catch (error: any) {
      console.error('[Brand Kit] AI analysis error:', error);
      res.status(500).json({ message: 'Failed to analyze brand' });
    }
  });

  app.post("/api/social/content-plans", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { scope } = req.body;

      if (!scope || !['week', 'month'].includes(scope)) {
        return res.status(400).json({ message: 'Invalid scope. Use "week" or "month"' });
      }

      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.status(404).json({ message: 'Social profile not found' });
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found. Please create a brand kit first.' });
      }

      const { createAndSaveContentPlan } = await import('./services/aiSocialStrategist');
      const result = await createAndSaveContentPlan(brandKit.id, scope as 'week' | 'month');

      if (result.plan.error) {
        return res.status(500).json({
          message: 'Failed to generate content plan',
          error: result.plan.error,
        });
      }

      res.json({
        success: true,
        planId: result.planId,
        message: `${scope === 'week' ? '1-Week' : '30-Day'} content plan generated successfully`,
        plan: result.plan,
      });
    } catch (error: any) {
      console.error('[Content Plans] Generation error:', error);
      res.status(500).json({ message: 'Failed to generate content plan' });
    }
  });

  app.get("/api/social/content-plans", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.userId, userId),
      });

      if (!profile) {
        return res.json([]);
      }

      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.socialProfileId, profile.id),
      });

      if (!brandKit) {
        return res.json([]);
      }

      const { getContentPlansForBrandKit } = await import('./services/aiSocialStrategist');
      const plans = await getContentPlansForBrandKit(brandKit.id);

      res.json(plans);
    } catch (error: any) {
      console.error('[Content Plans] List error:', error);
      res.status(500).json({ message: 'Failed to get content plans' });
    }
  });

  app.get("/api/social/content-plans/:id", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { id } = req.params;

      const { getContentPlan } = await import('./services/aiSocialStrategist');
      const plan = await getContentPlan(id);

      if (!plan) {
        return res.status(404).json({ message: 'Content plan not found' });
      }

      res.json(plan);
    } catch (error: any) {
      console.error('[Content Plans] Get error:', error);
      res.status(500).json({ message: 'Failed to get content plan' });
    }
  });

  app.patch("/api/social/content-plans/:id/status", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      if (!['draft', 'approved', 'executing', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const { getContentPlan } = await import('./services/aiSocialStrategist');
      
      // If approving, persist posts to socialPosts table using atomic transaction
      if (status === 'approved') {
        const plan = await getContentPlan(id);
        if (!plan || !plan.plan?.posts) {
          return res.status(404).json({ message: 'Content plan not found' });
        }

        // Get user's social profile first (outside transaction)
        const [profile] = await db
          .select()
          .from(socialProfiles)
          .where(eq(socialProfiles.userId, userId))
          .limit(1);

        if (!profile) {
          return res.status(404).json({ message: 'Social profile not found' });
        }

        // Helper to derive postType from contentType (normalized)
        const getPostType = (contentType: string, hasMedia: boolean): string => {
          const normalized = (contentType || '').toString().trim().toLowerCase();
          const videoTypes = ['video', 'reel', 'short', 'story'];
          const imageTypes = ['image', 'photo', 'carousel', 'pin'];
          
          if (videoTypes.includes(normalized)) return 'video';
          if (imageTypes.includes(normalized)) return 'photo';
          if (hasMedia) return 'photo';
          return 'text';
        };

        // Use atomic update - only transition from draft status to prevent duplicates
        const [statusUpdated] = await db
          .update(aiContentPlans)
          .set({ status: 'approved' })
          .where(and(
            eq(aiContentPlans.id, id),
            eq(aiContentPlans.status, 'draft')
          ))
          .returning();

        if (!statusUpdated) {
          // Already approved or in different state - fetch current and return
          const [current] = await db
            .select()
            .from(aiContentPlans)
            .where(eq(aiContentPlans.id, id))
            .limit(1);
          console.log(`[Content Plans] Plan ${id} not in draft status, current: ${current?.status}`);
          return res.json({ ...current, message: 'Plan already processed' });
        }

        // Status atomically updated - now safe to insert posts
        const postsToCreate = plan.plan.posts.filter(
          (post: any) => post.status === 'pending' || post.status === 'approved'
        );

        console.log(`[Content Plans] Creating ${postsToCreate.length} posts in socialPosts table`);
        let postsCreated = 0;
        let postsSkipped = 0;

        for (const planPost of postsToCreate) {
          // Handle time fallback - default to 12:00 if missing
          const time = planPost.time && planPost.time.match(/^\d{2}:\d{2}$/) ? planPost.time : '12:00';
          const dateStr = `${planPost.date}T${time}:00`;
          const scheduledDate = new Date(dateStr);
          
          // Validate date
          if (isNaN(scheduledDate.getTime())) {
            console.error(`[Content Plans] Invalid date for post: ${dateStr}, skipping`);
            postsSkipped++;
            continue;
          }
          
          try {
            const rawContentType = planPost.contentType || 'post';
            const contentType = rawContentType.toString().trim().toLowerCase();
            const postType = getPostType(contentType, !!planPost.mediaPrompt);
            
            await db.insert(socialPosts).values({
              socialProfileId: profile.id,
              postType,
              contentType,
              platforms: planPost.platforms || [],
              title: planPost.caption,
              description: planPost.mediaPrompt || null,
              hashtags: planPost.hashtags || [],
              scheduledAt: scheduledDate,
              status: 'scheduled',
              aiGenerated: true,
              aiPromptUsed: planPost.mediaPrompt || null,
            });
            postsCreated++;
          } catch (postError: any) {
            console.error(`[Content Plans] Error creating post:`, postError);
            postsSkipped++;
          }
        }

        console.log(`[Content Plans] Plan ${id}: ${postsCreated} posts created, ${postsSkipped} skipped`);
        return res.json({ ...statusUpdated, postsCreated, postsSkipped });
      }

      // For non-approval status updates, just update the status
      const [updated] = await db
        .update(aiContentPlans)
        .set({ status })
        .where(eq(aiContentPlans.id, id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error('[Content Plans] Status update error:', error);
      res.status(500).json({ message: 'Failed to update plan status' });
    }
  });

  app.patch("/api/social/content-plans/:id/posts/:index/status", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { id, index } = req.params;
      const { status } = req.body;

      if (!['pending', 'approved', 'rejected', 'scheduled', 'posted'].includes(status)) {
        return res.status(400).json({ message: 'Invalid post status' });
      }

      const { updatePostStatus } = await import('./services/aiSocialStrategist');
      const [updated] = await updatePostStatus(id, parseInt(index), status);

      res.json(updated);
    } catch (error: any) {
      console.error('[Content Plans] Post status update error:', error);
      res.status(500).json({ message: 'Failed to update post status' });
    }
  });

  app.post("/api/social/content-plans/:id/posts/:index/regenerate", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { id, index } = req.params;

      const { regeneratePlanPost } = await import('./services/aiSocialStrategist');
      const newPost = await regeneratePlanPost(id, parseInt(index));

      if (!newPost) {
        return res.status(500).json({ message: 'Failed to regenerate post' });
      }

      res.json({
        success: true,
        post: newPost,
      });
    } catch (error: any) {
      console.error('[Content Plans] Post regeneration error:', error);
      res.status(500).json({ message: 'Failed to regenerate post' });
    }
  });

  // Delete a content plan
  app.delete("/api/social/content-plans/:id", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify plan exists and belongs to user
      const plan = await db.query.aiContentPlans.findFirst({
        where: eq(aiContentPlans.id, id),
      });

      if (!plan) {
        return res.status(404).json({ message: 'Content plan not found' });
      }

      // Verify user owns this plan via brand kit
      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.id, plan.brandKitId),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.id, brandKit.socialProfileId),
      });

      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Delete the plan
      await db.delete(aiContentPlans).where(eq(aiContentPlans.id, id));

      console.log(`[Content Plans] Deleted plan ${id} for user ${userId}`);
      res.json({ deleted: true, id });
    } catch (error: any) {
      console.error('[Content Plans] Delete error:', error);
      res.status(500).json({ message: 'Failed to delete content plan' });
    }
  });

  // Delete a post from a content plan
  app.delete("/api/social/content-plans/:id/posts/:index", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { id, index } = req.params;
      const postIndex = parseInt(index);
      const userId = req.user.id;

      // Get the plan
      const plan = await db.query.aiContentPlans.findFirst({
        where: eq(aiContentPlans.id, id),
      });

      if (!plan) {
        return res.status(404).json({ message: 'Content plan not found' });
      }

      // Verify user owns this plan
      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.id, plan.brandKitId),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.id, brandKit.socialProfileId),
      });

      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const planData = plan.plan as { posts?: any[] } | null;
      if (!planData?.posts || postIndex < 0 || postIndex >= planData.posts.length) {
        return res.status(404).json({ message: 'Post not found' });
      }

      // Remove the post from the array
      const updatedPosts = [...planData.posts];
      updatedPosts.splice(postIndex, 1);

      // Update the plan
      const [updated] = await db
        .update(aiContentPlans)
        .set({ plan: { ...planData, posts: updatedPosts } })
        .where(eq(aiContentPlans.id, id))
        .returning();

      console.log(`[Content Plans] Deleted post ${postIndex} from plan ${id}`);
      res.json({ deleted: true, plan: updated });
    } catch (error: any) {
      console.error('[Content Plans] Post delete error:', error);
      res.status(500).json({ message: 'Failed to delete post' });
    }
  });

  // Bulk delete posts from a content plan
  app.post("/api/social/content-plans/:id/posts/bulk-delete", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Validate indices with zod
      const bulkDeleteSchema = z.object({
        indices: z.array(z.number().int().min(0)).min(1, 'At least one index required'),
      });

      const parseResult = bulkDeleteSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: 'Invalid request', 
          errors: parseResult.error.flatten().fieldErrors 
        });
      }

      const { indices } = parseResult.data;

      // Get the plan
      const plan = await db.query.aiContentPlans.findFirst({
        where: eq(aiContentPlans.id, id),
      });

      if (!plan) {
        return res.status(404).json({ message: 'Content plan not found' });
      }

      // Verify user owns this plan
      const brandKit = await db.query.socialBrandKits.findFirst({
        where: eq(socialBrandKits.id, plan.brandKitId),
      });

      if (!brandKit) {
        return res.status(404).json({ message: 'Brand kit not found' });
      }

      const profile = await db.query.socialProfiles.findFirst({
        where: eq(socialProfiles.id, brandKit.socialProfileId),
      });

      if (!profile || profile.userId !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const planData = plan.plan as { posts?: any[] } | null;
      if (!planData?.posts) {
        return res.status(404).json({ message: 'No posts in plan' });
      }

      // Sort indices in descending order to remove from end first (preserves indices)
      const sortedIndices = [...indices].sort((a, b) => b - a);
      const updatedPosts = [...planData.posts];
      
      for (const idx of sortedIndices) {
        if (idx >= 0 && idx < updatedPosts.length) {
          updatedPosts.splice(idx, 1);
        }
      }

      // Update the plan
      const [updated] = await db
        .update(aiContentPlans)
        .set({ plan: { ...planData, posts: updatedPosts } })
        .where(eq(aiContentPlans.id, id))
        .returning();

      console.log(`[Content Plans] Deleted ${indices.length} posts from plan ${id}`);
      res.json({ deleted: true, deletedCount: indices.length, plan: updated });
    } catch (error: any) {
      console.error('[Content Plans] Bulk delete error:', error);
      res.status(500).json({ message: 'Failed to bulk delete posts' });
    }
  });

  app.get("/api/social/execution-agent/status", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { getAgentStatus } = await import('./services/contentExecutionAgent');
      const status = getAgentStatus();
      res.json(status);
    } catch (error: any) {
      console.error('[Execution Agent] Status error:', error);
      res.status(500).json({ message: 'Failed to get agent status' });
    }
  });

  app.post("/api/social/execution-agent/start", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { startContentExecutionAgent } = await import('./services/contentExecutionAgent');
      await startContentExecutionAgent();
      res.json({ success: true, message: 'Execution agent started' });
    } catch (error: any) {
      console.error('[Execution Agent] Start error:', error);
      res.status(500).json({ message: 'Failed to start execution agent' });
    }
  });

  app.post("/api/social/execution-agent/stop", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { stopContentExecutionAgent } = await import('./services/contentExecutionAgent');
      await stopContentExecutionAgent();
      res.json({ success: true, message: 'Execution agent stopped' });
    } catch (error: any) {
      console.error('[Execution Agent] Stop error:', error);
      res.status(500).json({ message: 'Failed to stop execution agent' });
    }
  });

  app.post("/api/social/execution-agent/execute-now", requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const { triggerManualExecution, getAgentStatus } = await import('./services/contentExecutionAgent');
      const statusBefore = getAgentStatus();
      
      if (statusBefore.isExecuting) {
        return res.json({ 
          success: false, 
          skipped: true,
          message: 'Execution already in progress',
          results: [],
          postsAttemptedThisRun: statusBefore.postsAttemptedThisRun,
          postsSucceededThisRun: statusBefore.postsSucceededThisRun,
          postsFailedThisRun: statusBefore.postsFailedThisRun,
        });
      }
      
      const results = await triggerManualExecution();
      const statusAfter = getAgentStatus();
      const attemptedCount = statusAfter.postsAttemptedThisRun;
      const successCount = statusAfter.postsSucceededThisRun;
      const failedCount = statusAfter.postsFailedThisRun;
      
      let message = 'No posts to process';
      if (attemptedCount > 0) {
        if (failedCount === 0) {
          message = `Successfully published ${successCount} post${successCount > 1 ? 's' : ''}`;
        } else if (successCount === 0) {
          message = `Failed to publish ${failedCount} post${failedCount > 1 ? 's' : ''}`;
        } else {
          message = `Published ${successCount}, failed ${failedCount}`;
        }
      }
      
      res.json({ 
        success: failedCount === 0,
        skipped: false,
        message,
        results,
        postsAttemptedThisRun: attemptedCount,
        postsSucceededThisRun: successCount,
        postsFailedThisRun: failedCount,
      });
    } catch (error: any) {
      console.error('[Execution Agent] Manual execution error:', error);
      res.status(500).json({ message: 'Failed to execute posts' });
    }
  });

  // ===== SOCIAL HUB ASSETS ROUTES =====
  // These are the user's curated media library for social media content
  
  // Configure multer for file uploads
  const socialHubUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
        'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Allowed: images, videos, and audio files.'));
      }
    }
  });

  // Get user's social hub assets
  app.get("/api/social/hub-assets", requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type, source } = req.query;

      let whereConditions = [
        eq(socialHubAssets.userId, userId),
        eq(socialHubAssets.isActive, true),
      ];

      if (type && ['image', 'video', 'audio'].includes(type)) {
        whereConditions.push(eq(socialHubAssets.type, type));
      }

      if (source && ['imported', 'uploaded', 'ai_generated'].includes(source)) {
        whereConditions.push(eq(socialHubAssets.source, source));
      }

      const assets = await db.query.socialHubAssets.findMany({
        where: and(...whereConditions),
        orderBy: desc(socialHubAssets.createdAt),
      });

      res.json(assets);
    } catch (error: any) {
      console.error('[Social Hub Assets] Get assets error:', error);
      res.status(500).json({ message: 'Failed to get assets' });
    }
  });

  // Upload a new asset to social hub (direct upload to S3)
  app.post("/api/social/hub-assets/upload", requireJWT, socialHubUpload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      if (!isS3Enabled()) {
        return res.status(503).json({ message: 'File storage is not configured. Please contact support.' });
      }

      // Determine asset type from MIME type
      let assetType: 'image' | 'video' | 'audio' = 'image';
      if (file.mimetype.startsWith('video/')) {
        assetType = 'video';
      } else if (file.mimetype.startsWith('audio/')) {
        assetType = 'audio';
      }

      // Upload to S3
      const uploadResult = await uploadBuffer(file.buffer, {
        prefix: 'social-hub-assets' as S3Prefix,
        contentType: file.mimetype,
        filename: `${userId}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
      });

      // Create database record
      const [asset] = await db
        .insert(socialHubAssets)
        .values({
          userId,
          source: 'uploaded',
          type: assetType,
          filename: file.originalname,
          url: uploadResult.signedUrl,
          mimeType: file.mimetype,
          fileSize: file.size,
          title: req.body.title || file.originalname.replace(/\.[^/.]+$/, ''),
          description: req.body.description || null,
          tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [],
        })
        .returning();

      console.log(`[Social Hub Assets] Uploaded ${assetType}: ${asset.id} for user ${userId}`);

      res.json({
        success: true,
        asset,
        message: `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} uploaded successfully`,
      });
    } catch (error: any) {
      console.error('[Social Hub Assets] Upload error:', error);
      if (error.message?.includes('Invalid file type')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: 'Failed to upload asset' });
    }
  });

  // Import asset from main Library to Social Hub
  app.post("/api/social/hub-assets/import", requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { generationId } = req.body;

      if (!generationId) {
        return res.status(400).json({ message: 'Generation ID is required' });
      }

      // Get the generation from main library
      const generation = await db.query.generations.findFirst({
        where: and(
          eq(generations.id, generationId),
          eq(generations.userId, userId),
        ),
      });

      if (!generation) {
        return res.status(404).json({ message: 'Generation not found or access denied' });
      }

      if (generation.status !== 'completed' || !generation.resultUrl) {
        return res.status(400).json({ message: 'Generation must be completed with a result URL' });
      }

      // Check if already imported
      const existing = await db.query.socialHubAssets.findFirst({
        where: and(
          eq(socialHubAssets.userId, userId),
          eq(socialHubAssets.generationId, generationId),
          eq(socialHubAssets.isActive, true),
        ),
      });

      if (existing) {
        return res.status(409).json({ message: 'This asset is already in your Social Hub library', asset: existing });
      }

      // Determine asset type from generation type
      let assetType: 'image' | 'video' | 'audio' = 'image';
      if (['video', 'upscaling'].includes(generation.type) || generation.generationType?.includes('video')) {
        assetType = 'video';
      } else if (['music', 'sound-effect', 'tts'].includes(generation.type)) {
        assetType = 'audio';
      }

      // Create database record linking to the generation
      const [asset] = await db
        .insert(socialHubAssets)
        .values({
          userId,
          source: 'imported',
          generationId: generation.id,
          type: assetType,
          filename: `${generation.model}-${generation.id.slice(0, 8)}`,
          url: generation.resultUrl,
          thumbnailUrl: generation.thumbnailUrl,
          title: generation.prompt?.substring(0, 100) || generation.model,
          description: generation.prompt,
        })
        .returning();

      console.log(`[Social Hub Assets] Imported from Library: ${asset.id} for user ${userId}`);

      res.json({
        success: true,
        asset,
        message: 'Asset imported to Social Hub library',
      });
    } catch (error: any) {
      console.error('[Social Hub Assets] Import error:', error);
      res.status(500).json({ message: 'Failed to import asset' });
    }
  });

  // Bulk import multiple assets from Library
  app.post("/api/social/hub-assets/import-bulk", requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { generationIds } = req.body;

      if (!generationIds || !Array.isArray(generationIds) || generationIds.length === 0) {
        return res.status(400).json({ message: 'At least one generation ID is required' });
      }

      if (generationIds.length > 50) {
        return res.status(400).json({ message: 'Maximum 50 assets can be imported at once' });
      }

      const results = {
        imported: [] as any[],
        skipped: [] as { id: string; reason: string }[],
        failed: [] as { id: string; error: string }[],
      };

      for (const generationId of generationIds) {
        try {
          // Get the generation
          const generation = await db.query.generations.findFirst({
            where: and(
              eq(generations.id, generationId),
              eq(generations.userId, userId),
            ),
          });

          if (!generation) {
            results.skipped.push({ id: generationId, reason: 'Not found or access denied' });
            continue;
          }

          if (generation.status !== 'completed' || !generation.resultUrl) {
            results.skipped.push({ id: generationId, reason: 'Not completed or no result URL' });
            continue;
          }

          // Check if already imported
          const existing = await db.query.socialHubAssets.findFirst({
            where: and(
              eq(socialHubAssets.userId, userId),
              eq(socialHubAssets.generationId, generationId),
              eq(socialHubAssets.isActive, true),
            ),
          });

          if (existing) {
            results.skipped.push({ id: generationId, reason: 'Already imported' });
            continue;
          }

          // Determine asset type
          let assetType: 'image' | 'video' | 'audio' = 'image';
          if (['video', 'upscaling'].includes(generation.type) || generation.generationType?.includes('video')) {
            assetType = 'video';
          } else if (['music', 'sound-effect', 'tts'].includes(generation.type)) {
            assetType = 'audio';
          }

          // Create database record
          const [asset] = await db
            .insert(socialHubAssets)
            .values({
              userId,
              source: 'imported',
              generationId: generation.id,
              type: assetType,
              filename: `${generation.model}-${generation.id.slice(0, 8)}`,
              url: generation.resultUrl,
              thumbnailUrl: generation.thumbnailUrl,
              title: generation.prompt?.substring(0, 100) || generation.model,
              description: generation.prompt,
            })
            .returning();

          results.imported.push(asset);
        } catch (err: any) {
          results.failed.push({ id: generationId, error: err.message });
        }
      }

      console.log(`[Social Hub Assets] Bulk import: ${results.imported.length} imported, ${results.skipped.length} skipped, ${results.failed.length} failed`);

      res.json({
        success: true,
        imported: results.imported.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
        details: results,
      });
    } catch (error: any) {
      console.error('[Social Hub Assets] Bulk import error:', error);
      res.status(500).json({ message: 'Failed to bulk import assets' });
    }
  });

  // Update asset metadata
  app.patch("/api/social/hub-assets/:id", requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { title, description, tags } = req.body;

      const asset = await db.query.socialHubAssets.findFirst({
        where: and(
          eq(socialHubAssets.id, id),
          eq(socialHubAssets.userId, userId),
        ),
      });

      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      const [updated] = await db
        .update(socialHubAssets)
        .set({
          title: title !== undefined ? title : asset.title,
          description: description !== undefined ? description : asset.description,
          tags: tags !== undefined ? (Array.isArray(tags) ? tags : [tags]) : asset.tags,
        })
        .where(eq(socialHubAssets.id, id))
        .returning();

      res.json({ success: true, asset: updated });
    } catch (error: any) {
      console.error('[Social Hub Assets] Update error:', error);
      res.status(500).json({ message: 'Failed to update asset' });
    }
  });

  // Delete asset (soft delete)
  app.delete("/api/social/hub-assets/:id", requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const asset = await db.query.socialHubAssets.findFirst({
        where: and(
          eq(socialHubAssets.id, id),
          eq(socialHubAssets.userId, userId),
        ),
      });

      if (!asset) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      await db
        .update(socialHubAssets)
        .set({ isActive: false })
        .where(eq(socialHubAssets.id, id));

      console.log(`[Social Hub Assets] Deleted (soft): ${id} for user ${userId}`);

      res.json({ success: true, message: 'Asset removed from library' });
    } catch (error: any) {
      console.error('[Social Hub Assets] Delete error:', error);
      res.status(500).json({ message: 'Failed to delete asset' });
    }
  });

  // Get main library generations for import picker
  app.get("/api/social/library-generations", requireJWT, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { type, limit: limitParam } = req.query;
      const limitNum = Math.min(parseInt(limitParam as string) || 50, 100);

      let whereConditions = [
        eq(generations.userId, userId),
        eq(generations.status, 'completed'),
      ];

      // Filter by type if specified
      if (type) {
        const typeFilters: Record<string, string[]> = {
          image: ['image'],
          video: ['video', 'upscaling'],
          audio: ['music', 'sound-effect', 'tts'],
        };
        if (typeFilters[type]) {
          // For simplicity, we'll filter in-memory after fetch
        }
      }

      const gens = await db.query.generations.findMany({
        where: and(...whereConditions),
        orderBy: desc(generations.createdAt),
        limit: limitNum * 2, // Fetch extra to filter
      });

      // Filter by type and only include those with resultUrl
      let filtered = gens.filter(g => g.resultUrl);
      
      if (type === 'image') {
        filtered = filtered.filter(g => !['video', 'upscaling', 'music', 'sound-effect', 'tts'].includes(g.type));
      } else if (type === 'video') {
        filtered = filtered.filter(g => ['video', 'upscaling'].includes(g.type) || g.generationType?.includes('video'));
      } else if (type === 'audio') {
        filtered = filtered.filter(g => ['music', 'sound-effect', 'tts'].includes(g.type));
      }

      // Get already imported IDs
      const importedAssets = await db.query.socialHubAssets.findMany({
        where: and(
          eq(socialHubAssets.userId, userId),
          eq(socialHubAssets.isActive, true),
          eq(socialHubAssets.source, 'imported'),
        ),
        columns: { generationId: true },
      });
      const importedIds = new Set(importedAssets.map(a => a.generationId).filter(Boolean));

      // Mark which ones are already imported
      const result = filtered.slice(0, limitNum).map(g => ({
        ...g,
        alreadyImported: importedIds.has(g.id),
      }));

      res.json(result);
    } catch (error: any) {
      console.error('[Social Hub Assets] Get library generations error:', error);
      res.status(500).json({ message: 'Failed to get library generations' });
    }
  });

  console.log('✓ Social Media Hub routes registered');
}
