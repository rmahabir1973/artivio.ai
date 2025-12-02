import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "./db";
import { storage } from "./storage";
import { requireJWT } from "./jwtMiddleware";
import { getLateService, PLATFORM_DAILY_CAPS, type SocialPlatform, SOCIAL_POSTER_PRICE_ID } from "./getLate";
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
  insertSocialGoalSchema,
  updateSocialGoalSchema,
  insertSocialPostSchema,
  updateSocialPostSchema,
  insertSocialBrandKitSchema,
  insertSocialBrandMaterialSchema,
  insertSocialBrandAssetSchema,
} from "@shared/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
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
      const mappedAccounts = accounts.map(acc => ({
        id: acc.id,
        platform: acc.platform,
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
      }));

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

      const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
      
      if (!DEEPSEEK_API_KEY) {
        return res.status(503).json({ message: 'AI content generation is not configured' });
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error('[Social AI] Deepseek API error');
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

  // Generate AI content plan based on goals
  app.post('/api/social/ai/generate-plan', requireJWT, requireSocialPoster, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { goal, platforms, duration, businessDescription, targetAudience } = req.body;

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

      const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
      
      if (!DEEPSEEK_API_KEY) {
        return res.status(503).json({ message: 'AI content generation is not configured' });
      }

      const durationDays = duration === '1week' ? 7 : duration === '2weeks' ? 14 : 30;

      // Build platform-specific configuration info for AI prompt
      const platformInfo = filteredPlatforms.map((platform: string) => {
        const config = PLATFORM_CONFIGS[platform as PlatformType];
        const contentTypes = getContentTypes(platform as PlatformType);
        const optimalTimes = OPTIMAL_POSTING_TIMES[platform as PlatformType];
        const contentMix = CONTENT_MIX_RECOMMENDATIONS[platform as PlatformType];
        
        if (!config) return null;
        
        // Get valid content types and their descriptions
        const validContentTypes = contentTypes.map(ct => ({
          id: ct.id,
          name: ct.name,
          description: ct.description,
          requiresMedia: ct.requiresMedia
        }));
        
        // Get optimal times for each content type
        const timesInfo = Object.entries(optimalTimes)
          .filter(([_, times]) => (times as string[]).length > 0)
          .map(([type, times]) => `${type}: ${(times as string[]).join(', ')}`);
        
        // Get content mix percentages (non-zero only)
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
  - Recommended Content Mix: ${p.contentMix.join(', ') || 'Equal distribution'}
  - Content Type Details:
${p.contentTypeDetails.map((ct: any) => `    * ${ct.id}: ${ct.description}${ct.requiresMedia ? ' (requires media)' : ''}`).join('\n')}`
      ).join('\n');

      const systemPrompt = `You are an expert social media strategist. Create a detailed, optimized content plan for a business using platform-specific best practices.

BUSINESS CONTEXT:
Business: ${businessDescription || 'Not specified'}
Goal: ${goal.trim()}
Target audience: ${targetAudience || 'General audience'}
Duration: ${durationDays} days

PLATFORM CONFIGURATIONS:
${platformConfigText}

CONTENT TYPE REFERENCE (use ONLY these valid values for contentType):
- Instagram: 'post', 'reel', 'story', 'carousel'
- YouTube: 'video', 'short'
- TikTok: 'video'
- LinkedIn: 'post', 'carousel'
- Facebook: 'post', 'carousel', 'reel'
- X/Twitter: 'post', 'thread'
- Threads: 'post', 'thread'
- Pinterest: 'pin'
- Bluesky: 'post', 'thread'
- Reddit: 'text', 'link', 'post'

REQUIREMENTS:
1. Use the EXACT contentType values from the reference above for each platform
2. Follow the recommended content mix percentages for content type distribution
3. Use the optimal posting times provided for each platform and content type
4. Ensure captions respect the character limits for each platform
5. Distribute posts evenly across the ${durationDays} days
6. Create diverse content that supports the business goal

IMPORTANT: Return ONLY valid JSON without any markdown formatting, code fences, or extra text.

Response format:
{
  "strategy": "Brief overall strategy explanation based on the business goal",
  "weeklyThemes": ["Theme 1", "Theme 2", "Theme 3"],
  "posts": [
    {
      "day": 1,
      "platform": "instagram",
      "time": "09:00",
      "contentType": "reel",
      "topic": "Topic/Theme for this post",
      "captionIdea": "Brief caption idea within platform character limits",
      "hashtags": ["relevant", "hashtags"]
    }
  ],
  "tips": ["Platform-specific tip 1", "Engagement tip 2"]
}`;

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a ${durationDays}-day content plan for the platforms: ${filteredPlatforms.join(', ')}` },
          ],
          temperature: 0.8,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        console.error('[Social AI] Deepseek API error');
        return res.status(502).json({ message: 'AI service temporarily unavailable' });
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return res.status(502).json({ message: 'AI service returned empty response' });
      }

      // Clean markdown fencing and parse JSON
      let cleanedContent = content.trim();
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

      try {
        const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Validate parsed structure
          const plan = {
            strategy: String(parsed.strategy || 'AI-generated content strategy'),
            weeklyThemes: Array.isArray(parsed.weeklyThemes) ? parsed.weeklyThemes : [],
            posts: Array.isArray(parsed.posts) ? parsed.posts : [],
            tips: Array.isArray(parsed.tips) ? parsed.tips : [],
          };
          
          // Save as a goal with the AI-generated plan
          const goalData = {
            socialProfileId: profile.id,
            primaryGoal: goal.trim(),
            postingFrequency: duration === '1week' ? 'daily' : 'weekly',
            brandTopics: plan.weeklyThemes.slice(0, 10), // Limit themes
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
          const today = new Date();
          
          for (const postPlan of plan.posts) {
            try {
              // Calculate the scheduled date based on day number
              const scheduledDate = new Date(today);
              scheduledDate.setDate(today.getDate() + (postPlan.day - 1));
              
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
            } catch (postError) {
              console.error('[Social AI] Error creating post:', postError);
              // Continue with other posts
            }
          }

          console.log(`[Social AI] Created ${postsCreated.length} posts from AI plan`);

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
        } else {
          return res.status(502).json({ message: 'AI response could not be parsed' });
        }
      } catch (parseError) {
        console.error('[Social AI] Plan JSON parse error');
        return res.status(502).json({ message: 'AI response format error' });
      }
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

  console.log('✓ Social Media Hub routes registered');
}
